(function(xhr) {

	var send = xhr.send;
	var open = xhr.open;
	var extensionId = 'fponoehammiikgnomgdpbjpjlflfflif';

	// override open method
    xhr.open = function(method, url, async) {


		xhr.send = function(data){

	    	// user is sending a message
	    	if (method == 'POST' && url == '/ajax/mercury/send_messages.php'){
		    	var that = this;

	    		var payload = {
	    			type: 'send_message',
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




