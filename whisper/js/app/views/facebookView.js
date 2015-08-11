// View for facebook.com/messages

define("facebookView", ["Utils", "EventManager"], function (Utils, e){


	var STYLES = {
		// container div where to put the lock button
		toolbar : '_51xa rfloat _ohf',
		// style used for facebook buttons on toolbar
		button  : '_42ft _4jy0 _n6m _4jy3 _517h _51sy',
		// heading of the current chat window
		heading : '_r7',
		// class used in the thread list when a thread is selected
		currentThread: '_k- _kv',
		// list of names when you hover mouse over in group thread
		threadNameList: 'uiList _4kg _6-h _6-j _6-i'
	}


	function init(){

		if (!validateDom()){
			alert('Could not initialise Whisper. Please refresh the page. If this issue persists please check for an updated version of the plugin!');
			return;
		}

		// initialise the GUI
		injectGui();

		// add event listeners
		bindDomEvents();

		// listen to controller events
		subscribeEvents();

		// check user has key

		// if no key bind an event to prompt every time they click lock button

		// otherwise just carry on as normal

	}

	// subscribes to events emitted by the event manager
	function subscribeEvents(){
		e.subscribe('renderKey', renderKey);
		// e.subscribe('noPrivKey', )
	}


	// adds all the event listeners
	function bindDomEvents(){
		document.getElementById('lockButton').addEventListener('click', toggleEncryption);


		// watches for changes between threads : need to add to dom validate
		var threads = document.getElementById('wmMasterViewThreadlist');
		var config = { attributes: true, attributeFilter : ['class'], childList: false, characterData: false, subtree: true };
		var threadObserver = new MutationObserver(function(mutations) {
		    for(var i = 0; i < mutations.length; i++){
		        if (mutations[i].target.className === STYLES.currentThread){
		            getThread(mutations[i].target);
		            break;
		        }
		    }		    
		});
		threadObserver.observe(threads, config);
	}


	// checks that facebook's markup hasn't changed
	function validateDom(){

		for(var key in STYLES){
			if (!Utils.classExists(STYLES[key])){
				console.log('STYLE: ', key, ' was not found.');
				return false;
			}
				
		}
		return true;
	}


	// inject the lock button into the page
	function injectGui(){

		// widgets for facebook chat are placed inside this container element
		var lockContainer = document.getElementsByClassName(STYLES.toolbar)[0];

		// lock button & icon to be injected into the toolbar
		var lockButton = document.createElement('BUTTON');
		lockButton.className = STYLES.button;
		lockButton.id = "lockButton";

		var lockButtonIcon = document.createElement('I');
		lockButtonIcon.className = 'ion-unlocked';
		lockButton.appendChild(lockButtonIcon);

		// insert the lock into the page
		lockContainer.appendChild(lockButton);
	}


	function toggleEncryption(e){
		
		var thread = getThread(e);

		console.log(thread);
	}


	function getThread(node){

		var thread = {}

		// id of the thread 
		var threadId = node.children[0].children[1].href.split('/').pop();			

		// 1 - 1 conversation
		if (threadId.indexOf('conversation') === -1){
			thread.id = threadId;
			thread.type = 'solo';
			thread.keys = [thread.id];
		}
		// group chat
		else {
			thread.id = threadId.split('-').pop();
			thread.type = 'group';
			thread.keys = [];

			document.getElementsByClassName(STYLES.heading)[0].children[0].dispatchEvent(new Event('mouseover'));
			
			var idList;

			setTimeout(function(){
				document.getElementsByClassName(STYLES.heading)[0].children[0].dispatchEvent(new Event('mouseout'));
				idList = document.getElementsByClassName(STYLES.threadNameList)[1].children;

				for(var i = 0; i < idList.length; i++){
					thread.keys.push(idList[i].children[0].children[0].href.split('/').pop());
				}

			},10);
		}
		console.log(thread);
		e.publish('setThread', thread);
	}




	return{
		init: init
	}

});