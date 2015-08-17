function inject(script){
	// credit: http://bit.ly/1JW19AK
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(script);
	s.onload = function() {
	    this.parentNode.removeChild(this);
	};
	(document.head||document.documentElement).appendChild(s);
}

inject('js/ajaxProxy.js');
inject('js/fb-overrides.js');