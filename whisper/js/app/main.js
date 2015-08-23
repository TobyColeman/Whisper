define("main", ["messengerView", "MessageController"], function (messengerView, MessageController) {

	MessageController.init(function(success){

		chrome.runtime.sendMessage({type: 'enabled', enabled: !!success});

		if(success){
            window.addEventListener('load', function(){
                messengerView.init();
            });
        }
		
	});
});	
