/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */

!function(){var e,t,n;!function(r){function s(e,t){return k.call(e,t)}function o(e,t){var n,r,s,o,i,a,c,u,p,d,y,l=t&&t.split("/"),f=b.map,g=f&&f["*"]||{};if(e&&"."===e.charAt(0))if(t){for(e=e.split("/"),i=e.length-1,b.nodeIdCompat&&w.test(e[i])&&(e[i]=e[i].replace(w,"")),e=l.slice(0,l.length-1).concat(e),p=0;p<e.length;p+=1)if(y=e[p],"."===y)e.splice(p,1),p-=1;else if(".."===y){if(1===p&&(".."===e[2]||".."===e[0]))break;p>0&&(e.splice(p-1,2),p-=2)}e=e.join("/")}else 0===e.indexOf("./")&&(e=e.substring(2));if((l||g)&&f){for(n=e.split("/"),p=n.length;p>0;p-=1){if(r=n.slice(0,p).join("/"),l)for(d=l.length;d>0;d-=1)if(s=f[l.slice(0,d).join("/")],s&&(s=s[r])){o=s,a=p;break}if(o)break;!c&&g&&g[r]&&(c=g[r],u=p)}!o&&c&&(o=c,a=u),o&&(n.splice(0,a,o),e=n.join("/"))}return e}function i(e,t){return function(){var n=K.call(arguments,0);return"string"!=typeof n[0]&&1===n.length&&n.push(null),l.apply(r,n.concat([e,t]))}}function a(e){return function(t){return o(t,e)}}function c(e){return function(t){h[e]=t}}function u(e){if(s(m,e)){var t=m[e];delete m[e],v[e]=!0,y.apply(r,t)}if(!s(h,e)&&!s(v,e))throw new Error("No "+e);return h[e]}function p(e){var t,n=e?e.indexOf("!"):-1;return n>-1&&(t=e.substring(0,n),e=e.substring(n+1,e.length)),[t,e]}function d(e){return function(){return b&&b.config&&b.config[e]||{}}}var y,l,f,g,h={},m={},b={},v={},k=Object.prototype.hasOwnProperty,K=[].slice,w=/\.js$/;f=function(e,t){var n,r=p(e),s=r[0];return e=r[1],s&&(s=o(s,t),n=u(s)),s?e=n&&n.normalize?n.normalize(e,a(t)):o(e,t):(e=o(e,t),r=p(e),s=r[0],e=r[1],s&&(n=u(s))),{f:s?s+"!"+e:e,n:e,pr:s,p:n}},g={require:function(e){return i(e)},exports:function(e){var t=h[e];return"undefined"!=typeof t?t:h[e]={}},module:function(e){return{id:e,uri:"",exports:h[e],config:d(e)}}},y=function(e,t,n,o){var a,p,d,y,l,b,k=[],K=typeof n;if(o=o||e,"undefined"===K||"function"===K){for(t=!t.length&&n.length?["require","exports","module"]:t,l=0;l<t.length;l+=1)if(y=f(t[l],o),p=y.f,"require"===p)k[l]=g.require(e);else if("exports"===p)k[l]=g.exports(e),b=!0;else if("module"===p)a=k[l]=g.module(e);else if(s(h,p)||s(m,p)||s(v,p))k[l]=u(p);else{if(!y.p)throw new Error(e+" missing "+p);y.p.load(y.n,i(o,!0),c(p),{}),k[l]=h[p]}d=n?n.apply(h[e],k):void 0,e&&(a&&a.exports!==r&&a.exports!==h[e]?h[e]=a.exports:d===r&&b||(h[e]=d))}else e&&(h[e]=n)},e=t=l=function(e,t,n,s,o){if("string"==typeof e)return g[e]?g[e](t):u(f(e,t).f);if(!e.splice){if(b=e,b.deps&&l(b.deps,b.callback),!t)return;t.splice?(e=t,t=n,n=null):e=r}return t=t||function(){},"function"==typeof n&&(n=s,s=o),s?y(r,e,t,n):setTimeout(function(){y(r,e,t,n)},4),l},l.config=function(e){return l(e)},e._defined=h,n=function(e,t,n){if("string"!=typeof e)throw new Error("See almond README: incorrect module build, no module name");t.splice||(n=t,t=[]),s(h,e)||s(m,e)||(m[e]=[e,t,n])},n.amd={jQuery:!0}}(),n("Thread",[],function(){function e(e){this.id=e,this.isEncrypted=!1,this.hasAllKeys=!0,this.numPeople=0,this.keys={}}return e.prototype.setEncrypted=function(e){this.isEncrypted=e},e.prototype.setNumPeople=function(){this.numPeople=Object.keys(this.keys).length},e.prototype.addKey=function(e){this.keys[e.FBID]=e,this.setNumPeople()},e.prototype.removeKey=function(e){var t=this.keys.indexOf(e);t>-1&&this.keys.splice(t,1)},e}),n("Tab",["Thread"],function(e){function t(e,t){this.id=e,this.key=t,this.isEncrypted=!0,this.thread=null}return t.prototype.setKeyFBID=function(e){this.key.setFBID(e)},t.prototype.setEncrypted=function(e){this.isEncrypted=e},t.prototype.setThread=function(t){this.thread=new e(t)},t}),n("Key",[],function(){function e(e){this.pubKey=openpgp.key.readArmored(e.pubKey).keys[0],this.privKey=void 0===e.privKey?null:openpgp.key.readArmored(e.privKey).keys[0],this.FBID,this.vanityID=e.vanityID}return e.prototype.getId=function(){return this.pubKey.users[0].userId.userid},e.prototype.setFBID=function(e){this.FBID=e},e.prototype.isUnlocked=function(){return this.privKey.primaryKey.isDecrypted},e.prototype.getName=function(){var e=this.getId(),t=e.split("<")[0];return t},e.prototype.getEmail=function(){var e=this.getId(),t=e.split("<")[1].replace(">","");return t},e.prototype.getPubKeyLength=function(){function e(e){var t=-1;return e.mpi.length>0&&(t=8*e.mpi[0].byteLength()),t}var t=this.pubKey.primaryKey;return null!==t&&(strength=e(t)),strength},e}),n("StoreController",["Key"],function(e){function t(){if(null!==n)throw new Error("StoreController instance already exists")}var n=null;return t.prototype.getKey=function(t,n){chrome.storage.local.get(t,function(r){delete r.settings,n(null===t?r:void 0===r[t]?!1:new e(r[t]))})},t.prototype.setKey=function(e,t,n,r){var s={};null!==n?s.whisper_key={vanityID:e,privKey:n,pubKey:t}:s[e]={vanityID:e,pubKey:t},this.sendUpdate(),chrome.storage.local.set(s,r)},t.prototype.delKey=function(e,t){var n=this;this.getKey(e,function(r){r?(chrome.storage.local.remove(e,t(!0)),n.sendUpdate(),"whisper_key"==e&&chrome.storage.local.remove(r.vanityID)):t(!1)})},t.prototype.hasPrivKey=function(e){this.getKey("whisper_key",e)},t.prototype.getFriends=function(t){this.getKey(null,function(n){var r=!1;if(n.whisper_key){var s=n.whisper_key.vanityID;delete n[s],delete n.whisper_key}if(Object.keys(n).length>0){r=[];for(key in n)r.push(new e({vanityID:n[key].vanityID,pubKey:n[key].pubKey}))}t(r)})},t.prototype.getSettings=function(e,t){chrome.storage.local.get({settings:{}},function(n){var r=n.settings;t(void 0===r[e]?!1:r[e])})},t.prototype.setSettings=function(e,t){chrome.storage.local.get({settings:{}},function(n){var r=n.settings;r[e]=r[e]===!1||void 0===r[e]?!0:!1,chrome.storage.local.set({settings:r},t)})},t.prototype.sendUpdate=function(){chrome.runtime.sendMessage({type:"key_update"})},t.getInstance=function(){return null===n&&(n=new t),n},t.getInstance()}),n("TabManager",["Tab","StoreController"],function(e,t){function n(){if(r=this,this.tabs={},null!==s)throw new Error("MessageController instance already exists")}var r,s=null;return n.prototype.addTab=function(t,n){this.tabs[t]=new e(t,n)},n.prototype.getTab=function(e){return this.tabs[e]},n.prototype.decryptKey=function(e,t){return this.tabs[e].key.privKey.decrypt(t)?!0:!1},n.prototype.updateEncryptionSettings=function(e,n){var r=this.getTab(e);r.thread.setEncrypted(n),t.setSettings(r.thread.id)},n.getInstance=function(){return null===s&&(s=new n),s},n.getInstance()}),n("MessageReader",["TabManager"],function(e){function t(){if(n=this,null!==r)throw new Error("MessageController instance already exists")}var n,r=null;return t.prototype.processMessage=function(t,r,s){function o(){"decrypt_message"==r.type?n.decryptMessage(i,r.data,s):n.decryptMessageBatch(i,r.data,s)}var i=e.getTab(t);return i.key?(i.key.isUnlocked()&&i.isEncrypted?o():i.key.isUnlocked()||i.isEncrypted?!i.key.isUnlocked()&&i.isEncrypted&&setTimeout(function(){n.processMessage(t,r,s)},500):s({message:r.data}),!0):void s({message:r.data})},t.prototype.decryptMessage=function(e,t,n){function r(e){try{var t=JSON.parse(e);return t}catch(n){return!1}}try{var s=r(decodeURIComponent(t))}catch(o){var s=r(t)}if(!s)return void n({message:t});if(!s[e.key.FBID])return void n({message:t});try{var i=openpgp.message.readArmored(s[e.key.FBID])}catch(a){return void n({message:"Could Not Decrypt Message"})}openpgp.decryptMessage(e.key.privKey,i).then(function(e){e="🔏 "+e,n({message:e})})["catch"](function(){n({message:"Could Not Decrypt Message"})})},t.prototype.decryptMessageBatch=function(e,t,r){!function(){function s(){o<t.length?n.decryptMessage(e,t[o].body,function(e){t[o].body=e.message,o++,s()}):r({message:t})}var o=0;s()}()},t.getInstance=function(){return null===r&&(r=new t),r},t.getInstance()}),n("MessageWriter",["Thread","StoreController","TabManager"],function(e,t,n){function r(){if(s=this,null!==o)throw new Error("MessageWriter instance already exists")}var s,o=null;return r.prototype.encryptMessage=function(e,t,r){var s=n.getTab(e),o=/\[body\]=(.*?)&/,i=t.match(o);if(null===i)return void r({message:t});if(i=decodeURIComponent(i[1]),s.thread.isEncrypted){var a={};!function(){function e(){if(n<s.thread.numPeople){var c=parseInt(Object.keys(s.thread.keys)[n]);openpgp.encryptMessage(s.thread.keys[c].pubKey,i).then(function(t){a[s.thread.keys[c].FBID]=t,n++,e()})}else a="[body]="+encodeURIComponent(JSON.stringify(a))+"&",t=t.replace(o,a),r({message:t})}var n=0;e()}()}else r({message:t})},r.prototype.setThread=function(e,r,s){var o,i,a,c=n.getTab(e);o=JSON.parse(r),a=o.payload.participants,i=o.payload.ordered_threadlists[0].thread_fbids[0],void 0===i&&(i=o.payload.ordered_threadlists[0].other_user_fbids[0]),c.setThread(i),t.getSettings(c.thread.id,function(e){!function(){function n(){r<a.length?t.getKey(a[r].vanity,function(e){{var t=a[r].fbid;a[r].vanity}e?(e.setFBID(t),c.thread.addKey(e)):c.thread.hasAllKeys=!1,r++,n()}):(s({hasAllKeys:c.thread.hasAllKeys,encrypted:e,keys:c.thread.keys}),t.getSettings(c.thread.id,function(e){c.thread.setEncrypted(e)}))}var r=0;n()}()})},r.getInstance=function(){return null===o&&(o=new r),o},r.getInstance()}),n("background",["StoreController","Key","MessageReader","MessageWriter","TabManager"],function(e,t,n,r,s){function o(e,t,s){if(t.url.match(u)){switch(e.type){case"decrypt_message":n.processMessage(t.tab.id,e,s);break;case"decrypt_message_batch":n.processMessage(t.tab.id,e,s);break;case"encrypt_message":r.encryptMessage(t.tab.id,e.data,s);break;default:a.uid=e.uid,a.fb_dtsg=e.fb_dtsg}return!0}}function i(t,n,o){function i(t){e.hasPrivKey(function(e){var n=e?!0:!1;s.addTab(t.tab.id,e);var r=n?"images/locked.png":"images/unlocked.png",i=n?"Whisper":"No private key";chrome.pageAction.setIcon({tabId:t.tab.id,path:{19:r,38:r}},function(){chrome.pageAction.setTitle({title:i,tabId:t.tab.id})}),o({success:n})})}function c(){s.decryptKey(n.tab.id,t.password)?(s.getTab(n.tab.id).setKeyFBID(a.uid),o({success:!0})):o({success:!1})}switch(t.type){case"set_thread_info":r.setThread(n.tab.id,t.data,o);break;case"set_encryption":s.updateEncryptionSettings(n.tab.id,t.encrypted);break;case"get_post_data":o({payload:a});break;case"is_enabled":i(n);break;case"decrypt_key":c();break;case"no_password":s.getTab(n.tab.id).setEncrypted(!1)}return!0}chrome.runtime.onMessageExternal.addListener(o),chrome.runtime.onMessage.addListener(i);var a={uid:null,fb_dtsg:null,lastFetched:new Date},c="https://[^ ]*messenger.com/t/[^ ]*",u="https://[^ ]*messenger.com/[^ ]*";chrome.runtime.onMessage.addListener(function(e){"key_update"==e.type&&chrome.tabs.query({url:"https://*.messenger.com/t/*"},function(e){for(var t=0;t<e.length;t++)chrome.tabs.reload(e[t].id)})}),chrome.tabs.onUpdated.addListener(function(e,t,n){n.url.match(u)?(chrome.pageAction.show(n.id),n.url.match(c)&&"complete"==n.status&&chrome.tabs.sendMessage(e,{type:"setThread"}),"https://www.messenger.com/new"==n.url&&(s.getTab(e).setThread(-1),chrome.tabs.sendMessage(e,{type:"new_message"}))):chrome.pageAction.hide(n.id)})}),t(["background"],null,null,!0)}();