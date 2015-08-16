define("MessageController", ["EventManager", "StoreController", "Key", "Thread", "Utils", "openpgp"], function(e, Store, Key, Thread, Utils, openpgp){

	var instance = null;
	var thread, myKey;

	function MessageController() {
		self = this;
		if (instance !== null)
			throw new Error("MessageController instance already exists");
	}


	MessageController.prototype.init = function(callback) {

        Store.hasPrivKey(function(key) {
            if (!key){
                myKey = false;
            }
            else{
                myKey = key;
				e.subscribe('setThread', self.getThreadInfo);
				e.subscribe('setEncryption', self.setEncryption);
				e.subscribe('decryptKey', self.decryptKey);   
				self.listen();   
            }
            callback(myKey);
        });
	};


	MessageController.prototype.listen = function() {

		// send the content script the fields needed to make requests to facebook
		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
		
			if (request.type == 'encrypt_message'){
				self.encryptMessage(request.data, sendResponse);
			}
			else if (request.type == 'decrypt_message'){
				self.decryptMessage(request.data, sendResponse);
			}
			return true;
		});
	};


	MessageController.prototype.decryptMessage = function(proxyResponse, callback) {


		var proxyResponseText = JSON.parse(proxyResponse.responseText.split('for (;;);')[1]);

		for (var i = 0; i < proxyResponseText.payload.actions.length; i++) {
			proxyResponseText.payload.actions[i].body = 'REPLACED TEXT';
		};

		proxyResponse.responseText = 'for (;;);' + JSON.stringify(proxyResponseText);	
		proxyResponse.response = 'for (;;);' + JSON.stringify(proxyResponseText);	

		callback({proxyResponse: proxyResponse});

	};

	MessageController.prototype.encryptMessage = function(data, callback) {

		var expr = /\[body\]=(.*?)&/;
		var messageBody = data.match(expr)[1];

		// can't find message for some reason
		if(messageBody === undefined)
			return false;

		messageBody = decodeURIComponent(messageBody);
		
		if (thread.isEncrypted){
			var payload = {
				sender: myKey.fb_id,
				messages: []
			};

			(function(){

				var i = 0;

				function encryptMessage(){
					// for each person in the thread, encrypt your message 
					if (i < thread.numPeople){

						openpgp.encryptMessage(thread.keys[i].key.pubKey, messageBody).then(function(pgpMessage){

							var message = {
								recipient: thread.keys[i].vanity,
								content: pgpMessage
							};

							payload.messages.push(message);

							i++;
							encryptMessage();
						});
					}
					else{
						// replace the plaintext message with encrypted message
						payload = '[body]=' + JSON.stringify(payload) + '&';
						data = data.replace(expr, payload);
						callback({message:data});
					}
				}
				encryptMessage();
			})();
		}
		else{
			callback({message:data});
		}
			
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
        					var vanity = participants[i].vanity;

        					// if we found a key 
        					if(result){
        						// need to store vanity -> key as this is 
        						// how the key is stored in local storage
        						key.vanity = vanity;
        						key.key = result;
        						// view needs numeric id for placement
        						// of lock icons
        						keys[fbid] = true;
        						thread.addKey(key);
        					}
        						
        					else{
        						key[vanity] = false
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
