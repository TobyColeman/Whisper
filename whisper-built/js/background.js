(function(){  

    externalListener();

    // data needed for making requests to facebook
    var postData = {
        uid :null,
        fb_dtsg :null,
        lastFetched: new Date()
    }

    var messenger_url = 'https\:\/\/[^ ]*messenger.com\/[^ ]*';
    var messenger_loaded_url = 'https\:\/\/[^ ]*messenger.com\/t\/[^ ]*'

    
    chrome.runtime.onMessage.addListener(
        function handleMessages(request, sender, sendResponse){
            // send the content script the fields needed to make requests to facebook
            if (request.type == 'getPostData'){
                sendResponse({payload: postData}); 

            }
            else if (request.type == 'key_update'){
                chrome.tabs.query({url: "https://*.messenger.com/t/*"}, function(tabs) {
                    for (var i = 0; i < tabs.length; i++) {
                        chrome.tabs.reload(tabs[i].id);
                    };
                });
            }
            // check the content script initialised successfully
            else if (request.type == 'enabled'){
                var imgPath = request.enabled == true ? 'images/locked.png' : 'images/unlocked.png'; 
                var title = request.enabled == true ? 'Whisper' : 'No private key';

                chrome.pageAction.setIcon({tabId: sender.tab.id, path:{19: imgPath, 38: imgPath}}, function(){

                    chrome.pageAction.setTitle({title: title, tabId: sender.tab.id});
                    
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



    // listen for messages from content-start
    function externalListener(){
        chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse){

            if(request.type == 'update_post_info'){

                var curTime = new Date();

                if ( (((curTime.getTime() - postData.lastFetched.getTime())*0.001)/60) > 60 || postData.uid == null ){
                    postData.uid = request.uid;
                    postData.fb_dtsg = request.fb_dtsg;
                    console.log(postData);
                }
            }

            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

                // pass the message to the content script
                chrome.tabs.sendMessage(tabs[0].id, request, function(response) {
                    
                    // send the response back to content-start
                    sendResponse(response);              
                });
            });
            return true;
        });
    }


})();

