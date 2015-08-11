define(["Key"], function(Key) {

	function Person(vanity, fbid){
		this.vanity = vanity;
		this.fbid = fbid;
		this.key = false;
	}


	Person.prototype.setKey = function(key) {
		this.key = new Key(key);
	};

	return Person;
});