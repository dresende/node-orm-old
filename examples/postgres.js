var orm = require(__dirname + "/../lib/orm");

orm.connect("pg://orm:orm@localhost/orm", function (success, db) {
	if (!success) {
		console.log("Error %d: %s", db.number, db.message);
		return;
	}
	var Person = db.define("person", {
		   name: String,
		created: Date
	});
	Person.sync();

	Person.find({ name: [ "John Doe" ] }, function (people) {
		if (people !== null) {
			return console.log(people);
		}
		var John = new Person({ "name": "John Doe", "created": new Date() });
		John.save(function (err, person) {
			console.log(person);
		});
	});
});
