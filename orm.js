var ORM = function (db) {
	this._db = db;
};
ORM.prototype.define = function (colName, colFields, colParams) {
	var ORMObject = this,
	    collection = colName,
	    collectionFields = colFields || {},
	    collectionAssociations = [];

	var ORMCollection = function (data) {
		if (data) {
			for (k in data) {
				if (data.hasOwnProperty(k)) this[k] = data[k];
			}
		}
		if (colParams && colParams.classMethods) {
			for (k in colParams.classMethods) {
				this[k] = colParams.classMethods[k];
			}
		}
	};
	ORMCollection.prototype.hasOne = function (association, collection) {
		collectionAssociations.push({
			"field"	: association,
			"type"	: "one",
			"entity": (!collection ? this : collection)	// this = circular reference
		});
		this._addOneAssociationMethods(association);
	};
	ORMCollection.prototype.hasMany = function (association, collection, field) {
		collectionAssociations.push({
			"field"	: association,
			"name"	: field,
			"type"	: "many",
			"entity": (!collection ? this : collection)	// this = circular reference
		});
	};
	ORMCollection.prototype._addOneAssociationMethods = function (collection, association) {
		var method = "get" + association.substr(0, 1).toUpperCase() + association.substr(1);
	
		this.prototype[method] = function (cb) {
			cb({ "id": null, "description": "not done yet" });
		};
	};
	ORMCollection.sync = function () {
		ORMObject._db.createCollection(collection, collectionFields, collectionAssociations);
	};
	ORMCollection.find = function () {
		console.log("find()");
	};

	return ORMCollection;
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
