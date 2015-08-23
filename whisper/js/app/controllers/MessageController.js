define("MessageController", ["EventManager", "StoreController", "Key", "Thread", "Utils", "openpgp"], function(e, Store, Key, Thread, Utils, openpgp){

	var instance = null;
	var thread, myKey;
	var decryption = true;

	function MessageController() {
		self = this;
		if (instance !== null)
			throw new Error("MessageController instance already exists");
	}


	MessageController.prototype.init = function(callback) {

        Store.hasPrivKey(function(key) {

        	myKey = !!key ? key : false;

        	if(myKey){
				e.subscribe('setThread', self.getThreadInfo);
				e.subscribe('setEncryption', self.setEncryption);
				e.subscribe('decryptKey', self.decryptKey);  
				e.subscribe('setDecryption', function(data){
					decryption = data.enabled;
				}) 
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
				processMessage(request.data, sendResponse, self.decryptMessage)
			}
			else if(request.type == 'descrypt_message_batch'){
				processMessage(request.data, sendResponse, self.decryptMessageBatch);
			}
			return true;
		});

		function processMessage(data, sendResponse, decryptionHandler){
			// decryption enabled and user key unlocked
			if(myKey.isUnlocked() && decryption){
				decryptionHandler(data, sendResponse);
			}
			// decryption disabled
			else if(!myKey.isUnlocked() && !decryption){
				sendResponse({message: data});
			}
			// waiting for password
			else if (!myKey.isUnlocked() && decryption){
				setTimeout(function(){
					processMessage(data, sendResponse, decryptionHandler)
				}, 200);
			}
			return true;
		}
	};


	MessageController.prototype.decryptMessage = function(data, callback) {

		var body = isJSON(decodeURIComponent(data));

		// plaintext message, picture or sticker
		if (!body){
			callback({message: data});
			return;
		}
		// message not found for user
		else if(!body[myKey.FBID]){
			callback({message: data});
			return;
		}

		try{
			var pgpMessage = openpgp.message.readArmored(body[myKey.FBID]);
		}
		catch(error){
			callback({message: 'Could Not Decrypt Message'});
			return;
		}
		

		openpgp.decryptMessage(myKey.privKey, pgpMessage).then(function(plaintext){
			callback({message: plaintext});
		}).catch(function(error){
			callback({message: 'Could Not Decrypt Message'});
		});

		function isJSON(msg){
			try{
				var body = JSON.parse(msg)
				return body;
			}
			catch(e){
				return false;
			}
		}			

	};


	MessageController.prototype.decryptMessageBatch = function(data, callback) {

		(function(){

			var i = 0;

			function decryptMessages(){

				if(i < data.length){

					self.decryptMessage(data[i].body, function(response){

						data[i].body = response.message;

						i++;
						decryptMessages();
					});

				}else{
					callback({message: data});
				}
			}
			decryptMessages();
		})();	
	};


	MessageController.prototype.encryptMessage = function(data, callback) {

		var expr = /\[body\]=(.*?)&/;
		var messageBody = data.match(expr);

		// sending a picture, sticker, thumbs up
		if(messageBody === null){
			callback({message:data});
			return;
		}
			

		messageBody = decodeURIComponent(messageBody[1]);
		
		if (thread.isEncrypted){

			var payload = {};

			(function(){

				var i = 0;

				function encryptMessage(){
					// for each person in the thread, encrypt your message 
					if (i < thread.numPeople){

						var id = Object.keys(thread.keys)[i];

						openpgp.encryptMessage(thread.keys[id].pubKey, messageBody).then(function(pgpMessage){

							payload[thread.keys[id].FBID] =  pgpMessage;

							i++;
							encryptMessage();
						});
					}
					else{
						// replace the plaintext message with encrypted message
						payload = '[body]=' + encodeURIComponent(JSON.stringify(payload)) + '&';
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
			postData = response.payload;
			if(myKey) myKey.setFBID(postData.uid);
            self.makeRequest("/ajax/mercury/threadlist_info.php", 
                        {type  : 'POST',
                         params: 'inbox[offset]=' + data.threadIndex + '&inbox[limit]=1&__user=' + postData.uid + '&__a=1b&__req=1&fb_dtsg=' + postData.fb_dtsg,
                     	 retries: 3}, 
                         self.setActiveThread);
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

    	var threadInfo, threadId, participants;

    	// parse response from threadlist_info.php
        threadInfo = JSON.parse(data);

        // array of participants in the active thread
        participants = threadInfo.payload.participants;

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

        				Store.getKey(participants[i].vanity, function(key){

        					// var key = {};
        					var fbid = participants[i].fbid;
        					var vanity = participants[i].vanity;

        					// if we found a key 
        					if(key){
        						key.setFBID(fbid);
        						thread.addKey(key);
        					}
        						
        					else{
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
	    										   		   	   keys: thread.keys,
	    										   		   	   hasAllKeys: true});
	    				else
	    					e.publish('renderThreadSettings', {isEncrypted: encrypted,
	    										   		   	   keys: thread.keys,
	    										   		   	   hasAllKeys: false});

	    				// if we have all the keys and the thread is tagged as encrypted
	    				// ask for the user's password if needed
			        	thread.setEncrypted(encrypted);
			        	// self.getPassword(encrypted);
    				
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
    	// self.getPassword(data.encrypted);

    	Store.setSettings(thread.id);
    };


    MessageController.prototype.getPassword = function(encrypted) {
    	if(encrypted && !myKey.isUnlocked()){
    		e.publish('getPassword');	    		
    	}
    };


	// ajax helper function
	MessageController.prototype.makeRequest = function(url, options, callback) {
        var xhr = new XMLHttpRequest();
        var retries = options.retries;

        xhr.onreadystatechange = function(){
            if(xhr.readyState == 4 && xhr.status == 200){
            	callback(xhr.responseText.replace('for (;;);', ''));
            }
            else if (xhr.readyState == 4 && xhr.status != 200){
            	retries--;
            	if(retries > 0){
            		setTimeout(function(){
            			makeRequest();
            		},500);	
            	}
            }      
        }

        function makeRequest(){
	        xhr.open(options.type, url, true);

	        if(options.type === 'POST')
	            xhr.send(options.params);
	        else
	            xhr.send();       	
        }
        makeRequest();
	};


	MessageController.getInstance = function() {
		if (instance === null)
			instance = new MessageController();
		return instance;
	}

	return MessageController.getInstance();
});
