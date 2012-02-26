module.exports = {
	extend: function (Model) {
		Model._eventListeners = {};

		Model.on = function (ev, cb) {
			if (!this._eventListeners.hasOwnProperty(ev)) {
				this._eventListeners[ev] = [];
			}
			this._eventListeners[ev].push(cb);
			return this;
		};
		Model.emit = function () {
			var args = Array.prototype.slice.call(arguments),
			    ev = args.splice(0, 1);
			
			if (!this._eventListeners.hasOwnProperty(ev)) return;

			for (var i = 0; i < this._eventListeners[ev].length; i++) {
				this._eventListeners[ev][i].call(this, args);
			}
			//console.log("event '%s'", ev, args);
		};
	}
}