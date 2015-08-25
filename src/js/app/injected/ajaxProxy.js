var extensionId = 'mljjhffoolehodpjmimidgkfgannmbdn';

(function(xhr) {

    var send = xhr.send;

    var open = xhr.open;

    // override open method
    xhr.open = function(method, url, async) {

        var oldReady = this.onreadystatechange;

        xhr.send = function(data) {

            // user is sending a message
            if (method == 'POST') {

                var fb_dtsg = data.match(/fb_dtsg=(.*?)&/)[1];
    
                var uid = data.match(/__user=(.*?)&/)[1];

                var payload = {
                    type: 'update_post_info',
                    fb_dtsg: fb_dtsg,
                    uid: uid
                }

                chrome.runtime.sendMessage(extensionId, payload);

                if (url == '/ajax/mercury/send_messages.php') {

                    var that = this;

                    var payload = {
                        type: 'encrypt_message',
                        url: url,
                        data: data
                    }

                    // send request body to be encrypted if the user has encryption turned off, data will be plaintext
                    chrome.runtime.sendMessage(extensionId, payload,
                        function(response) {
                            // call send with the replaced message 	 				
                            send.call(that, response.message);
                        });

                } else {
                    send.call(this, data);
                }
            } else {
                send.call(this, data);
            }
        }
        open.call(this, method, url, true);
    };

})(XMLHttpRequest.prototype);
