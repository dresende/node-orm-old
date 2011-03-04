var Client = require("mysql").Client;
var DBClient = function (client) {
	this._client = client;
};
DBClient.prototype.createCollection = function (collection, fields, assocs) {
	var _table = collection.toLowerCase();
	var _query = "CREATE TABLE IF NOT EXISTS `%table` (%values) ENGINE = INNODB CHARACTER SET utf8 COLLATE utf8_general_ci", _fields = [], _indexes = [];
	_query = _query.replace("%table", _table);
	
	var field_names = [];
	var add_id = (!fields._params || fields._params.indexOf("no-id") == -1);
	var unique_record = (fields._params && fields._params.indexOf("unique-record") != -1);
	
	if (add_id) {
		_fields.push("`id` BIGINT(10) UNSIGNED NOT NULL AUTO_INCREMENT");
	}
	for (k in fields) {
		if (k == "_params") {
			continue;
		}

		var field = "`" + k + "`";
		
		switch (fields[k].type) {
			case "enum":
				field += " ENUM ('" + fields[k].values.join("', '") + "')";
				break;
			case "struct":
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
		
		field_names.push(k);
		_fields.push(field + " NOT NULL");
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
		for (var i = 0; i < _indexes.length; i++) {
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
	var _query = "SELECT * FROM `" + _table + "`";

	config = config || {};

	if (config.conditions) {
		var conditions = [];
		for (k in config.conditions) {
			if (!config.conditions.hasOwnProperty(k)) continue;
			
			switch (typeof config.conditions[k]) {
				case "number":
					conditions.push("`" + k + "`=" + config.conditions[k]);
					break;
				case "boolean":
					conditions.push("`" + k + "`=" + (config.conditions[k] ? 1 : 0));
					break;
				default:
					conditions.push("`" + k + "`='" + config.conditions[k].replace("'", "\\'") + "'");
			}
		}
		_query += " WHERE " + conditions.join(" AND ");
	}

	if (config.order) {
		if (!config.order.match(/\s(asc|desc)$/i)) {
			config.order += " asc";
		}
		_query += " ORDER BY " + config.order.replace(/\w+/g, function (word) {
			if ([ "ASC", "DESC" ].indexOf(word.toUpperCase()) != -1)
				return word.toUpperCase();
			return "`" + word + "`";
		});
	}

	if (config.limit) {
		if (config.skip) {
			_query += " LIMIT " + config.skip + ", " + config.limit;
		} else {
			_query += " LIMIT " + config.limit;
		}
	}

	//console.log(_query);

	this._client.query(_query, function (err, info) {
		if (err) {
			config.callback(err);
			return;
		}
		
		config.callback(null, info);
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
	var _table = collection.toLowerCase();
	var _query = "INSERT INTO `" + _table + "` (%fields) VALUES (%values)", _fields = [], _values = [];
	
	for (k in data) {
		if (!data.hasOwnProperty(k)) continue;
		
		_fields.push("`" + k + "`");

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
				_values.push("'" + data[k].replace("'", "\\'") + "'");
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
		
		callback(null, info.insertId);
	});
};
DBClient.prototype._updateRecord = function (collection, data, id, callback) {
	var _table = collection.toLowerCase();
	var _query = "UPDATE `" + _table + "` SET %values WHERE `id`=" + id, _values = [];
	
	for (k in data) {
		if (!data.hasOwnProperty(k)) continue;

		switch (typeof data[k]) {
			case "number":
				_values.push("`" + k + "`=" + data[k]);
				break;
			case "boolean":
				_values.push("`" + k + "`=" + (data[k] ? 1 : 0));
				break;
			default:
				_values.push("`" + k + "`='" + data[k].replace("'", "\\'") + "'");
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

exports.connect = function (options, callback) {
	var client = new Client();
	var opts = {
		"host"		: "localhost",
		"port"		: 3306,
		"user"		: "root",
		"password"	: "",
		"database"	: "test"
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
	for (k in opts) {
		if (opts.hasOwnProperty(k)) {
			client[k] = opts[k];
		}
	}

	client.connect(function (err) {
		if (err && err.number) {
			callback(false, { "number": err.number, "message": err.message });
		} else {
			callback(true, new DBClient(client));
		}
	});
};
