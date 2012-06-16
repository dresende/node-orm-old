var validators = require("../lib/validators");
var should = require("should");

describe("validators", function () {
	var tests = {
		rangeNumber: [
			[ [ 3, 6 ], [ 3 ] ],
			[ [ 3, 6 ], [ 4 ] ],
			[ [ 3, 6 ], [ 6 ] ],
			[ [ 3, 6 ], [ -4 ], "out-of-range-number" ],
			[ [ 3 ], [ 3 ] ],
			[ [ 3 ], [ 5 ] ],
			[ [ 3 ], [ 2 ], "out-of-range-number" ],
			[ [ 3 ], [ -2 ], "out-of-range-number" ],
			[ [ undefined, 3 ], [ -2 ] ],
			[ [ undefined, 3 ], [ 2 ] ],
			[ [ undefined, 3 ], [ 3 ] ],
			[ [ undefined, 3 ], [ 5 ], "out-of-range-number" ]
		],
		rangeLength: [
			[ [ 3, 6 ], [ "abc" ] ],
			[ [ 3, 6 ], [ "abcdef" ] ],
			[ [ 3, 6 ], [ "ab" ], "out-of-range-length" ],
			[ [ 3, 6 ], [ "abcdefg" ], "out-of-range-length" ],
			[ [ 3, 6 ], [ undefined ], "undefined" ]
		],
		insideList: [
			[ [[ 1, 2, "a" ]], [ 1 ] ],
			[ [[ 1, 2, "a" ]], [ 2 ] ],
			[ [[ 1, 2, "a" ]], [ "a" ] ],
			[ [[ 1, 2, "a" ]], [ "1" ], "outside-list" ]
		],
		outsideList: [
			[ [[ 1, 2, "a" ]], [ "1" ] ],
			[ [[ 1, 2, "a" ]], [ 1 ], "inside-list" ],
			[ [[ 1, 2, "a" ]], [ 2 ], "inside-list" ],
			[ [[ 1, 2, "a" ]], [ "a" ], "inside-list" ]
		],
		equalToProperty: [
			[ [ "strprop" ], [ "str" ] ],
			[ [ "strprop" ], [ "not" ], "not-equal-to-property" ],
			[ [ "numprop" ], [ 2 ] ],
			[ [ "numprop" ], [ "2" ] ],
			[ [ "numprop" ], [ 3 ], "not-equal-to-property" ],
			[ [ "boolprop" ], [ false ] ],
			[ [ "boolprop" ], [ null ], "not-equal-to-property" ],
			[ [ "boolprop" ], [ true ], "not-equal-to-property" ],
			[ [ "boolprop" ], [ undefined ], "not-equal-to-property" ]
		]
	};
	for (var k in tests) {
		for (var i = 0; i < tests[k].length; i++) {
			addTest(k, tests[k][i][0], tests[k][i][1], tests[k][i][2]);
		}
	}
});

function addTest(fun, params1, params2, throwValue) {
	var test = testName(fun, params1, params2);

	if (!throwValue) {
		return describe(test, shouldNotThrow(validators[fun], params1, params2));
	}
	return describe(test, shouldThrow(validators[fun], params1, params2, throwValue));
}

function testName(fun, params1, params2) {
	return "." + fun + "(" + params1.join(", ") + ")(" + params2.join(", ") + ")";
}

function shouldNotThrow(validator, build_params, call_params) {
	call_params.push(function (err) {
		should.strictEqual(undefined, err);
	});
	call_params.push({ strprop: "str", numprop: 2, boolprop: false });

	return function () {
		it("should not throw error", function () {
			validator.apply(null, build_params).apply(null, call_params);
		});
	};
}

function shouldThrow(validator, build_params, call_params, error) {
	call_params.push(function (err) {
		should.strictEqual(error, err);
	});
	call_params.push({ strprop: "str", numprop: 2, boolprop: false });

	return function () {
		it("should throw error '" + error + "'", function () {
			validator.apply(null, build_params).apply(null, call_params);
		});
	};
}
