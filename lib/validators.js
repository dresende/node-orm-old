/**
 * This is a supposed to be a list of common validators
 * that can be reused instead of creating new ones.
 **/
module.exports = {
	"rangeNumber": function (min, max) {
		return function (num, next) {
			if (num >= min && num <= max) return next();
			return next('out-of-range-number');
		};
	},
	"insideList": function (list) {
		return function (val, next) {
			if (list.indexOf(val) >= 0) return next();
			return next('outside-list');
		};
	},
	"outsideList": function (list) {
		return function (val, next) {
			if (list.indexOf(val) == -1) return next();
			return next('inside-list');
		};
	}
};