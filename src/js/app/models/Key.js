define("Key", function() {

    
    // @param pgpKey {dict} contains a public key, optional private key and a facebook id
    function Key(pgpKey) {
        this.pubKey = openpgp.key.readArmored(pgpKey['pubKey']).keys[0];

        this.privKey = pgpKey['privKey'] === undefined ? null : openpgp
            .key.readArmored(pgpKey['privKey']).keys[0];

        this.FBID;

        this.vanityID = pgpKey['vanityID'];
    }

    
    // @returns {string} the id of the key, format: FirstName LastName <email@domain.com>
    Key.prototype.getId = function() {
        return this.pubKey.users[0].userId.userid;
    }
  
    // @UID {int} numerical id associated with facebook vanity ID
    Key.prototype.setFBID = function(FBID) {
        this.FBID = FBID;
    };
     
    // @returns {boolean} whether the private key has been decrypted or not
    Key.prototype.isUnlocked = function() {
        return this.privKey.primaryKey.isDecrypted;
    };
    
    // @returns {string} the name part of the key's id
    Key.prototype.getName = function() {
        var id = this.getId();

        var name = id.split('<')[0];

        return name;
    }
    
    // @returns {string} the email part of the key's id
    Key.prototype.getEmail = function() {
        var id = this.getId();

        var email = id.split('<')[1].replace('>', '');

        return email;
    }
    
    // @returns {integer} the length of the key
    Key.prototype.getPubKeyLength = function() {
        var publicKeyPacket = this.pubKey.primaryKey;

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
