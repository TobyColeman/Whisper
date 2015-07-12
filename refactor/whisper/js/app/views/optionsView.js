define("optionsView", ['Utils', 'EventManager'], function (Utils, EventManager){


	function bindEvent(){
		document.forms["keyGenForm"].addEventListener('submit', handleKeyForm);
		Utils.addListenerToClass('ion-trash-b ion-medium ion-clickable', 'click', requestDelete);
	}


	/* 
	 * sets the visibility of the key table / creation form
	 * @param visible {boolean}		if true should show user's key
	 * @param key 	  {Key} 	    the user's key
	 */
	function renderUserKey(visible, key){

		var keyFormWrapper = document.getElementById('keyFormWrapper');
		var keyTable = document.getElementById('key_table');

		if(!visible){
			keyFormWrapper.style.display = "block";
			keyTable.style.display = "none";
			return;		
		}

		keyTable.style.display = "block";
		keyGenProgress.style.display = "none";
		keyFormWrapper.style.display = "none";

		updateKeyTable(key);

		/* 
		 * Updates the key table with the user's details
		 */ 
		function updateKeyTable(key){
			var table = keyTable.rows[1].cells;
			table.namedItem("user_name").innerHTML = key.getName();
			table.namedItem("user_id").innerHTML = key.fb_id;
			table.namedItem("key_email").innerHTML = key.getEmail();
			table.namedItem("key_length").innerHTML = key.getPubKeyLength();
		}
	}

	/* 
	 * sets the visibility of the table displaying the user's friends' keys
	 */
	function renderFriendTable(visible){

		var friendTable = document.getElementById('friend_list');
		var noFriendMsg = document.getElementById('no_friends');

        if(visible){
            friendTable.style.display = "block";
            noFriendMsg.style.display = "none";
        }
        else{
            noFriendMsg.style.display = "block";
        }
	}


	/* 
	 * handles the creation of a key by the user
	 */
	function handleKeyForm(e){
		// grab all the form data
		e.preventDefault();
		var form = document.forms["keyGenForm"];
		var keyGenProgress = document.getElementById('keyGenProgress');
		var fb_id = form.fb_id.value.trim();
		var name = form.name.value.trim();
		var email = form.email.value.trim();
		var password = form.password.value;
		var numBits = form.key_length.options[form.key_length.selectedIndex].value;

		// notify the user a key is being generated
		keyGenProgress.style.display = "block";

		// push an event to let the controller know a key has been requested
		EventManager.publish('newKey', {'fb_id'		: fb_id,
										'name' 		: name,
										'email'		: email,
										'password'	: password,
										'numBits'	: numBits});
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
		bindEvents: bindEvent
	}

});