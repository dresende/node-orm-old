var v = require("../lib/validators");
var should = require("should");

describe("validators", function () {
	describe(".rangeNumber(3, 6)(3)", shouldNotThrow(v.rangeNumber, [ 3, 6 ], [ 3 ]));
	describe(".rangeNumber(3, 6)(4)", shouldNotThrow(v.rangeNumber, [ 3, 6 ], [ 4 ]));
	describe(".rangeNumber(3, 6)(6)", shouldNotThrow(v.rangeNumber, [ 3, 6 ], [ 6 ]));
	describe(".rangeNumber(3, 6)(2)", shouldThrow(v.rangeNumber, [ 3, 6 ], [ -4 ], "out-of-range-number"));
	describe(".rangeNumber(3)(3)", shouldNotThrow(v.rangeNumber, [ 3 ], [ 3 ]));
	describe(".rangeNumber(3)(5)", shouldNotThrow(v.rangeNumber, [ 3 ], [ 5 ]));
	describe(".rangeNumber(3)(2)", shouldThrow(v.rangeNumber, [ 3 ], [ 2 ], "out-of-range-number"));
	describe(".rangeNumber(3)(-2)", shouldThrow(v.rangeNumber, [ 3 ], [ -2 ], "out-of-range-number"));
	describe(".rangeNumber(, 3)(-2)", shouldNotThrow(v.rangeNumber, [ undefined, 3 ], [ -2 ]));
	describe(".rangeNumber(, 3)(2)", shouldNotThrow(v.rangeNumber, [ undefined, 3 ], [ 2 ]));
	describe(".rangeNumber(, 3)(3)", shouldNotThrow(v.rangeNumber, [ undefined, 3 ], [ 3 ]));
	describe(".rangeNumber(, 3)(5)", shouldThrow(v.rangeNumber, [ undefined, 3 ], [ 5 ], "out-of-range-number"));

	describe(".rangeLength(3, 6)('abc')", shouldNotThrow(v.rangeLength, [ 3, 6 ], [ "abc" ]));
	describe(".rangeLength(3, 6)('abcdef')", shouldNotThrow(v.rangeLength, [ 3, 6 ], [ "abcdef" ]));
	describe(".rangeLength(3, 6)('ab')", shouldThrow(v.rangeLength, [ 3, 6 ], [ "ab" ], "out-of-range-length"));
	describe(".rangeLength(3, 6)('abcdefg')", shouldThrow(v.rangeLength, [ 3, 6 ], [ "abcdefg" ], "out-of-range-length"));
	describe(".rangeLength(3, 6)()", shouldThrow(v.rangeLength, [ 3, 6 ], [ undefined ], "undefined"));

	describe(".insideList([ 1, 2, 'a' ])(1)", shouldNotThrow(v.insideList, [ [ 1, 2, 'a' ] ], [ 1 ]));
	describe(".insideList([ 1, 2, 'a' ])(2)", shouldNotThrow(v.insideList, [ [ 1, 2, 'a' ] ], [ 2 ]));
	describe(".insideList([ 1, 2, 'a' ])('a')", shouldNotThrow(v.insideList, [ [ 1, 2, 'a' ] ], [ 'a' ]));
	describe(".insideList([ 1, 2, 'a' ])('1')", shouldThrow(v.insideList, [ [ 1, 2, 'a' ] ], [ '1' ], "outside-list"));

	describe(".outsideList([ 1, 2, 'a' ])('1')", shouldNotThrow(v.outsideList, [ [ 1, 2, 'a' ] ], [ '1' ]));
	describe(".outsideList([ 1, 2, 'a' ])(1)", shouldThrow(v.outsideList, [ [ 1, 2, 'a' ] ], [ 1 ], "inside-list"));
	describe(".outsideList([ 1, 2, 'a' ])(2)", shouldThrow(v.outsideList, [ [ 1, 2, 'a' ] ], [ 2 ], "inside-list"));
	describe(".outsideList([ 1, 2, 'a' ])('a')", shouldThrow(v.outsideList, [ [ 1, 2, 'a' ] ], [ 'a' ], "inside-list"));
});

function shouldNotThrow(validator, build_params, call_params) {
	call_params.push(function (err) {
		should.strictEqual(undefined, err);
	});

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

	return function () {
		it("should throw error '" + error + "'", function () {
			validator.apply(null, build_params).apply(null, call_params);
		});
	};
}
