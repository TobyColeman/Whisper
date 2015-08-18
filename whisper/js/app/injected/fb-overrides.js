(function(){

onLoaded("AsyncRequest", function() {

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


onLoaded("Arbiter", function() {

	var inform = Arbiter.inform;

	Arbiter.inform = function(a, b, c){

		if(a == 'channel/message:messaging'){
			if(b.obj.folder){
			 b.obj.message.body = 'REPLACED TEXT';
			}        
		}		
	    inform.apply(this, arguments);	
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