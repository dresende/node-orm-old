var util = require("util");
var events = require("events");
var moment = require("moment");

var re_order_mode = /^(a|de)sc$/i;

function DBQuery(query) {
	events.EventEmitter.call(this);

	query.on("row", (function (o) {
		return function (row) {
			o.emit("record", row);
		};
	})(this));
	query.on("result", (function (o) {
		return function (row) {
			o.emit("record", row);
		};
	})(this));
	query.on("end", (function (o) {
		return function (res) {
			o.emit("end", res);
		};
	})(this));
	query.on("error", (function (o) {
		return function (err) {
			o.emit("error", err);
		};
	})(this));
}
util.inherits(DBQuery, events.EventEmitter);

module.exports = {
	DBQuery: DBQuery,

	// order should be in the format "<field>[ <order>][ <field>[ <order>] ..]"
	// - <order> must be "asc" or "desc"
	buildSqlOrder: function (order, escapeCb) {
		var orders = [], i = 0;

		order = order.replace(/\s+$/, '').replace(/^\s+/, '').split(/\s+/);

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
		var token_n = 1;

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
				_conditions.push(prop + op + (opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
				if (typeof opts.boolean_convert == "function") {
					_values.push(opts.boolean_convert(conditions[k]));
				} else {
					_values.push(conditions[k] ? 1 : 0);
				}
				continue;
			}
			if (Array.isArray(conditions[k])) {
				if (conditions[k].length > 0) {
					var tmp = [];
					for (i = 0; i < conditions[k].length; i++) {
						tmp.push((opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
					}
					_conditions.push(prop + " " + (op == "!=" ? "NOT " : "") + "IN (" + tmp.join(",") + ")");
					_values = _values.concat(conditions[k]);
				} else {
					// ?
					_conditions.push(prop + " " + (op == "!=" ? "NOT " : "") + "IN (NULL)");
				}
				continue;
			}
			if (typeof conditions[k] == "object" && conditions[k].hasOwnProperty("__ormFunction")) {
				_conditions.push(conditions[k].__ormFunction.replace(/\#\#/g, escapeCb(prop)) + op + (opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
				_values.push(conditions[k].v);
				continue;
			}
			_conditions.push(prop + op + (opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
			_values.push(conditions[k]);
		}

		return [ " WHERE " + _conditions.join(" AND "), _values ];
	},

	createSqlUpdate: function (opts) {
		var query = "UPDATE " + opts.escape(opts.table) +
		            " SET %values WHERE " + opts.escape(opts.key) + " = " + opts.id;

		query = query.replace("%values", opts.info.query);

		// console.log(query, opts.info.values);
		return opts.db.query(query, opts.info.values, this.handleSqlUpdateCall(opts.callback));
	},

	createSqlInsert: function (opts) {
		var query = "INSERT INTO " + opts.escape(opts.table) + " (%fields) " +
		            "VALUES (%values)";

		query = query.replace("%fields", Object.keys(opts.data).map(opts.escape).join(", "));
		query = query.replace("%values", opts.info.escapes.join(", "));

		// console.log(query, opts.info.values);
		return opts.db.query(query, opts.info.values, this.handleSqlInsertCall(opts.callback));
	},

	handleSqlUpdateCall: function (cb) {
		return function (err, info) {
			if (err) {
				return cb(err);
			}
			return cb(null);
		};
	},

	handleSqlInsertCall: function (cb, orm) {
		return function (err, info) {
			if (err) {
				return cb(err);
			}
			return cb(null, info.insertId);
		};
	},

	escapeUpdateFields: function (data, escapeCb, opts) {
		var val = [], id = [], token_n = 1;

		for (var k in data) {
			if (!data.hasOwnProperty(k)) continue;

			if (typeof data[k] == "boolean") {
				id.push(escapeCb(k) + " = " + (opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
				val.push(opts.boolean_convert(data[k]));
				continue;
			}
			if (data[k] === null) {
				id.push(escapeCb(k) + " = " + (opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
				val.push(null);
				continue;
			}
			if (util.isDate(data[k])) {
				id.push(escapeCb(k) + " = " + opts.date_convert_fmt);
				val.push(moment.utc(data[k]).unix());
				continue;
			}
			id.push(escapeCb(k) + " = " + (opts.tokenCb ? opts.tokenCb(token_n++) : "?"));
			val.push(data[k]);
		}

		return { query: id.join(", "), values: val };
	},
	escapeInsertFields: function (data, opts) {
		var val = [], escapes = [], token_n = 1;

		for (var k in data) {
			if (!data.hasOwnProperty(k)) continue;

			if (typeof data[k] == "boolean") {
				escapes.push(opts.tokenCb ? opts.tokenCb(token_n++) : "?");
				val.push(opts.boolean_convert(data[k]));
				continue;
			}
			if (data[k] === null) {
				escapes.push(opts.tokenCb ? opts.tokenCb(token_n++) : "?");
				val.push(null);
				continue;
			}
			if (util.isDate(data[k])) {
				escapes.push(opts.date_convert_fmt);
				val.push(moment.utc(data[k]).unix());
				continue;
			}
			escapes.push(opts.tokenCb ? opts.tokenCb(token_n++) : "?");
			val.push(data[k]);
		}

		return { values: val, escapes: escapes };
	}
};
