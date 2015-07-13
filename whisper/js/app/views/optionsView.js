define("optionsView", ['Utils', 'EventManager'], function (Utils, EventManager){

	var self = this;

	function bindEvent(){
		document.forms["keyGenForm"].addEventListener('submit', handleKeyForm);
		document.forms["keyInsForm"].addEventListener('submit', handlePrivInsert);
		document.forms["friendInsForm"].addEventListener('submit', handlePubInsert);
		document.getElementById('keyOpts').addEventListener('change', handleKeyGenType);
		document.getElementById('friendFormToggle').addEventListener('click', toggleFriendForm);
		Utils.addListenerToClass('ion-trash-b ion-medium ion-clickable', 'click', requestDelete);
		EventManager.subscribe('newPubKey', this.renderFriendTable);
		EventManager.subscribe('newPrivKey', this.renderUserKey);
		EventManager.subscribe('noPrivKey', this.renderUserKey);
		EventManager.subscribe('noPubKeys', this.renderFriendTable);
		EventManager.subscribe('error', this.renderError);
	}


	function showKeyDetails(){
		console.log('clicked');
	}


	/*
	 * Displays error messages passed down from the controller
	 * @param data.error {string} error message displayed to the user
	 */
	function renderError(data){
		var errorBlock = document.getElementById('errorBlock');
		errorBlock.children.namedItem('blockText').innerHTML = 'Error: ' + data.error;
		document.getElementById('keyGenProgress').style.display = "none";
		errorBlock.style.display = "block";

		setTimeout(function(){
			errorBlock.style.display = "none";
		}, 5000);
	}


	/* 
	 * sets the visibility of the key table / creation form
	 * @param data.visible {boolean}	if true should show user's key
	 * @param data.keys    {array} 	    contains Key objects
	 */
	function renderUserKey(data){

		var keyFormWrapper = document.getElementById('keyFormWrapper');
		var keyTable = document.getElementById('key_table');

		if(!data.visible){
			keyFormWrapper.style.display = "block";
			keyTable.style.display = "none";
			return;		
		}

		updateTableRows(data.keys, keyTable);
		keyTable.style.display = "block";

		document.getElementById('keyGenProgress').style.display = "none";
		keyFormWrapper.style.display = "none";	
	}


	/* 
	 * sets the visibility of the table displaying the user's friends' keys
	 */
	function renderFriendTable(data){

		var friendTable = document.getElementById('friend_table');
		var noFriendMsg = document.getElementById('no_friends');

        if(!data.visible){

        	noFriendMsg.style.display = "block";
        	friendTable.style.display = "none";
        	return;
        }

        updateTableRows(data.keys, friendTable);
		friendTable.style.display = "block";
		document.forms["friendInsForm"].reset();
		noFriendMsg.style.display = "none";
	}

	/* 
	 * Updates the key table with the user's details
	 */ 
	function updateTableRows(keys, table){

		keys.forEach(function(key, index){
			var row = table.insertRow(index+1);
			row.insertCell(0).innerHTML = key.fb_id;
			row.insertCell(1).innerHTML = key.getName();
			row.insertCell(2).innerHTML = key.getEmail();

			// used for showing details of a key
			var showBtn = document.createElement("A");
			showBtn.innerHTML="show key";
			showBtn.href="#";
			showBtn.addEventListener('click', showKeyDetails);

			// used for deleting a key
			var deleteBtn = document.createElement("SPAN");
			deleteBtn.className = "ion-trash-b ion-medium ion-clickable";
			deleteBtn.addEventListener('click', requestDelete);

			// user may have multiple private keys in future, so this would
			// only need to be slightly modified 
			if(key.privKey != null){
				showBtn.setAttribute('data-uid', 'whisper_key');
				deleteBtn.setAttribute('data-uid', 'whisper_key');
			}
			else{
				showBtn.setAttribute('data-uid', key.fb_id);
				deleteBtn.setAttribute('data-uid', key.fb_id);
			}
			row.insertCell(3).appendChild(showBtn);
			row.insertCell(4).innerHTML = key.getPubKeyLength();
			row.insertCell(5).appendChild(deleteBtn);
		});
	}


	/*
	 * Controls which input form should be displayed to input user's key
	 */
	function handleKeyGenType(e){

		if(e.target.value == 1){
			document.forms["keyGenForm"].style.display = "block";
			document.forms["keyInsForm"].style.display = "none";
		}
		else{
			document.forms["keyGenForm"].style.display = "none";
			document.forms["keyInsForm"].style.display = "block";
		}
	}


	/* 
	 * handles the creation of a key by the user
	 */
	function handleKeyForm(e){
		// grab all the form data
		e.preventDefault();
		var form = document.forms["keyGenForm"];
		var fb_id = form.fb_id.value.trim();
		var name = form.name.value.trim();
		var email = form.email.value.trim();
		var password = form.password.value;
		var numBits = form.numBits[form.numBits.selectedIndex].value;

		// notify the user a key is being generated
		document.getElementById('keyGenProgress').style.display = "block";

		// push an event to let the controller know a key has been requested
		EventManager.publish('newKey', {'fb_id'		: fb_id,
										'name' 		: name,
										'email'		: email,
										'password'	: password,
										'numBits'	: numBits});
	}


	/* 
	 * Grabs form data and requests private key to be stored
	 */
	function handlePrivInsert(e){
		e.preventDefault();
		var form = document.forms["keyInsForm"];
		var fb_id = form.fb_id.value.trim();
		var password = form.password.value;
		var privKey = form.privKey.value.trim();

		// notify the user a key is being generated
		document.getElementById('keyGenProgress').style.display = "block";

		EventManager.publish('privKeyInsert', {'fb_id': fb_id,
											   'password': password,
										   	   'privKey': privKey});
	}


	/* 
	 * Grabs form data and requests public key to be stored
	 */
	function handlePubInsert(e){
		e.preventDefault();
		var form = document.forms["friendInsForm"];
		var fb_id = form.fb_id.value.trim();
		var pubKey = form.pubKey.value.trim();

		EventManager.publish('pubKeyInsert', {'fb_id': fb_id,
											  'pubKey': pubKey});
	}

	function toggleFriendForm(e){
		if(document.forms["friendInsForm"].style.display == "none"){
			document.forms["friendInsForm"].style.display = "block";
		}
		else{
			document.forms["friendInsForm"].style.display = "none";
		}
	}


	// warn the user about deleting the element
	function requestDelete(element){
		// get the id of the key to be deleted
		console.log(element.target.id);
		// confirm they want to delete the key

		// remove the key from local storage

		// update the table
	}

	return{
		renderUserKey: renderUserKey,
		renderFriendTable: renderFriendTable,
		renderError: renderError,
		bindEvents: bindEvent
	}

});