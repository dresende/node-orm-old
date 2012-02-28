var orm = require(__dirname + "/../lib/orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	// define a Person
	var Person = db.define("person", {
		"created"	: { "type": "date" },
		"name"		: { "type": "string", "validations": [ orm.validators.unique() ] },
		"surname"	: { "type": "string", "def": "" },
		"age"		: { "type": "int", "validations": orm.validators.rangeNumber(18) },
		"male"		: { "type": "bool", "def": true },
		"meta"		: { "type": "struct" }
	}, {
		"methods"	: {
			// this is a method that can be called in any
			// instance
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});
	Person.find({ name: "Jane" }, function (Janes) {
		if (Janes === null) {
			return console.log("No Jane does not exist!");
		}

		var Jane = Janes[0];

		Jane.age = -15;
		console.log("saving Jane as -15 year old..");
		Jane.save({ "validateAll": true }, function (err, SavedJane) {
			// you should have 2 errors here
			console.log("error:", err);
			
			Jane.age = 19;
			console.log("saving Jane as 19 year old..");
			Jane.save(function (err, SavedJane) {
				console.log("error:", err);
				console.log("Jane:", SavedJane);
			});
		});
	});
});
