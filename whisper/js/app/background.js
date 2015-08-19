(function(){  

    // data needed for making requests to facebook
    var postData = {
        uid :null,
        fb_dtsg :null
    }

    var messenger_url = 'https\:\/\/[^ ]*messenger.com\/[^ ]*';
    var messenger_loaded_url = 'https\:\/\/[^ ]*messenger.com\/t\/[^ ]*'

    
    chrome.runtime.onMessage.addListener(
        function handleMessages(request, sender, sendResponse){
            // send the content script the fields needed to make requests to facebook
            if(request.type == 'getThreadInfo'){
                sendResponse({payload: postData}); 

            }
            // check the content script initialised successfully
            else if (request.type == 'enabled'){

                var imgPath = request.enabled == true ? 'images/locked.png' : 'images/unlocked.png'; 
                var title = request.enabled == true ? 'Whisper' : 'No private key';

                chrome.pageAction.setIcon({tabId: sender.tab.id, path:{19: imgPath, 38: imgPath}}, function(){

                    chrome.pageAction.setTitle({title: title, tabId: sender.tab.id});

                    if (request.enabled){ 
                        externalListener();
                    } 
                    else{
                        chrome.runtime.onMessage.removeListener(handleMessages);
                    }                        
                });  
            }   
        }           
    );

    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {   
        // display pageAction if on messenger.com
        if (!!tab.url.match(messenger_url)) {
            chrome.pageAction.show(tab.id);

            // if threads loaded, inject the view
            if(!!tab.url.match(messenger_loaded_url)){
                chrome.tabs.sendMessage(tab.id, {type: 'init', init: true});
            }
        }
        else{
            chrome.pageAction.hide(tab.id);
        }  
    });



    // listen for messages from the webpage
    function externalListener(){
        chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse){

            if(request.type == 'update_post_info'){
                postData.uid = request.uid;
                postData.fb_dtsg = request.fb_dtsg;
                return;
            }

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
    }
})();
