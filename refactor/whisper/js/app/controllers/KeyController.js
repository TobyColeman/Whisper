define("KeyController", ['StoreController', 'Key', 'optionsView', 'openpgp', 'EventManager'], 
function (StoreController, Key, optionsView, openpgp, EventManager) {

    var instance = null;

    function KeyController(){
        if(instance !== null)
            throw new Error("KeyController instance already exists");
    }

    /*
     * runs initially when the options page loads, checks if the user has a key / friends
     * and sets the view accordingly
     */
    KeyController.prototype.init = function(){

        EventManager.subscribe('newKey', this.generateKey);

        // check if the user has a key
        StoreController.getKey('whisper_key', function(result){
            if(result['whisper_key'] === undefined)
                optionsView.renderUserKey(false);
            else
                optionsView.renderUserKey(true, new Key(result['whisper_key']));           

        });

        // check if the user has any friends
        StoreController.hasFriends(function(friends){
            if(friends)
                optionsView.renderFriendTable(true);
            else
                optionsView.renderFriendTable(false);
        })
    }



    /*
     * generates a new openpgp key and stores in localstorge
     * @param data {object} contains form data for creating the key
     */
    KeyController.prototype.generateKey = function(data){
        options = {
            numBits: data.numBits,
            userId: data.name + ' <' + data.email + '>',
            passphrase: data.password
        }

        openpgp.generateKeyPair(options).then(function(keypair){
            var privKey = keypair.privateKeyArmored;
            var pubKey = keypair.publicKeyArmored;

            StoreController.setKey(data.fb_id, pubKey, privKey, function(){
                optionsView.renderUserKey(true, new Key({'fb_id': data.fb_id,
                                                         'pubKey': pubKey,
                                                         'privKey': privKey}));              
            });
        });
    }

    // KeyController.handleInsert = function(data){
    //     var privateKey = openpgp.key.readArmored(privKey).keys[0];
    //     privateKey.decrypt('1234');
    //     console.log(privateKey.toPublic().armor());
    // }


    KeyController.getInstance = function(){
        if(instance === null)
            instance = new KeyController();
        return instance;
    }

    return KeyController.getInstance();
});
