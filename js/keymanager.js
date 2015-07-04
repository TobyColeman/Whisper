// get key from local storage
function getKey(key, callback){
	chrome.storage.local.get(key, callback);
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

// https://github.com/fastdata2go/openpgp.js-examples
function getPubKeyLength(data) {
    var publicKey = openpgp.key.readArmored(data);
    var publicKeyPacket = publicKey.keys[0].primaryKey;
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
}



// chrome.storage.local.set({'whisper_key': 10}, function(success){

// 	if(chrome.runtime.lastError){
// 		return;
// 	}
// });

	// {

	// 	if(chrome.runtime.lastError){
	// 		return; 
	// 	}

	// 	return key
	// 	// console.log(key);
	
	// });

	// chrome.storage.local.remove('whisper_key');

