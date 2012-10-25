var mysql = require("mysql");
var mysql_v2 = (typeof mysql.createConnection == "function");
var helpers = require("./helpers");

function DBClient(client) {
	this._client = client;
}
DBClient.prototype.getClient = function () {
	return this._client;
};
DBClient.prototype.createCollection = function (collection, fields, assocs, opts, callback) {
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

	//console.log(query, values);

	if (typeof config.callback == "function") {
		this._client.query(query, values, function (err, info) {
			if (err) {
				config.callback(err);
				return;
			}

			config.callback(null, info);
		});
	} else {
		return new helpers.DBQuery(this._client.query(query, values));
	}
};
DBClient.prototype.clearRecords = function (collection, config) {
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

		config.callback(null, info);
	});
};
DBClient.prototype.saveRecord = function (propertyId, collection, data, cb) {
	if (propertyId && data[propertyId] && parseInt(data[propertyId], 10) > 0) {
		var id = data[propertyId];
		delete data[propertyId];

		this._updateRecord(collection, propertyId, data, id, cb);
	} else {
		this._insertRecord(collection, data, cb);
	}
};
DBClient.prototype._insertRecord = function (collection, data, cb) {
	return helpers.createSqlInsert({
		table: this._collectionToTable(collection),
		escape: this._escapeId,
		info: helpers.escapeInsertFields(data, this._helperOpts),
		orm: this._orm,
		data: data,
		db: this._client,
		callback: cb
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
	date_convert_fmt: "FROM_UNIXTIME(?)",
	additional_operators: [ "LIKE", "ILIKE" ],
	boolean_convert: this._booleanToSqlValue
};
DBClient.prototype._booleanToSqlValue = function (value) {
	return value ? 1 : 0;
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

	if (mysql_v2) {
		client = mysql.createConnection(opts);
		client.connect(function (err) {
			if (err) {
				return callback(false, err);
			}
			return callback(true, new DBClient(client));
		});
	} else {
		client = mysql.createClient(opts);

		client.query("SHOW STATUS");

		var testConnection = function (n) {
			if (n <= 0) {
				return callback(false);
			}
			if (client.connected) {
				return callback(true, new DBClient(client));
			}

			setTimeout(function () {
				testConnection(n - 1);
			}, 250);
		};

		testConnection(12); // 12 means 12 tries every 250ms = 3 seconds timeout
	}
};

exports.use_db = function (rawDb, callback) {
	callback(true, new DBClient(rawDb));
};
