var ORM = function (db) {
	this._db = db;
};
ORM.prototype.define = function (model, fields, colParams) {
	var ORMObject = this,
	    associations = [];

	var addOneAssociationMethods = function (model, association) {
		var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);
	
		model.prototype["get" + camelCaseAssociation] = function (cb) {
			cb({ "id": null, "description": "not done yet" });
		};
		model.prototype["unset" + camelCaseAssociation] = function (cb) {
			this["set" + camelCaseAssociation](null, cb);
		};
		model.prototype["set" + camelCaseAssociation] = function (instance, cb) {
			var self = this;
			
			if (instance === null) {
				self[association + "_id"] = 0;
				cb(true);
				return;
			}

			if (!instance.saved()) {
				instance.save(function (success) {
					if (!success) {
						return cb(false);
					}
					self[association + "_id"] = instance.id;
					cb(true);
				});
				return;
			}
			self[association + "_id"] = instance.id;
			cb(true);
		};
	};
	var ORMCollection = function (data) {
		if (data) {
			for (k in data) {
				if (data.hasOwnProperty(k)) this[k] = data[k];
			}
		}
		if (colParams && colParams.methods) {
			for (k in colParams.methods) {
				this[k] = colParams.methods[k];
			}
		}
	};
	ORMCollection.prototype.saved = function () {
		return false;
	};
	ORMCollection.prototype.save = function (callback) {
		var data = {}, self = this;
		
		if (typeof this.id == "number" && this.id > 0) {
			data.id = this.id;
		}

		for (k in fields) {
			if (!fields.hasOwnProperty(k)) continue;
			
			data[k] = this[k];
		}
		for (var i = 0; i < associations.length; i++) {
			switch (associations[i].type) {
				case "one":
					if (this.hasOwnProperty(associations[i].field + "_id")) {
						data[associations[i].field + "_id"] = this[associations[i].field + "_id"];
					}
			}
		}
		
		ORMObject._db.saveRecord(model, data, function (success, id) {
			if (!success) {
				if (typeof callback == "function") callback(false);
				return;
			}
			if (!self.id) {
				self.id = id;
			}
			if (typeof callback == "function") callback(true, self);
		});
	};
	ORMCollection.hasOne = function (association, model) {
		associations.push({
			"field"	: association,
			"type"	: "one",
			"entity": (!model ? this : model)	// this = circular reference
		});
		addOneAssociationMethods(this, association);
	};
	ORMCollection.hasMany = function (association, model, field) {
		associations.push({
			"field"	: association,
			"name"	: field,
			"type"	: "many",
			"entity": (!model ? this : model)	// this = circular reference
		});
	};
	ORMCollection.sync = function () {
		ORMObject._db.createCollection(model, fields, associations);
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
