define(function() {

	function Thread(id){
		this.id = id;
		this.isEncrypted = false;
		this.people = [];
	}


	Thread.prototype.setEncrypted = function(encrypted) {
		if (encrypted)
			this.isEncrypted = true;
		else
			this.isEncrypted = false;
	};


	Thread.prototype.isEncrypted = function() {
		return this.isEncrypted();
	};


	Thread.prototype.addPerson = function(person) {
		this.people.push(person);
	};


	Thread.prototype.removePerson = function(person) {

		var index = this.people.indexOf(person);

		if (index > -1)
			this.people.splice(index, 1);
	};

	return Thread;
});