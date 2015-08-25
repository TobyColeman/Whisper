define("background", ['StoreController', 'Key', 'MessageReader'], function(Store, Key, MessageReader){

    // data needed for making requests to facebook
    var postData = {
        uid :null,
        fb_dtsg :null,
        lastFetched: new Date()
    }
    var messenger_url = 'https\:\/\/[^ ]*messenger.com\/[^ ]*';
    var messenger_loaded_url = 'https\:\/\/[^ ]*messenger.com\/t\/[^ ]*';


// listener for injected scripts
chrome.runtime.onMessageExternal.addListener(function(request, sender, sendResponse){

    if(request.type == 'decrypt_message'){
        MessageReader.processMessage(request, sendResponse);
    }
    else if(request.type == 'decrypt_message_batch'){
        MessageReader.processMessage(request, sendResponse);
    }
    else if(request.type == 'encrypt_message'){
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {

            // pass the message to the content script
            chrome.tabs.sendMessage(tabs[0].id, request, function(response) {
                
                // send the response back to content-start
                sendResponse(response);              
            });
        });                
    }
    else{
        postData.uid = request.uid;
        postData.fb_dtsg = request.fb_dtsg;
    }
    return true;
});



chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse){
        // send the content script the fields needed to make requests to facebook
        if (request.type == 'getPostData'){
            sendResponse({payload: postData}); 
        }
        // refresh messenger pages on insertion/deletion of keys
        else if (request.type == 'key_update'){
            chrome.tabs.query({url: "https://*.messenger.com/t/*"}, function(tabs) {
                for (var i = 0; i < tabs.length; i++) {
                    chrome.tabs.reload(tabs[i].id);
                };
            });
        }
        // notify message controller if user has a key
        else if (request.type == 'enabled'){

            Store.hasPrivKey(function(key){

                var hasKey = !!key ? true : false;
                MessageReader.bindKey(key, postData.uid);

                var imgPath = hasKey ? 'images/locked.png' : 'images/unlocked.png'; 
                var title = hasKey ? 'Whisper' : 'No private key';

                chrome.pageAction.setIcon({tabId: sender.tab.id, path:{19: imgPath, 38: imgPath}}, function(){

                    chrome.pageAction.setTitle({title: title, tabId: sender.tab.id});
                    
                }); 
                sendResponse({success: hasKey});         
            });
        }
        else if(request.type == 'decryptKey'){
            if(!MessageReader.decrypt(request.password)){
                sendResponse({success:false});
            }
            else{
                MessageReader.setFBID(postData.uid);
                sendResponse({success:true});
            }
        }  
        else if(request.type == 'disableDecryption'){
            MessageReader.isDecrypting = false;
        }
        return true; 
    }           
);



chrome.tabs.onUpdated.addListener(
    function(tabId, changeInfo, tab) {   
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
    }
);


});






