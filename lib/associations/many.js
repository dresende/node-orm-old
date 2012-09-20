module.exports = {
	define: function (orm, Model, model, fields, colParams, plugins) {
		var idProperty = colParams && colParams.idProperty ? colParams.idProperty : "id";

		return {
			extend: function (associations) {
				var helper = this;

				Model.hasMany = function () {
					var model = this;
					var association = null;
					var field = "";
					var opts = {};

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

					helper.create(this, association, field, model, opts);
				};
			},
			create: function (instance, association, field, associationModel, associationOpts) {
				var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);
				var collection = associationOpts.collection ? associationOpts.collection : model + "_" + association;

				instance.prototype["add" + camelCaseAssociation] = function () {
					var instances = [], cb = null;
					var data = {}, extra = {};
					data[model + "_id"] = this[idProperty];

					for (var i = 0; i < arguments.length; i++) {
						switch (typeof arguments[i]) {
							case "function":
								cb = arguments[i];
								break;
							case "object":
								if (arguments[i].hasOwnProperty("_dataPending")) {
									instances.push(arguments[i]);
								} else {
									extra = arguments[i];
								}
								break;
							default:
						}
					}

					for (var k in extra) {
						data[k] = extra[k];
					}

					if (instances.length === 0) {
						throw { "message": "No " + camelCaseAssociation + " were given" };
					}

					var missingInstances = instances.length;

					instances.forEach(function (instance) {
						if (!instance.saved()) {
							instance.save(function (err, savedInstance) {
								if (err) return cb(err);

								data[field + "_id"] = savedInstance[idProperty];

								orm._db.saveRecord(null, collection, data, function (err) {
									if (plugins.hasOwnProperty("afterSave")) {
										for (var k in plugins["afterSave"]) {
											plugins["afterSave"][k](data, Model);
										}
									}
									if (--missingInstances === 0) cb(null);
								});
							});
							return;
						}

						data[field + "_id"] = instance[idProperty];
						orm._db.saveRecord(null, collection, data, function (err) {
							if (plugins.hasOwnProperty("afterSave")) {
								for (var k in plugins["afterSave"]) {
									plugins["afterSave"][k](data, Model);
								}
							}
							if (--missingInstances === 0) cb(null);
						});
					});
				};

				instance.prototype["remove" + camelCaseAssociation] = function () {
					var instances = [];
					var cb = null;
					var data = {};

					data[model + "_id"] = this[idProperty];

					for (var i = 0; i < arguments.length; i++) {
						if (typeof arguments[i] == "function") {
							cb = arguments[i];
						} else {
							instances.push(arguments[i]);
						}
					}

					if (instances.length === 0) {
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
						if (typeof instance[idProperty] == "undefined" || instance[idProperty] === 0) {
							if (--missingInstances === 0) cb(null);
							return;
						}

						data[field + "_id"] = instance[idProperty];

						orm._db.clearRecords(collection, {
							"conditions"	: data,
							"callback"		: function () {
								if (--missingInstances === 0) cb(null);
							}
						});
					});
				};

				instance.prototype["set" + camelCaseAssociation] = function () {
					var instances = [];
					var cb = null;
					var data = {};

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
							if (instances.length === 0) return cb(null);

							var missingInstances = instances.length;

							instances.forEach(function (instance) {
								if (!instance.saved()) {
									instance.save(function (err, savedInstance) {
										if (err) return cb(err);

										data[field + "_id"] = savedInstance[idProperty];

										orm._db.saveRecord(null, collection, data, function (err) {
											if (--missingInstances === 0) cb(null);
										});
									});
									return;
								}

								data[field + "_id"] = instance[idProperty];
								orm._db.saveRecord(null, collection, data, function (err) {
									if (--missingInstances === 0) cb(null);
								});
							});
						}
					});
				};

				instance.prototype["get" + camelCaseAssociation] = function () {
					var cb = null;
					var opts = {};

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

					orm._db.selectRecords(associationModel._ORM.collection, {
						"rel": [{
							collection: collection,
							rel: [ "id", field + "_id", model + "_id" ],
							value: this[idProperty]
						}],
						"conditions": {},
						"callback"	: function (err, data) {
							if (err) return cb(null);

							var pending = data.length;
							var checkDone = function () {
								if (pending-- == 1) {
									cb(data);
								}
							};

							for (var i = 0; i < data.length; i++) {
								data[i] = new associationModel(data[i], opts);
								data[i].ready(checkDone);
							}
						}
					});

					return this;
				};

				if (associationOpts.link && associationOpts.link.length) {
					var associationLink = associationOpts.link;

					associationModel.prototype["get" + associationLink] = function () {
						var cb = null;
						var conditions = {};

						for (var i = 0; i < arguments.length; i++) {
							switch (typeof arguments[i]) {
								case "object":
									conditions = arguments[i];
									break;
								case "function":
									cb = arguments[i];
									break;
							}
						}

						orm._db.selectRecords(Model._ORM.collection, {
							"rel": [{
								collection: collection,
								rel: [ "id", model + "_id", field + "_id" ],
								value: this[idProperty]
							}],
							"conditions": conditions,
							"callback"	: function (err, data) {
								if (err) return cb(null);

								var pending = data.length;
								var checkDone = function () {
									if (pending-- == 1) {
										cb(data);
									}
								};

								for (var i = 0; i < data.length; i++) {
									data[i] = new Model(data[i]);
									data[i].ready(checkDone);
								}
							}
						});
					};
				}
			},
			fetch: function (instance, assoc, opts) {
				if (!(assoc.opts &&
					assoc.opts.hasOwnProperty("autoFetch") &&
					assoc.opts.autoFetch === true &&
					(!opts.hasOwnProperty("fetchDepth") || opts.fetchDepth > 0))) {
					return;
				}
				var camelCaseAssociation = assoc.field.substr(0, 1).toUpperCase() + assoc.field.substr(1);
				var assocOpts = {};

				for (var k in opts) {
					if (k == "fetchDepth") {
						assocOpts.fetchDepth = opts.fetchDepth - 1;
					} else {
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
		};
	}
};
