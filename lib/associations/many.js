var model, fields, colParams;

module.exports = {
	define: function (orm, Model, model, fields, colParams) {
		var idProperty = colParams && colParams.idProperty ? colParams.idProperty : "id";

		return {
			extend: function (associations) {
				var helper = this;

				Model.hasMany = function () {
					var model = this,
					    association = null,
					    field = "",
					    opts = {};

					for (var i = 0; i < arguments.length; i++) {
						switch (typeof arguments[i]) {
							case "string":
								if (association === null) {
									association = arguments[i];
								}
								field = arguments[i];
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
						"name"  : field,
						"type"  : "many",
						"model" : model,         // this = circular reference
						"opts"  : opts
					});

					helper.create(this, association, field, model);
				};
			},
			create: function (instance, association, field, associationModel) {
				var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);
				var collection = model + "_" + association;

				instance.prototype["add" + camelCaseAssociation] = function () {
					var instances = [], cb = null;
					var data = {};
					data[model + "_id"] = this[idProperty];

					for (var i = 0; i < arguments.length; i++) {
						if (typeof arguments[i] == "function") {
							cb = arguments[i];
						} else {
							instances.push(arguments[i]);
						}
					}

					if (instances.length == 0) {
						throw { "message": "No " + camelCaseAssociation + " were given" };
					}

					var missingInstances = instances.length;

					instances.forEach(function (instance) {
						if (!instance.saved()) {
							instance.save(function (err, savedInstance) {
								if (err) return cb(err);

								data[field + "_id"] = savedInstance[idProperty];

								orm._db.saveRecord(null, collection, data, function (err) {
									if (--missingInstances == 0) cb(null);
								});
							});
							return;
						}

						data[field + "_id"] = instance[idProperty];
						orm._db.saveRecord(null, collection, data, function (err) {
							if (--missingInstances == 0) cb(null);
						});
					});
				};

				instance.prototype["remove" + camelCaseAssociation] = function () {
					var instances = [],
					    cb = null,
					    data = {};

					data[model + "_id"] = this[idProperty];

					for (var i = 0; i < arguments.length; i++) {
						if (typeof arguments[i] == "function") {
							cb = arguments[i];
						} else {
							instances.push(arguments[i]);
						}
					}

					if (instances.length == 0) {
						orm._db.clearRecords(collection, {
							"conditions"	: data,
							"callback"		: function () {
								cb(null);
							}
						});
						return;
					}

					var missingInstances = instances.length;

					instances.forEach(function (instance) {
						if (typeof instance[idProperty] == "undefined" || instance[idProperty] == 0) {
							if (--missingInstances == 0) cb(null);
							return;
						}

						data[field + "_id"] = instance[idProperty];

						orm._db.clearRecords(collection, {
							"conditions"	: data,
							"callback"		: function () {
								if (--missingInstances == 0) cb(null);
							}
						});
					});
				};

				instance.prototype["set" + camelCaseAssociation] = function () {
					var instances = [],
					    cb = null,
					    data = {};

					data[model + "_id"] = this[idProperty];

					for (var i = 0; i < arguments.length; i++) {
						if (typeof arguments[i] == "function") {
							cb = arguments[i];
						} else {
							instances.push(arguments[i]);
						}
					}

					orm._db.clearRecords(collection, {
						"conditions"	: data,
						"callback"		: function () {
							if (instances.length == 0) return cb(null);

							var missingInstances = instances.length;

							instances.forEach(function (instance) {
								if (!instance.saved()) {
									instance.save(function (err, savedInstance) {
										if (err) return cb(err);

										data[field + "_id"] = savedInstance[idProperty];

										orm._db.saveRecord(null, collection, data, function (err) {
											if (--missingInstances == 0) cb(null);
										});
									});
									return;
								}

								data[field + "_id"] = instance[idProperty];
								orm._db.saveRecord(null, collection, data, function (err) {
									if (--missingInstances == 0) cb(null);
								});
							});
						}
					});
				};

				instance.prototype["get" + camelCaseAssociation] = function () {
					var cb = null,
					    opts = {},
					    items = [],
					    conditions = {};

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

					conditions[model + "_id"] = this[idProperty];

					orm._db.selectRecords(collection, {
						"conditions": conditions,
						"callback"	: function (err, data) {
							if (err) return cb(null);
							if (data.length == 0) return cb([]);

							var ids = [], conditions = {};
							for (var i = 0; i < data.length; i++) {
								ids.push(data[i][field + "_id"]);
							}

							conditions[idProperty] = ids;

							orm._db.selectRecords(associationModel._ORM.collection, {
								"conditions": conditions,
								"callback"	: function (err, data) {
									if (err) return cb(null);

									var pending = data.length;

									for (var i = 0; i < data.length; i++) {
										data[i] = new associationModel(data[i], opts);
										data[i].ready(function () {
											if (pending-- == 1) {
												cb(data);
											}
										});
									}
								}
							});
						}
					});
				};
			},
			fetch: function (instance, assoc, opts) {
				if (!(assoc.opts && assoc.opts.hasOwnProperty("autoFetch")
				    && assoc.opts.autoFetch === true
				    && (!opts.hasOwnProperty("fetchDepth") || opts.fetchDepth > 0))) {
					return;
				}
				var camelCaseAssociation = assoc.field.substr(0, 1).toUpperCase()
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
				instance[assoc.field] = [];
				instance["get" + camelCaseAssociation](assocOpts, function (result) {
					instance[assoc.field] = result;

					if (instance._dataPending-- == 1) {
						instance.emit("ready", instance);
					}
				});
			}
		}
	}
}
