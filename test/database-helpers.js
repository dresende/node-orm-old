var helpers = require("../lib/databases/helpers");
var should = require("should");

describe("helpers", function () {
	var tests = {
		buildSqlOrder: [
			[ [ "A" ], " ORDER BY A ASC" ],
			[ [ "A Asc" ], " ORDER BY A ASC" ],
			[ [ "A Desc" ], " ORDER BY A DESC" ],
			[ [ "A B Asc" ], " ORDER BY A ASC, B ASC" ],
			[ [ "A Asc B Asc" ], " ORDER BY A ASC, B ASC" ],
			[ [ "A Desc B" ], " ORDER BY A DESC, B ASC" ],
			[ [ " A  B   C  " ], " ORDER BY A ASC, B ASC, C ASC" ],
			[ [ "A" ], " ORDER BY A ASC" ]
		],
		buildSqlLimit: [
			[ [ "N" ], " LIMIT N" ],
			[ [ "N", "M" ], " LIMIT M, N" ]
		]
	};

	for (var k in tests) {
		for (var i = 0; i < tests[k].length; i++) {
			addTest(k, tests[k][i][0], tests[k][i][1]);
		}
	}
});

function addTest(fun, params, expected) {
	describe("." + fun + "(" + params.join(", ") + ")", function () {
		it("should return '" + expected + "'", function () {
			helpers[fun].apply(helpers, params).should.equal(expected);
		});
	});
}
