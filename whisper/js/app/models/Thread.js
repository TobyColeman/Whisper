define(function() {

	function Thread(id){
		this.id = id;
		this.isEncrypted = false;
		this.hasAllKeys = true;
		this.numPeople = 0;
		this.keys = [];
	}


	Thread.prototype.setEncrypted = function(encrypted) {
		this.isEncrypted = encrypted;
	};


	Thread.prototype.setNumPeople = function() {
		this.numPeople +=1;
	};


	Thread.prototype.addKey = function(key) {
		this.keys.push(key);
		this.setNumPeople();
	};


	Thread.prototype.removeKey = function(key) {

		var index = this.keys.indexOf(key);

		if (index > -1)
			this.keys.splice(index, 1);
	};


	Thread.prototype.makeMessage = function(message, sender) {

		var payload = {
			sender: sender,
			messages: []
		};

		(function(){
			var i = 0;

			function encryptMessage(){
				if (i < this.numPeople){
					openpgp.encryptMessage(keys[i].pubKey.keys, message).then(function(pgpMessage){

						var message = {
							recipient: keys[i],
							content: pgpMessage
						};

						payload.messages.push(message);

						i++;
						encryptMessage();
					})
				}
				else{

				}
			}
		});
	};


	return Thread;
});