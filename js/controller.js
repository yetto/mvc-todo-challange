(function (window) {
	'use strict';

	/**
	 * Takes a model and view and acts as the controller between them
	 *
	 * @constructor
	 * @param {object} model The model instance
	 * @param {object} view The view instance
	 */
	function Controller(model, view) {
		var that = this;
		that.model = model;
		that.view = view;

		that.view.bind('newTodo', function (title) {
			console.log("newTodo");
			that.addItem(title);
		});

		that.view.bind('itemEdit', function (item) {
			console.log("itemEdit");
			that.editItem(item.id);
		});

		that.view.bind('itemEditDone', function (item) {
			console.log("itemEditDone");
			that.editItemSave(item.id, item.title);
		});

		that.view.bind('itemEditCancel', function (item) {
			console.log("itemEditCancel");
			that.editItemCancel(item.id);
		});

		that.view.bind('itemRemove', function (item) {
			console.log("itemRemove");
			that.removeItem(item.id);
		});

		that.view.bind('setAsDone', function (item) {
			console.log("#Controller > setAsDone",item.id);
			that.setAsDone(item.id,item.checked);
		});

		that.view.bind('clearCompleted', function (item) {
			console.log("#Controller > clear-completed");
			that.clearCompleted();
		});

	}

	/**
	 * Loads and initialises the view
	 *
	 * @param {string} '' | 'active' | 'completed'
	 */
	Controller.prototype.setView = function (locationHash) {
		console.log("#Controller > setView [locationHash]",locationHash);
		var route = locationHash.split('/')[1];
		var page = route || '';
		this._updateFilterState(page);
	};

	/**
	 * An event to fire on load. Will get all items and display them in the
	 * todo-list
	 */
	Controller.prototype.showAll = function () {
		console.log("#Controller > showAll");
		var that = this;
		that.model.read(function (data) {
			that.view.render('showEntries', data);
		});
	};

	/**
	 * Renders all active tasks
	 */
	Controller.prototype.showActive = function () {
		console.log("#Controller > showActive");
		var that = this;
		that.model.read({done:false},function (data) {
			that.view.render('showEntries', data);
		});
	};

	/**
	 * Renders all active tasks
	 */
	Controller.prototype.showCompleted = function () {
		console.log("#Controller > showCompleted");
		var that = this;
		that.model.read({done:true},function (data) {
			that.view.render('showEntries', data);
		});
	};

	/**
	 * Removes all completed tasks and re-renders
	 */
	Controller.prototype.clearCompleted = function () {
		console.log("#Controller > clearCompleted");
		var that = this;
		that.model.read({done:true},onRead);
		function onRead(data){
			console.log("#Controller > clearCompleted > onRead");
			data.forEach(function(item){
				console.log("......Removing",item.id);
				that.model.remove(item.id);
			});
			that.model.read({done:true},onRemove);
		};
		function onRemove(data){
			console.log("#Controller > clearCompleted > onRemove");
			that.view.render('showEntries', data);
			that._updateCount();
		};
	};


	/**
	 * An event to fire whenever you want to add an item. Simply pass in the event
	 * object and it'll handle the DOM insertion and saving of the new item.
	 */
	Controller.prototype.addItem = function (title) {
		var that = this;

		if (title.trim() === '') {
			return;
		}

		that.model.create(title, null, function () {
			that.view.render('clearNewTodo');
			that._filter(true);
		});
	};

	/*
	 * Triggers the item editing mode.
	 */
	Controller.prototype.editItem = function (id) {
		var that = this;
		that.model.read(id, function (data) {
			that.view.render('editItem', {id: id, title: data[0].title});
		});
	};

	/*
	 * Finishes the item editing mode successfully.
	 */
	Controller.prototype.editItemSave = function (id, title) {
		var that = this;
		if (title.trim()) {
			that.model.update(id, {title: title}, function () {
				that.view.render('editItemDone', {id: id, title: title});
			});
		} else {
			that.removeItem(id);
		}
	};

	/*
	 * Cancels the item editing mode.
	 */
	Controller.prototype.editItemCancel = function (id) {
		var that = this;
		that.model.read(id, function (data) {
			that.view.render('editItemDone', {id: id, title: data[0].title});
		});
	};

	/**
	 * By giving it an ID it'll find the DOM element matching that ID,
	 * remove it from the DOM and also remove it from storage.
	 *
	 * @param {number} id The ID of the item to remove from the DOM and
	 * storage
	 */
	Controller.prototype.removeItem = function (id) {
		var that = this;
		that.model.remove(id, function () {
			that.view.render('removeItem', id);
		});

		that._filter();
	};

	/**
	 * By giving it an ID it'll find the DOM element matching that ID,
	 * then it will find .toggle and set the input as checked.
	 *
	 * @param {number} id The ID of the input to mark as checked from the
	 * DOM and storage
	 */
	Controller.prototype.setAsDone = function (id,done) {
		var that = this;

		that.model.update(id, {done:done}, function (data) {
			console.log("that.model.update, callback",done);
			that.view.render('setAsDone',{id:id,done:done});
		},id);

		that._filter();

	};

	/**
	 * Updates the pieces of the page which change depending on the remaining
	 * number of todos.
	 */
	Controller.prototype._updateCount = function () {
		var that = this;
		that.model.getCount(function (todos) {
			that.view.render('updateElementCount', todos);
			that.view.render('contentBlockVisibility', {visible: todos.total > 0});
		});
	};

	/**
	 * Re-filters the todo items, based on the active route.
	 * @param {boolean|undefined} force  forces a re-painting of todo items.
	 */
	Controller.prototype._filter = function (force) {
		console.log("#Controller > _filter [force]:",force);
		var activeRoute = this._activeRoute.charAt(0).toUpperCase() + this._activeRoute.substr(1);

		this._updateCount();

		// If the last active route isn't "All", or we're switching routes, we
		// re-create the todo item elements, calling:
		//   this.show[All|Active]();
		if (force || this._lastActiveRoute !== 'All' || this._lastActiveRoute !== activeRoute) {
			try{
				this['show' + activeRoute]();
			}catch(e){
				if (window.ENV_DEV) console.error(e);
				console.warn("Bad route");
				return false;
			}
		}

		this._lastActiveRoute = activeRoute;
	};

	/**
	 * Simply updates the filter nav's selected states
	 */
	Controller.prototype._updateFilterState = function (currentPage) {
		console.log("#Controller > _updateFilterState [currentPage]",currentPage);
		// Store a reference to the active route, allowing us to re-filter todo
		this._activeRoute = currentPage;

		if (currentPage === '') {
			this._activeRoute = 'All';
		}

		this._filter();

		this.view.render('setFilter', currentPage);
	};

	// Export to window
	window.app = window.app || {};
	window.app.Controller = Controller;
})(window);
