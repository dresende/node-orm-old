/**
 * This is a supposed to be a list of common validators
 * that can be reused instead of creating new ones.
 **/
var validators = {};

/**
 * Check if a number is between a minimum and
 * a maximum number. One of this constraints
 * can be omitted.
 **/
validators.rangeNumber = function (min, max) {
	return function (n, next) {
		if (min === undefined && n <= max) return next();
		if (max === undefined && n >= min) return next();
		if (n >= min && n <= max) return next();
		return next('out-of-range-number');
	};
};

/**
 * Check if a string length is between a minimum
 * and a maximum number. One of this constraints
 * can be omitted.
 **/
validators.rangeLength = function (min, max) {
	return function (v, next) {
		if (min === undefined && v.length <= max) return next();
		if (max === undefined && v.length >= min) return next();
		if (v.length >= min && v.length <= max) return next();
		return next('out-of-range-length');
	};
};

/**
 * Check if a value (number or string) is
 * in a list of values.
 **/
validators.insideList = function (list) {
	return function (v, next) {
		if (list.indexOf(val) >= 0) return next();
		return next('outside-list');
	};
};

/**
 * Check if a value (number or string) is
 * not in a list of values.
 **/
validators.outsideList = function (list) {
	return function (v, next) {
		if (list.indexOf(val) == -1) return next();
		return next('inside-list');
	};
};

/**
 * Check if a value is the same as a value
 * of another property.
 **/
validators.equalToProperty = function (name) {
	return function (v, next, data) {
		if (v == data[name]) return next();
		return next('not-equal-to-property');
	};
};

/**
 * Check if a string has zero length. Sometimes
 * you might want to have a property on your
 * model that is not required but on a specific
 * form it can be.
 **/
validators.notEmptyString = function () {
	return validators.rangeLength(1);
};

/**
 * Pattern validators are usually based on regular
 * expressions and solve more complicated validations
 * you might need.
 **/
validators.patterns = {};

/**
 * Check if a value matches a given pattern.
 * You can define a pattern string and regex
 * modifiers or just send the RegExp object
 * as 1st argument.
 **/
validators.patterns.match = function (pattern, modifiers) {
	return function (v, next) {
		if (typeof pattern == "string") {
			pattern = new RegExp(pattern, modifiers);
		}
		if (v.match(pattern)) return next();
		return next('no-pattern-match');
	};
};

/**
 * Check if a value is an hexadecimal string
 * (letters from A to F and numbers).
 **/
validators.patterns.hexString = function () {
	return validators.patterns.match("^[a-f0-9]+$", "i");
};

module.exports = validators;