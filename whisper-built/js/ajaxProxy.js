(function(xhr) {

	var send = xhr.send;
	var open = xhr.open;
	var extensionId = 'fponoehammiikgnomgdpbjpjlflfflif';

	// override open method
    xhr.open = function(method, url, async) {

    	var oldReady = this.onreadystatechange;

		xhr.send = function(data){

	    	// user is sending a message
	    	if (method == 'POST' && url == '/ajax/mercury/send_messages.php'){
		    	var that = this;

	    		var payload = {
	    			type: 'encrypt_message',
	    			url: url,
	    			data: data
	    		}

		    	// send request body to be encrypted if the user has encryption turned off, data will be plaintext
		 		chrome.runtime.sendMessage(extensionId, payload, function(response){	
		 			// call send with the replaced message 	 				
		 			send.call(that, response.message);
		 		});
	 		}
	 		else{
	 			send.call(this, data);
	 		}
		}
        open.call(this, method, url, true);
    };

})(XMLHttpRequest.prototype);


function onLoaded(name, callback) {
    var interval = 10; // ms
    window.setTimeout(function() {
        if (window[name]) {
            callback(window[name]);
        } 
        else {
            window.setTimeout(arguments.callee, interval);
        }
    }, interval);
}


onLoaded("AsyncRequest", function(t) {


	(function(AsyncRequest){

		var oldDispatch = AsyncRequest._dispatchResponse;
		var oldSetFinallyHandler = AsyncRequest.setFinallyHandler;

		AsyncRequest._dispatchResponse = function(AsyncResponse){

			// var oldgetPayload = AsyncResponse.getPayload;

			AsyncResponse.getPayload = function(){

				if(!this.payload.actions){
					return this.payload;
				}

				for (var i = 0; i < this.payload.actions.length; i++) {
					this.payload.actions[i].body = 'REPLACED TEXT';
				};

				return this.payload;	
			}

			oldDispatch.call(this, AsyncResponse);
		}

	})(AsyncRequest.prototype);
});


onLoaded("Arbiter", function(t) {

	var inform = Arbiter.inform;

	Arbiter.inform = function(a, b, c){

		if(a == 'channel/message:messaging'){
			if(b.obj.folder){
			 console.log(b.obj.message.body);
			 b.obj.message.body = 'REPLACED TEXT';
			}        
		}		
	    inform.apply(this, arguments);	
	}
});


