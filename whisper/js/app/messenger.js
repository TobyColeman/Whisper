define("messenger", ["messengerView", "MessageController"], function (messengerView, MessageController) {
		
	MessageController.init(function(success){

		if(!success){
			return;
		}

		// injects script - credit: http://bit.ly/1JW19AK
		var s = document.createElement('script');
		s.src = chrome.extension.getURL('js/ajaxProxy.js');
		s.onload = function() {
		    this.parentNode.removeChild(this);
		};
		(document.head||document.documentElement).appendChild(s);

		messengerView.init();		
	});
});	
