define("messenger", ["messengerView", "MessageController"], function (messengerView, MessageController) {
	MessageController.init(function(success){

		chrome.runtime.sendMessage({type: 'enabled', enabled: !!success});

		// user doesn't have a private key
		if(!success){
			return;
		}

		// wait until the user is logged in to inject the view
		chrome.runtime.onMessage.addListener(
			function initView(request, sender, sendResponse){
				if(request.init){
					messengerView.init();
					chrome.runtime.onMessage.removeListener(initView);					
				}
			}
		);	
	});
});	
