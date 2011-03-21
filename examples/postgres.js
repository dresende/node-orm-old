var orm = require(__dirname + "/../lib/orm");

orm.connect("postgresql://postgres:postgres@localhost/amber", function (success, db) {
	if (!success) {
		console.log("Error %d: %s", db.number, db.message);
		return;
	}
	var FTS = db.define("fts", {
		"name"		: { "type": "string" },
		"body"		: { "type": "text", "textsearch": true }
	});
	FTS.sync();

	var fts = [
		new FTS({ "name": "John", "body": "John is friend of Jane and Jeremy" }),
		new FTS({ "name": "Jane", "body": "This girl is not friendly" }),
		new FTS({ "name": "Jeremy", "body": "This guy has no one" }),
		new FTS({ "name": "Jessica", "body": "Jessica does not have any friends" }),
		new FTS({ "name": "Jasmin", "body": "Jasmin is too young" })
	];
	FTS.clear(function () {
		for (var i = 0; i < fts.length; i++) {
			fts[i].save(function (err) {
				if (err) {
					console.log("Error %s: %s", err.number, err.message);
					return;
				}
				console.dir("FTS saved");
			});
		}
	});

	setTimeout(function () {
		console.log("Searching for 'friends or jeremy or (jane and not jones)' (max 2 results)..");
		FTS.textsearch(2, "friends or jeremy or (jane and not jones)", function (people) {
			if (people === null) {
				return console.log("Error searching");
			}
			for (i = 0; i < people.length; i++) {
				console.log("%s (%d) = '%s'", people[i].name, people[i].id, people[i].body);
			}
		});
	}, 1500);
});
