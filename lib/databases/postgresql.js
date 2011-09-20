var DBClient = function (client) {
	this._client = client;
};
DBClient.prototype.createCollection = function (collection, fields, assocs) {
	var _table = collection.toLowerCase();
	var _query = "CREATE TABLE \"%table\" (%values)", _fields = [], _indexes = [];
	_query = _query.replace("%table", _table);

	var field_names = [], self = this;
	var add_id = (!fields._params || fields._params.indexOf("no-id") == -1);
	var unique_record = (fields._params && fields._params.indexOf("unique-record") != -1);
	var text_search_fields = [];

	if (add_id) {
		_fields.push("\"id\" SERIAL");
	}
	for (k in fields) {
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

		field_names.push(k);
		_fields.push(field + " NOT NULL");
	}

	for (var i = 0; i < assocs.length; i++) {
		switch (assocs[i].type) {
			case "one":
				_fields.push("\"" + assocs[i].field + "_id\" BIGINT(10) UNSIGNED NOT NULL");
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
	} else {
		for (i = 0; i < _indexes.length; i++) {
			_fields.push("INDEX (\"" + _indexes[i] + "\")");
		}
	}

	_query = _query.replace("%values", _fields.join(", "));
	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (text_search_fields.length > 0) {
			self._client.query("CREATE INDEX \"" + _table + "_idx\" " +
			                   "ON \""+_table+"\" " +
			                   "USING gin(to_tsvector('english', " + text_search_fields.join(" || ' ' || ") + "))", function () {});
		}
	});
};
DBClient.prototype.selectRecords = function (collection, config) {
	var _table = collection.toLowerCase(collection);
	var _query = "SELECT * FROM \"" + _table + "\"";

	config = config || {};

	if (config.conditions) _query = this._addQueryConditions(_query, config.conditions);
	if (config.order) _query = this._addQueryOrder(_query, config.order);
	if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (err) {
			config.callback(err);
			return;
		}

		config.callback(null, info.rows);
	});
};
DBClient.prototype.searchRecords = function (collection, config) {
	var _table = collection.toLowerCase(collection);
	var _query = "SELECT * FROM \"" + _table + "\" WHERE to_tsvector(body) @@ to_tsquery('%text')";

	config.text = config.text.replace(/\Wand\W/gi, " & ");
	config.text = config.text.replace(/\Wor\W/gi, " | ");
	config.text = config.text.replace(/\Wnot\W/gi, " !");
	_query = _query.replace("%text", config.text.replace("'", "''"));

	if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

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
	var _table = collection.toLowerCase(collection);
	var _query = "DELETE FROM \"" + _table + "\"";

	config = config || {};

	if (config.conditions) _query = this._addQueryConditions(_query, config.conditions);
	if (config.order) _query = this._addQueryOrder(_query, config.order);
	if (config.limit) _query = this._addQueryLimit(_query, config.limit, config.skip);

	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (err) {
			config.callback(err);
			return;
		}

		config.callback(null, info.rows);
	});
};
DBClient.prototype.saveRecord = function (collection, data, callback) {
	if (parseInt(data.id) > 0) {
		var id = data.id;
		delete data.id;

		this._updateRecord(collection, data, id, callback);
	} else {
		this._insertRecord(collection, data, callback);
	}
};
DBClient.prototype._insertRecord = function (collection, data, callback) {
	var _table = collection.toLowerCase(), self = this;
	var _query = "INSERT INTO \"" + _table + "\" (%fields) VALUES (%values)", _fields = [], _values = [];

	for (k in data) {
		if (!data.hasOwnProperty(k)) continue;

		_fields.push("\"" + k + "\"");

		switch (typeof data[k]) {
			case "number":
				_values.push(data[k]);
				break;
			case "boolean":
				_values.push(data[k] ? 1 : 0);
				break;
			case "undefined":
				_fields.pop();
				break;
			default:
				_values.push("'" + data[k].replace("'", "''") + "'");
		}
	}

	_query = _query.replace("%fields", _fields.join(", "));
	_query = _query.replace("%values", _values.join(", "));

	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (err) {
			callback(err);
			return;
		}

		self._client.query("SELECT CURRVAL(pg_get_serial_sequence('" + _table + "', 'id'))", function (err, info) {
			if (err) {
				callback(err);
				return;
			}

			callback(null, info.rows[0].currval);
		});
	});
};
DBClient.prototype._updateRecord = function (collection, data, id, callback) {
	var _table = collection.toLowerCase();
	var _query = "UPDATE \"" + _table + "\" SET %values WHERE \"id\"=" + id, _values = [];

	for (k in data) {
		if (!data.hasOwnProperty(k)) continue;

		switch (typeof data[k]) {
			case "number":
				_values.push("\"" + k + "\"=" + data[k]);
				break;
			case "boolean":
				_values.push("\"" + k + "\"=" + (data[k] ? 1 : 0));
				break;
			default:
				if (data[k] === null) {
					_values.push("\"" + k + "\"=NULL");
				} else {
					if (typeof data[k] == "object") console.dir(data[k]);
					_values.push("\"" + k + "\"='" + data[k].replace("'", "''") + "'");
				}
		}
	}

	_query = _query.replace("%values", _values.join(", "));
	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (err) {
			callback(err);
			return;
		}

		callback(null);
	});
};
DBClient.prototype._addQueryConditions = function (query, conditions) {
	var _conditions = [];

	for (k in conditions) {
		if (!conditions.hasOwnProperty(k)) continue;

		switch (typeof conditions[k]) {
			case "number":
				_conditions.push("\"" + k + "\"=" + conditions[k]);
				break;
			case "boolean":
				_conditions.push("\"" + k + "\"=" + (conditions[k] ? 1 : 0));
				break;
			default:
				if (conditions[k].forEach) {
					_conditions.push("\"" + k + "\" IN ('" + conditions[k].join("', '") + "')");
				} else {
					_conditions.push("\"" + k + "\"='" + conditions[k].replace("'", "''") + "'");
				}
		}
	}

	return query + " WHERE " + _conditions.join(" AND ");
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
	var pg = require("pg");
	var opts = {
		"host"		: "localhost",
		"port"		: 5432,
		"user"		: "postgres",
		"password"	: "",
		"database"	: "postgres"
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

	for (k in options) {
		if (opts.hasOwnProperty(k)) {
			opts[k] = options[k];
		}
	}

    var client = new pg.Client("pg://"+opts.user+":"+opts.password+"@"+opts.host+":"+opts.port+"/"+opts.database);
    var errorListener = function(err) {
	    callback(false, { "number": parseInt(err.code), "message": err.message });
    };
    client.once("error", errorListener);
    client.once("connect", function() {
        client.removeListener("error", errorListener);
        callback(true, new DBClient(client));
    });
    client.connect();
};

exports.use_db = function (rawDb, callback) {
	callback(true, new DBClient(rawDb));
};
