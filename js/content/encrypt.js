(function() {

// gets all messages currently loaded
var message = document.getElementsByClassName('clearfix _42ef');
console.log('messages---');
console.log(message);

// container for the button
var encryptContainer = document.createElement("DIV");
encryptContainer.className="_6a _m _2of _9_h";

// encrypt button
var encryptBtn = document.createElement("A");
encryptBtn.className = "_214 uiButton ion-unlocked ion-clickable";
encryptBtn.id = "encrypt-toggle";

// get the chat bar and append the encrypt button to it
var chatBar = document.getElementsByClassName('_211')[0];

// inject elements
encryptContainer.appendChild(encryptBtn);
chatBar.appendChild(encryptContainer);

var openpgp = window.openpgp;

var options = {
    numBits: 2048,
    userId: 'Jon Smith <jon.smith@example.org>',
    passphrase: 'super long and hard to guess secret'
};

openpgp.generateKeyPair(options).then(function(keypair) {
    // success
    var privkey = keypair.privateKeyArmored;
    var pubkey = keypair.publicKeyArmored;
    console.log(privkey);
}).catch(function(error) {
    // failure
});

})();
