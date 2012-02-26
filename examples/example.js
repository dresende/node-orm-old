var orm = require(__dirname + "/../lib/orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	// define a Person
	var Person = db.define("person", {
		"name"		: String,
		"surname"	: String,
		"age"		: Number,
		"male"		: Boolean,
		"meta"		: Object
	}, {
		"methods"	: {
			// this is a method that can be called in any
			// instance
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});
	// define a Pet
	var Pet = db.define("pet", {
		"name"		: { "type": "string" },
		"type"		: { "type": "enum", "values": [ "dog", "cat", "fish" ] }
	});
	
	// a Person has many "pets" (from model "Pet") where each one is called a "pet"
	Person.hasMany("pets", Pet, "pet");
	// another example: a Group has many "people" (from model "Person") where each one is called a "member"
	
	// sync to database
	Person.sync();
	Pet.sync();
	
	// create the Person John (if it does not exist)
	createJohn(function (John) {
		console.log(John);
		// create the Pet Deco (if it does not exist)
		createDeco(function (Deco) {
			// create the Pet Hugo (if it does not exist)
			createHugo(function (Hugo) {
			// add Deco and Hugo has John's pets
				John.addPets(Deco, Hugo, function () {
					console.log(Deco.name + " and " + Hugo.name + " are now " + John.fullName() + "'s pets");
				});
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

	function createHugo(callback) {
		Pet.find({ "name": "Hugo" }, function (pets) {
			if (pets === null) {
				var Hugo = new Pet({ "name": "Hugo", "type": "dog" });
				Hugo.save(function (err, dog) {
					callback(dog);
				});
			} else {
				callback(pets[0]);
			}
		});
	}
});
