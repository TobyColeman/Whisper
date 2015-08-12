// View for messenger.com

define("messengerView", ["Utils", "EventManager"], function (Utils, em){

	// Styles used when injecting plugin elements into messenger.com
	var STYLES = {
		// heading of the current chat window
		heading : '_3oh-',
		// currently selected thread
		activeThread: '_1ht2',
		// right column 
		threadInfoPane: '_3tkv',
		// name of person in 1-1 thread
		threadPersonName: '_3eur',
		// list of people in a group thread
		threadPeopleList: '_4wc-',
		// wrapper that toggles visibility of right col
		threadInfoPaneWrapper: '_4_j5',
		// span tag in column row
		colSpan: '_3x6u',
		// information button in active state
		infoBtn: '_fl3 _30yy',
	}

	// ignore checking these styles as they are not always used in the page
	// dom checking function is pretty bad really...
	var exceptions = ['rightCol', 'colSpan', 'threadPeopleList', 'threadPersonName'];


	function init(){
		
		if (!validateDom()){
			alert('Could not initialise Whisper. Please refresh the page. If this issue persists please check for an updated version of the plugin.');
			return;
		}
		
		// inject the checkbox needed to toggle encryption on/off
		injectToThread();

		// makes the popup dialog for entering password
		makeDialog();

		// add event listeners
		bindDomEvents();

		// listen to controller events
		subscribeEvents();

		setThread();
	}


	// checks that facebook's markup hasn't changed
	function validateDom(){

		for(var key in STYLES){
			if ( !Utils.classExists(STYLES[key]) && exceptions.indexOf(key) === -1){
				console.log('STYLE: ', key, ' was not found.');
				return false;
			}
				
		}
		return true;
	}


	// subscribes to events emitted by the event manager
	function subscribeEvents(){
		em.subscribe('renderThreadSettings', renderThreadSettings);

		em.subscribe('getPassword', function(){
			document.getElementById('pwDialog').showModal();
		});

		em.subscribe('wrongPassword', function(){
			document.getElementById('pwDialog').children[0].style.display = 'block';
		});

		em.subscribe('correctPassword', function(){
			document.getElementById('pwDialog').children[0].style.display = 'none';
			document.getElementById('pwDialog').close();
		});
	}


	// adds all the event listeners
	function bindDomEvents(){

		// watches for changes between threads
		var threadTitle = document.getElementsByClassName(STYLES.heading)[0];
		var config = { attributes: true, childList: true, characterData: true, subtree: true };
		var titleObserver = new MutationObserver(function() {
			setThread();
		});
		titleObserver.observe(threadTitle, config);

		// watches for change in the right colum / where thread interactions are
		var threadInfoWrapper = document.getElementsByClassName(STYLES.threadInfoPaneWrapper)[0];
		var config = { attributes: true, subtree: false };
		var threadInfoPaneObserver = new MutationObserver(function(mutations) {
			injectToThread();  	
		});
		threadInfoPaneObserver.observe(threadInfoWrapper, config);

		
		checkBox = document.getElementById('encryption-toggle').getElementsByTagName('INPUT')[0];

		// enable / disable encryption for current conversation
		checkBox.addEventListener('click', function(){
			em.publish('setEncryption', {encrypted: checkBox.checked});
		});

		// listen for dialog close event when entering password, will turn off encryption
		document.getElementById('closeDialog').addEventListener('click', function(e){
			e.preventDefault();
			checkBox.checked = false;
			document.getElementById('pwDialog').children[0].style.display = 'none';
			document.getElementById('keyPw').value = '';
			em.publish('setEncryption', {encrypted: false});
			document.getElementById('pwDialog').close();
		});

		// submitting password on enter press
		document.getElementById('keyPw').onkeydown = function(e){
			if(e.keyCode == 13){
				e.preventDefault();
				processForm(e);
			}
		};

		// submitting password with ok button
		document.getElementById('submitDialog').addEventListener('click', processForm);
	}


	// gets the index of the selected thread and pushes an event to retrieve
	// the participants and thread id
	function setThread(){

		// currently selected thread
		var activeThread = document.getElementsByClassName(STYLES.activeThread)[0];
		// get the list of threads
		var threadList = Array.prototype.slice.call(activeThread.parentElement.children);
		// index of the active thread needed for finding thread info 
		activeThread = threadList.indexOf(activeThread);

		checkBox.disabled = true;
		checkBox.checked = false;
		em.publish('setThread', {site:'messenger', threadIndex: activeThread});
	}


	function processForm(e){
		e.preventDefault();
		var password = document.getElementById('keyPw').value;
		em.publish('decryptKey', {password: password});
	}


	function renderThreadSettings(data){

		var encryptionText = checkBox.parentNode.parentNode.children[1];

		if(!data.hasAllKeys){
			checkBox.disabled = true;
			encryptionText.style.textDecoration = 'line-through';
			encryptionText.style.color = '#F0F0F0';		
		}
		else{
			checkBox.disabled = false;
			encryptionText.style.textDecoration = 'none';	
			encryptionText.style.color = '#141823';
			checkBox.checked = data.isEncrypted;	
		}

		var parent = document.getElementsByClassName('_3eur')[0];

		if(parent){	
			parent = parent.children[0];
			makeLock(data.hasAllKeys, parent)
			return;
		}

		var peopleList = document.getElementsByClassName(STYLES.threadPeopleList)[0].getElementsByTagName('UL')[0].children;
			
		for (var i = 0; i < peopleList.length; i++) {

			var lockIcon = document.createElement('SPAN');

			var fbid = peopleList[i].getAttribute('data-reactid').split('$fbid=2')[1];

			var parent = peopleList[i].getElementsByClassName('_364g')[0];

			var hasKey = data.keys[fbid] == true ? true : false;

			makeLock(hasKey, parent);
		};	

		function makeLock(hasKey, parent){
			var lockIcon = document.createElement('SPAN');

			if(hasKey){
				lockIcon.className = 'ion-locked ion-padded ion-blue';
			}
			else{
				lockIcon.className = 'ion-unlocked ion-padded';
			}
			if(parent.children.length < 1)
				parent.appendChild(lockIcon);		
		}
	}


	// inject the checkbox toggle option into the current thread
	function injectToThread(){

		var threadInfoPane = document.getElementsByClassName(STYLES.threadInfoPane)[0];

		if (threadInfoPane === undefined || document.getElementById('encryption-toggle') !== null)
			return;

		var threadInfoRow = threadInfoPane.childNodes[1].cloneNode(true)
		threadInfoRow.id = 'encryption-toggle';
		threadInfoRow.getElementsByClassName(STYLES.colSpan)[0].innerHTML = 'Encryption';

		Utils.removeNestedAttributes('data-reactid', threadInfoRow);
		threadInfoPane.childNodes[1].insertAdjacentElement('afterEnd', threadInfoRow);
	}


	// create a popup dialog for the user to enter their private key password
	function makeDialog(){
		var dialog = document.createElement("DIALOG");
		var errorMsg = document.createElement("P");
		var form = document.createElement("FORM");
		var btnWrapper = document.createElement("DIV");
		var passwordField = document.createElement("INPUT");
		var submitBtn = document.createElement("BUTTON");
		var closeBtn = document.createElement("BUTTON");

		dialog.id = "pwDialog";

		errorMsg.innerHTML = "Incorrect Password";

		passwordField.type = "text";
		passwordField.id = 'keyPw';
		passwordField.placeholder = 'Private Key Password';

		submitBtn.id = "submitDialog";
		submitBtn.innerHTML = "OK";

		closeBtn.id = "closeDialog";
		closeBtn.innerHTML = "Close";
		
		form.appendChild(passwordField);
		form.appendChild(btnWrapper);
		btnWrapper.appendChild(closeBtn);
		btnWrapper.appendChild(submitBtn);
		dialog.appendChild(errorMsg);
		dialog.appendChild(form);
		document.body.appendChild(dialog);
	}

	return{
		init: init
	}
});
