define("StoreController", ['Key'], function(Key){

    var instance = null;

    function StoreController(){
        if(instance !== null)
            throw new Error("StoreController instance already exists");
    }


	/*
	 * Get a key from local storage
	 * @param key      {string} the key used to store data
	 * @param callback {function} the function to execute when storing is complete
	 */
	StoreController.prototype.getKey = function(key, callback){
		chrome.storage.local.get(key, callback);
	}

	/* 
	 * Stores armored keys
	 * @param fb_id    {string} facebook id used in the key
	 * @param pubKey   {string} public part of the keypair
	 * @param privKey  {string} private part of the keypair
	 * @param callback {function} the function to execute when retreival is complete
	 */
	StoreController.prototype.setKey = function(fb_id, pubKey, privKey, callback){

		var data = {};

		if(privKey !== null){
			data['whisper_key'] = {'fb_id': fb_id, 'privKey': privKey,'pubKey' : pubKey};
		}
		else{
			data[fb_id] = {'fb_id': fb_id, 'pubKey': pubKey};
		}

		chrome.storage.local.set(data, callback);
	}

	/* 
	 * Find out of user has any friends
	 * @param callback {function} executed when retreival from ls is complete
	 */
	StoreController.prototype.hasFriends = function(callback){
		this.getKey(null, function(results){

			var friends = false;
			// since user only has one key pair, we can assume the remaining 
			// items in the dict are their friends' public keys
			if(Object.keys(results).length > 1){
				delete results['whisper_key'];
				friends = [];
				for(key in results){
					friends.push(new Key({"fb_id" : results[key].fb_id,
										  "pubKey": results[key].pubKey}));
				}
			}
			callback(friends);
		});
	}

    StoreController.getInstance = function(){
        if(instance === null)
            instance = new StoreController();
        return instance;
    }

    return StoreController.getInstance();
});



