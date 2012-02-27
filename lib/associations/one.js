module.exports = {
	define: function (orm, Model, model, fields, colParams) {
		var idProperty = colParams && colParams.idProperty ? colParams.idProperty : "id";

		return {
			extend: function (associations) {
				var helper = this;

				Model.hasOne = function () {
					var model = this,
					    association = "association",
					    opts = {};

					for (var i = 0; i < arguments.length; i++) {
						switch (typeof arguments[i]) {
							case "string":
								association = arguments[i];
								break;
							case "function":
								model = arguments[i];
								break;
							case "object":
								opts = arguments[i];
								break;
						}
					}

					associations.push({
						"field" : association,
						"type"  : "one",
						"model" : model,	// this = circular reference
						"opts"  : opts
					});

					helper.create(this, association, model);
				};
			},
			create: function (instance, association, associationModel) {
				var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);

				instance.prototype["get" + camelCaseAssociation] = function () {
					var cb = null, opts = {};

					for (var i = 0; i < arguments.length; i++) {
						switch (typeof arguments[i]) {
							case "object":
								opts = arguments[i];
								break;
							case "function":
								cb = arguments[i];
								break;
						}
					}

					if (this[association + "_id"] > 0) {
						if (this[association]) return cb(this[association]);

						var data = {}, conditions = {};
						data[model + "_id"] = this[idProperty];

						conditions[idProperty] = this[association + "_id"];

						orm._db.selectRecords(associationModel._ORM.collection, {
							"conditions": conditions,
							"callback"	: function (err, data) {
								if (err || !data || data.length == 0) return cb(null);

								(new associationModel(data[0], opts)).ready(cb);
							}
						});
						return;
					}
					cb(null);
				};
				instance.prototype["unset" + camelCaseAssociation] = function (cb) {
					this["set" + camelCaseAssociation](null, cb);
				};
				instance.prototype["set" + camelCaseAssociation] = function (instance, cb) {
					var self = this;

					if (instance === null) {
						self[association + "_id"] = 0;
						delete self[association];

						return cb();
					}

					if (!instance.saved()) {
						instance.save(function (err, savedInstance) {
							if (err) return cb(err);

							self[association + "_id"] = savedInstance[idProperty];
							self[association] = savedInstance;
							cb();
						});
						return;
					}
					self[association + "_id"] = instance[idProperty];
					self[association] = instance;
					cb();
				};
			},
			fetch: function (instance, assoc, opts) {
				if (!(instance[assoc.field + "_id"] > 0
				   && assoc.opts && assoc.opts.hasOwnProperty("autoFetch")
				   && assoc.opts.autoFetch === true
				   && (!opts.hasOwnProperty("fetchDepth") || opts.fetchDepth > 0))) {
					return;
				}
				var camelCaseassoc = assoc.field.substr(0, 1).toUpperCase()
				                         + assoc.field.substr(1),
				    assocOpts = {};

				for (k in opts) {
					switch (k) {
						case "fetchDepth":
							assocOpts.fetchDepth = opts.fetchDepth - 1;
							break;
						default:
							assocOpts[k] = opts[k];
					}
				}

				instance._dataPending += 1;
				instance[assoc.field] = null;
				instance["get" + camelCaseassoc](assocOpts, function (result) {
					instance[assoc.field] = result;

					if (instance._dataPending-- == 1) {
						instance.emit("ready", instance);
					}
				});
			}
		}
	}
}
