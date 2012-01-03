var orm = require(__dirname + "/../lib/orm");

function MyHashType(value) {
	try {
		this.hash = JSON.parse(value);
	} catch (e) {
		this.hash = {};
	}
}
MyHashType.prototype.toString = function () {
	return JSON.stringify(this.hash);
}
MyHashType.prototype.newRandomProp = function () {
	this.hash.prop = Math.random();
	console.log("meta.prop changed to ", this.hash.prop);
}

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	// define a Person
	var Person = db.define("person", {
		"created"	: Date,
		"name"		: String,
		"surname"	: String,
		"age"		: Number,
		"male"		: Boolean,
		"meta"		: MyHashType // this is saved as binary
	}, {
		"methods"	: {
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});

	Person.sync();

	createJohn(function (John) {
		console.log(John);
		console.log("instanceof John.meta == MyHashType ?", John.meta instanceof MyHashType);

		console.log("John.meta.newRandomProp()");
		John.meta.newRandomProp();

		John.save(function () {
			console.log("John saved. Run again to see if meta has changed");
			process.exit(0);
		});
	});

	function createJohn(callback) {
		Person.find({ "name": "John" }, function (people) {
			if (people === null) {
				var John = new Person({
					"name"   : "John",
					"surname": "Doe",
					"created": new Date(),
					"age"    : 25,
					"meta"   : new MyHashType("{prop:2}")
				});
				John.save(function (err, person) {
					callback(person);
				});
			} else {
				callback(people[0]);
			}
		});
	}
});
