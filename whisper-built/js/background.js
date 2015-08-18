(function(){  

    // data needed for making requests to facebook
    var user = {
        id :null,
        fb_dtsg :null
    }

    var messenger_url = 'https\:\/\/[^ ]*messenger.com\/[^ ]*';
    var messenger_loaded_url = 'https\:\/\/[^ ]*messenger.com\/t\/[^ ]*'

    
    chrome.runtime.onMessage.addListener(
        function handleMessages(request, sender, sendResponse){
            // send the content script the fields needed to make requests to facebook
            if(request.type == 'getThreadInfo')
                sendResponse({user: user}); 

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
                chrome.tabs.sendMessage(tab.id, {init: true});
            }
        }
        else{
            chrome.pageAction.hide(tab.id);
        }  
    });



    // listen for messages from the webpage
    function externalListener(){
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
    }


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

        // console.log('URL: ', details.url, user);
    },
    {urls: ['*://*.messenger.com/ajax/bz', 
            '*://*.messenger.com/ajax/mercury/send_messages.php',
            '*://*.messenger.com/chat/user_info/']},
    ['requestBody']);
})();






