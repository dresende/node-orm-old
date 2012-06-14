var util = require("util");
var events = require("events");
var helpers = require("./helpers");

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
	var k, assoc_fields;

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
	_query = "CREATE TABLE IF NOT EXISTS " + this._escapeId("%table") + " (%values) " +
	         "ENGINE = " + opts.engine +
	         " CHARACTER SET " + opts.encoding +
	         " COLLATE " + opts.collate;

	_query = _query.replace("%table", _table);

	if (add_id) {
		_fields.push("`id` BIGINT(10) UNSIGNED NOT NULL AUTO_INCREMENT");
	}

	for (var i = 0; i < assocs.length; i++) {
		switch (assocs[i].type) {
			case "one":
				_fields.push(this._escapeId(assocs[i].field + "_id") + " BIGINT(10) UNSIGNED NOT NULL");
				_indexes.push(assocs[i].field + "_id");
				field_names.push(assocs[i].field + "_id");
				break;
			case "many":
				assoc_fields = {
					"_params": [ "unique-record", "no-id" ]
				};
				if (assocs[i].opts && assocs[i].opts.properties) {
					for (k in assocs[i].opts.properties) {
						if (!assocs[i].opts.properties.hasOwnProperty(k)) continue;

						assoc_fields[k] = assocs[i].opts.properties[k];
					}
				}
				this.createCollection(_table + "_" + assocs[i].field, assoc_fields, [{
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

	for (k in fields) {
		if (k == "_params") {
			continue;
		}

		var field = this._escapeId(k);

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
			case "date":	field += " DATETIME";
				if (!fields[k].hasOwnProperty("allowNull")) {
					// if not set, dates are better nulled than 0000-00-00 ..
					fields[k].allowNull = true;
				}
				break;
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

		//field_names.push(k);
		_fields.push(field);
	}

	if (add_id) {
		_fields.push("PRIMARY KEY (" + this._escapeId("id") + ")");
	}

	if (unique_record) {
		_fields.push("PRIMARY KEY (" + field_names.map(this._escapeId).join(", ") + ")");
	} else {
		for (i = 0; i < _indexes.length; i++) {
			_fields.push("INDEX (" + this._escapeId(_indexes[i]) + ")");
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
	var _query = "SELECT * FROM ", tmp, _values = [];
	var _query_tables = this._escapeId(_table) + " t0";

	config = config || {};

	if (config.rel && config.rel.length) {
		for (var i = 0; i < config.rel.length; i++) {
			_query_tables = "(" + _query_tables + ") JOIN " + this._escapeId(config.rel[i].collection) + " t" + (i + 1) +
			                " ON " + this._escapeId("t" + i + "." + config.rel[i].rel[0]) + " = " + this._escapeId("t" + (i + 1) + "." + config.rel[i].rel[1]);
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
	var _query = "DELETE FROM " + this._escapeId(_table), tmp, _values = [];

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
	if (idProp && data[idProp] && parseInt(data[idProp], 10) > 0) {
		var id = data[idProp];
		delete data[idProp];

		this._updateRecord(collection, idProp, data, id, callback);
	} else {
		this._insertRecord(collection, data, callback);
	}
};
DBClient.prototype._insertRecord = function (collection, data, callback) {
	var _table = collection.toLowerCase();
	var _query = "INSERT INTO " + this._escapeId(_table) + " (%fields) VALUES (%values)";
	var info = helpers.escapeInsertFields(data, {
		date_convert_fmt: "FROM_UNIXTIME(?)",
		boolean_convert: function (v) { return v ? 1 : 0; }
	});

	_query = _query.replace("%fields", Object.keys(data).map(this._escapeId).join(", "));
	_query = _query.replace("%values", info.escapes.join(", "));
	//console.log(_query, info);

	this._client.query(_query, info.values, function (err, info) {
		if (err) {
			callback(err);
			return;
		}

		callback(null, info.insertId);
	});
};
DBClient.prototype._updateRecord = function (collection, idProp, data, id, callback) {
	var _table = collection.toLowerCase();
	var _query = "UPDATE " + this._escapeId(_table) + " SET %values WHERE " + this._escapeId(idProp) + " = " + id;
	var info = helpers.escapeUpdateFields(data, this._escapeId, {
		date_convert_fmt: "FROM_UNIXTIME(?)",
		boolean_convert: function (v) { return v ? 1 : 0; }
	});

	_query = _query.replace("%values", info.query);
	//console.log(_query, info);

	this._client.query(_query, info.values, function (err, info) {
		if (err) {
			callback(err);
			return;
		}

		callback(null);
	});
};
DBClient.prototype._addQueryConditions = function (conditions) {
	return helpers.buildSqlWhere(conditions, this._escapeId, {
		additional_operators: [ "LIKE", "ILIKE" ]
	});
};
DBClient.prototype._addQueryOrder = function (query, order) {
	return query + helpers.buildSqlOrder(order, this._escapeId);
};
DBClient.prototype._addQueryLimit = function (query, limit, skip) {
	return query + helpers.buildSqlLimit(limit, skip);
};
DBClient.prototype._escapeId = function (id) {
	if (id.indexOf(".") == -1) {
		return "`" + id + "`";
	} else {
		return "`" + id.substr(0, id.indexOf(".")) + "`.`" + id.substr(id.indexOf(".") + 1) + "`";
	}
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
