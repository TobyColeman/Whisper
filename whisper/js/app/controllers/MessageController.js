define("MessageController", ["EventManager", "StoreController", "Key", "Thread", "Utils"], function(e, Store, Key, Thread, Utils){

	var instance = null;
	var thread, myKey;

	function MessageController() {
		self = this;
		if (instance !== null)
			throw new Error("MessageController instance already exists");
	}


	MessageController.prototype.init = function() {

        Store.hasPrivKey(function(key) {
            if (!key)
                return false;
            else
                myKey = key;
            return true;
        });

		e.subscribe('setThread', this.getThreadInfo);
		e.subscribe('setEncryption', this.setEncryption);
		e.subscribe('decryptKey', this.decryptKey);
	};				


	/*
	 * Grabs thread id and participants for the current active thread, using fb's api
	 * @param data {object} contains index of the current thread & the site
	 */
	MessageController.prototype.getThreadInfo = function(data) {

		// get the id of the thread
		chrome.runtime.sendMessage({type: 'getThreadInfo', site: data.site}, function(response){
			user = response.user;
            self.makeRequest("/ajax/mercury/threadlist_info.php", 
                        {type  : 'POST',
                         params: 'inbox[offset]=' + data.threadIndex + '&inbox[limit]=1&__user=' + user.id + '&__a=1b&__req=1&fb_dtsg=' + user.fb_dtsg}, 
                         self.setActiveThread)
		});
	};


	/*
	 * decrypts the user's private key
	 * @param data {object} contains password from dialog in the view
	 */
	MessageController.prototype.decryptKey = function(data) {

        if (!myKey.privKey.decrypt(data.password)){
            e.publish('wrongPassword');
            return;
        }
        e.publish('correctPassword');
	};


	/* Constructs a new thread object & retrieves key's for every participant
	 * Notifies the view as to whether encryption was on/off for the current thread
	 * @param data {object} ajax response from facebook's api to threadlist_info
	 */
    MessageController.prototype.setActiveThread = function(data){

    	var threadInfo, threadId, participants, keys = {};

    	// parse respons from threadlist_info.php
        threadInfo = JSON.parse(data);

        // array of participants in the active thread
        participants = threadInfo.payload.participants;

        // get the index of our fbid as we don't want this in the thread
        var myKeyIndex = Utils.findObjWithAttribute(participants, 'vanity', myKey.fb_id);

        // store a refrence to our id in the keys obj as the view needs to know what locks to render
        var fbid = participants[myKeyIndex].fbid;
        keys[fbid] = true;
        participants.splice(myKeyIndex, 1);

        // id of the active thread (group-convo)
        threadId = threadInfo.payload.ordered_threadlists[0].thread_fbids[0];

        // id of the active thread (solo-convo)
        if (threadId === undefined)
        	threadId = threadInfo.payload.ordered_threadlists[0].other_user_fbids[0];

        // make a new thread, store its' id
        thread = new Thread(threadId);

        // get the settings for the current thread, check what public
        // keys are in storage then notify the view
        Store.getSettings(thread.id, function(encrypted){

    		(function(){
    			var i = 0;

    			function forloop(){
        			if (i < participants.length){

        				Store.getKey(participants[i].vanity, function(result){

        					var key = {};
        					var fbid = participants[i].fbid;

        					// if we found a key 
        					if(result){
        						key[fbid] = result
        						keys[fbid] = true;
        						thread.addKey(key);
        					}
        						
        					else{
        						key[fbid] = false
        						keys[fbid] = false
        						thread.addKey(key);
        						thread.hasAllKeys = false;
        					}
        					i++;
        					forloop();
        				});
        			}
        			else{
        				// if we're missing a key, we'll tell the view to disable
        				// the encryption controls
        				if(thread.hasAllKeys)
	    					e.publish('renderThreadSettings', {isEncrypted: encrypted,
	    										   		   	   keys: keys,
	    										   		   	   hasAllKeys: true});
	    				else
	    					e.publish('renderThreadSettings', {isEncrypted: encrypted,
	    										   		   	   keys: keys,
	    										   		   	   hasAllKeys: false});

	    				// if we have all the keys and the thread is tagged as encrypted
	    				// ask for the user's password if needed
			        	thread.setEncrypted(encrypted);

			        	if(encrypted && !myKey.isUnlocked())
			        		e.publish('getPassword');	    				
        			}
        		}
        		forloop();
    		})();
        });
    }


    /* Toggles encryption on/off for the current thread & stores settings
     * @param data {object} contains a boolean for encrypted state
     */ 
    MessageController.prototype.setEncryption = function(data) {
    	thread.setEncrypted(data.encrypted);

    	if(data.encrypted && !myKey.isUnlocked())
    		e.publish('getPassword');

    	Store.setSettings(thread.id, function(){
    		// don't need anything in this callback yet
    	});
    };


	// ajax helper function
	MessageController.prototype.makeRequest = function(url, options, callback) {
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function(){
            if(xhr.readyState == 4 && xhr.status == 200)
                callback(xhr.responseText.replace('for (;;);', ''));
        }

        xhr.open(options.type, url, true);

        if(options.type === 'POST')
            xhr.send(options.params);
        else
            xhr.send();
	};


	MessageController.getInstance = function() {
		if (instance === null)
			instance = new MessageController();
		return instance;
	}

	return MessageController.getInstance();
});
