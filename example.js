var orm = require("./orm");

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
	// one to one association: Person.sibling -> Person.id
	Person.hasOne("sibling", Person);
	// many to many association: creates table person_friends with primary keys person_id and friend_id
	Person.hasMany("friends", Person, "friend");
	// create table(s) on database
	Person.sync();

	// new records
	var John = new Person({
		"created"	: new Date(),
		"name"		: "John",
		"surname"	: "Doe",
		"age"		: 20,
		"meta"		: {
			"birthday"	: "June 10",
			"shoeSize"	: 43
		}
	});
	
	console.log("John:");
	console.dir(John);
	
	John.save(function (err) {
		Person.get(John.id, function (JohnCopy) {
			console.log("John Copy:");
			console.dir(JohnCopy);
		});
	});
	return;
	var Jane = new Person({
		"name"		: "Jane",
		"surname"	: "Doe",
		"age"		: 18,
		"male"		: false
	});
	
	// this will auto-save Jane (to get Jane's ID)
	John.setSibling(Jane, function (err) {
		if (err) {
			console.dir(err);
			return;
		}
		John.save();

		John.getSibling(function (JaneCopy) {
			console.dir(JaneCopy);
			console.log(Jane == JaneCopy);
			Person.get(Jane.id, function (otherJaneCopy) {
				console.dir(otherJaneCopy);
				console.log(otherJaneCopy == JaneCopy);
			});
		});
	});
});
