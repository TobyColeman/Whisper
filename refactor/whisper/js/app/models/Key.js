define(['openpgp'], function (openpgp) {

	/*
	 * @param pgpKey {dict} contains a public key, optional private key and a facebook id
	 */
    function Key(pgpKey) {
		this.pubKey = pgpKey['pubKey'];
		this.privKey = pgpKey['privKey'] === undefined ? null : pgpKey['privKey'];
		this.fb_id = pgpKey['fb_id'];
    }

    /*
     * @returns {string} the id of the key, format: FirstName LastName <email@domain.com>
     */
	Key.prototype.getId = function(){
		return openpgp.key.readArmored(this.pubKey).keys[0].users[0].userId.userid;
	}

	/*
	 * @returns {string} the name part of the key's id
	 */
	Key.prototype.getName = function(){
		var id = this.getId();
		var name = id.split('<')[0];
		return name;
	}

	/*
	 * @returns {string} the email part of the key's id
	 */
	Key.prototype.getEmail = function(){
		var id = this.getId();
		var email = id.split('<')[1].replace('>', '');
		return email;
	}

	/*
	 * @returns {integer} the length of the key
	 */
	Key.prototype.getPubKeyLength = function(){
		var publicKeyPacket = openpgp.key.readArmored(this.pubKey).keys[0].primaryKey;

	    if (publicKeyPacket !== null) {
	        strength = getBitLength(publicKeyPacket);
	    }

	    function getBitLength(publicKeyPacket) {
	        var size = -1;
	        if (publicKeyPacket.mpi.length > 0) {
	            size = (publicKeyPacket.mpi[0].byteLength() * 8);
	        }
	        return size;
	    }
	    return strength;	
	}

    return Key;
});