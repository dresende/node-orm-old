var ORM = function (db) {
	this._db = db;
};
ORM.prototype.define = function (model, fields, colParams) {
	var orm = this,
	    associations = [];

	var addOneAssociationMethods = function (model, association) {
		var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);
	
		model.prototype["get" + camelCaseAssociation] = function (cb) {
			var self = this;
			
			if (self[association + "_id"] > 0) {
				if (self[association]) {
					cb(self[association]);
					return;
				}
				cb({ "id": null, "description": "need to fetch" });
				return;
			}
			cb(null);
		};
		model.prototype["unset" + camelCaseAssociation] = function (cb) {
			this["set" + camelCaseAssociation](null, cb);
		};
		model.prototype["set" + camelCaseAssociation] = function (instance, cb) {
			var self = this;
			
			if (instance === null) {
				self[association + "_id"] = 0;
				delete self[association];
				cb();
				return;
			}

			if (!instance.saved()) {
				instance.save(function (err, savedInstance) {
					if (err) {
						return cb(err);
					}
					self[association + "_id"] = savedInstance.id;
					self[association] = savedInstance;
					cb();
				});
				return;
			}
			self[association + "_id"] = instance.id;
			self[association] = instance;
			cb();
		};
	};
	var addManyAssociationMethods = function (self, association, field) {
		var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);

		self.prototype["add" + camelCaseAssociation] = function () {
			var instances = [], cb = null;
			var collection = model + "_" + association;
			var data = {};
			data[model + "_id"] = this.id;
			
			for (var i = 0; i < arguments.length; i++) {
				if (typeof arguments[i] == "function") {
					cb = arguments[i];
				} else {
					instances.push(arguments[i]);
				}
			}

			if (instances.length == 0) {
				return cb(null);
			}
					
			var missingInstances = instances.length;

			instances.forEach(function (instance) {
				if (!instance.saved()) {
					instance.save(function (err, savedInstance) {
						if (err) {
							return cb(err);
						}
						data[field + "_id"] = savedInstance.id;
				
						orm._db.saveRecord(collection, data, function (err) {
							if (--missingInstances == 0) {
								cb(null);
							}
						});
					});
					return;
				}
		
				data[field + "_id"] = instance.id;
				orm._db.saveRecord(model + "_" + association, data, function (err) {
					if (--missingInstances == 0) {
						cb(null);
					}
				});
			});
		};

		self.prototype["remove" + camelCaseAssociation] = function () {
			var instances = [], cb = null;
			var collection = model + "_" + association;
			var data = {};
			data[model + "_id"] = this.id;
			
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
				if (typeof instance.id == "undefined" || instance.id == 0) {
					if (--missingInstances == 0) {
						cb(null);
					}
					return;
				}
		
				data[field + "_id"] = instance.id;
				
				orm._db.clearRecords(collection, {
					"conditions"	: data,
					"callback"		: function () {
						if (--missingInstances == 0) {
							cb(null);
						}
					}
				});
			});
		};

		self.prototype["set" + camelCaseAssociation] = function () {
			var instances = [], cb = null;
			var collection = model + "_" + association;
			var data = {};
			data[model + "_id"] = this.id;
			
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
					if (instances.length == 0) {
						return cb(null);
					}
					
					var missingInstances = instances.length;

					instances.forEach(function (instance) {
						if (!instance.saved()) {
							instance.save(function (err, savedInstance) {
								if (err) {
									return cb(err);
								}
								data[field + "_id"] = savedInstance.id;
						
								orm._db.saveRecord(collection, data, function (err) {
									if (--missingInstances == 0) {
										cb(null);
									}
								});
							});
							return;
						}
				
						data[field + "_id"] = instance.id;
						orm._db.saveRecord(model + "_" + association, data, function (err) {
							if (--missingInstances == 0) {
								cb(null);
							}
						});
					});
				}
			});
		};
	};
	var Model = function (data) {
		if (data) {
			for (k in data) {
				if (!data.hasOwnProperty(k)) continue;
				
				if (fields.hasOwnProperty(k)) {
					switch (fields[k].type) {
						case "bool":
						case "boolean":
							data[k] = (data[k] == 1);
							break;
						case "struct":
							if (typeof data[k] == "string") {
								data[k] = (data[k].length > 0 ? JSON.parse(data[k]) : {});
							}
					}
				}

				this[k] = data[k];
			}
		}
		for (k in fields) {
			if (!fields.hasOwnProperty(k)) continue;
			if (!data.hasOwnProperty(k) && fields[k].def) this[k] = fields[k].def;
		}
		for (var i = 0; i < associations.length; i++) {
			switch (associations[i].type) {
				case "one":
					if (!this.hasOwnProperty(associations[i].field + "_id")) {
						this[associations[i].field + "_id"] = 0;
					}
					break;
			}
		}
		
		if (colParams && colParams.methods) {
			for (k in colParams.methods) {
				this[k] = colParams.methods[k];
			}
		}
	};
	Model.prototype.saved = function () {
		return false;
	};
	Model.prototype.save = function (callback) {
		var data = {}, self = this;
		
		if (typeof this.id == "number" && this.id > 0) {
			data.id = this.id;
		}

		for (k in fields) {
			if (!fields.hasOwnProperty(k)) continue;
			
			switch (fields[k].type) {
				case "bool":
				case "boolean":
					data[k] = (this[k] == 1);
					break;
				case "date":
					if (this[k]) {
						data[k] = (this[k].toJSON ? this[k].toJSON() : null);
					} else {
						data[k] = "0000-00-00";
					}
					break;
				case "struct":
					if (this[k]) {
						data[k] = (typeof this[k] == "object" ? JSON.stringify(this[k]) : this[k]);
					} else {
						data[k] = "";
					}
					break;
				default:
					data[k] = this[k];
			}
		}

		for (var i = 0; i < associations.length; i++) {
			switch (associations[i].type) {
				case "one":
					if (this.hasOwnProperty(associations[i].field + "_id")) {
						data[associations[i].field + "_id"] = this[associations[i].field + "_id"];
					}
			}
		}
		
		orm._db.saveRecord(model, data, function (err, id) {
			if (err) {
				if (typeof callback == "function") callback(err);
				return;
			}

			if (!self.id) {
				self.id = id;
			}
			if (typeof callback == "function") callback(null, self);
		});
	};
	Model.hasOne = function (association, otherModel) {
		associations.push({
			"field"	: association,
			"type"	: "one",
			"entity": (!otherModel ? this : otherModel)	// this = circular reference
		});
		addOneAssociationMethods(this, association);
	};
	Model.hasMany = function (association, otherModel, field) {
		associations.push({
			"field"	: association,
			"name"	: field,
			"type"	: "many",
			"entity": (!otherModel ? this : otherModel)	// this = circular reference
		});
		addManyAssociationMethods(this, association, field);
	};
	Model.sync = function () {
		orm._db.createCollection(model, fields, associations);
	};
	Model.get = function (id, callback) {
		orm._db.selectRecords(model, {
			"conditions": { "id": id },
			"callback"	: function (err, data) {
				if (err || data.length == 0) return callback();

				callback(new Model(data[0]));
			}
		});
	};
	Model.find = function () {
		var args = arguments, callback = null, config = {}, last_arg = arguments.length - 1;
		
		if (last_arg >= 0) {
			callback = arguments[last_arg];
			last_arg--;
		}

		//.find(callback);
		//.find(conditions, callback);
		//.find(conditions, limit, callback);
		//.find(conditions, order, callback);
		//.find(conditions, order, limit, callback);
		
		for (var i = 0; i <= last_arg; i++) {
			switch (typeof arguments[i]) {
				case "object": // conditions
					config.conditions = arguments[i];
					break;
				case "number": // limit
					config.limit = arguments[i];
					break;
				case "string": // order
					config.order = arguments[i];
					break;
			}
		}

		if (callback !== null) {
			config.callback = function (err, data) {
				if (err || data.length == 0) return callback();

				for (var i = 0; i < data.length; i++) {
					data[i] = new Model(data[i]);
				}
				callback(data);
			};
		}
		orm._db.selectRecords(model, config);
	};

	return Model;
};

exports.connect = function (uri, callback) {
	var url = require("url"), uri = url.parse(uri);
	
	if (!uri.protocol) {
		return callback(false, { "number": 1, "message": "Protocol not defined" });
	}
	
	var path = require("path"), db_path = __dirname + "/databases/" + uri.protocol.substr(0, uri.protocol.length - 1) + ".js";
	path.exists(db_path, function (exists) {
		if (!exists) {
			return callback(false, { "number": 2, "message": "Protocol not installed" });
		}
		
		var db = require(db_path);
		
		db.connect(uri, function (success, info) {
			if (!success) {
				return callbak(false, info);
			}
			
			return callback(true, new ORM(info));
		});
	});
};
