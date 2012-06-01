var util = require("util"),
    events = require("events");

function DBQuery(query) {
	events.EventEmitter.call(this);

	query.on("row", (function (o) {
		return function (row) {
			o.emit("record", row);
		};
	})(this));
	query.on("end", (function (o) {
		return function (res) {
			o.emit("end", res);
		};
	})(this));
	query.on("error", (function (o) {
		return function (err) {
			o.emit("error", err);
		};
	})(this));
}
util.inherits(DBQuery, events.EventEmitter);

function DBClient(client) {
	this._client = client;
}

DBClient.prototype.getClient = function () {
	return this._client;
};

DBClient.prototype.createCollection = function (collection, fields, assocs, opts) {
	var _table = collection.toLowerCase();
	var _query = "", _fields = [], _indexes = [];

	var field_names = [];
	var add_id = (!fields._params || fields._params.indexOf("no-id") == -1);
	var unique_record = (fields._params && fields._params.indexOf("unique-record") != -1);

	opts = opts || {};
	if (!opts.hasOwnProperty("engine")) {
		opts.engine = "InnoDB";
	}
	if (!opts.hasOwnProperty("encoding")) {
		opts.encoding = "utf8";
	}
	if (!opts.hasOwnProperty("collate")) {
		opts.collate = "utf8_general_ci";
	}
	_query = "CREATE TABLE IF NOT EXISTS `%table` (%values) " +
	         "ENGINE = " + opts.engine +
	         " CHARACTER SET " + opts.encoding +
	         " COLLATE " + opts.collate;

	_query = _query.replace("%table", _table);

	if (add_id) {
		_fields.push("`id` BIGINT(10) UNSIGNED NOT NULL AUTO_INCREMENT");
	}
	for (var k in fields) {
		if (k == "_params") {
			continue;
		}

		var field = "`" + k + "`";

		switch (fields[k].type) {
			case "enum":
				field += " ENUM ('" + fields[k].values.join("', '") + "')";
				break;
			case "struct":
			case "object":
			case "text":	field += " TEXT"; break;
			case "num":
			case "number":
			case "int":
			case "integer":	field += " INT"; break;
			case "float":	field += " FLOAT"; break;
			case "bool":
			case "boolean":	field += " TINYINT(1)"; break;
			case "date":	field += " DATETIME"; break;
			case "data":	field += " BLOB"; break;
			default:
				field += " VARCHAR(255)";
		}

		if (fields[k].hasOwnProperty("default")) {
			field += " DEFAULT '" + fields[k]["default"] + "'";
		}
		if (!fields[k].hasOwnProperty("allowNull") || !fields[k].allowNull) {
			field += " NOT NULL";
		}

		field_names.push(k);
		_fields.push(field);
	}

	for (var i = 0; i < assocs.length; i++) {
		switch (assocs[i].type) {
			case "one":
				_fields.push("`" + assocs[i].field + "_id` BIGINT(10) UNSIGNED NOT NULL");
				_indexes.push(assocs[i].field + "_id");
				field_names.push(assocs[i].field + "_id");
				break;
			case "many":
				this.createCollection(_table + "_" + assocs[i].field, {
					"_params": [ "unique-record", "no-id" ]
				}, [{
					"field"	: _table,
					"type"	: "one",
					"entity": this
				}, {
					"field"	: assocs[i].name || assocs[i].field,
					"type"	: "one",
					"entity": assocs[i].entity
				}]);
				break;
		}
	}

	if (add_id) {
		_fields.push("PRIMARY KEY (`id`)");
	}

	if (unique_record) {
		_fields.push("PRIMARY KEY (`" + field_names.join("`, `") + "`)");
	} else {
		for (i = 0; i < _indexes.length; i++) {
			_fields.push("INDEX (`" + _indexes[i] + "`)");
		}
	}

	_query = _query.replace("%values", _fields.join(", "));

	this._client.query(_query, function (err, info) {
		/*
		console.log(err);
		console.log(info);
		console.log("collection synced");
		*/
	});
};
DBClient.prototype.selectRecords = function (collection, config) {
	var _table = collection.toLowerCase(collection);
	var _query = "SELECT * FROM ", tmp, _values = [],
	    _query_tables = "`" + _table + "` t0";

	config = config || {};

	if (config.rel && config.rel.length) {
		for (var i = 0; i < config.rel.length; i++) {
			_query_tables = "(" + _query_tables + ") JOIN `" + config.rel[i].collection + "` t" + (i + 1) +
			                " ON t" + i + ".`" + config.rel[i].rel[0] + "` = t" + (i + 1) + ".`" + config.rel[i].rel[1] + "`";
			config.conditions["t" + (i + 1) + "." + config.rel[i].rel[2]] = config.rel[i].value;
		}
	}

	_query += _query_tables;

	if (config.conditions) {
		tmp = this._addQueryConditions(config.conditions);
		_query += tmp[0];
		_values = _values.concat(tmp[1]);
	}
	if (config.order) _query = this._addQueryOrder(_query, config.order);
	if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

	//console.log(_query, _values);

	if (typeof config.callback == "function") {
		this._client.query(_query, _values, function (err, info) {
			if (err) {
				config.callback(err);
				return;
			}

			config.callback(null, info);
		});
	} else {
		return new DBQuery(this._client.query(_query, _values));
	}
};
DBClient.prototype.clearRecords = function (collection, config, callback) {
	var _table = collection.toLowerCase(collection);
	var _query = "DELETE FROM `" + _table + "`", tmp, _values = [];

	config = config || {};

	if (config.conditions) {
		tmp = this._addQueryConditions(config.conditions);
		_query += tmp[0];
		_values = _values.concat(tmp[1]);
	}
	if (config.order) _query = this._addQueryOrder(_query, config.order);
	if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

	this._client.query(_query, _values, function (err, info) {
		if (err) {
			config.callback(err);
			return;
		}

		config.callback(null, info);
	});
};
DBClient.prototype.saveRecord = function (idProp, collection, data, callback) {
	if (data[idProp] && parseInt(data[idProp], 10) > 0) {
		var id = data[idProp];
		delete data[idProp];

		this._updateRecord(collection, idProp, data, id, callback);
	} else {
		this._insertRecord(collection, data, callback);
	}
};
DBClient.prototype._insertRecord = function (collection, data, callback) {
	var _table = collection.toLowerCase();
	var _query = "INSERT INTO `" + _table + "` (%fields) VALUES (%values)",
	    _fields = [], _values = [], _escapes = [];

	for (var k in data) {
		if (!data.hasOwnProperty(k)) continue;

		_fields.push("`" + k + "`");
		_values.push("?");

		switch (typeof data[k]) {
			case "boolean":
				_escapes.push(data[k] ? 1 : 0);
				break;
			case "undefined":
				_values.pop();
				_fields.pop();
				break;
			default:
				if (data[k] === null) {
					_escapes.push(null);
				} else {
					if (typeof data[k] == "object") {
						if (data[k].getTime) {
							if (data[k].toString() != "Invalid Date") {
								_escapes.push(Math.round(data[k].getTime() / 1e3));
								_values[_values.length - 1] = "FROM_UNIXTIME(?)";
							}
						} else {
							_escapes.push(data[k]);

						}
					} else {
						_escapes.push(data[k]);
					}
				}
		}
	}

	_query = _query.replace("%fields", _fields.join(", "));
	_query = _query.replace("%values", _values.join(", "));

	//console.log(_query, _escapes);

	this._client.query(_query, _escapes, function (err, info) {
		if (err) {
			callback(err);
			return;
		}

		callback(null, info.insertId);
	});
};
DBClient.prototype._updateRecord = function (collection, idProp, data, id, callback) {
	var _table = collection.toLowerCase();
	var _query = "UPDATE `" + _table + "` SET %values WHERE `" + idProp + "`=" + id, _updates = [], _values = [];

	for (var k in data) {
		if (!data.hasOwnProperty(k)) continue;

		switch (typeof data[k]) {
			case "boolean":
				_values.push(data[k] ? 1 : 0);
				_updates.push("`" + k + "`=?");
				break;
			default:
				if (data[k] === null) {
					_values.push(null);
					_updates.push("`" + k + "`=?");
				} else {
					if (typeof data[k] == "object") {
						if (data[k].getTime) {
							if (data[k].toString() != "Invalid Date") {
								_values.push(Math.round(data[k].getTime() / 1e3));
								_updates.push("`" + k + "`=FROM_UNIXTIME(?)");
							}
						} else {
							_values.push(data[k]);
							_updates.push("`" + k + "`=?");
						}
					} else {
						_values.push(data[k]);
						_updates.push("`" + k + "`=?");
					}
				}
		}
	}

	_query = _query.replace("%values", _updates.join(", "));

	//console.log(_query, _values);

	this._client.query(_query, _values, function (err, info) {
		if (err) {
			callback(err);
			return;
		}

		callback(null);
	});
};
DBClient.prototype._addQueryConditions = function (conditions) {
	var _conditions = [], _values = [], prop, op, i;

	for (var k in conditions) {
		if (!conditions.hasOwnProperty(k)) continue;

		if (k.indexOf(" ") > 0) {
			op = k.substr(k.indexOf(" ") + 1, k.length).replace(/^\s+/, "");
			prop = k.substr(0, k.indexOf(" "));

			if ( ["like", "ilike" ].indexOf(op) >= 0 ) {
				op = " " + op + " ";
			} else if ([ "=", "!", "!=", ">", "<", ">=", "<=" ].indexOf(op) == -1) {
				op = "=";
			} else if (op == "!") {
				op = "!=";
			}
		} else {
			prop = k;
			op = "=";
		}

		if (prop.indexOf(".") == -1) {
			prop = "`" + prop + "`";
		} else {
			prop = prop.substr(0, prop.indexOf(".")) + ".`" + prop.substr(prop.indexOf(".") + 1) + "`";
		}

		switch (typeof conditions[k]) {
			case "boolean":
				_conditions.push(prop + op + "?");
				_values.push(conditions[k] ? 1 : 0);
				break;
			default:
				if (Array.isArray(conditions[k])) {
					if (conditions[k].length > 0) {
						_conditions.push(prop + " " + (op == "!=" ? "NOT " : "") + "IN (" + (new Array(conditions[k].length)).join("?,") + "?)");
						_values = _values.concat(conditions[k]);
					} else {
						// ?
						_conditions.push(prop + " " + (op == "!=" ? "NOT " : "") + "IN (NULL)");
					}
				} else if (typeof conditions[k] == "object" && conditions[k].hasOwnProperty("__ormFunction")) {
					_conditions.push(conditions[k].__ormFunction.replace(/\#\#/g, "`" + prop + "`") + op + "?");
					_values.push(conditions[k].v);
				} else {
					_conditions.push(prop + op + "?");
					_values.push(conditions[k]);
				}
		}
	}

	return [ " WHERE " + _conditions.join(" AND "), _values ];
};
DBClient.prototype._addQueryOrder = function (query, order) {
	if (!order.match(/\s(asc|desc)$/i)) {
		order += " asc";
	}

	return query + " ORDER BY " + order.replace(/\w+/g, function (word) {
		if ([ "ASC", "DESC" ].indexOf(word.toUpperCase()) != -1)
			return word.toUpperCase();
		return "`" + word + "`";
	});
};
DBClient.prototype._addQueryLimit = function (query, limit, skip) {
	if (skip) {
		return query + " LIMIT " + skip + ", " + limit;
	}
	return query + " LIMIT " + limit;
};
DBClient.prototype.end = function () {
    this._client.end();
};

exports.connect = function (options, callback) {
	var client = null;
	var opts = {
		"host"		: "localhost",
		"port"		: 3306,
		"user"		: "root",
		"password"	: "",
		"database"	: "test",
		"charset"   : "UTF8_GENERAL_CI"
	};

	if (options.auth) {
		var p;
		if ((p = options.auth.indexOf(":")) != -1) {
			options.user = options.auth.substr(0, p);
			options.password = options.auth.substr(p + 1);
		} else {
			options.user = options.auth;
		}
	}
	if (options.pathname) {
		options.database = options.pathname.substr(1);
	}
	if (options.hostname) {
		options.host = options.hostname;
	}

	for (var k in options) {
		if (opts.hasOwnProperty(k)) {
			opts[k] = options[k];
		}
	}

	client = require("mysql").createClient(opts);
	client.query("SHOW STATUS");

	function testConnection(n) {
		if (n <= 0) {
			return callback(false);
		}
		if (client.connected) {
			return callback(true, new DBClient(client));
		}

		setTimeout(function () {
			testConnection(n - 1);
		}, 250);
	}

	testConnection(12); // 12 means 12 tries every 250ms = 3 seconds timeout
};

exports.use_db = function (rawDb, callback) {
	callback(true, new DBClient(rawDb));
};
