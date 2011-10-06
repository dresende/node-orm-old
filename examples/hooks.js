var orm = require(__dirname + "/../lib/orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	// define a Person
	var Person = db.define("person", {
		"created"	: { "type": "date" },
		"updated"	: { "type": "date" },
		"name"		: { "type": "string" },
		"surname"	: { "type": "string", "def": "" },
		"age"		: { "type": "int" },
		"male"		: { "type": "bool", "def": true },
		"meta"		: { "type": "struct" }
	}, {
		"methods"	: {
			// this is a method that can be called in any
			// instance
			fullName: function () {
				return this.name + " " + this.surname;
			}
		},
		"hooks": {
			beforeSave: function (person) {
				person.updated = new Date();
			},
			afterSave: function (success, person) {
				if (!success) {
					return console.log("%s not saved :(", person.fullName());
				}
				console.log("%s saved :)", person.fullName());
			}
		}
	});

	Person.sync();
	Person.find({ name: "Jane" }, function (Janes) {
		if (Janes === null) {
			return console.log("No Jane does not exist!");
		}

		var Jane = Janes[0];
		console.log(Jane);

		Jane.age = 20 + Math.round(Math.random() * 10);

		console.log("saving Jane..");
		Jane.save(function (err, SavedJane) {
			console.log("error:", err);
			console.log("Jane:", SavedJane);
		});
	});
});
