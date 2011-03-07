var orm = require(__dirname + "/../lib/orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	var Person = db.define("person", {
		"created"	: { "type": "date" },
		"name"		: { "type": "string" },
		"surname"	: { "type": "string", "def": "" },
		"age"		: { "type": "int" },
		"male"		: { "type": "bool", "def": true },
		"meta"		: { "type": "struct" }
	}, {
		"methods"	: {
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});
	var Pet = db.define("pet", {
		"name"		: { "type": "string" },
		"type"		: { "type": "enum", "values": [ "dog", "cat", "fish" ] }
	});
	Person.hasMany("pets", Pet, "pet");
	
	Person.sync();
	Pet.sync();
	
	createJohn(function (John) {
		createDeco(function (Deco) {
			John.addPets(Deco, function () {
				console.log(Deco.name + " is now " + John.fullName() + "'s dog");
			});
		});
	});

	function createJohn(callback) {
		Person.find({ "name": "John" }, function (people) {
			if (people === null) {
				var John = new Person({ "name": "John", "surname": "Doe", "created": new Date(), "age": 25 });
				John.save(function (err, person) {
					callback(person);
				});
			} else {
				callback(people[0]);
			}
		});
	}

	function createDeco(callback) {
		Pet.find({ "name": "Deco" }, function (pets) {
			if (pets === null) {
				var Deco = new Pet({ "name": "Deco", "type": "dog" });
				Deco.save(function (err, dog) {
					callback(dog);
				});
			} else {
				callback(pets[0]);
			}
		});
	}
});
