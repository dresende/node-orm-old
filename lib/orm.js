var crypto = require("crypto"),
    util = require("util"),
    events = require("events"),
    db_alias = require("./database-alias");

function ORM(db) {
	this._db = db;
	this._models = {};
}
ORM.prototype.model = function (model) {
	return this._models.hasOwnProperty(model) ? this._models[model] : null;
};
ORM.prototype.end = function () {
	this._db.end();
};
ORM.prototype.getConnection = function () {
	return this._db;
};
ORM.prototype.getClient = function () {
	return this._db.getClient();
};
ORM.prototype.define = function (model, fields, colParams) {
	var orm = this,
	    associations = [],
	    associationHelpers = {},
	    idProperty = colParams && colParams.idProperty ? colParams.idProperty : "id";

	var Model = function (data, opts) {
		events.EventEmitter.call(this);

		this._dataPending = 0;
		this._dataHash = null;

		data || (data = {});
		opts || (opts = {});

		for (var k in fields) {
			if (!fields.hasOwnProperty(k)) {
				continue;
			}
			if (!data.hasOwnProperty(k) && fields[k].hasOwnProperty("def")) {
				this[k] = fields[k].def;
			}
		}

		for (k in data) {
			if (!data.hasOwnProperty(k)) continue;

			if (!fields.hasOwnProperty(k) && k != idProperty) {
				// this was wrong, I don't think we should preserve
				// undescribed properties
				//this[k] = data[k];
				continue;
			}

			if (k == idProperty) {
				// fixed property
				Object.defineProperty(this, idProperty, {
					"value": data[idProperty],
					"enumerable": true
				});
				continue;
			}

			switch (fields[k].type) {
				case "bool":
				case "boolean":
					data[k] = (data[k] == 1 || data[k] === true);
					break;
				case "struct":
				case "object":
					if (typeof data[k] == "string") {
						try {
							data[k] = (data[k].length > 0 ? JSON.parse(data[k]) : {});
						} catch (e) {
							data[k] = {};
						}
					}
					break;
				default:
					if (typeof fields[k].type == "function") {
						try {
							data[k] = new (fields[k].type)(data[k]);
						} catch (e) {
							data[k] = undefined;
						}
					}
			}

			this[k] = data[k];
		}

		for (var i = 0; i < associations.length; i++) {
			switch (associations[i].type) {
				case "one":
					if (!this.hasOwnProperty(associations[i].field + "_id")) {
						if (!data.hasOwnProperty(associations[i].field + "_id")) {
							data[associations[i].field + "_id"] = 0;
						}
						this[associations[i].field + "_id"] = data[associations[i].field + "_id"];
					}
					associationHelpers.one.fetch(this, associations[i], opts);
					break;
				case "many":
					associationHelpers.many.fetch(this, associations[i], opts);
					break;
			}
		}

		if (colParams && colParams.methods) {
			for (k in colParams.methods) {
				this[k] = data[k] = colParams.methods[k];
			}
		}

		this._dataHash = require("./hash").hash(data);

		if (this._dataPending === 0) {
			this.emit("ready", this);
		}
	};
	// this adds events to instances
	util.inherits(Model, events.EventEmitter);

	associationHelpers.one = require("./associations/one").define(orm, Model, model, fields, colParams);
	associationHelpers.many = require("./associations/many").define(orm, Model, model, fields, colParams);

	// this adds events to object
	require("./events").extend(Model);

	Model.prototype._getData = function () {
		var data = {};

		if (this.hasOwnProperty(idProperty)) {
			data[idProperty] = this[idProperty];
		}

		for (var k in fields) {
			if (!fields.hasOwnProperty(k)) continue;

			// don't set default values, if property is not set, ignore it
			if (!this.hasOwnProperty(k)) continue;

			switch (fields[k].type) {
				case "bool":
				case "boolean":
					data[k] = (this[k] == 1);
					break;
				case "date":
					if (this[k]) {
						data[k] = (this[k].toJSON ? this[k].toJSON() : "0000-00-00");
					} else {
						data[k] = "0000-00-00";
					}
					break;
				case "struct":
				case "object":
					if (this[k]) {
						data[k] = (typeof this[k] == "object" ? JSON.stringify(this[k]) : this[k]);
					} else {
						data[k] = "";
					}
					break;
				default:
					data[k] = (this[k] && this[k].hasOwnProperty("toString") ? this[k].toString() : this[k]);
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

		return data;
	};
	Model.prototype.ready = function (cb) {
		if (typeof cb == "function") {
			if (this._dataPending === 0) {
				cb(this);
			} else {
				this.once("ready", cb);
			}

			return this;
		}

		return (this._pending === 0);
	};
	Model.prototype.saved = function () {
		return (this._dataHash == require("./hash").hash(this._getData()));
	};
	Model.prototype.created = function () {
		return this.hasOwnProperty(idProperty);
	};
	Model.prototype.save = function () {
		var callback = function () {}, opts = {}, data = {}, self = this;
		var validators = [];
		var saveRecord = function () {
			orm._db.saveRecord(idProperty, model, data, function (err, id) {
				if (err) {
					if (colParams && colParams.hooks && typeof colParams.hooks.afterSave == "function") {
						colParams.hooks.afterSave(false, self);
					}
					if (typeof callback == "function") {
						callback(err);
					}
					return;
				}

				if (!self[idProperty]) self[idProperty] = id;

				if (colParams && colParams.hooks && typeof colParams.hooks.afterSave == "function") {
					colParams.hooks.afterSave(true, self);
				}

				if (typeof callback == "function") {
					callback(null, self);
				}
			});
		};

		for (var i = 0; i < arguments.length; i++) {
			if (typeof arguments[i] == "function") {
				callback = arguments[i];
			} else if (typeof arguments[i] == "object") {
				opts = arguments[i] || {}; // avoid null (yes, it's an object)
			}
		}

		data = this._getData();

		if (colParams && colParams.validations) {
			for (var field in colParams.validations) {
				if (!colParams.validations.hasOwnProperty(field) || !data.hasOwnProperty(field)) continue;

				if (typeof colParams.validations[field] === "function") {
					validators.push([ field, data[field], colParams.validations[field] ]);
				} else if (Array.isArray(colParams.validations[field])) {
					for (i = 0; i < colParams.validations[field].length; i++) {
						validators.push([ field, data[field], colParams.validations[field][i] ]);
					}
				}
			}
		}

		for (var k in fields) {
			if (!fields.hasOwnProperty(k)) continue;
			if (!fields[k].hasOwnProperty("validations")) continue;

			if (typeof fields[k].validations === "function") {
				validators.push([ k, data[k], fields[k].validations ]);
			} else if (Array.isArray(fields[k].validations)) {
				for (i = 0; i < fields[k].validations.length; i++) {
					validators.push([ k, data[k], fields[k].validations[i] ]);
				}
			}
		}

		if (validators.length > 0) {
			var validatorIndex = 0, errors = [];
			var validatorNext = function (response) {
				if (typeof response == "undefined" || response === true) {
					validatorIndex++;
					return callNextValidator();
				}
				errors.push({
					"type": "validator",
					"field": validators[validatorIndex][0],
					"value": validators[validatorIndex][1],
					"msg": response
				});
				if (opts.validateAll) {
					validatorIndex++;
					return callNextValidator();
				}
				return callback(errors[0]);
			};
			var callNextValidator = function () {
				if (validatorIndex >= validators.length) {
					if (opts.validateAll && errors.length > 0) {
						return callback(errors);
					}

					if (colParams && colParams.hooks && typeof colParams.hooks.beforeSave == "function") {
						colParams.hooks.beforeSave(self);
					}
					return saveRecord();
				}
				validators[validatorIndex][2].apply(self, [ validators[validatorIndex][1], validatorNext, data, Model, validators[validatorIndex][0] ]);
			};
			return callNextValidator();
		}

		if (colParams && colParams.hooks && typeof colParams.hooks.beforeSave == "function") {
			colParams.hooks.beforeSave(self);
		}

		return saveRecord();
	};
	Model.prototype.remove = function (callback) {
		if (this.hasOwnProperty(idProperty)) {
			var self = this,
			    conditions = {};

			conditions[idProperty] = this[idProperty];

			orm._db.clearRecords(model, {
				"conditions": conditions,
				"callback": function (err, info) {
					/*
						The object will still have all properties and you can save() later
						if you want (a new ID should be assigned)
					*/
					delete self[idProperty];

					if (typeof callback == "function") callback(!err);
				}
			});
			return;
		}
		// no id so nothing to "unsave"
		if (typeof callback == "function") callback(true);
	};

	associationHelpers.one.extend(associations);
	associationHelpers.many.extend(associations);

	Model.sync = function () {
		orm._db.createCollection(model, fields, associations);
	};
	Model.clear = function (callback) {
		orm._db.clearRecords(model, {
			"callback": function (err, info) {
				if (typeof callback == "function") callback(!err);
			}
		});
	};
	Model.get = function (id, callback) {
		var modelOpts = {},
		    conditions = {};

		if (colParams.hasOwnProperty("fetchDepth")) {
			modelOpts.fetchDepth = colParams.fetchDepth;
		}

		conditions[idProperty] = id;

		orm._db.selectRecords(model, {
			"conditions": conditions,
			"callback"	: function (err, data) {
				if (err || data.length === 0) return callback(null);

				(new Model(data[0], modelOpts)).ready(callback);
			}
		});
	};
	Model.find = function () {
		var args = arguments,
		    callback = null,
		    config = {},
		    last_arg = arguments.length - 1,
		    modelOpts = {};

		if (last_arg >= 0 && typeof arguments[last_arg] == "function") {
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

		if (colParams.hasOwnProperty("fetchDepth")) {
			modelOpts.fetchDepth = colParams.fetchDepth;
		}

		if (callback !== null) {
			config.callback = function (err, data) {
				if (err || data.length === 0) return callback(null);

				var pending = data.length;

				for (var i = 0; i < data.length; i++) {
					data[i] = new Model(data[i], modelOpts);

					data[i].ready(function () {
						if (pending-- == 1) {
							callback(data);
						}
					});
				}
			};
			orm._db.selectRecords(model, config);

			return this;
		} else {
			var query = orm._db.selectRecords(model, config);

			(function (m) {
				query.on("record", function (record) {
					(new Model(record, modelOpts)).ready(function (m) {
						m.emit("record", m);
					});
				});
				query.on("end", function (info) {
					// info not properly processed yet
					m.emit("end");
				});
				query.on("error", function (err) {
					m.emit("error", err);
				});
			})(this);

			return query;
		}
	};
	Model.textsearch = function () {
		var args = arguments,
		    callback = null,
		    config = {},
		    last_arg = arguments.length - 1;

		if (last_arg >= 0) {
			callback = arguments[last_arg];
			last_arg--;
		}

		if (!orm._db.searchRecords) {
			return callback(null);
		}

		//.textsearch(text, callback);
		//.textsearch(text, limit, callback);
		//.textsearch(limit, text, callback);

		for (var i = 0; i <= last_arg; i++) {
			switch (typeof arguments[i]) {
				case "number": // limit
					config.limit = arguments[i];
					break;
				case "string": // text
					config.text = arguments[i];
					break;
			}
		}

		if (!config.text) return callback(null);

		if (callback !== null) {
			config.callback = function (err, data) {
				if (err || data.length === 0) return callback(null);

				for (var i = 0; i < data.length; i++) {
					data[i] = new Model(data[i]);
				}
				callback(data);
			};
		}
		orm._db.searchRecords(model, config);
	};
	Model._ORM = { "collection": model };

	colParams || (colParams = {});
	for (var k in fields) {
		if (!fields.hasOwnProperty(k)) {
			continue;
		}
		if (typeof fields[k] == "function") {
			var o = new fields[k]();
			if (o instanceof String || o instanceof Boolean || o instanceof Number) {
				fields[k] = { "type": typeof fields[k]() };
			} else if (o instanceof Date) {
				fields[k] = { "type": "date" };
			} else {
				fields[k] = { "type": fields[k] };
			}
		} else if (typeof fields[k] == "string") {
			fields[k] = { "type": fields[k].toLowerCase() };
		} else if (Array.isArray(fields[k]) && fields[k].length > 0 && fields[k][0].hasMany) {
			Model.hasMany(k + (k.substr(-1) != "s" ? "s" : ""), fields[k][0], k);
			delete fields[k];
		}
	}

	this._models[model] = Model;
	if (!module.exports.hasOwnProperty(model)) {
		module.exports[model] = this._models[model];
	}

	return this._models[model];
};

module.exports = {
	"validators": require("./validators"),
	"F": function (str, value) {
		return { __ormFunction: str, v: value };
	},
	"connect"   : function () {
		var dbObject = null,
		    dbType = null,
		    dbPath = "",
		    cb = function () {},
		    uri = "";

		for (var i = 0; i < arguments.length; i++) {
			switch (typeof arguments[i]) {
				case "string":
					uri = dbType = arguments[i];
					break;
				case "function":
					cb = arguments[i];
					break;
				case "object":
					dbObject = arguments[i];
					break;
			}
		}

		if (dbObject === null) {
			uri = require("url").parse(uri);

			if (!uri.protocol) {
				return cb(false, { "number": 1, "message": "Protocol not defined" });
			}

			dbType = uri.protocol.substr(0, uri.protocol.length - 1);
		}

		if (db_alias.hasOwnProperty(dbType)) {
			dbType = db_alias[dbType];
		}

		dbPath = __dirname + "/databases/" + dbType + ".js";

		require("path").exists(dbPath, function (exists) {
			if (!exists) {
				return cb(false, { "number": 2, "message": "Protocol not installed" });
			}

			var db = require(dbPath);

			var handleResult = function (success, info) {
				if (!success) return cb(false, info);

				return cb(true, new ORM(info));
			};

			if (dbObject !== null) {
				db.use_db(dbObject, handleResult);
			} else {
				db.connect(uri, handleResult);
			}
		});
	}
};
