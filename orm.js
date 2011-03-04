var ORM = function (db) {
	this._db = db;
};
ORM.prototype.define = function (model, fields, colParams) {
	var orm = this,
	    associations = [];

	var addOneAssociationMethods = function (model, association) {
		var camelCaseAssociation = association.substr(0, 1).toUpperCase() + association.substr(1);
	
		model.prototype["get" + camelCaseAssociation] = function (cb) {
			var self = this;
			
			if (self[association + "_id"] > 0) {
				if (self[association]) {
					cb(self[association]);
					return;
				}
				cb({ "id": null, "description": "need to fetch" });
				return;
			}
			cb(null);
		};
		model.prototype["unset" + camelCaseAssociation] = function (cb) {
			this["set" + camelCaseAssociation](null, cb);
		};
		model.prototype["set" + camelCaseAssociation] = function (instance, cb) {
			var self = this;
			
			if (instance === null) {
				self[association + "_id"] = 0;
				delete self[association];
				cb();
				return;
			}

			if (!instance.saved()) {
				instance.save(function (err, savedInstance) {
					if (err) {
						return cb(err);
					}
					self[association + "_id"] = savedInstance.id;
					self[association] = savedInstance;
					cb();
				});
				return;
			}
			self[association + "_id"] = instance.id;
			self[association] = instance;
			cb();
		};
	};
	var Model = function (data) {
		if (data) {
			for (k in data) {
				if (!data.hasOwnProperty(k)) continue;
				
				if (fields.hasOwnProperty(k)) {
					switch (fields[k].type) {
						case "bool":
						case "boolean":
							data[k] = (data[k] == 1);
							break;
						case "struct":
							if (typeof data[k] == "string") {
								data[k] = (data[k].length > 0 ? JSON.parse(data[k]) : {});
							}
					}
				}

				this[k] = data[k];
			}
		}
		for (k in fields) {
			if (!fields.hasOwnProperty(k)) continue;
			if (!data.hasOwnProperty(k) && fields[k].def) this[k] = fields[k].def;
		}
		for (var i = 0; i < associations.length; i++) {
			switch (associations[i].type) {
				case "one":
					if (!this.hasOwnProperty(associations[i].field + "_id")) {
						this[associations[i].field + "_id"] = 0;
					}
					break;
			}
		}
		
		if (colParams && colParams.methods) {
			for (k in colParams.methods) {
				this[k] = colParams.methods[k];
			}
		}
	};
	Model.prototype.saved = function () {
		return false;
	};
	Model.prototype.save = function (callback) {
		var data = {}, self = this;
		
		if (typeof this.id == "number" && this.id > 0) {
			data.id = this.id;
		}

		for (k in fields) {
			if (!fields.hasOwnProperty(k)) continue;
			
			switch (fields[k].type) {
				case "bool":
				case "boolean":
					data[k] = (this[k] == 1);
					break;
				case "date":
					data[k] = (this[k].toJSON ? this[k].toJSON() : null);
					break;
				case "struct":
					if (this[k]) {
						data[k] = (typeof this[k] == "object" ? JSON.stringify(this[k]) : this[k]);
					} else {
						data[k] = "";
					}
					break;
				default:
					data[k] = this[k];
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
		
		orm._db.saveRecord(model, data, function (err, id) {
			if (err) {
				if (typeof callback == "function") callback(err);
				return;
			}

			if (!self.id) {
				self.id = id;
			}
			if (typeof callback == "function") callback(null, self);
		});
	};
	Model.hasOne = function (association, model) {
		associations.push({
			"field"	: association,
			"type"	: "one",
			"entity": (!model ? this : model)	// this = circular reference
		});
		addOneAssociationMethods(this, association);
	};
	Model.hasMany = function (association, model, field) {
		associations.push({
			"field"	: association,
			"name"	: field,
			"type"	: "many",
			"entity": (!model ? this : model)	// this = circular reference
		});
	};
	Model.sync = function () {
		orm._db.createCollection(model, fields, associations);
	};
	Model.get = function (id, callback) {
		orm._db.selectRecords(model, { "conditions": { "id": id } }, function (err, data) {
			if (err) {
				return callback();
			}
			if (data.length == 0) {
				return callback();
			}
			callback(new Model(data[0]));
		});
	};
	Model.find = function () {
		console.log("find()");
	};

	return Model;
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
