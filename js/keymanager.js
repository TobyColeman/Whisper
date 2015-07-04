var keys = {};

// get key from local storage
function getKey(key, callback){
	chrome.storage.local.get(key, callback);
}

// stores armored keys
function setKey(fb_id, pubKey, privKey, callback){

	var data = {};

	if(privKey){
		data['whisper_key'] = {'fb_id': fb_id, 'privateKey': privKey,'publicKey' : pubKey};
	}
	else{
		data[fb_id] = {'fb_id': fb_id, 'publickey': pubKey};
	}

	chrome.storage.local.set(data, callback);
}

// find out of user has any friends
function hasFriends(callback){
	chrome.storage.local.get(null, function(results){

		var friends = false;
		// since user only has one key pair, we can assume the remaining 
		// items in the dict are their friends' public keys
		if(Object.keys(results).length > 1){
			delete results['whisper_key'];
			friends = results;
		}
		callback(friends);
	});
}



function Key(pgpKey){
	this.pubKey = pgpKey['publicKey'];
	this.privKey = pgpKey['privateKey'] === undefined ? null : pgpKey['privateKey'];
	this.fb_id = pgpKey['fb_id'];
}

Key.prototype.getId = function(){
	return openpgp.key.readArmored(this.pubKey).keys[0].users[0].userId.userid;
}

Key.prototype.getName = function(){
	var id = this.getId();
	var name = id.split('<')[0];
	return name;
}

Key.prototype.getEmail = function(){
	var id = this.getId();
	var email = id.split('<')[1].replace('>', '');
	return email;
}

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