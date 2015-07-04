window.addEventListener("load", init(), false);

// reference to openpgp crypto library
var openpgp = window.openpgp;

// clickables on the dashboard page
var delete_btns;
var keyDetailsBtn;

// static fields on the dashboard page
var keyCreationForm;
var friendTable;
var noFriendMsg;

// elements that display the user's key
var keyTable;
var keyTableName;
var keyTableId;
var keyTableEmail;
var keyTableLength;

// dictionary storing all the keys 
var keys = {};

function init(){

	// clickables on dashboard
	delete_btns = document.getElementsByClassName('ion-trash-b ion-medium ion-clickable');
	keyForm = document.getElementById('keyGenForm');
	keyDetailsBtn = document.getElementById('key_show_btn');

	// event listeners
	keyForm.addEventListener('submit', handleKeyForm);
	addListenerToClass(delete_btns, 'click', requestDelete);

	// elements that display the user's key
	keyTable = document.getElementById('key_table');
	keyTableName = document.getElementById('user_name');
	keyTableId = document.getElementById('user_id');
	keyTableEmail = document.getElementById('key_email');
	keyTableLength = document.getElementById('key_length');

	// visibility toggled for these depending on local storage
	keyCreationForm = document.getElementById('key_creation');
	friendTable = document.getElementById('friend_list');
	noFriendMsg = document.getElementById('no_friends');
	keyGenProgress = document.getElementById('keyGenProgress');

	// check if the user has made a key --- whisper_key used for user's key always
	getKey('whisper_key', function(keyChain){

		// if the user has no key, display form to make one
		if(keyChain['whisper_key'] === undefined){
			// set UI
			keyCreationForm.style.display = "block";
			keyTable.style.display = "none";

		}
		// otherwise display the details of their key
		else{
			// Set UI
			keyCreationForm.style.display = "none";
			// store user key in memory for fast retreival & update UI 
			keys['whisper_key'] = new Key(keyChain['whisper_key']);
			updateKeyTable(keys['whisper_key']);
			keyTable.style.display = "block";
		}
	});

	// check if the user has any friends' key
	hasFriends(function(friends){
		if(friends){
			console.log('has friends: ', friends);
			friendTable.style.display = "block";
			noFriendMsg.style.display = "none";
		}
		else{
			noFriendMsg.style.display = "block";
		}
	});
}

// grabs all the data from the Key class
function updateKeyTable(key){
	keyTableName.innerHTML = key.getName();
	keyTableId.innerHTML = key.fb_id;
	keyTableEmail.innerHTML = key.getEmail();
	keyTableLength.innerHTML = key.getPubKeyLength();

}

// handles the creation of a key by the user
function handleKeyForm(e){
	e.preventDefault();
	var form = document.forms["keyGenForm"];
	var fb_id = form.fb_id.value.trim();
	var name = form.name.value.trim();
	var email = form.email.value.trim();
	var password = form.password.value;
	var keyLength = form.key_length.options[form.key_length.selectedIndex].value;

	// display generating....

	keyGenProgress.style.display = "block";

	keygen(keyLength, name + ' ' + '<' + email + '>', password, function(keypair){
		// update ui
		keyGenProgress.style.display = "none";

		// read in the keys 
		var privKey = keypair.privateKeyArmored;
		var pubKey = keypair.publicKeyArmored;

		// store the user's keys
		setKey(fb_id, pubKey, privKey, function(){
			keyCreationForm.style.display = "none";

			// could probably tidy this up... calling get just avoids
			// having to pass in a harcoded object in the format it is daved into localstorage
			getKey('whisper_key', function(keyChain){
				// store user key in memory for fast retreival & update UI 
				keys['whisper_key'] = new Key(keyChain['whisper_key']);
				updateKeyTable(keys['whisper_key']);
				keyTable.style.display = "block";
			});
		});
	});
	form.reset();
}



// warn the user about deleting the element
function requestDelete(element){
	// get the id of the key to be deleted
	console.log(element.target.id);
	// confirm they want to delete the key

	// remove the key from local storage

	// update the table
}



// should probably be moved into a more generic js file...
function addListenerToClass(elements, listener, callback){
	if(elements.length === 0){
		return -1;
	}

	for(var i=0; i < elements.length; i++){
		elements[i].addEventListener(listener, callback, false);
	}
}


function keygen(numBits, userId, passphrase, callback) {
    var openpgp = window.openpgp;
    var a;
    var key = openpgp.generateKeyPair({
        numBits: numBits,
        userId: userId,
        passphrase: passphrase
    }).then(callback);
}