module.exports = {
	hash: function (data) {
		var h = require("crypto").createHash("md5");
		h.update(JSON.stringify(data));

		return h.digest("hex");
	}
}