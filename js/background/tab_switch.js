// called when tab updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	//  check if the user is currently viewing facebook messages
	var facebook_url = 'https\:\/\/[^ ]*facebook.com\/messages\/[^ ]*';

    if (tab.url.match(facebook_url)) {
        chrome.pageAction.show(tabId);
    }
});