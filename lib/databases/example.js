var DBClient = function () {
	/**
	 * Object constructor. This can have all the parameters you want,
	 * it will only be used by the module.
	 **/
};
DBClient.prototype.createCollection = function (collection, fields, assocs) {
	/**
	 * Create collection with fields and assoc(iation)s
	 **/
};
DBClient.prototype.selectRecords = function (collection, config) {
	/**
	 * Get records from a collection. config is a hash that can have:
	 * - conditions: a hash with key=value AND conditions
	 * - order: order string like "field (asc|desc)[, ..]*"
	 * - limit: a limit amount of records to fetch
	 * - skip: an amount of records to skip from start
	 **/
};
DBClient.prototype.clearRecords = function (collection, config, callback) {
	/**
	 * Remove records from a collection. config is a hash that can have
	 * the same keys as .selectRecords (check comment above).
	 **/
};
DBClient.prototype.saveRecord = function (idProp, collection, data, callback) {
	/**
	 * Save a record. data is a hash with record data. if data.id exists,
	 * the record should be updated, otherwise created. callback is to
	 * be called after .saveRecord finishes.
	 * idProp is the name of the primary key field
	 **/
};
DBClient.prototype.end = function () {
	/**
     * Close the connection to the database. Do not reuse the db object.
	 **/
};

exports.connect = function (options, callback) {
	/**
	 * Initiate communication with the database. options is a hash with:
	 * - host: hostname to connect
	 * - port: port to use
	 * - auth: username:password to use
	 * - pathname: /database to use
	 *
	 * This options are parsed from a url string like: proto://auth@hostname:/pathname.
	 * Some parameters might not be present so you should ensure you have defaults.
	 *
	 * callback should be called with 2 parameters, where the first one is a boolean
	 * variable saying if connection was success or not. If not success, the second
	 * parameter should be an object with .number and .message keys saying what happened.
	 * If success, the second parameter should be a reference to the DBClient above.
	 **/
};
