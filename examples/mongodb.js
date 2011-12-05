var orm = require(__dirname + "/../lib/orm");

orm.connect("mongodb://localhost/dfs", function (success, db) {
	if (!success) {
		console.log("Error %d: %s", db.number, db.message);
		return;
	}

	var Doc = db.define("docs", {
		"path"		: String,
		"key"		: String,
		"meta"		: Object,
		"copies"	: Number,
		"size"		: Number,
		"hash"		: String,
		"location"	: Object
	});

	Doc.find({ key: "mykey" }, function (doc) {
		if (doc === null) {
			return console.log("no docs found");
		}
		console.log("doc with key 'mykey' has id '%s'", doc[0].id);
		console.log(doc[0]);
		
		doc[0].location = [ "nowhere", "somewhere" ];
		doc[0].save(function (err, saved_doc) {
			console.log("err?", err);
			console.log(saved_doc);
		});
	});

	setTimeout(function () {
		console.log("Doc.clear()");
		Doc.clear();
	}, 1e3);

	var mydoc = new Doc({
		"path": "/my/path",
		"key" : "mykey",
		"meta": { "my": "doc" },
		"copies": 1,
		"size": 12345,
		"hash": "myhash",
		"location": "nowhere"
	});
	mydoc.save(function (err, doc) {
		console.log(err);
		console.log(doc);
	});
});
