var helpers = require("../lib/databases/helpers");
var should = require("should");

describe("helpers", function () {
	describe(".buildSqlOrder(A)", function () {
		it("should return ' ORDER BY A ASC'", function () {
			helpers.buildSqlOrder("A").should.equal(" ORDER BY A ASC");
		});
	});
	describe(".buildSqlOrder(A Asc)", function () {
		it("should return ' ORDER BY A ASC'", function () {
			helpers.buildSqlOrder("A Asc").should.equal(" ORDER BY A ASC");
		});
	});
	describe(".buildSqlOrder(A Desc)", function () {
		it("should return ' ORDER BY A DESC'", function () {
			helpers.buildSqlOrder("A Desc").should.equal(" ORDER BY A DESC");
		});
	});
	describe(".buildSqlOrder(A B Asc)", function () {
		it("should return ' ORDER BY A ASC, B ASC'", function () {
			helpers.buildSqlOrder("A B Asc").should.equal(" ORDER BY A ASC, B ASC");
		});
	});
	describe(".buildSqlOrder(A Asc B Asc)", function () {
		it("should return ' ORDER BY A ASC, B ASC'", function () {
			helpers.buildSqlOrder("A Asc B Asc").should.equal(" ORDER BY A ASC, B ASC");
		});
	});
	describe(".buildSqlOrder(A Desc B Asc)", function () {
		it("should return ' ORDER BY A DESC, B ASC'", function () {
			helpers.buildSqlOrder("A Desc B Asc").should.equal(" ORDER BY A DESC, B ASC");
		});
	});
	describe(".buildSqlOrder( A  B   C  )", function () {
		it("should return ' ORDER BY A ASC, B ASC, C ASC'", function () {
			helpers.buildSqlOrder(" A  B   C  ").should.equal(" ORDER BY A ASC, B ASC, C ASC");
		});
	});
	describe(".buildSqlOrder(A)", function () {
		it("should return ' ORDER BY A ASC'", function () {
			helpers.buildSqlOrder("A").should.equal(" ORDER BY A ASC");
		});
	});
	describe(".buildSqlLimit(N)", function () {
		it("should return ' LIMIT N'", function () {
			helpers.buildSqlLimit("N").should.equal(" LIMIT N");
		});
	});
	describe(".buildSqlLimit(N, M)", function () {
		it("should return ' LIMIT M,N'", function () {
			helpers.buildSqlLimit("N", "M").should.equal(" LIMIT M, N");
		});
	});
});
