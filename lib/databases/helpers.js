var util = require("util");

var re_order_mode = /^(a|de)sc$/i;

module.exports = {
	// order should be in the format "<field>[ <order>][ <field>[ <order>] ..]"
	// - <order> must be "asc" or "desc"
	buildSqlOrder: function (order, escapeCb) {
		var orders = [], i = 0;

		order = order.split(/\s+/);

		for (; i < order.length; i++) {
			if (i < order.length - 1 && re_order_mode.test(order[i + 1])) {
				orders.push((escapeCb ? escapeCb(order[i]) : order[i]) + " " + order[i + 1].toUpperCase());
				i += 1;
			} else {
				orders.push((escapeCb ? escapeCb(order[i]) : order[i]) + " ASC");
			}
		}

		return " ORDER BY " + orders.join(", ");
	},
	// both limit and skip should be numbers, skip is optional
	buildSqlLimit: function (limit, skip) {
		if (skip) {
			return " LIMIT " + skip + ", " + limit;
		}
		return " LIMIT " + limit;
	},
	buildSqlWhere: function (conditions, escapeCb, opts) {
		var _conditions = [], _values = [], prop, op, i;

		if (!opts) opts = {};

		for (var k in conditions) {
			if (!conditions.hasOwnProperty(k)) continue;

			if (k.indexOf(" ") > 0) {
				op = k.substr(k.indexOf(" ") + 1, k.length).replace(/^\s+/, "");
				prop = k.substr(0, k.indexOf(" "));

				if (Array.isArray(opts.additional_operators) && opts.additional_operators.indexOf(op.toUpperCase()) >= 0) {
					op = " " + op.toUpperCase() + " ";
				} else if ([ "=", "!", "!=", ">", "<", ">=", "<=" ].indexOf(op) == -1) {
					op = "=";
				} else if (op == "!") {
					op = "!=";
				}
			} else {
				prop = k;
				op = "=";
			}

			if (escapeCb) prop = escapeCb(prop);

			if (typeof conditions[k] == "boolean") {
				_conditions.push(prop + op + "?");
				_values.push(conditions[k] ? 1 : 0);
				continue;
			}
			if (Array.isArray(conditions[k])) {
				if (conditions[k].length > 0) {
					_conditions.push(prop + " " + (op == "!=" ? "NOT " : "") + "IN (" + (new Array(conditions[k].length)).join("?,") + "?)");
					_values = _values.concat(conditions[k]);
				} else {
					// ?
					_conditions.push(prop + " " + (op == "!=" ? "NOT " : "") + "IN (NULL)");
				}
				continue;
			}
			if (typeof conditions[k] == "object" && conditions[k].hasOwnProperty("__ormFunction")) {
				_conditions.push(conditions[k].__ormFunction.replace(/\#\#/g, "`" + prop + "`") + op + "?");
				_values.push(conditions[k].v);
				continue;
			}
			_conditions.push(prop + op + "?");
			_values.push(conditions[k]);
		}

		return [ " WHERE " + _conditions.join(" AND "), _values ];
	},

	escapeUpdateFields: function (data, escapeCb, opts) {
		var val = [], id = [];

		for (var k in data) {
			if (!data.hasOwnProperty(k)) continue;

			if (typeof data[k] == "boolean") {
				id.push(escapeCb(k) + " = ?");
				val.push(opts.boolean_convert(data[k]));
				continue;
			}
			if (data[k] === null) {
				id.push(escapeCb(k) + " = ?");
				val.push(null);
				continue;
			}
			if (util.isDate(data[k])) {
				id.push(escapeCb(k) + " = " + opts.date_convert_fmt);
				val.push(Math.round(data[k].getTime() / 1e3));
				continue;
			}
			id.push(escapeCb(k) + " = ?");
			val.push(data[k]);
		}

		return { query: id.join(", "), values: val };
	},

	escapeInsertFields: function (data, opts) {
		var val = [], escapes = [];

		for (var k in data) {
			if (!data.hasOwnProperty(k)) continue;

			if (typeof data[k] == "boolean") {
				escapes.push("?");
				val.push(opts.boolean_convert(data[k]));
				continue;
			}
			if (data[k] === null) {
				escapes.push("?");
				val.push(null);
				continue;
			}
			if (util.isDate(data[k])) {
				escapes.push(opts.date_convert_fmt);
				val.push(Math.round(data[k].getTime() / 1e3));
				continue;
			}
			escapes.push("?");
			val.push(data[k]);
		}

		return { values: val, escapes: escapes };
	}
};
