var orm = require(__dirname + "/../lib/orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	// define a Pet
	var Pet = db.define("pet", {
		"name"		: { "type": "string" },
		"type"		: { "type": "enum", "values": [ "dog", "cat", "fish" ] }
	});
	// define a Person
	var Person = db.define("person", {
		"created"	: Date,
		"name"		: String,
		"surname"	: String,
		"age"		: Number,
		"male"		: Boolean,
		"pet"       : [ Pet ] // same as: Person.hasMany("pets", Pet, "pet");
	}, {
		"methods"	: {
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});

	Person.find(function (people) {
		for (var i = 0; i < people.length; i++) {
			console.log(people[i].fullName());
			people[i].getPets((function (person) {
				return function (pets) {
					for (var i = 0; i < pets.length; i++) {
						console.log("%s has %s %s", person.fullName(), pets[i].type, pets[i].name)
					}
				}
			})(people[i]));
		}
	});
});
