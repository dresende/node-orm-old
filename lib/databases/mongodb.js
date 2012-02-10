var DBClient = function (client) {
	this.mongodb = require("mongodb");
	this._client = client;
	this._collections = {};
};

DBClient.prototype.getClient = function () {
	return this._client;
};
DBClient.prototype.getCollection = function (collection, cb) {
	collection = collection.toLowerCase(collection);

	if (this._collections.hasOwnProperty(collection)) {
		return cb(this._collections[collection]);
	}

	this._client.collection(collection, (function (dbclient) {
		return function (err, col) {
			if (err) {
				throw new Error("Could not get collection '" + collection + "'");
			}
			dbclient._collections[collection] = col;

			cb(col);
		};
	})(this));
};

DBClient.prototype.createCollection = function (collection, fields, assocs) {
	var _collection = collection.toLowerCase(collection);
	this._client.createCollection(_collection, function () {});

	return;
};
DBClient.prototype.selectRecords = function (collection, config) {
	config = config || {};

	this.getCollection(collection, function (col) {
		var k, prop, op;
		for (k in config.conditions) {
			if (!config.conditions.hasOwnProperty(k)) continue;
			if (k.indexOf(" ") <= 0) {
				// handle arrays before continue..
				if (Array.isArray(config[k])) {
					config[k] = { "$in": config[k] };
				}
				continue;
			}

			op = k.substr(k.indexOf(" ") + 1, k.length).replace(/^\s+/, "");
			prop = k.substr(0, k.indexOf(" "));

			if ([ "=", "!", ">", "<", ">=", "<=" ].indexOf(op) == -1) {
				op = "=";
			} else if (op == "!") {
				op = "!=";
			}

			switch (op) {
				case "=":  config[prop] = (Array.isArray(config[k]) ? { "$in": config[k] } : config[k]); break;
				case "!=": config[prop] = (Array.isArray(config[k]) ? { "$nin": config[k] } : { "$ne": config[k] }); break;
				case ">":  config[prop] = { "$gt": config[k] }; break;
				case "<":  config[prop] = { "$lt": config[k] }; break;
				case ">=": config[prop] = { "$gte": config[k] }; break;
				case "<=": config[prop] = { "$lte": config[k] }; break;
			}
			delete config[k];
		}

		var cursor = col.find(config.conditions || {});

		if (config.order) {
			// @TODO: better parse..
			cursor.sort([ config.order.split(" ", 2) ]);
		}
		if (config.limit) cursor.limit(config.limit);
		if (config.skip) cursor.skip(config.skip);

		cursor.toArray(function (err, docs) {
			if (err) {
				config.callback(err);
				return;
			}

			for (var i = 0; i < docs.length; i++) {
				docs[i].id = docs[i]._id.toHexString();
				delete docs[i]._id;
			}
			config.callback(null, docs);
		});
	});
};
DBClient.prototype.clearRecords = function (collection, config, callback) {
	if (config.order || config.skip || config.limit) {
		throw new Error("MongoDB clearRecords() not fully done yet. Can't use order/skip/limit");
	}
	if (config.conditions) {
		if (config.conditions.hasOwnProperty("id")) {
			config.conditions._id = this._client.bson_serializer.ObjectID.createFromHexString(config.conditions.id);
			delete config.conditions.id;
		}
	}
	this.getCollection(collection, function (col) {
		col.remove(config.conditions || {}, { "safe": true }, config.callback);
	});
};
DBClient.prototype.saveRecord = function (idProp, collection, data, callback) {
	this.getCollection(collection, (function (dbclient) {
		return function (col) {
			if (data.hasOwnProperty(idProp)) {
				var id = dbclient._client.bson_serializer.ObjectID.createFromHexString(data[idProp]);
				delete data[idProp];

				col.update({ "_id": id }, data, { "safe": true, "upsert": true }, function (err) {
					if (err) {
						return callback(err);
					}

					data[idProp] = id.toHexString();

					return callback(null, data);
				});
			} else {
				col.insert(data, { "safe": true }, function (err, objs) {
					if (err) {
						return callback(err);
					}

					objs[0][idProp] = objs[0]._id.toHexString();
					delete objs[0]._id;

					return callback(null, objs[0]);
				});
			}
		};
	})(this));
};
DBClient.prototype.end = function () {
	// exists?
    //this._client.end();
};

exports.connect = function (options, callback) {
	var mongodb = require("mongodb");
	var client;
	var opts = {
		"host"		: "localhost",
		"port"		: 27017,
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

	opts.port = parseInt(opts.port, 10);

	client = new mongodb.Db(opts.database, new mongodb.Server(opts.host, opts.port, {}));
	client.open(function (err, cli) {
		if (err) {
			return callback(false, err);
		}

		return callback(true, new DBClient(cli));
	});
};

exports.use_db = function (rawDb, callback) {
	callback(true, new DBClient(rawDb));
};
