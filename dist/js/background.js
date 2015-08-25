/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */

!function(){var e,t,n;!function(r){function s(e,t){return b.call(e,t)}function i(e,t){var n,r,s,i,o,a,c,u,p,d,y,l=t&&t.split("/"),f=v.map,h=f&&f["*"]||{};if(e&&"."===e.charAt(0))if(t){for(e=e.split("/"),o=e.length-1,v.nodeIdCompat&&I.test(e[o])&&(e[o]=e[o].replace(I,"")),e=l.slice(0,l.length-1).concat(e),p=0;p<e.length;p+=1)if(y=e[p],"."===y)e.splice(p,1),p-=1;else if(".."===y){if(1===p&&(".."===e[2]||".."===e[0]))break;p>0&&(e.splice(p-1,2),p-=2)}e=e.join("/")}else 0===e.indexOf("./")&&(e=e.substring(2));if((l||h)&&f){for(n=e.split("/"),p=n.length;p>0;p-=1){if(r=n.slice(0,p).join("/"),l)for(d=l.length;d>0;d-=1)if(s=f[l.slice(0,d).join("/")],s&&(s=s[r])){i=s,a=p;break}if(i)break;!c&&h&&h[r]&&(c=h[r],u=p)}!i&&c&&(i=c,a=u),i&&(n.splice(0,a,i),e=n.join("/"))}return e}function o(e,t){return function(){var n=K.call(arguments,0);return"string"!=typeof n[0]&&1===n.length&&n.push(null),l.apply(r,n.concat([e,t]))}}function a(e){return function(t){return i(t,e)}}function c(e){return function(t){g[e]=t}}function u(e){if(s(m,e)){var t=m[e];delete m[e],k[e]=!0,y.apply(r,t)}if(!s(g,e)&&!s(k,e))throw new Error("No "+e);return g[e]}function p(e){var t,n=e?e.indexOf("!"):-1;return n>-1&&(t=e.substring(0,n),e=e.substring(n+1,e.length)),[t,e]}function d(e){return function(){return v&&v.config&&v.config[e]||{}}}var y,l,f,h,g={},m={},v={},k={},b=Object.prototype.hasOwnProperty,K=[].slice,I=/\.js$/;f=function(e,t){var n,r=p(e),s=r[0];return e=r[1],s&&(s=i(s,t),n=u(s)),s?e=n&&n.normalize?n.normalize(e,a(t)):i(e,t):(e=i(e,t),r=p(e),s=r[0],e=r[1],s&&(n=u(s))),{f:s?s+"!"+e:e,n:e,pr:s,p:n}},h={require:function(e){return o(e)},exports:function(e){var t=g[e];return"undefined"!=typeof t?t:g[e]={}},module:function(e){return{id:e,uri:"",exports:g[e],config:d(e)}}},y=function(e,t,n,i){var a,p,d,y,l,v,b=[],K=typeof n;if(i=i||e,"undefined"===K||"function"===K){for(t=!t.length&&n.length?["require","exports","module"]:t,l=0;l<t.length;l+=1)if(y=f(t[l],i),p=y.f,"require"===p)b[l]=h.require(e);else if("exports"===p)b[l]=h.exports(e),v=!0;else if("module"===p)a=b[l]=h.module(e);else if(s(g,p)||s(m,p)||s(k,p))b[l]=u(p);else{if(!y.p)throw new Error(e+" missing "+p);y.p.load(y.n,o(i,!0),c(p),{}),b[l]=g[p]}d=n?n.apply(g[e],b):void 0,e&&(a&&a.exports!==r&&a.exports!==g[e]?g[e]=a.exports:d===r&&v||(g[e]=d))}else e&&(g[e]=n)},e=t=l=function(e,t,n,s,i){if("string"==typeof e)return h[e]?h[e](t):u(f(e,t).f);if(!e.splice){if(v=e,v.deps&&l(v.deps,v.callback),!t)return;t.splice?(e=t,t=n,n=null):e=r}return t=t||function(){},"function"==typeof n&&(n=s,s=i),s?y(r,e,t,n):setTimeout(function(){y(r,e,t,n)},4),l},l.config=function(e){return l(e)},e._defined=g,n=function(e,t,n){if("string"!=typeof e)throw new Error("See almond README: incorrect module build, no module name");t.splice||(n=t,t=[]),s(g,e)||s(m,e)||(m[e]=[e,t,n])},n.amd={jQuery:!0}}(),n("MessageReader",[],function(){function e(){if(t=this,this.isDecrypting=!0,this.FBID,null!==n)throw new Error("MessageController instance already exists")}var t,n=null;return e.prototype.bindKey=function(e){this.key=e},e.prototype.setFBID=function(e){this.key.setFBID(e)},e.prototype.decrypt=function(e){return this.key.privKey.decrypt(e)?!0:!1},e.prototype.processMessage=function(e,n){function r(){"decrypt_message"==e.type?t.decryptMessage(e.data,n):t.decryptMessageBatch(e.data,n)}return this.key?(this.key.isUnlocked()&&this.isDecrypting?r():this.key.isUnlocked()||this.isDecrypting?!this.key.isUnlocked()&&this.isDecrypting&&setTimeout(function(){t.processMessage(e,n)},200):n({message:e.data}),!0):void n({message:e.data})},e.prototype.decryptMessage=function(e,t){function n(e){try{var t=JSON.parse(e);return t}catch(n){return!1}}try{var r=n(decodeURIComponent(e))}catch(s){var r=n(e)}if(!r)return void t({message:e});if(!r[this.key.FBID])return void t({message:e});try{var i=openpgp.message.readArmored(r[this.key.FBID])}catch(o){return void t({message:"Could Not Decrypt Message"})}openpgp.decryptMessage(this.key.privKey,i).then(function(e){e="🔏 "+e,t({message:e})})["catch"](function(){t({message:"Could Not Decrypt Message"})})},e.prototype.decryptMessageBatch=function(e,n){!function(){function r(){s<e.length?t.decryptMessage(e[s].body,function(t){e[s].body=t.message,s++,r()}):n({message:e})}var s=0;r()}()},e.getInstance=function(){return null===n&&(n=new e),n},e.getInstance()}),n("Thread",[],function(){function e(e){this.id=e,this.isEncrypted=!1,this.hasAllKeys=!0,this.numPeople=0,this.keys={}}return e.prototype.setEncrypted=function(e){this.isEncrypted=e},e.prototype.setNumPeople=function(){this.numPeople+=1},e.prototype.addKey=function(e){this.keys[e.FBID]=e,this.setNumPeople()},e.prototype.removeKey=function(e){var t=this.keys.indexOf(e);t>-1&&this.keys.splice(t,1)},e}),n("Key",[],function(){function e(e){this.pubKey=openpgp.key.readArmored(e.pubKey).keys[0],this.privKey=void 0===e.privKey?null:openpgp.key.readArmored(e.privKey).keys[0],this.FBID,this.vanityID=e.vanityID}return e.prototype.getId=function(){return this.pubKey.users[0].userId.userid},e.prototype.setFBID=function(e){this.FBID=e},e.prototype.isUnlocked=function(){return this.privKey.primaryKey.isDecrypted},e.prototype.getName=function(){var e=this.getId(),t=e.split("<")[0];return t},e.prototype.getEmail=function(){var e=this.getId(),t=e.split("<")[1].replace(">","");return t},e.prototype.getPubKeyLength=function(){function e(e){var t=-1;return e.mpi.length>0&&(t=8*e.mpi[0].byteLength()),t}var t=this.pubKey.primaryKey;return null!==t&&(strength=e(t)),strength},e}),n("StoreController",["Key"],function(e){function t(){if(null!==n)throw new Error("StoreController instance already exists")}var n=null;return t.prototype.getKey=function(t,n){chrome.storage.local.get(t,function(r){delete r.settings,n(null===t?r:void 0===r[t]?!1:new e(r[t]))})},t.prototype.setKey=function(e,t,n,r){var s={};null!==n?s.whisper_key={vanityID:e,privKey:n,pubKey:t}:s[e]={vanityID:e,pubKey:t},this.sendUpdate(),chrome.storage.local.set(s,r)},t.prototype.delKey=function(e,t){var n=this;this.getKey(e,function(r){r?(chrome.storage.local.remove(e,t(!0)),n.sendUpdate(),"whisper_key"==e&&chrome.storage.local.remove(r.vanityID)):t(!1)})},t.prototype.hasPrivKey=function(e){this.getKey("whisper_key",e)},t.prototype.hasFriends=function(t){this.getKey(null,function(n){var r=!1;if(n.whisper_key){var s=n.whisper_key.vanityID;delete n[s],delete n.whisper_key}if(Object.keys(n).length>0){r=[];for(key in n)r.push(new e({vanityID:n[key].vanityID,pubKey:n[key].pubKey}))}t(r)})},t.prototype.getSettings=function(e,t){chrome.storage.local.get({settings:{}},function(n){var r=n.settings;t(void 0===r[e]?!1:r[e])})},t.prototype.setSettings=function(e,t){chrome.storage.local.get({settings:{}},function(n){var r=n.settings;r[e]=r[e]===!1||void 0===r[e]?!0:!1,chrome.storage.local.set({settings:r},t)})},t.prototype.sendUpdate=function(){chrome.runtime.sendMessage({type:"key_update"})},t.getInstance=function(){return null===n&&(n=new t),n},t.getInstance()}),n("MessageWriter",["Thread","StoreController"],function(e,t){function n(){if(r=this,this.thread=null,null!==s)throw new Error("MessageWriter instance already exists")}var r,s=null;return n.prototype.encryptMessage=function(e,t){var n=/\[body\]=(.*?)&/,s=e.match(n);if(null===s)return void t({message:e});if(s=decodeURIComponent(s[1]),r.thread.isEncrypted){var i={};!function(){function o(){if(a<r.thread.numPeople){var c=parseInt(Object.keys(r.thread.keys)[a]);openpgp.encryptMessage(r.thread.keys[c].pubKey,s).then(function(e){i[r.thread.keys[c].FBID]=e,a++,o()})}else i="[body]="+encodeURIComponent(JSON.stringify(i))+"&",e=e.replace(n,i),t({message:e})}var a=0;o()}()}else t({message:e})},n.prototype.setThread=function(n,s){var i,o,a;i=JSON.parse(n),a=i.payload.participants,o=i.payload.ordered_threadlists[0].thread_fbids[0],void 0===o&&(o=i.payload.ordered_threadlists[0].other_user_fbids[0]),this.thread=new e(o),t.getSettings(this.thread.id,function(e){!function(){function n(){i<a.length?t.getKey(a[i].vanity,function(e){{var t=a[i].fbid;a[i].vanity}e?(e.setFBID(t),r.thread.addKey(e)):r.thread.hasAllKeys=!1,i++,n()}):(s({hasAllKeys:r.thread.hasAllKeys,encrypted:e,keys:r.thread.keys}),t.getSettings(r.thread.id,function(e){r.thread.setEncrypted(e)}))}var i=0;n()}()})},n.prototype.updateEncryptionSettings=function(e){r.thread.setEncrypted(e),t.setSettings(r.thread.id)},n.getInstance=function(){return null===s&&(s=new n),s},n.getInstance()}),n("background",["StoreController","Key","MessageReader","MessageWriter"],function(e,t,n,r){function s(e,t,s){if(t.url.match(a)){switch(e.type){case"decrypt_message":n.processMessage(e,s);break;case"decrypt_message_batch":n.processMessage(e,s);break;case"encrypt_message":r.encryptMessage(e.data,s);break;default:o.uid=e.uid,o.fb_dtsg=e.fb_dtsg}return!0}}function i(t,s,i){function a(){e.hasPrivKey(function(e){var t=e?!0:!1;n.bindKey(e,o.uid);var r=t?"images/locked.png":"images/unlocked.png",a=t?"Whisper":"No private key";chrome.pageAction.setIcon({tabId:s.tab.id,path:{19:r,38:r}},function(){chrome.pageAction.setTitle({title:a,tabId:s.tab.id})}),i({success:t})})}function c(){n.decrypt(t.password)?(n.setFBID(o.uid),i({success:!0})):i({success:!1})}switch(t.type){case"set_thread_info":r.setThread(t.data,i);break;case"set_encryption":r.updateEncryptionSettings(t.encrypted);break;case"get_post_data":i({payload:o});break;case"is_enabled":a();break;case"decrypt_key":c();break;case"disable_decryption":n.isDecrypting=!1}return!0}var o={uid:null,fb_dtsg:null,lastFetched:new Date},a="https://[^ ]*messenger.com/t/[^ ]*";chrome.runtime.onMessageExternal.addListener(s),chrome.runtime.onMessage.addListener(i),chrome.runtime.onMessage.addListener(function(e){"key_update"==e.type&&chrome.tabs.query({url:"https://*.messenger.com/t/*"},function(e){for(var t=0;t<e.length;t++)chrome.tabs.reload(e[t].id)})}),chrome.tabs.onUpdated.addListener(function(e,t,n){var r="https://[^ ]*messenger.com/[^ ]*";n.url.match(r)?(chrome.pageAction.show(n.id),n.url.match(a)&&chrome.tabs.sendMessage(n.id,{type:"init",init:!0})):chrome.pageAction.hide(n.id)})}),t(["background"],null,null,!0)}();