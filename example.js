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
	// one to one association: Person.sibling -> Person.id
	Person.hasOne("sibling", Person);
	// many to many association: creates table person_friends with primary keys person_id and friend_id
	Person.hasMany("friends", Person, "friend");
	// create table(s) on database
	Person.sync();

	// new records
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
	
	// show John record
	console.log(John);
	
	// this will auto-save Jane (to get Jane's ID)
	John.setSibling(Jane, function (success) {
		if (success) {
			John.save(function (success) {
				if (success) {
					// show John record again (should have sibling_id)
					console.log(John);
					John.unsetSibling(function (success) {
						John.save(function (success) {
							if (success) {
								// show John record again (should have sibling_id = 0)
								console.log(John);
							}
						});
					});
				}
			});
		}
	});
});
