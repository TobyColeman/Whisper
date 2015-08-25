define("MessageReader", function(){

    var instance = null;
    var self;

    function MessageReader(key){
        self = this;
        this.isDecrypting = true;
        this.FBID;
        if (instance !== null)
            throw new Error("MessageController instance already exists");
    }


    MessageReader.prototype.bindKey = function(key){
        this.key = key;
    }


    MessageReader.prototype.setFBID = function(FBID) {
        this.key.setFBID(FBID);
    };


    MessageReader.prototype.decrypt = function(password){
        if(!this.key.privKey.decrypt(password)){
            return false;
        }
        return true;
    }


    MessageReader.prototype.processMessage = function(request, sendResponse){
        // no key
        if(!this.key){
            sendResponse({message: request.data});
            return;
        }
        // decryption enabled and user key unlocked
        if(this.key.isUnlocked() && this.isDecrypting){
            pickHandler();
        }
        // decryption disabled
        else if(!this.key.isUnlocked() && !this.isDecrypting){
            sendResponse({message: request.data});
        }
        // waiting for password
        else if (!this.key.isUnlocked() && this.isDecrypting){
            setTimeout(function(){
                self.processMessage(request, sendResponse);
            }, 200);
        }

        function pickHandler(){
            if (request.type == 'decrypt_message'){
                self.decryptMessage(request.data, sendResponse);
            }
            else{
                self.decryptMessageBatch(request.data, sendResponse);
            }
        }
        return true;
    }


    /*
     * decrypts message into plaintext
     * @param body {string} body of the message
     * @param callback {function} function to execute after decryption
     */
    MessageReader.prototype.decryptMessage = function(body, callback) {

        try{
            var encryptedBody = isJSON(decodeURIComponent(body));
        }
        catch(e){
            var encryptedBody = isJSON(body);
        }

        // plaintext message, picture or sticker
        if (!encryptedBody){
            callback({message: body});
            return;
        }
        // message not found for user
        else if(!encryptedBody[this.key.FBID]){
            callback({message: body});
            return;
        }

        // read in the message
        try{
            var pgpMessage = openpgp.message.readArmored(encryptedBody[this.key.FBID]);
        }
        catch(error){
            callback({message: 'Could Not Decrypt Message'});
            return;
        }
        
        // decrypt the message
        openpgp.decryptMessage(this.key.privKey, pgpMessage).then(function(plaintext){
            plaintext = "🔏 " + plaintext;
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


    /*
     * Decrypts an array of messages pulled in from an async request
     * @param messages {array} contains messages from facebook
     * @param callback {function} function called after decryption
     */ 
    MessageReader.prototype.decryptMessageBatch = function(messages, callback) {

        (function(){

            var i = 0;

            function decryptMessages(){

                if(i < messages.length){

                    self.decryptMessage(messages[i].body, function(response){

                        messages[i].body = response.message;

                        i++;
                        decryptMessages();
                    });

                }else{
                    callback({message: messages});
                }
            }
            decryptMessages();
        })();   
    };


    MessageReader.getInstance = function() {
        if (instance === null)
            instance = new MessageReader();
        return instance;
    }

    return MessageReader.getInstance();
});