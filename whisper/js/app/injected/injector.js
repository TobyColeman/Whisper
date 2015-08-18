(function(){

function inject(script){
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(script);
	s.onload = function() {
	    this.parentNode.removeChild(this);
	};
	(document.head||document.documentElement).appendChild(s);
}

inject('js/content-start.js');

})();