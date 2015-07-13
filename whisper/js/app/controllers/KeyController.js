define("KeyController", ['StoreController', 'Key', 'optionsView', 'openpgp', 'EventManager'], 
function (StoreController, Key, optionsView, openpgp, EventManager) {

    var instance = null;

    function KeyController(){
        self = this;
        if(instance !== null)
            throw new Error("KeyController instance already exists");
    }

    /*
     * runs initially when the options page loads, checks if the user has a key / friends
     * and sets the view accordingly
     */
    KeyController.prototype.init = function(){

        EventManager.subscribe('newKey', this.generateKey);
        EventManager.subscribe('privKeyInsert', this.insertPrivKey);
        EventManager.subscribe('pubKeyInsert', this.insertPubKey);

        // check if the user has a key
        StoreController.getKey('whisper_key', function(result){
            if(result['whisper_key'] === undefined)
                optionsView.renderUserKey(false);
            else
                optionsView.renderUserKey(true, [new Key(result['whisper_key'])]);           

        });

        // check if the user has any friends
        StoreController.hasFriends(function(friends){
            if(friends)
                optionsView.renderFriendTable(true, friends);
            else
                optionsView.renderFriendTable(false);
        })
    }



    /*
     * generates a new openpgp key and stores in localstorge
     * @param data {object} contains form data for creating the key
     */
    KeyController.prototype.generateKey = function(data){
        var options = {
            numBits: data.numBits,
            userId: data.name + ' <' + data.email + '>',
            passphrase: data.password
        }

        openpgp.generateKeyPair(options).then(function(keypair){
            var privKey = keypair.privateKeyArmored;
            var pubKey = keypair.publicKeyArmored;

            StoreController.setKey(data.fb_id, pubKey, privKey, function(){
                optionsView.renderUserKey(true, [new Key({'fb_id': data.fb_id,
                                                         'pubKey': pubKey,
                                                         'privKey': privKey})]);              
            });
        });
    }


    /*
     * Used when a user wants to insert an already generate private key
     * @param data {object} contains facebook id and private key
     */
    KeyController.prototype.insertPrivKey = function(data){

        var result = self.checkKeyIntegrity(data.privKey);

        if(result['err']){
            optionsView.renderError('Invalid Key')
            return;
        }

        if(!self.validateKeyPassword(result['privKey'], data.password)){
            optionsView.renderError('Wrong password')
            return;
        }

        var pubKey = result['privKey'].toPublic().armor();

        StoreController.setKey(data.fb_id, pubKey, result['privKey'], function(){
            optionsView.renderUserKey(true, [new Key({'fb_id': data.fb_id,
                                                     'pubKey': pubKey,
                                                     'privKey': result['privKey']})]);              
        });
    }

    KeyController.prototype.insertPubKey = function(data){

        var result = self.checkKeyIntegrity(data.pubKey);

        if(result['err']){
            optionsView.renderError('Invalid Key')
            return;
        }

        StoreController.getKey(data.fb_id, function(result){

            if(result[data.fb_id] !== undefined || result['whisper_key'].fb_id == data.fb_id){
                optionsView.renderError('Key Already Exists For: ' + data.fb_id);
                return;
            }

            StoreController.setKey(data.fb_id, data.pubKey, null, function(){
                optionsView.renderFriendTable(true, [new Key({'fb_id': data.fb_id,
                                                         'pubKey': data.pubKey})]);            
            });    
        });
    }


    /*
     * checks if the key is a vali
     */ 
    KeyController.prototype.checkKeyIntegrity = function(key){

        var result = openpgp.key.readArmored(key);

        if(result['err'])
            return {'err': result['err'][0].message}; 

        return {'privKey': result.keys[0]};

    }


    /*
     * checks if the correct password has been entered for the private key
     */
    KeyController.prototype.validateKeyPassword = function(key, password){
        // wrong password check
        if(!key.decrypt(password))
            return false;
        return true;      
    }


    KeyController.getInstance = function(){
        if(instance === null)
            instance = new KeyController();
        return instance;
    }

    return KeyController.getInstance();
});
