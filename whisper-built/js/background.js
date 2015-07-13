// called when tab updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	//  check if the user is currently viewing facebook messages
	var facebook_url = 'https\:\/\/[^ ]*facebook.com\/messages\/[^ ]*';

	// if the user is viewing messages show the icon, otherwise hide it
    if (tab.url.match(facebook_url)) {
        chrome.pageAction.show(tabId);

        chrome.tabs.executeScript(tabId, {file:"../lib/openpgp.min.js"}, function(){

        });
    }
    else{
    	chrome.pageAction.hide(tabId);
    }
});