var helpers = require("../lib/databases/helpers");
var should = require("should");
var sqlWhereOpts = {
	boolean_convert: function (val) {
		return val ? 'pass' : 'fail';
	}
};

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
		],
		buildSqlWhere: [
			[ [ {}, escapeCb ], [ " WHERE ", [] ] ],
			[ [ { "prop1": 2 }, escapeCb ], [ " WHERE $prop1$=?", [ 2 ] ] ],
			[ [ { "prop1": 'a' }, escapeCb ], [ " WHERE $prop1$=?", [ 'a' ] ] ],
			[ [ { "prop1": 2, "prop2": '2' }, escapeCb ], [ " WHERE $prop1$=? AND $prop2$=?", [ 2, '2' ] ] ],
			[ [ { "prop1": 2, "prop2": true }, escapeCb, sqlWhereOpts ], [ " WHERE $prop1$=? AND $prop2$=?", [ 2, 'pass' ] ] ],
			[ [ { "prop1": 2, "prop2": false }, escapeCb, sqlWhereOpts ], [ " WHERE $prop1$=? AND $prop2$=?", [ 2, 'fail' ] ] ],
			[ [ { "prop1 !": 2 }, escapeCb ], [ " WHERE $prop1$!=?", [ 2 ] ] ],
			[ [ { "prop1 !=": 2 }, escapeCb ], [ " WHERE $prop1$!=?", [ 2 ] ] ],
			[ [ { "prop1 >": 2 }, escapeCb ], [ " WHERE $prop1$>?", [ 2 ] ] ],
			[ [ { "prop1 <": 2 }, escapeCb ], [ " WHERE $prop1$<?", [ 2 ] ] ],
			[ [ { "prop1 >=": 2 }, escapeCb ], [ " WHERE $prop1$>=?", [ 2 ] ] ],
			[ [ { "prop1 <=": 2 }, escapeCb ], [ " WHERE $prop1$<=?", [ 2 ] ] ],
			[ [ { "prop1": [ ] }, escapeCb ], [ " WHERE $prop1$ IN (NULL)", [ ] ] ],
			[ [ { "prop1": [ 1, 2 ] }, escapeCb ], [ " WHERE $prop1$ IN (?,?)", [ 1, 2 ] ] ],
			[ [ { "prop1 !": [ 1, 2 ] }, escapeCb ], [ " WHERE $prop1$ NOT IN (?,?)", [ 1, 2 ] ] ]
		]
	};

	for (var k in tests) {
		for (var i = 0; i < tests[k].length; i++) {
			addTest(k, tests[k][i][0], tests[k][i][1]);
		}
	}
});

function addTest(fun, params, expected) {
	var p = [];
	for (var i = 0; i < params.length; i++) {
		switch (typeof params[i]) {
			case "object":
				if (Array.isArray(params[i])) {
					p.push("[" + params[i].join(",") + "]");
				} else {
					p.push(params[i]);
				}
				break;
			case "function":
				p.push("[Function]");
				break;
			case "string":
				p.push("'" + params[i] + "'");
				break;
			default:
				p.push(params[i]);
		}
	}

	describe("." + fun + "(" + p.join(", ") + ")", function () {
		it("should return '" + expected + "'", function () {
			helpers[fun].apply(helpers, params).should.eql(expected);
		});
	});
}

function escapeCb(name) {
	return '$' + name + '$';
}
