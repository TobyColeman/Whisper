window.addEventListener("load", init(), false);

// clickables on the dashboard page
var delete_btns;
var keyDetailsBtn;

// static fields on the dashboard page
var idField;
var emailField;
var keyLengthField;
var keyCreationForm;
var keyTable;
var friendTable;
var noFriendMsg;

// http://openpgpjs.org/
var openpgp = window.openpgp;


function init(){

	// clickables on dashboard
	delete_btns = document.getElementsByClassName('ion-trash-b ion-medium ion-clickable');
	addListenerToClass(delete_btns, 'click', requestDelete);

	keyDetailsBtn = document.getElementById('key_show_btn');

	// static fields in the key table
	idField = document.getElementById('user_id');
	emailField = document.getElementById('key_email');
	keyLengthField = document.getElementById('key_length');

	// visibility toggled for these depending on local storage
	keyCreationForm = document.getElementById('key_creation');
	keyTable = document.getElementById('key_table');
	friendTable = document.getElementById('friend_list');
	noFriendMsg = document.getElementById('no_friends');

	// check if the user has made a key
	getKey(null, function(keyChain){


		// make new key...
		keygen(1024, 'Toby Coleman <tobych82@gmail.com>', '1234', function(key){
			console.log(key);
		});

		if(keyChain['whisper_key'] === undefined){
			// set UI
			keyCreationForm.style.display = "block";
			keyTable.style.display = "none";

		}
		else{
			// Set UI
			keyCreationForm.style.display = "none";
			keyTable.style.display = "block";

		}

		// debugging stuff ... remove
		console.log('key: ' + keyChain['whisper_key']);
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