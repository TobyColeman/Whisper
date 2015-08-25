(function(){

onLoaded("AsyncRequest", function() {

	(function(AsyncRequest){

		var oldDispatch = AsyncRequest._dispatchResponse;

		AsyncRequest._dispatchResponse = function(AsyncResponse){

			var that = this;
			var payload = AsyncResponse.getPayload();

			if(payload.actions && payload.actions.length > 0){

				var message = {
					type: 'decrypt_message_batch',
					data: payload.actions
				}

				chrome.runtime.sendMessage(extensionId, message, function(response){

					AsyncResponse.payload.actions = response.message;

					oldDispatch.call(that, AsyncResponse);
				});
			}
			else{
				oldDispatch.call(this, AsyncResponse);
			}
		}

	})(AsyncRequest.prototype);
});


onLoaded("Arbiter", function() {

	var inform = Arbiter.inform;

	Arbiter.inform = function(eventType, data, c){

		if(eventType == 'channel/message:messaging' && data.obj.is_unread){

			var that = this;

			var payload = {
				type: 'decrypt_message',
				data: data.obj.message.body
			}

	 		chrome.runtime.sendMessage(extensionId, payload, function(response){	
	 			// call send with the replaced message 	 
	 			data.obj.message.body = response.message;				
	 			inform.call(that, eventType, data, c);
	 		});
		}
		/* should probably override this instead of xhr object...
		else if(eventType == 'AsyncRequest/send' && data.request.data.message_batch){}
		*/
		else{
			inform.call(this, eventType, data, c)	
		}		
	    
	}
});


// disable the input box as soon as it's available 
window.addEventListener("DOMContentLoaded", function(){

	var observer = new MutationObserver(function(mutations) {

	mutations.forEach(function(mutation) {
			if(mutation.target.className == '_kmc'){
				document.getElementsByClassName('_54-z')[0].setAttribute('contenteditable', false);
				observer.disconnect();
			} 
		});
	});

	observer.observe(document.body, {
		subtree: true,
		attributes: true
	});	
});


function onLoaded(name, callback) {
    var interval = 5; // ms
    window.setTimeout(function() {
        if (window[name]) {
            callback();
        } 
        else {
            window.setTimeout(arguments.callee, interval);
        }
    }, interval);
}

})();