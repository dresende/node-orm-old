module.exports = {
	"afterSave": function (data, Model) {
		console.log("record saved", data, Model._ORM);
	}
};
