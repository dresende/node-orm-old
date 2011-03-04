var orm = require("./orm");

orm.connect("mysql://orm:orm@localhost/orm", function (success, db) {
	var Person = db.define("person", {
		"name"		: { "type": "string" },
		"surname"	: { "type": "string", "default": "" },
		"age"		: { "type": "int" }
	}, {
		"methods"	: {
			"fullName" :function () {
				return this.name + " " + this.surname;
			}
		}
	});
	Person.hasOne("sibling", Person);
	Person.hasMany("friends", Person, "friend");
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
	console.log(John);
	
	// this will auto-save Jane
	John.setSibling(Jane, function (success) {
		if (success) {
			John.save(function (success) {
				if (success) {
					console.log(John);
					John.unsetSibling(function (success) {
						John.save(function (success) {
							if (success) {
								console.log(John);
							}
						});
					});
				}
			});
		}
	});
});
