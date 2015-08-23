(function(){

function inject(script){
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(script);
	s.onload = function() {
	    this.parentNode.removeChild(this);
	};
	(document.head||document.documentElement).appendChild(s);
}

chrome.storage.local.get('whisper_key', function(result){
 	if(!!result['whisper_key']) inject('js/content-start.js');
});


})();
