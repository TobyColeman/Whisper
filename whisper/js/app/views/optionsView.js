// TODO: Could split this up into more modular parts to make it easier to read
// TODO: Remove StoreController and publish events instead
define("optionsView", ['Utils', 'EventManager', 'StoreController'], function(Utils, EventManager, StoreController) {

    function bindEvent() {
        // form events
        document.forms["keyGenForm"].addEventListener('submit', handleKeyForm);
        document.forms["keyInsForm"].addEventListener('submit', handlePrivInsert);
        document.forms["friendInsForm"].addEventListener('submit', handlePubInsert);
        document.forms["delForm"].addEventListener('submit', doDelete);

        // click events
        document.getElementById('keyOpts').addEventListener('change', toggleKeyGenType);
        document.getElementById('friendFormToggle').addEventListener('click', toggleFriendForm);
        Utils.addListenerToClass('close', 'click', function() {
            this.parentNode.close()
        });

        // events emitted from EventManager (stuff from the controllers)
        EventManager.subscribe('newPubKey', renderFriendTable);
        EventManager.subscribe('noPubKeys', renderFriendTable);
        EventManager.subscribe('newPrivKey', renderUserKey);
        EventManager.subscribe('noPrivKey', renderUserKey);
        EventManager.subscribe('error', renderError);
    }


    /*
     * Displays error messages passed down from the controller
     * @param data.error {string} error message displayed to the user
     */
    function renderError(data) {
        var errorBlock = document.getElementById('errorBlock');
        errorBlock.children.namedItem('blockText').innerHTML = 'Error: ' + data.error;
        document.getElementById('keyGenProgress').style.display = "none";
        errorBlock.style.display = "block";

        setTimeout(function() {
            errorBlock.style.display = "none";
        }, 2000);
    }


    /* 
     * sets the visibility of the key table / creation form
     * @param data.visible {boolean}	if true should show table
     * @param data.keys    {array} 	    contains Key objects
     */
    function renderUserKey(data) {

        var keyFormWrapper = document.getElementById('keyFormWrapper');
        var keyTable = document.getElementById('key_table');

        if (!data.keys) {
            keyFormWrapper.style.display = "block";
            keyTable.style.display = "none";
            return;
        }

        // update the rows in the table where user's key is displayed
        updateTableRows(data.keys, keyTable);

        // display the table and hide creation form
        keyTable.style.display = "block";
        document.getElementById('keyGenProgress').style.display = "none";
        document.forms["keyGenForm"].reset();
        document.forms["keyInsForm"].reset();
        keyFormWrapper.style.display = "none";
    }


    /* 
     * sets the visibility of the table displaying the user's friends' keys
     * @param data.visible {boolean}	if true should show table
     * @param data.keys    {array} 	    contains Key objects
     */
    function renderFriendTable(data) {

        var friendTable = document.getElementById('friend_table');
        var noFriendMsg = document.getElementById('no_friends');

        if (!data.keys) {
            noFriendMsg.style.display = "block";
            friendTable.style.display = "none";
            return;
        }

        // update the rows in the table where public keys are displayed
        updateTableRows(data.keys, friendTable);

        // display the table and reset public key insertion form
        friendTable.style.display = "block";
        document.forms["friendInsForm"].reset();
        noFriendMsg.style.display = "none";
    }


    /* 
     * Updates the key table with the user's details
     * @param keys {array} an array of Key objects
     * @param table {element} the table to append rows to
     */
    function updateTableRows(keys, table) {

        var privKeyInfo = document.getElementById('key_table').children[0].children[1];

        if(table.id == 'friend_table' && privKeyInfo){
            var privVanityID = document.getElementById('key_table').children[0].children[1].children[0].innerText;
        }
            

        keys = Array.isArray(keys) ? keys : [keys];

        keys.forEach(function(key, index) {
            var row = table.insertRow(index + 1);
            row.insertCell(0).innerHTML = key.vanityID;
            row.insertCell(1).innerHTML = key.getName();
            row.insertCell(2).innerHTML = key.getEmail();

            // used for showing details of a key
            var showBtn = document.createElement("A");
            showBtn.innerHTML = "show key";
            showBtn.href = "#";
            showBtn.addEventListener('click', showKeyDetails);

            // used for deleting a key
            var deleteBtn = document.createElement("SPAN");

            if (key.vanityID != privVanityID){
                deleteBtn.className = "ion-trash-b ion-medium ion-clickable";
                deleteBtn.addEventListener('click', promptDelete);             
            }

            /* 
             * TODO: User may have multiple private keys in future, so this would
             * only need to be slightly modified 
             */
            if (key.privKey != null) {
                showBtn.setAttribute('data-uid', 'whisper_key');
                deleteBtn.setAttribute('data-uid', 'whisper_key');
            } else {
                showBtn.setAttribute('data-uid', key.vanityID);
                deleteBtn.setAttribute('data-uid', key.vanityID);
            }

            row.insertCell(3).appendChild(showBtn);
            row.insertCell(4).innerHTML = key.getPubKeyLength();
            row.insertCell(5).appendChild(deleteBtn);
        });
    }


    // Grabs the form data needed to create a key & requests its' creation
    function handleKeyForm(e) {
        // grab all the form data
        e.preventDefault();
        var form = document.forms["keyGenForm"];
        var vanityID = form.vanityID.value.trim().toLowerCase();
        var name = form.name.value.trim();
        var email = form.email.value.trim();
        var password = form.password.value;
        var numBits = form.numBits[form.numBits.selectedIndex].value;

        // notify the user a key is being generated
        document.getElementById('keyGenProgress').style.display = "block";

        // push an event to let the controller know a new key has been requested
        EventManager.publish('newKey', {
            'vanityID': vanityID,
            'name': name,
            'email': email,
            'password': password,
            'numBits': numBits
        });
    }


    // Grabs already generated private key & requests its' insertion
    function handlePrivInsert(e) {
        e.preventDefault();
        var form = document.forms["keyInsForm"];
        var vanityID = form.vanityID.value.trim().toLowerCase();
        var password = form.password.value;
        var privKey = form.privKey.value.trim();

        // notify the user a key is being generated
        document.getElementById('keyGenProgress').style.display = "block";

        EventManager.publish('privKeyInsert', {
            'vanityID': vanityID,
            'password': password,
            'privKey': privKey
        });
    }


    // Grabs form data and requests public key to be stored
    function handlePubInsert(e) {
        e.preventDefault();
        var form = document.forms["friendInsForm"];
        var vanityID = form.vanityID.value.trim().toLowerCase();
        var pubKey = form.pubKey.value.trim();

        EventManager.publish('pubKeyInsert', {
            'vanityID': vanityID,
            'pubKey': pubKey
        });
    }


    // Sets the visibility of the public key form
    function toggleFriendForm(e) {
        if (document.forms["friendInsForm"].style.display == "none") {
            document.forms["friendInsForm"].style.display = "block";
        } else {
            document.forms["friendInsForm"].style.display = "none";
        }
    }


    // Sets the visibility of the private key forms
    function toggleKeyGenType(e) {

        if (e.target.value == 1) {
            document.forms["keyGenForm"].style.display = "block";
            document.forms["keyInsForm"].style.display = "none";
        } else {
            document.forms["keyGenForm"].style.display = "none";
            document.forms["keyInsForm"].style.display = "block";
        }
    }


    // displays a modal asking user to confirm deletion
    function promptDelete(e) {

        // store a reference to the stuff needed for deletion 
        var row = e.target.parentNode.parentElement;
        var rowIndex = row.rowIndex;
        var tableId = row.parentElement.parentElement.id;
        var name = e.target.parentElement.parentElement.childNodes[1].innerHTML;
        var keyId = e.target.getAttribute('data-uid');

        // store the references in hiden form and displays modal
        updateModal();

        function updateModal() {
            var modal = document.getElementById('delModal');
            modal.children.namedItem("delMsg").children.namedItem("delName").innerHTML = name;
            document.forms["delForm"].keyId.value = keyId;
            document.forms["delForm"].rowIndex.value = rowIndex;
            document.forms["delForm"].tableId.value = tableId;
            modal.showModal();
        }
    }


    // grabs hidden form data and attempts to delete key from storage
    function doDelete(e) {

        e.preventDefault();

        var keyId = document.forms["delForm"].keyId.value;
        var tableId = document.forms["delForm"].tableId.value;
        var rowIndex = document.forms["delForm"].rowIndex.value;

        StoreController.delKey(keyId, function(success) {

            if (!success) {
                renderError({
                    error: 'Could not find key'
                });
                return;
            }

            if (keyId === 'whisper_key') {
                EventManager.publish('noPrivKey', {
                    keys: false
                });
                var privVanityID = document.getElementById('key_table').children[0].children[1].children[0].innerText;
                var friendTable = document.getElementById('friend_table');
                var rows = friendTable.children[0]
                for(var i = 1; i < rows.children.length; i++){
                    var uid = rows.children[i].getElementsByTagName('A')[0].getAttribute('data-uid');
                    if(uid == privVanityID){
                        rows.removeChild(rows.children[i]);
                    }
                }
            }

            else if (document.getElementById('friend_table').rows.length === 2){
                 EventManager.publish('noPubKeys', {
                    keys: false
                });               
            }

            document.getElementById(tableId).rows[rowIndex].remove();

            document.forms["delForm"].parentNode.close();
        });
    };


    // display key details to the user
    function showKeyDetails(e) {

        getKeyFromTable(e, updateModal);

        // Helper function for getting key from table, checks if key exists.
        function getKeyFromTable(e, callback) {
            var keyId = e.target.getAttribute('data-uid');

            StoreController.getKey(keyId, function(key) {
                if (!key) {
                    renderError({
                        error: 'Could not find key'
                    });
                    return;
                }
                callback(key);
            });
        }

        function updateModal(key) {
            var modal = document.getElementById('keyModal');
            modal.children.namedItem('modalHeading').innerHTML = 'Key For: ' + key.getName() + " - " + key.vanityID;

            if (key.privKey === null) {
                modal.children.namedItem('privKeyText').style.display = "none";
                modal.children.namedItem('privateHeading').style.display = "none";
            } else {
                modal.children.namedItem('privKeyText').style.display = "block";
                modal.children.namedItem('privateHeading').style.display = "block";
                modal.children.namedItem('privKeyText').innerHTML = key.privKey.armor();
            }

            
            modal.children.namedItem('pubKeyText').innerHTML = key.pubKey.armor();

            modal.showModal();
        }
    }


    return {
        renderUserKey: renderUserKey,
        renderFriendTable: renderFriendTable,
        renderError: renderError,
        bindEvents: bindEvent
    }

});