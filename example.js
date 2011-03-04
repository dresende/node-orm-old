var orm = require("./orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	var Person = db.define("person", {
		"name"		: { "type": "string" },
		"surname"	: { "type": "string", "default": "" },
		"age"		: { "type": "int" }
	}, {
		"classMethods"	: {
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});
	Person.sync();

	var John = new Person({
		"name"		: "John",
		"surname"	: "Doe",
		"age"		: 20
	});
	var Jane = new Person({
		"name"		: "Jane",
		"surname"	: "Doe",
		"age"		: 18
	});
	
	console.log("Hi, my name is " + John.fullName() + " and I'm " + John.age + " years old");
	console.log("And my name is " + Jane.name + " and I'm " + Jane.age + " years old");
	
	Person.find();
});
