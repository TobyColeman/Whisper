define("messenger", ["messengerView", "MessageController"], function (messengerView, MessageController) {
	MessageController.init(function(success){

		// user doesn't have a private key
		if(!success){
			return;
		}

		var viewInjected = false;

		// wait until the user is logged in to inject the view
		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
			if (request.init == true && viewInjected == false){
				viewInjected = true;

			    window.addEventListener('load', function(){
					messengerView.init();	
			    })
			}
		});	
	});
});	
