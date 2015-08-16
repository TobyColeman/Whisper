(function(){

    // data needed for making requests to facebook
    var user = {
        id :null,
        fb_dtsg :null
    }

    // called when tab updated
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {

        //  check if the user is currently viewing facebook messages
        var messenger_url = 'https\:\/\/[^ ]*messenger.com\/[^ ]*';

        // if the user is viewing messages show the icon, otherwise hide it
        if (tab.url.match(messenger_url)) {
            chrome.pageAction.show(tabId);
        }
        else{
            chrome.pageAction.hide(tabId);
        }

        // notify the view that it can inject its self
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
            if(tabs[0].url.match(messenger_url)){
                chrome.tabs.sendMessage(tabs[0].id, {init: true});
            }
        });
    });


    // listen for messages from the webpage
    chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse){

        // get the active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

            // pass the message to the content script
            chrome.tabs.sendMessage(tabs[0].id, request, function(response) {
                
                // send the response back to ajaxProxy.js
                sendResponse(response);              
            });
        });

        return true;
    });


    // send the content script the fields needed to make requests to facebook
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
        sendResponse({user: user});           
    });


    // Credit: http://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
    // array buffer --> string 
    function ab2str(buf) {
      return String.fromCharCode.apply(null, new Uint8Array(buf));
    }


    // grabs the required fields for making requests to facebook
    chrome.webRequest.onBeforeRequest.addListener(function(details){

        var requestBody;

        if (details.method === 'POST'){
            if (details.requestBody.raw){
                requestBody = ab2str(details.requestBody.raw[0].bytes);
                user.fb_dtsg = requestBody.match(/fb_dtsg=(.*?)&/)[1];
                user.id = requestBody.match(/__user=(.*?)&/)[1];
            }
            else{
                requestBody = details.requestBody.formData;
                user.fb_dtsg = requestBody.fb_dtsg[0];
                user.id = requestBody.__user[0];
            }
                
        }

        if (details.url == 'https://www.messenger.com/ajax/mercury/send_messages.php'){

        }

        console.log('URL: ', details.url, user);
    },
    {urls: ['*://*.messenger.com/ajax/bz', 
            '*://*.messenger.com/ajax/mercury/send_messages.php',
            '*://*.messenger.com/chat/user_info/']},
    ['requestBody']);


    console.log('---', chrome.runtime);


})();






