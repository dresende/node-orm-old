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

DBClient.prototype.createCollection = function (collection, fields, assocs, opts, callback) { /* opts not used yet */
	var _table = collection.toLowerCase();
	var _query = "CREATE TABLE \"%table\" (%values)", _fields = [], _indexes = [];
	_query = _query.replace("%table", _table);

	var field_names = [], self = this;
	var add_id = (!fields._params || fields._params.indexOf("no-id") == -1);
	var unique_record = (fields._params && fields._params.indexOf("unique-record") != -1);
	var text_search_fields = [], emptycb = function () {};

	if (add_id) {
		_fields.push("\"id\" SERIAL");
	}
	for (var k in fields) {
		if (k == "_params") {
			continue;
		}

		var field = "\"" + k + "\"";

		if (fields[k].textsearch) {
			text_search_fields.push(k);
		}

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
			case "integer":	field += " INTEGER"; break;
			case "float":	field += " REAL"; break;
			case "bool":
			case "boolean":	field += " BOOLEAN"; break;
			case "date":	field += " TIMESTAMP"; break;
			case "data":	field += " BYTEA"; break;
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
				_fields.push("\"" + assocs[i].field + "_id\" INTEGER NOT NULL");
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
		_fields.push("PRIMARY KEY (\"id\")");
	}

	if (unique_record) {
		_fields.push("PRIMARY KEY (\"" + field_names.join("\", \"") + "\")");
	}

	_query = _query.replace("%values", _fields.join(", "));
	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (text_search_fields.length > 0) {
			self._client.query("CREATE INDEX \"" + _table + "_idx\" " +
			                   "ON \""+_table+"\" " +
			                   "USING gin(to_tsvector('english', " + text_search_fields.join(" || ' ' || ") + "))", function () {});
		}
		if (!unique_record) {
			for (i = 0; i < _indexes.length; i++) {
				self._client.query("CREATE INDEX \"" + _table + "_" + _indexes[i] + "_idx\" " + "ON \"" + _table + "\"(" + _indexes[i] + ")", emptycb);
			}
		}

		if (callback !== undefined) {
			var success = !err;
			callback(success);
		}
	});
};
DBClient.prototype.selectRecords = function (collection, config) {
	var query = "SELECT * FROM ";
	var query_tables = this._escapeId(this._collectionToTable(collection)) + " t0";
	var values = [];
	var tmp;

	config = config || {};

	if (config.rel && config.rel.length) {
		for (var i = 0; i < config.rel.length; i++) {
			query_tables = "(" + query_tables + ") JOIN " +
					this._escapeId(config.rel[i].collection) + " t" + (i + 1) +
					" ON " + this._escapeId("t" + i + "." + config.rel[i].rel[0]) +
					" = " + this._escapeId("t" + (i + 1) + "." + config.rel[i].rel[1]);
			config.conditions["t" + (i + 1) + "." + config.rel[i].rel[2]] = config.rel[i].value;
		}
	}

	query += query_tables;

	if (config.conditions) {
		tmp = this._addQueryConditions(config.conditions);
		query += tmp[0];
		values = values.concat(tmp[1]);
	}
	if (config.order) {
		query += helpers.buildSqlOrder(config.order, this._escapeId);
	}
	if (config.limit) {
		query += helpers.buildSqlLimit(config.limit, config.skip);
	}

	if (typeof config.callback == "function") {
		this._client.query(query, values, function (err, info) {
			if (err) {
				config.callback(err);
				return;
			}

			config.callback(null, info.rows);
		});
	} else {
		return new DBQuery(this._client.query(query, values));
	}
};
// this should not be used for now..
DBClient.prototype.searchRecords = function (collection, config) {
	var _table = collection.toLowerCase(collection);
	var _query = "SELECT * FROM \"" + _table + "\" WHERE to_tsvector(body) @@ to_tsquery('%text')";

	config.text = config.text.replace(/\Wand\W/gi, " & ");
	config.text = config.text.replace(/\Wor\W/gi, " | ");
	config.text = config.text.replace(/\Wnot\W/gi, " !");
	_query = _query.replace("%text", config.text.replace("'", "''"));

	if (config.limit) {
		query += helpers.buildSqlLimit(config.limit, config.skip);
	}

	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (err) {
			config.callback(err);
			return;
		}

		config.callback(null, info.rows);
	});
};
DBClient.prototype.clearRecords = function (collection, config, callback) {
	var query = "DELETE FROM " + this._escapeId(this._collectionToTable(collection));
	var tmp;
	var values = [];

	config = config || {};

	if (config.conditions) {
		tmp = this._addQueryConditions(config.conditions);
		query += tmp[0];
		values = values.concat(tmp[1]);
	}
	if (config.order) {
		query += helpers.buildSqlOrder(config.order, this._escapeId);
	}
	if (config.limit) {
		query += helpers.buildSqlLimit(config.limit, config.skip);
	}

	this._client.query(query, values, function (err, info) {
		if (err) {
			config.callback(err);
			return;
		}

		config.callback(null, info.rows);
	});
};
DBClient.prototype.saveRecord = function (propertyId, collection, data, callback) {
	if (data[propertyId] && parseInt(data[propertyId], 10) > 0) {
		var id = data[propertyId];
		delete data[propertyId];

		this._updateRecord(collection, propertyId, data, id, callback);
	} else {
		this._insertRecord(collection, propertyId, data, callback);
	}
};
DBClient.prototype._insertRecord = function (collection, propertyId, data, cb) {
	var self = this;

	return helpers.createSqlInsert({
		table: this._collectionToTable(collection),
		escape: this._escapeId,
		info: helpers.escapeInsertFields(data, this._helperOpts),
		orm: this._orm,
		data: data,
		db: this._client,
		callback: function (err, info) {
			if (err) {
				return cb(err);
			}

			self._client.query("SELECT CURRVAL(pg_get_serial_sequence('" +
			                    self._collectionToTable(collection) + "', '" +
			                    propertyId + "'))", function (err, info) {
				if (err) {
					return cb(err);
				}

				return cb(null, info.rows[0].currval);
			});
		}
	});
};
DBClient.prototype._updateRecord = function (collection, propertyId, data, id, cb) {
	return helpers.createSqlUpdate({
		table: this._collectionToTable(collection),
		key: propertyId,
		id: id,
		escape: this._escapeId,
		info: helpers.escapeUpdateFields(data, this._escapeId, this._helperOpts),
		db: this._client,
		callback: cb
	});
};
DBClient.prototype._addQueryConditions = function (conditions) {
	return helpers.buildSqlWhere(conditions, this._escapeId, this._helperOpts);
};
DBClient.prototype._collectionToTable = function (collection) {
	return collection.toLowerCase();
};
DBClient.prototype._helperOpts = {
	additional_operators: [ "LIKE", "ILIKE" ],
	date_convert_fmt: "TO_TIMESTAMP(?)::timestamp",
	boolean_convert: this._booleanToSqlValue,
	tokenCb: function (n) { return '$' + n; }
};
DBClient.prototype._booleanToSqlValue = function (value) {
	return value ? 1 : 0;
};
DBClient.prototype._escapeId = function (id) {
	if (id.indexOf(".") == -1) {
		return "\"" + id + "\"";
	} else {
		return "\"" + id.substr(0, id.indexOf(".")) + "\".\"" + id.substr(id.indexOf(".") + 1) + "\"";
	}
};
DBClient.prototype.end = function () {
    this._client.end();
};

exports.connect = function (options, callback) {
	var pg = require("pg");

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

	var connectionString = "pg://"
		+ (options.user ? options.user : "")
		+ (options.password ? ":" + options.password : "")
		+ (options.host ? "@" + options.host : "")
		+ (options.port ? ":" + options.port : "")
		+ "/" + options.database;
	// console.log('connection = ' + connectionString);
	var client = new pg.Client(connectionString);
	var errorListener = function (err) {
		callback(false, { "number": parseInt(err.code, 10), "message": err.message });
	};
	client.once("error", errorListener);
	client.once("connect", function () {
		client.removeListener("error", errorListener);
		callback(true, new DBClient(client));
	});
	client.connect();
};

exports.use_db = function (rawDb, callback) {
	callback(true, new DBClient(rawDb));
};
