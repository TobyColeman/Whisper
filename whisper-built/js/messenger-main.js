(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.libGlobalName = factory();
    }
}(this, function () {/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

/*! OpenPGPjs.org  this is LGPL licensed code, see LICENSE/our website for more information.- v1.2.0 - 2015-06-12 */!function(a){"object"==typeof exports?module.exports=a():"function"==typeof define&&define.amd?define('openpgp',a):"undefined"!=typeof window?window.openpgp=a():"undefined"!=typeof global?global.openpgp=a():"undefined"!=typeof self&&(self.openpgp=a())}(function(){return function a(b,c,d){function e(g,h){if(!c[g]){if(!b[g]){var i="function"==typeof require&&require;if(!h&&i)return i(g,!0);if(f)return f(g,!0);throw new Error("Cannot find module '"+g+"'")}var j=c[g]={exports:{}};b[g][0].call(j.exports,function(a){var c=b[g][1][a];return e(c?c:a)},j,j.exports,a,b,c,d)}return c[g].exports}for(var f="function"==typeof require&&require,g=0;g<d.length;g++)e(d[g]);return e}({1:[function(a,b,c){var d=b.exports={};d.nextTick=function(){var a="undefined"!=typeof window&&window.setImmediate,b="undefined"!=typeof window&&window.postMessage&&window.addEventListener;if(a)return function(a){return window.setImmediate(a)};if(b){var c=[];return window.addEventListener("message",function(a){var b=a.source;if((b===window||null===b)&&"process-tick"===a.data&&(a.stopPropagation(),c.length>0)){var d=c.shift();d()}},!0),function(a){c.push(a),window.postMessage("process-tick","*")}}return function(a){setTimeout(a,0)}}(),d.title="browser",d.browser=!0,d.env={},d.argv=[],d.binding=function(a){throw new Error("process.binding is not supported")},d.cwd=function(){return"/"},d.chdir=function(a){throw new Error("process.chdir is not supported")}},{}],2:[function(a,b,c){"use strict";var d=a("./promise/promise").Promise,e=a("./promise/polyfill").polyfill;c.Promise=d,c.polyfill=e},{"./promise/polyfill":6,"./promise/promise":7}],3:[function(a,b,c){"use strict";function d(a){var b=this;if(!e(a))throw new TypeError("You must pass an array to all.");return new b(function(b,c){function d(a){return function(b){e(a,b)}}function e(a,c){h[a]=c,0===--i&&b(h)}var g,h=[],i=a.length;0===i&&b([]);for(var j=0;j<a.length;j++)g=a[j],g&&f(g.then)?g.then(d(j),c):e(j,g)})}var e=a("./utils").isArray,f=a("./utils").isFunction;c.all=d},{"./utils":11}],4:[function(a,b,c){function d(){return function(){j.nextTick(g)}}function e(){var a=0,b=new m(g),c=document.createTextNode("");return b.observe(c,{characterData:!0}),function(){c.data=a=++a%2}}function f(){return function(){n.setTimeout(g,1)}}function g(){for(var a=0;a<o.length;a++){var b=o[a],c=b[0],d=b[1];c(d)}o=[]}function h(a,b){var c=o.push([a,b]);1===c&&i()}var i,j=a("__browserify_process"),k="undefined"!=typeof self?self:"undefined"!=typeof window?window:{},l="undefined"!=typeof window?window:{},m=l.MutationObserver||l.WebKitMutationObserver,n="undefined"!=typeof k?k:void 0===this?window:this,o=[];i="undefined"!=typeof j&&"[object process]"==={}.toString.call(j)?d():m?e():f(),c.asap=h},{__browserify_process:1}],5:[function(a,b,c){"use strict";function d(a,b){return 2!==arguments.length?e[a]:void(e[a]=b)}var e={instrument:!1};c.config=e,c.configure=d},{}],6:[function(a,b,c){function d(){var a;a="undefined"!=typeof e?e:"undefined"!=typeof window&&window.document?window:self;var b="Promise"in a&&"resolve"in a.Promise&&"reject"in a.Promise&&"all"in a.Promise&&"race"in a.Promise&&function(){var b;return new a.Promise(function(a){b=a}),g(b)}();b||(a.Promise=f)}var e="undefined"!=typeof self?self:"undefined"!=typeof window?window:{},f=a("./promise").Promise,g=a("./utils").isFunction;c.polyfill=d},{"./promise":7,"./utils":11}],7:[function(a,b,c){"use strict";function d(a){if(!q(a))throw new TypeError("You must pass a resolver function as the first argument to the promise constructor");if(!(this instanceof d))throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");this._subscribers=[],e(a,this)}function e(a,b){function c(a){j(b,a)}function d(a){l(b,a)}try{a(c,d)}catch(e){d(e)}}function f(a,b,c,d){var e,f,g,h,k=q(c);if(k)try{e=c(d),g=!0}catch(m){h=!0,f=m}else e=d,g=!0;i(b,e)||(k&&g?j(b,e):h?l(b,f):a===y?j(b,e):a===z&&l(b,e))}function g(a,b,c,d){var e=a._subscribers,f=e.length;e[f]=b,e[f+y]=c,e[f+z]=d}function h(a,b){for(var c,d,e=a._subscribers,g=a._detail,h=0;h<e.length;h+=3)c=e[h],d=e[h+b],f(b,c,d,g);a._subscribers=null}function i(a,b){var c,d=null;try{if(a===b)throw new TypeError("A promises callback cannot return that same promise.");if(p(b)&&(d=b.then,q(d)))return d.call(b,function(d){return c?!0:(c=!0,void(b!==d?j(a,d):k(a,d)))},function(b){return c?!0:(c=!0,void l(a,b))}),!0}catch(e){return c?!0:(l(a,e),!0)}return!1}function j(a,b){a===b?k(a,b):i(a,b)||k(a,b)}function k(a,b){a._state===w&&(a._state=x,a._detail=b,o.async(m,a))}function l(a,b){a._state===w&&(a._state=x,a._detail=b,o.async(n,a))}function m(a){h(a,a._state=y)}function n(a){h(a,a._state=z)}var o=a("./config").config,p=(a("./config").configure,a("./utils").objectOrFunction),q=a("./utils").isFunction,r=(a("./utils").now,a("./all").all),s=a("./race").race,t=a("./resolve").resolve,u=a("./reject").reject,v=a("./asap").asap;o.async=v;var w=void 0,x=0,y=1,z=2;d.prototype={constructor:d,_state:void 0,_detail:void 0,_subscribers:void 0,then:function(a,b){var c=this,d=new this.constructor(function(){});if(this._state){var e=arguments;o.async(function(){f(c._state,d,e[c._state-1],c._detail)})}else g(this,d,a,b);return d},"catch":function(a){return this.then(null,a)}},d.all=r,d.race=s,d.resolve=t,d.reject=u,c.Promise=d},{"./all":3,"./asap":4,"./config":5,"./race":8,"./reject":9,"./resolve":10,"./utils":11}],8:[function(a,b,c){"use strict";function d(a){var b=this;if(!e(a))throw new TypeError("You must pass an array to race.");return new b(function(b,c){for(var d,e=0;e<a.length;e++)d=a[e],d&&"function"==typeof d.then?d.then(b,c):b(d)})}var e=a("./utils").isArray;c.race=d},{"./utils":11}],9:[function(a,b,c){"use strict";function d(a){var b=this;return new b(function(b,c){c(a)})}c.reject=d},{}],10:[function(a,b,c){"use strict";function d(a){if(a&&"object"==typeof a&&a.constructor===this)return a;var b=this;return new b(function(b){b(a)})}c.resolve=d},{}],11:[function(a,b,c){"use strict";function d(a){return e(a)||"object"==typeof a&&null!==a}function e(a){return"function"==typeof a}function f(a){return"[object Array]"===Object.prototype.toString.call(a)}var g=Date.now||function(){return(new Date).getTime()};c.objectOrFunction=d,c.isFunction=e,c.isArray=f,c.now=g},{}],12:[function(a,b,c){"use strict";function d(a,b){return this instanceof d?(this.text=a.replace(/\r/g,"").replace(/[\t ]+\n/g,"\n").replace(/\n/g,"\r\n"),void(this.packets=b||new h.List)):new d(a,b)}function e(a){var b=j.decode(a);if(b.type!==i.armor.signed)throw new Error("No cleartext signed message.");var c=new h.List;c.read(b.data),f(b.headers,c);var e=new d(b.text,c);return e}function f(a,b){for(var c=function(a){for(var c=0;c<b.length;c++)if(b[c].tag===i.packet.signature&&!a.some(function(a){return b[c].hashAlgorithm===a}))return!1;return!0},d=null,e=[],f=0;f<a.length;f++){if(d=a[f].match(/Hash: (.+)/),!d)throw new Error('Only "Hash" header allowed in cleartext signed message');d=d[1].replace(/\s/g,""),d=d.split(","),d=d.map(function(a){a=a.toLowerCase();try{return i.write(i.hash,a)}catch(b){throw new Error("Unknown hash algorithm in armor header: "+a)}}),e=e.concat(d)}if(!e.length&&!c([i.hash.md5]))throw new Error('If no "Hash" header in cleartext signed message, then only MD5 signatures allowed');if(!c(e))throw new Error("Hash algorithm mismatch in armor header and signature")}var g=a("./config"),h=a("./packet"),i=a("./enums.js"),j=a("./encoding/armor.js");d.prototype.getSigningKeyIds=function(){var a=[],b=this.packets.filterByTag(i.packet.signature);return b.forEach(function(b){a.push(b.issuerKeyId)}),a},d.prototype.sign=function(a){var b=new h.List,c=new h.Literal;c.setText(this.text);for(var d=0;d<a.length;d++){if(a[d].isPublic())throw new Error("Need private key for signing");var e=new h.Signature;e.signatureType=i.signature.text,e.hashAlgorithm=g.prefer_hash_algorithm;var f=a[d].getSigningKeyPacket();if(e.publicKeyAlgorithm=f.algorithm,!f.isDecrypted)throw new Error("Private key is not decrypted.");e.sign(f,c),b.push(e)}this.packets=b},d.prototype.verify=function(a){var b=[],c=this.packets.filterByTag(i.packet.signature),d=new h.Literal;d.setText(this.text);for(var e=0;e<c.length;e++){for(var f=null,g=0;g<a.length&&!(f=a[g].getSigningKeyPacket(c[e].issuerKeyId));g++);var j={};f?(j.keyid=c[e].issuerKeyId,j.valid=c[e].verify(f,d)):(j.keyid=c[e].issuerKeyId,j.valid=null),b.push(j)}return b},d.prototype.getText=function(){return this.text.replace(/\r\n/g,"\n")},d.prototype.armor=function(){var a={hash:i.read(i.hash,g.prefer_hash_algorithm).toUpperCase(),text:this.text,data:this.packets.write()};return j.encode(i.armor.signed,a)},c.CleartextMessage=d,c.readArmored=e},{"./config":17,"./encoding/armor.js":41,"./enums.js":43,"./packet":53}],13:[function(a,b,c){(function(){"use strict";function a(a,b){var c=a.split("."),d=n;!(c[0]in d)&&d.execScript&&d.execScript("var "+c[0]);for(var e;c.length&&(e=c.shift());)c.length||b===l?d=d[e]?d[e]:d[e]={}:d[e]=b}function b(a,b){if(this.index="number"==typeof b?b:0,this.d=0,this.buffer=a instanceof(o?Uint8Array:Array)?a:new(o?Uint8Array:Array)(32768),2*this.buffer.length<=this.index)throw Error("invalid index");this.buffer.length<=this.index&&c(this)}function c(a){var b,c=a.buffer,d=c.length,e=new(o?Uint8Array:Array)(d<<1);if(o)e.set(c);else for(b=0;d>b;++b)e[b]=c[b];return a.buffer=e}function d(a){this.buffer=new(o?Uint16Array:Array)(2*a),this.length=0}function e(a,b){this.e=w,this.f=0,this.input=o&&a instanceof Array?new Uint8Array(a):a,this.c=0,b&&(b.lazy&&(this.f=b.lazy),"number"==typeof b.compressionType&&(this.e=b.compressionType),b.outputBuffer&&(this.b=o&&b.outputBuffer instanceof Array?new Uint8Array(b.outputBuffer):b.outputBuffer),"number"==typeof b.outputIndex&&(this.c=b.outputIndex)),this.b||(this.b=new(o?Uint8Array:Array)(32768))}function f(a,b){this.length=a,this.g=b}function g(a,b){function c(a,b){var c,d=a.g,e=[],f=0;c=z[a.length],e[f++]=65535&c,e[f++]=c>>16&255,e[f++]=c>>24;var g;switch(m){case 1===d:g=[0,d-1,0];break;case 2===d:g=[1,d-2,0];break;case 3===d:g=[2,d-3,0];break;case 4===d:g=[3,d-4,0];break;case 6>=d:g=[4,d-5,1];break;case 8>=d:g=[5,d-7,1];break;case 12>=d:g=[6,d-9,2];break;case 16>=d:g=[7,d-13,2];break;case 24>=d:g=[8,d-17,3];break;case 32>=d:g=[9,d-25,3];break;case 48>=d:g=[10,d-33,4];break;case 64>=d:g=[11,d-49,4];break;case 96>=d:g=[12,d-65,5];break;case 128>=d:g=[13,d-97,5];break;case 192>=d:g=[14,d-129,6];break;case 256>=d:g=[15,d-193,6];break;case 384>=d:g=[16,d-257,7];break;case 512>=d:g=[17,d-385,7];break;case 768>=d:g=[18,d-513,8];break;case 1024>=d:g=[19,d-769,8];break;case 1536>=d:g=[20,d-1025,9];break;case 2048>=d:g=[21,d-1537,9];break;case 3072>=d:g=[22,d-2049,10];break;case 4096>=d:g=[23,d-3073,10];break;case 6144>=d:g=[24,d-4097,11];break;case 8192>=d:g=[25,d-6145,11];break;case 12288>=d:g=[26,d-8193,12];break;case 16384>=d:g=[27,d-12289,12];break;case 24576>=d:g=[28,d-16385,13];break;case 32768>=d:g=[29,d-24577,13];break;default:throw"invalid distance"}c=g,e[f++]=c[0],e[f++]=c[1],e[f++]=c[2];var h,i;for(h=0,i=e.length;i>h;++h)r[s++]=e[h];u[e[0]]++,v[e[3]]++,t=a.length+b-1,n=null}var d,e,f,g,i,j,k,n,p,q={},r=o?new Uint16Array(2*b.length):[],s=0,t=0,u=new(o?Uint32Array:Array)(286),v=new(o?Uint32Array:Array)(30),w=a.f;if(!o){for(f=0;285>=f;)u[f++]=0;for(f=0;29>=f;)v[f++]=0}for(u[256]=1,d=0,e=b.length;e>d;++d){for(f=i=0,g=3;g>f&&d+f!==e;++f)i=i<<8|b[d+f];if(q[i]===l&&(q[i]=[]),j=q[i],!(0<t--)){for(;0<j.length&&32768<d-j[0];)j.shift();if(d+3>=e){for(n&&c(n,-1),f=0,g=e-d;g>f;++f)p=b[d+f],r[s++]=p,++u[p];break}0<j.length?(k=h(b,d,j),n?n.length<k.length?(p=b[d-1],r[s++]=p,++u[p],c(k,0)):c(n,-1):k.length<w?n=k:c(k,0)):n?c(n,-1):(p=b[d],r[s++]=p,++u[p])}j.push(d)}return r[s++]=256,u[256]++,a.j=u,a.i=v,o?r.subarray(0,s):r}function h(a,b,c){var d,e,g,h,i,j,k=0,l=a.length;h=0,j=c.length;a:for(;j>h;h++){if(d=c[j-h-1],g=3,k>3){for(i=k;i>3;i--)if(a[d+i-1]!==a[b+i-1])continue a;g=k}for(;258>g&&l>b+g&&a[d+g]===a[b+g];)++g;if(g>k&&(e=d,k=g),258===g)break}return new f(k,b-e)}function i(a,b){var c,e,f,g,h,i=a.length,k=new d(572),l=new(o?Uint8Array:Array)(i);if(!o)for(g=0;i>g;g++)l[g]=0;for(g=0;i>g;++g)0<a[g]&&k.push(g,a[g]);if(c=Array(k.length/2),e=new(o?Uint32Array:Array)(k.length/2),1===c.length)return l[k.pop().index]=1,l;for(g=0,h=k.length/2;h>g;++g)c[g]=k.pop(),e[g]=c[g].value;for(f=j(e,e.length,b),g=0,h=c.length;h>g;++g)l[c[g].index]=f[g];return l}function j(a,b,c){function d(a){var c=n[a][p[a]];c===b?(d(a+1),d(a+1)):--l[c],++p[a]}var e,f,g,h,i,j=new(o?Uint16Array:Array)(c),k=new(o?Uint8Array:Array)(c),l=new(o?Uint8Array:Array)(b),m=Array(c),n=Array(c),p=Array(c),q=(1<<c)-b,r=1<<c-1;for(j[c-1]=b,f=0;c>f;++f)r>q?k[f]=0:(k[f]=1,q-=r),q<<=1,j[c-2-f]=(j[c-1-f]/2|0)+b;for(j[0]=k[0],m[0]=Array(j[0]),n[0]=Array(j[0]),f=1;c>f;++f)j[f]>2*j[f-1]+k[f]&&(j[f]=2*j[f-1]+k[f]),m[f]=Array(j[f]),n[f]=Array(j[f]);for(e=0;b>e;++e)l[e]=c;for(g=0;g<j[c-1];++g)m[c-1][g]=a[g],n[c-1][g]=g;for(e=0;c>e;++e)p[e]=0;for(1===k[c-1]&&(--l[0],++p[c-1]),f=c-2;f>=0;--f){for(h=e=0,i=p[f+1],g=0;g<j[f];g++)h=m[f+1][i]+m[f+1][i+1],h>a[e]?(m[f][g]=h,n[f][g]=b,i+=2):(m[f][g]=a[e],n[f][g]=e,++e);p[f]=0,1===k[f]&&d(f)}return l}function k(a){var b,c,d,e,f=new(o?Uint16Array:Array)(a.length),g=[],h=[],i=0;for(b=0,c=a.length;c>b;b++)g[a[b]]=(0|g[a[b]])+1;for(b=1,c=16;c>=b;b++)h[b]=i,i+=0|g[b],i<<=1;for(b=0,c=a.length;c>b;b++)for(i=h[a[b]],h[a[b]]+=1,d=f[b]=0,e=a[b];e>d;d++)f[b]=f[b]<<1|1&i,i>>>=1;return f}var l=void 0,m=!0,n=this,o="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Uint32Array&&"undefined"!=typeof DataView;b.prototype.a=function(a,b,d){var e,f=this.buffer,g=this.index,h=this.d,i=f[g];if(d&&b>1&&(a=b>8?(u[255&a]<<24|u[a>>>8&255]<<16|u[a>>>16&255]<<8|u[a>>>24&255])>>32-b:u[a]>>8-b),8>b+h)i=i<<b|a,h+=b;else for(e=0;b>e;++e)i=i<<1|a>>b-e-1&1,8===++h&&(h=0,f[g++]=u[i],i=0,g===f.length&&(f=c(this)));f[g]=i,this.buffer=f,this.d=h,this.index=g},b.prototype.finish=function(){var a,b=this.buffer,c=this.index;return 0<this.d&&(b[c]<<=8-this.d,b[c]=u[b[c]],c++),o?a=b.subarray(0,c):(b.length=c,a=b),a};var p,q=new(o?Uint8Array:Array)(256);for(p=0;256>p;++p){for(var r=p,s=r,t=7,r=r>>>1;r;r>>>=1)s<<=1,s|=1&r,--t;q[p]=(s<<t&255)>>>0}var u=q;d.prototype.getParent=function(a){return 2*((a-2)/4|0)},d.prototype.push=function(a,b){var c,d,e,f=this.buffer;for(c=this.length,f[this.length++]=b,f[this.length++]=a;c>0&&(d=this.getParent(c),f[c]>f[d]);)e=f[c],f[c]=f[d],f[d]=e,e=f[c+1],f[c+1]=f[d+1],f[d+1]=e,c=d;return this.length},d.prototype.pop=function(){var a,b,c,d,e,f=this.buffer;for(b=f[0],a=f[1],this.length-=2,f[0]=f[this.length],f[1]=f[this.length+1],e=0;(d=2*e+2,!(d>=this.length))&&(d+2<this.length&&f[d+2]>f[d]&&(d+=2),f[d]>f[e]);)c=f[e],f[e]=f[d],f[d]=c,c=f[e+1],f[e+1]=f[d+1],f[d+1]=c,e=d;return{index:a,value:b,length:this.length}};var v,w=2,x=[];for(v=0;288>v;v++)switch(m){case 143>=v:x.push([v+48,8]);break;case 255>=v:x.push([v-144+400,9]);break;case 279>=v:x.push([v-256+0,7]);break;case 287>=v:x.push([v-280+192,8]);break;default:throw"invalid literal: "+v}e.prototype.h=function(){var a,c,d,e,f=this.input;switch(this.e){case 0:for(d=0,e=f.length;e>d;){c=o?f.subarray(d,d+65535):f.slice(d,d+65535),d+=c.length;var h=c,j=d===e,n=l,p=l,q=l,r=l,s=l,t=this.b,u=this.c;if(o){for(t=new Uint8Array(this.b.buffer);t.length<=u+h.length+5;)t=new Uint8Array(t.length<<1);t.set(this.b)}if(n=j?1:0,t[u++]=0|n,p=h.length,q=~p+65536&65535,t[u++]=255&p,t[u++]=p>>>8&255,t[u++]=255&q,t[u++]=q>>>8&255,o)t.set(h,u),u+=h.length,t=t.subarray(0,u);else{for(r=0,s=h.length;s>r;++r)t[u++]=h[r];t.length=u}this.c=u,this.b=t}break;case 1:var v=new b(o?new Uint8Array(this.b.buffer):this.b,this.c);v.a(1,1,m),v.a(1,2,m);var y,z,A,B=g(this,f);for(y=0,z=B.length;z>y;y++)if(A=B[y],b.prototype.a.apply(v,x[A]),A>256)v.a(B[++y],B[++y],m),v.a(B[++y],5),v.a(B[++y],B[++y],m);else if(256===A)break;this.b=v.finish(),this.c=this.b.length;break;case w:var C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R=new b(o?new Uint8Array(this.b.buffer):this.b,this.c),S=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],T=Array(19);for(C=w,R.a(1,1,m),R.a(C,2,m),D=g(this,f),H=i(this.j,15),I=k(H),J=i(this.i,7),K=k(J),E=286;E>257&&0===H[E-1];E--);for(F=30;F>1&&0===J[F-1];F--);var U,V,W,X,Y,Z,$=E,_=F,aa=new(o?Uint32Array:Array)($+_),ba=new(o?Uint32Array:Array)(316),ca=new(o?Uint8Array:Array)(19);for(U=V=0;$>U;U++)aa[V++]=H[U];for(U=0;_>U;U++)aa[V++]=J[U];if(!o)for(U=0,X=ca.length;X>U;++U)ca[U]=0;for(U=Y=0,X=aa.length;X>U;U+=V){for(V=1;X>U+V&&aa[U+V]===aa[U];++V);if(W=V,0===aa[U])if(3>W)for(;0<W--;)ba[Y++]=0,ca[0]++;else for(;W>0;)Z=138>W?W:138,Z>W-3&&W>Z&&(Z=W-3),10>=Z?(ba[Y++]=17,ba[Y++]=Z-3,ca[17]++):(ba[Y++]=18,ba[Y++]=Z-11,ca[18]++),W-=Z;else if(ba[Y++]=aa[U],ca[aa[U]]++,W--,3>W)for(;0<W--;)ba[Y++]=aa[U],ca[aa[U]]++;else for(;W>0;)Z=6>W?W:6,Z>W-3&&W>Z&&(Z=W-3),ba[Y++]=16,ba[Y++]=Z-3,ca[16]++,W-=Z}for(a=o?ba.subarray(0,Y):ba.slice(0,Y),L=i(ca,7),P=0;19>P;P++)T[P]=L[S[P]];for(G=19;G>4&&0===T[G-1];G--);for(M=k(L),R.a(E-257,5,m),R.a(F-1,5,m),R.a(G-4,4,m),P=0;G>P;P++)R.a(T[P],3,m);for(P=0,Q=a.length;Q>P;P++)if(N=a[P],R.a(M[N],L[N],m),N>=16){switch(P++,N){case 16:O=2;break;case 17:O=3;break;case 18:O=7;break;default:throw"invalid code: "+N}R.a(a[P],O,m)}var da,ea,fa,ga,ha,ia,ja,ka,la=[I,H],ma=[K,J];for(ha=la[0],ia=la[1],ja=ma[0],ka=ma[1],da=0,ea=D.length;ea>da;++da)if(fa=D[da],R.a(ha[fa],ia[fa],m),fa>256)R.a(D[++da],D[++da],m),ga=D[++da],R.a(ja[ga],ka[ga],m),R.a(D[++da],D[++da],m);else if(256===fa)break;this.b=R.finish(),this.c=this.b.length;break;default:throw"invalid compression type"}return this.b};var y=function(){function a(a){switch(m){case 3===a:return[257,a-3,0];case 4===a:return[258,a-4,0];case 5===a:return[259,a-5,0];case 6===a:return[260,a-6,0];case 7===a:return[261,a-7,0];case 8===a:return[262,a-8,0];case 9===a:return[263,a-9,0];case 10===a:return[264,a-10,0];case 12>=a:return[265,a-11,1];case 14>=a:return[266,a-13,1];case 16>=a:return[267,a-15,1];case 18>=a:return[268,a-17,1];case 22>=a:return[269,a-19,2];case 26>=a:return[270,a-23,2];case 30>=a:return[271,a-27,2];case 34>=a:return[272,a-31,2];case 42>=a:return[273,a-35,3];case 50>=a:return[274,a-43,3];case 58>=a:return[275,a-51,3];case 66>=a:return[276,a-59,3];case 82>=a:return[277,a-67,4];case 98>=a:return[278,a-83,4];case 114>=a:return[279,a-99,4];case 130>=a:return[280,a-115,4];case 162>=a:return[281,a-131,5];case 194>=a:return[282,a-163,5];case 226>=a:return[283,a-195,5];case 257>=a:return[284,a-227,5];case 258===a:return[285,a-258,0];default:throw"invalid length: "+a}}var b,c,d=[];for(b=3;258>=b;b++)c=a(b),d[b]=c[2]<<24|c[1]<<16|c[0];return d}(),z=o?new Uint32Array(y):y;a("Zlib.RawDeflate",e),a("Zlib.RawDeflate.prototype.compress",e.prototype.h);var A,B,C,D,E={NONE:0,FIXED:1,DYNAMIC:w};if(Object.keys)A=Object.keys(E);else for(B in A=[],C=0,E)A[C++]=B;for(C=0,D=A.length;D>C;++C)B=A[C],a("Zlib.RawDeflate.CompressionType."+B,E[B])}).call(this)},{}],14:[function(a,b,c){(function(){"use strict";function a(a,b){var c=a.split("."),d=g;!(c[0]in d)&&d.execScript&&d.execScript("var "+c[0]);for(var e;c.length&&(e=c.shift());)c.length||void 0===b?d=d[e]?d[e]:d[e]={}:d[e]=b}function b(a){var b,c,d,e,f,g,i,j,k,l,m=a.length,n=0,o=Number.POSITIVE_INFINITY;for(j=0;m>j;++j)a[j]>n&&(n=a[j]),a[j]<o&&(o=a[j]);for(b=1<<n,c=new(h?Uint32Array:Array)(b),d=1,e=0,f=2;n>=d;){for(j=0;m>j;++j)if(a[j]===d){for(g=0,i=e,k=0;d>k;++k)g=g<<1|1&i,i>>=1;for(l=d<<16|j,k=g;b>k;k+=f)c[k]=l;++e}++d,e<<=1,f<<=1}return[c,n,o]}function c(a,b){switch(this.g=[],this.h=32768,this.c=this.f=this.d=this.k=0,this.input=h?new Uint8Array(a):a,this.l=!1,this.i=j,this.q=!1,(b||!(b={}))&&(b.index&&(this.d=b.index),b.bufferSize&&(this.h=b.bufferSize),b.bufferType&&(this.i=b.bufferType),b.resize&&(this.q=b.resize)),this.i){case i:this.a=32768,this.b=new(h?Uint8Array:Array)(32768+this.h+258);break;case j:this.a=0,this.b=new(h?Uint8Array:Array)(this.h),this.e=this.v,this.m=this.s,this.j=this.t;break;default:throw Error("invalid inflate mode")}}function d(a,b){for(var c,d=a.f,e=a.c,f=a.input,g=a.d,h=f.length;b>e;){if(g>=h)throw Error("input buffer is broken");d|=f[g++]<<e,e+=8}return c=d&(1<<b)-1,a.f=d>>>b,a.c=e-b,a.d=g,c}function e(a,b){for(var c,d,e=a.f,f=a.c,g=a.input,h=a.d,i=g.length,j=b[0],k=b[1];k>f&&!(h>=i);)e|=g[h++]<<f,f+=8;return c=j[e&(1<<k)-1],d=c>>>16,a.f=e>>d,a.c=f-d,a.d=h,65535&c}function f(a){function c(a,b,c){var f,g,h,i=this.p;for(h=0;a>h;)switch(f=e(this,b)){case 16:for(g=3+d(this,2);g--;)c[h++]=i;break;case 17:for(g=3+d(this,3);g--;)c[h++]=0;i=0;break;case 18:for(g=11+d(this,7);g--;)c[h++]=0;i=0;break;default:i=c[h++]=f}return this.p=i,c}var f,g,i,j,k=d(a,5)+257,l=d(a,5)+1,m=d(a,4)+4,o=new(h?Uint8Array:Array)(n.length);for(j=0;m>j;++j)o[n[j]]=d(a,3);if(!h)for(j=m,m=o.length;m>j;++j)o[n[j]]=0;f=b(o),g=new(h?Uint8Array:Array)(k),i=new(h?Uint8Array:Array)(l),a.p=0,a.j(b(c.call(a,k,f,g)),b(c.call(a,l,f,i)))}var g=this,h="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Uint32Array&&"undefined"!=typeof DataView,i=0,j=1;c.prototype.u=function(){for(;!this.l;){var a=d(this,3);switch(1&a&&(this.l=!0),a>>>=1){case 0:var b=this.input,c=this.d,e=this.b,g=this.a,k=b.length,l=void 0,m=void 0,n=e.length,o=void 0;if(this.c=this.f=0,c+1>=k)throw Error("invalid uncompressed block header: LEN");if(l=b[c++]|b[c++]<<8,c+1>=k)throw Error("invalid uncompressed block header: NLEN");if(m=b[c++]|b[c++]<<8,l===~m)throw Error("invalid uncompressed block header: length verify");if(c+l>b.length)throw Error("input buffer is broken");switch(this.i){case i:for(;g+l>e.length;){if(o=n-g,l-=o,h)e.set(b.subarray(c,c+o),g),g+=o,c+=o;else for(;o--;)e[g++]=b[c++];this.a=g,e=this.e(),g=this.a}break;case j:for(;g+l>e.length;)e=this.e({o:2});break;default:throw Error("invalid inflate mode")}if(h)e.set(b.subarray(c,c+l),g),g+=l,c+=l;else for(;l--;)e[g++]=b[c++];this.d=c,this.a=g,this.b=e;break;case 1:this.j(z,B);break;case 2:f(this);break;default:throw Error("unknown BTYPE: "+a)}}return this.m()};var k,l,m=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],n=h?new Uint16Array(m):m,o=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],p=h?new Uint16Array(o):o,q=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],r=h?new Uint8Array(q):q,s=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],t=h?new Uint16Array(s):s,u=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],v=h?new Uint8Array(u):u,w=new(h?Uint8Array:Array)(288);for(k=0,l=w.length;l>k;++k)w[k]=143>=k?8:255>=k?9:279>=k?7:8;var x,y,z=b(w),A=new(h?Uint8Array:Array)(30);for(x=0,y=A.length;y>x;++x)A[x]=5;var B=b(A);c.prototype.j=function(a,b){var c=this.b,f=this.a;this.n=a;for(var g,h,i,j,k=c.length-258;256!==(g=e(this,a));)if(256>g)f>=k&&(this.a=f,c=this.e(),f=this.a),c[f++]=g;else for(h=g-257,j=p[h],0<r[h]&&(j+=d(this,r[h])),g=e(this,b),i=t[g],0<v[g]&&(i+=d(this,v[g])),f>=k&&(this.a=f,c=this.e(),f=this.a);j--;)c[f]=c[f++-i];for(;8<=this.c;)this.c-=8,this.d--;this.a=f},c.prototype.t=function(a,b){var c=this.b,f=this.a;this.n=a;for(var g,h,i,j,k=c.length;256!==(g=e(this,a));)if(256>g)f>=k&&(c=this.e(),k=c.length),c[f++]=g;else for(h=g-257,j=p[h],0<r[h]&&(j+=d(this,r[h])),g=e(this,b),i=t[g],0<v[g]&&(i+=d(this,v[g])),f+j>k&&(c=this.e(),k=c.length);j--;)c[f]=c[f++-i];for(;8<=this.c;)this.c-=8,this.d--;this.a=f},c.prototype.e=function(){var a,b,c=new(h?Uint8Array:Array)(this.a-32768),d=this.a-32768,e=this.b;if(h)c.set(e.subarray(32768,c.length));else for(a=0,b=c.length;b>a;++a)c[a]=e[a+32768];if(this.g.push(c),this.k+=c.length,h)e.set(e.subarray(d,d+32768));else for(a=0;32768>a;++a)e[a]=e[d+a];return this.a=32768,e},c.prototype.v=function(a){var b,c,d,e,f=this.input.length/this.d+1|0,g=this.input,i=this.b;return a&&("number"==typeof a.o&&(f=a.o),"number"==typeof a.r&&(f+=a.r)),2>f?(c=(g.length-this.d)/this.n[2],e=258*(c/2)|0,d=e<i.length?i.length+e:i.length<<1):d=i.length*f,h?(b=new Uint8Array(d),b.set(i)):b=i,this.b=b},c.prototype.m=function(){var a,b,c,d,e,f=0,g=this.b,i=this.g,j=new(h?Uint8Array:Array)(this.k+(this.a-32768));if(0===i.length)return h?this.b.subarray(32768,this.a):this.b.slice(32768,this.a);for(b=0,c=i.length;c>b;++b)for(a=i[b],d=0,e=a.length;e>d;++d)j[f++]=a[d];for(b=32768,c=this.a;c>b;++b)j[f++]=g[b];return this.g=[],this.buffer=j},c.prototype.s=function(){var a,b=this.a;return h?this.q?(a=new Uint8Array(b),a.set(this.b.subarray(0,b))):a=this.b.subarray(0,b):(this.b.length>b&&(this.b.length=b),a=this.b),this.buffer=a},a("Zlib.RawInflate",c),a("Zlib.RawInflate.prototype.decompress",c.prototype.u);var C,D,E,F,G={ADAPTIVE:j,BLOCK:i};if(Object.keys)C=Object.keys(G);else for(D in C=[],E=0,G)C[E++]=D;for(E=0,F=C.length;F>E;++E)D=C[E],a("Zlib.RawInflate.BufferType."+D,G[D])}).call(this)},{}],15:[function(a,b,c){(function(){"use strict";function a(a){throw a}function b(a,b){var c=a.split("."),d=w;!(c[0]in d)&&d.execScript&&d.execScript("var "+c[0]);for(var e;c.length&&(e=c.shift());)c.length||b===u?d=d[e]?d[e]:d[e]={}:d[e]=b}function c(b,c){this.index="number"==typeof c?c:0,this.i=0,this.buffer=b instanceof(x?Uint8Array:Array)?b:new(x?Uint8Array:Array)(32768),2*this.buffer.length<=this.index&&a(Error("invalid index")),this.buffer.length<=this.index&&this.f()}function d(a){this.buffer=new(x?Uint16Array:Array)(2*a),this.length=0}function e(a){var b,c,d,e,f,g,h,i,j,k,l=a.length,m=0,n=Number.POSITIVE_INFINITY;for(i=0;l>i;++i)a[i]>m&&(m=a[i]),a[i]<n&&(n=a[i]);for(b=1<<m,c=new(x?Uint32Array:Array)(b),d=1,e=0,f=2;m>=d;){for(i=0;l>i;++i)if(a[i]===d){for(g=0,h=e,j=0;d>j;++j)g=g<<1|1&h,h>>=1;for(k=d<<16|i,j=g;b>j;j+=f)c[j]=k;++e}++d,e<<=1,f<<=1}return[c,m,n]}function f(a,b){this.h=F,this.w=0,this.input=x&&a instanceof Array?new Uint8Array(a):a,this.b=0,b&&(b.lazy&&(this.w=b.lazy),"number"==typeof b.compressionType&&(this.h=b.compressionType),b.outputBuffer&&(this.a=x&&b.outputBuffer instanceof Array?new Uint8Array(b.outputBuffer):b.outputBuffer),"number"==typeof b.outputIndex&&(this.b=b.outputIndex)),this.a||(this.a=new(x?Uint8Array:Array)(32768))}function g(a,b){this.length=a,this.H=b}function h(b,c){function d(b,c){var d,e=b.H,f=[],g=0;d=J[b.length],f[g++]=65535&d,f[g++]=d>>16&255,f[g++]=d>>24;var h;switch(v){case 1===e:h=[0,e-1,0];break;case 2===e:h=[1,e-2,0];break;case 3===e:h=[2,e-3,0];break;case 4===e:h=[3,e-4,0];break;case 6>=e:h=[4,e-5,1];break;case 8>=e:h=[5,e-7,1];break;case 12>=e:h=[6,e-9,2];break;case 16>=e:h=[7,e-13,2];break;case 24>=e:h=[8,e-17,3];break;case 32>=e:h=[9,e-25,3];break;case 48>=e:h=[10,e-33,4];break;case 64>=e:h=[11,e-49,4];break;case 96>=e:h=[12,e-65,5];break;case 128>=e:h=[13,e-97,5];break;case 192>=e:h=[14,e-129,6];break;case 256>=e:h=[15,e-193,6];break;case 384>=e:h=[16,e-257,7];break;case 512>=e:h=[17,e-385,7];break;case 768>=e:h=[18,e-513,8];break;case 1024>=e:h=[19,e-769,8];break;case 1536>=e:h=[20,e-1025,9];break;case 2048>=e:h=[21,e-1537,9];break;case 3072>=e:h=[22,e-2049,10];break;case 4096>=e:h=[23,e-3073,10];break;case 6144>=e:h=[24,e-4097,11];break;case 8192>=e:h=[25,e-6145,11];break;case 12288>=e:h=[26,e-8193,12];break;case 16384>=e:h=[27,e-12289,12];break;case 24576>=e:h=[28,e-16385,13];break;case 32768>=e:h=[29,e-24577,13];break;default:a("invalid distance")}d=h,f[g++]=d[0],f[g++]=d[1],f[g++]=d[2];var i,j;for(i=0,j=f.length;j>i;++i)p[q++]=f[i];s[f[0]]++,t[f[3]]++,r=b.length+c-1,m=null}var e,f,g,h,j,k,l,m,n,o={},p=x?new Uint16Array(2*c.length):[],q=0,r=0,s=new(x?Uint32Array:Array)(286),t=new(x?Uint32Array:Array)(30),w=b.w;if(!x){for(g=0;285>=g;)s[g++]=0;for(g=0;29>=g;)t[g++]=0}for(s[256]=1,e=0,f=c.length;f>e;++e){for(g=j=0,h=3;h>g&&e+g!==f;++g)j=j<<8|c[e+g];if(o[j]===u&&(o[j]=[]),k=o[j],!(0<r--)){for(;0<k.length&&32768<e-k[0];)k.shift();if(e+3>=f){for(m&&d(m,-1),g=0,h=f-e;h>g;++g)n=c[e+g],p[q++]=n,++s[n];break}0<k.length?(l=i(c,e,k),m?m.length<l.length?(n=c[e-1],p[q++]=n,++s[n],d(l,0)):d(m,-1):l.length<w?m=l:d(l,0)):m?d(m,-1):(n=c[e],p[q++]=n,++s[n])}k.push(e)}return p[q++]=256,s[256]++,b.M=s,b.L=t,x?p.subarray(0,q):p}function i(a,b,c){var d,e,f,h,i,j,k=0,l=a.length;h=0,j=c.length;a:for(;j>h;h++){if(d=c[j-h-1],f=3,k>3){for(i=k;i>3;i--)if(a[d+i-1]!==a[b+i-1])continue a;f=k}for(;258>f&&l>b+f&&a[d+f]===a[b+f];)++f;if(f>k&&(e=d,k=f),258===f)break}return new g(k,b-e)}function j(a,b){var c,e,f,g,h,i=a.length,j=new d(572),l=new(x?Uint8Array:Array)(i);if(!x)for(g=0;i>g;g++)l[g]=0;for(g=0;i>g;++g)0<a[g]&&j.push(g,a[g]);if(c=Array(j.length/2),e=new(x?Uint32Array:Array)(j.length/2),1===c.length)return l[j.pop().index]=1,l;for(g=0,h=j.length/2;h>g;++g)c[g]=j.pop(),e[g]=c[g].value;for(f=k(e,e.length,b),g=0,h=c.length;h>g;++g)l[c[g].index]=f[g];return l}function k(a,b,c){function d(a){var c=n[a][o[a]];c===b?(d(a+1),d(a+1)):--l[c],++o[a]}var e,f,g,h,i,j=new(x?Uint16Array:Array)(c),k=new(x?Uint8Array:Array)(c),l=new(x?Uint8Array:Array)(b),m=Array(c),n=Array(c),o=Array(c),p=(1<<c)-b,q=1<<c-1;for(j[c-1]=b,f=0;c>f;++f)q>p?k[f]=0:(k[f]=1,p-=q),p<<=1,j[c-2-f]=(j[c-1-f]/2|0)+b;for(j[0]=k[0],m[0]=Array(j[0]),n[0]=Array(j[0]),f=1;c>f;++f)j[f]>2*j[f-1]+k[f]&&(j[f]=2*j[f-1]+k[f]),m[f]=Array(j[f]),n[f]=Array(j[f]);for(e=0;b>e;++e)l[e]=c;for(g=0;g<j[c-1];++g)m[c-1][g]=a[g],n[c-1][g]=g;for(e=0;c>e;++e)o[e]=0;for(1===k[c-1]&&(--l[0],++o[c-1]),f=c-2;f>=0;--f){for(h=e=0,i=o[f+1],g=0;g<j[f];g++)h=m[f+1][i]+m[f+1][i+1],h>a[e]?(m[f][g]=h,n[f][g]=b,i+=2):(m[f][g]=a[e],n[f][g]=e,++e);o[f]=0,1===k[f]&&d(f)}return l}function l(a){var b,c,d,e,f=new(x?Uint16Array:Array)(a.length),g=[],h=[],i=0;for(b=0,c=a.length;c>b;b++)g[a[b]]=(0|g[a[b]])+1;for(b=1,c=16;c>=b;b++)h[b]=i,i+=0|g[b],i<<=1;for(b=0,c=a.length;c>b;b++)for(i=h[a[b]],h[a[b]]+=1,d=f[b]=0,e=a[b];e>d;d++)f[b]=f[b]<<1|1&i,i>>>=1;return f}function m(b,c){switch(this.l=[],this.m=32768,this.e=this.g=this.c=this.q=0,this.input=x?new Uint8Array(b):b,this.s=!1,this.n=L,this.C=!1,(c||!(c={}))&&(c.index&&(this.c=c.index),c.bufferSize&&(this.m=c.bufferSize),c.bufferType&&(this.n=c.bufferType),c.resize&&(this.C=c.resize)),this.n){case K:this.b=32768,this.a=new(x?Uint8Array:Array)(32768+this.m+258);break;case L:this.b=0,this.a=new(x?Uint8Array:Array)(this.m),this.f=this.K,this.t=this.I,this.o=this.J;break;default:a(Error("invalid inflate mode"))}}function n(b,c){for(var d,e=b.g,f=b.e,g=b.input,h=b.c,i=g.length;c>f;)h>=i&&a(Error("input buffer is broken")),e|=g[h++]<<f,f+=8;return d=e&(1<<c)-1,b.g=e>>>c,b.e=f-c,b.c=h,d}function o(a,b){for(var c,d,e=a.g,f=a.e,g=a.input,h=a.c,i=g.length,j=b[0],k=b[1];k>f&&!(h>=i);)e|=g[h++]<<f,f+=8;return c=j[e&(1<<k)-1],d=c>>>16,a.g=e>>d,a.e=f-d,a.c=h,65535&c}function p(a){function b(a,b,c){var d,e,f,g=this.z;for(f=0;a>f;)switch(d=o(this,b)){case 16:for(e=3+n(this,2);e--;)c[f++]=g;break;case 17:for(e=3+n(this,3);e--;)c[f++]=0;g=0;break;case 18:for(e=11+n(this,7);e--;)c[f++]=0;g=0;break;default:g=c[f++]=d}return this.z=g,c}var c,d,f,g,h=n(a,5)+257,i=n(a,5)+1,j=n(a,4)+4,k=new(x?Uint8Array:Array)(Q.length);for(g=0;j>g;++g)k[Q[g]]=n(a,3);if(!x)for(g=j,j=k.length;j>g;++g)k[Q[g]]=0;c=e(k),d=new(x?Uint8Array:Array)(h),f=new(x?Uint8Array:Array)(i),a.z=0,a.o(e(b.call(a,h,c,d)),e(b.call(a,i,c,f)))}function q(a){if("string"==typeof a){var b,c,d=a.split("");for(b=0,c=d.length;c>b;b++)d[b]=(255&d[b].charCodeAt(0))>>>0;a=d}for(var e,f=1,g=0,h=a.length,i=0;h>0;){e=h>1024?1024:h,h-=e;do f+=a[i++],g+=f;while(--e);f%=65521,g%=65521}return(g<<16|f)>>>0}function r(b,c){var d,e;switch(this.input=b,this.c=0,(c||!(c={}))&&(c.index&&(this.c=c.index),c.verify&&(this.N=c.verify)),d=b[this.c++],e=b[this.c++],15&d){case da:this.method=da;break;default:a(Error("unsupported compression method"))}0!==((d<<8)+e)%31&&a(Error("invalid fcheck flag:"+((d<<8)+e)%31)),32&e&&a(Error("fdict flag is not supported")),this.B=new m(b,{index:this.c,bufferSize:c.bufferSize,bufferType:c.bufferType,resize:c.resize})}function s(a,b){this.input=a,this.a=new(x?Uint8Array:Array)(32768),this.h=ea.k;var c,d={};!b&&(b={})||"number"!=typeof b.compressionType||(this.h=b.compressionType);for(c in b)d[c]=b[c];
d.outputBuffer=this.a,this.A=new f(this.input,d)}function t(a,c){var d,e,f,g;if(Object.keys)d=Object.keys(c);else for(e in d=[],f=0,c)d[f++]=e;for(f=0,g=d.length;g>f;++f)e=d[f],b(a+"."+e,c[e])}var u=void 0,v=!0,w=this,x="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Uint32Array&&"undefined"!=typeof DataView;c.prototype.f=function(){var a,b=this.buffer,c=b.length,d=new(x?Uint8Array:Array)(c<<1);if(x)d.set(b);else for(a=0;c>a;++a)d[a]=b[a];return this.buffer=d},c.prototype.d=function(a,b,c){var d,e=this.buffer,f=this.index,g=this.i,h=e[f];if(c&&b>1&&(a=b>8?(D[255&a]<<24|D[a>>>8&255]<<16|D[a>>>16&255]<<8|D[a>>>24&255])>>32-b:D[a]>>8-b),8>b+g)h=h<<b|a,g+=b;else for(d=0;b>d;++d)h=h<<1|a>>b-d-1&1,8===++g&&(g=0,e[f++]=D[h],h=0,f===e.length&&(e=this.f()));e[f]=h,this.buffer=e,this.i=g,this.index=f},c.prototype.finish=function(){var a,b=this.buffer,c=this.index;return 0<this.i&&(b[c]<<=8-this.i,b[c]=D[b[c]],c++),x?a=b.subarray(0,c):(b.length=c,a=b),a};var y,z=new(x?Uint8Array:Array)(256);for(y=0;256>y;++y){for(var A=y,B=A,C=7,A=A>>>1;A;A>>>=1)B<<=1,B|=1&A,--C;z[y]=(B<<C&255)>>>0}var D=z;d.prototype.getParent=function(a){return 2*((a-2)/4|0)},d.prototype.push=function(a,b){var c,d,e,f=this.buffer;for(c=this.length,f[this.length++]=b,f[this.length++]=a;c>0&&(d=this.getParent(c),f[c]>f[d]);)e=f[c],f[c]=f[d],f[d]=e,e=f[c+1],f[c+1]=f[d+1],f[d+1]=e,c=d;return this.length},d.prototype.pop=function(){var a,b,c,d,e,f=this.buffer;for(b=f[0],a=f[1],this.length-=2,f[0]=f[this.length],f[1]=f[this.length+1],e=0;(d=2*e+2,!(d>=this.length))&&(d+2<this.length&&f[d+2]>f[d]&&(d+=2),f[d]>f[e]);)c=f[e],f[e]=f[d],f[d]=c,c=f[e+1],f[e+1]=f[d+1],f[d+1]=c,e=d;return{index:a,value:b,length:this.length}};var E,F=2,G={NONE:0,r:1,k:F,O:3},H=[];for(E=0;288>E;E++)switch(v){case 143>=E:H.push([E+48,8]);break;case 255>=E:H.push([E-144+400,9]);break;case 279>=E:H.push([E-256+0,7]);break;case 287>=E:H.push([E-280+192,8]);break;default:a("invalid literal: "+E)}f.prototype.j=function(){var b,d,e,f,g=this.input;switch(this.h){case 0:for(e=0,f=g.length;f>e;){d=x?g.subarray(e,e+65535):g.slice(e,e+65535),e+=d.length;var i=d,k=e===f,m=u,n=u,o=u,p=u,q=u,r=this.a,s=this.b;if(x){for(r=new Uint8Array(this.a.buffer);r.length<=s+i.length+5;)r=new Uint8Array(r.length<<1);r.set(this.a)}if(m=k?1:0,r[s++]=0|m,n=i.length,o=~n+65536&65535,r[s++]=255&n,r[s++]=n>>>8&255,r[s++]=255&o,r[s++]=o>>>8&255,x)r.set(i,s),s+=i.length,r=r.subarray(0,s);else{for(p=0,q=i.length;q>p;++p)r[s++]=i[p];r.length=s}this.b=s,this.a=r}break;case 1:var t=new c(x?new Uint8Array(this.a.buffer):this.a,this.b);t.d(1,1,v),t.d(1,2,v);var w,y,z,A=h(this,g);for(w=0,y=A.length;y>w;w++)if(z=A[w],c.prototype.d.apply(t,H[z]),z>256)t.d(A[++w],A[++w],v),t.d(A[++w],5),t.d(A[++w],A[++w],v);else if(256===z)break;this.a=t.finish(),this.b=this.a.length;break;case F:var B,C,D,E,G,I,J,K,L,M,N,O,P,Q,R,S=new c(x?new Uint8Array(this.a.buffer):this.a,this.b),T=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],U=Array(19);for(B=F,S.d(1,1,v),S.d(B,2,v),C=h(this,g),I=j(this.M,15),J=l(I),K=j(this.L,7),L=l(K),D=286;D>257&&0===I[D-1];D--);for(E=30;E>1&&0===K[E-1];E--);var V,W,X,Y,Z,$,_=D,aa=E,ba=new(x?Uint32Array:Array)(_+aa),ca=new(x?Uint32Array:Array)(316),da=new(x?Uint8Array:Array)(19);for(V=W=0;_>V;V++)ba[W++]=I[V];for(V=0;aa>V;V++)ba[W++]=K[V];if(!x)for(V=0,Y=da.length;Y>V;++V)da[V]=0;for(V=Z=0,Y=ba.length;Y>V;V+=W){for(W=1;Y>V+W&&ba[V+W]===ba[V];++W);if(X=W,0===ba[V])if(3>X)for(;0<X--;)ca[Z++]=0,da[0]++;else for(;X>0;)$=138>X?X:138,$>X-3&&X>$&&($=X-3),10>=$?(ca[Z++]=17,ca[Z++]=$-3,da[17]++):(ca[Z++]=18,ca[Z++]=$-11,da[18]++),X-=$;else if(ca[Z++]=ba[V],da[ba[V]]++,X--,3>X)for(;0<X--;)ca[Z++]=ba[V],da[ba[V]]++;else for(;X>0;)$=6>X?X:6,$>X-3&&X>$&&($=X-3),ca[Z++]=16,ca[Z++]=$-3,da[16]++,X-=$}for(b=x?ca.subarray(0,Z):ca.slice(0,Z),M=j(da,7),Q=0;19>Q;Q++)U[Q]=M[T[Q]];for(G=19;G>4&&0===U[G-1];G--);for(N=l(M),S.d(D-257,5,v),S.d(E-1,5,v),S.d(G-4,4,v),Q=0;G>Q;Q++)S.d(U[Q],3,v);for(Q=0,R=b.length;R>Q;Q++)if(O=b[Q],S.d(N[O],M[O],v),O>=16){switch(Q++,O){case 16:P=2;break;case 17:P=3;break;case 18:P=7;break;default:a("invalid code: "+O)}S.d(b[Q],P,v)}var ea,fa,ga,ha,ia,ja,ka,la,ma=[J,I],na=[L,K];for(ia=ma[0],ja=ma[1],ka=na[0],la=na[1],ea=0,fa=C.length;fa>ea;++ea)if(ga=C[ea],S.d(ia[ga],ja[ga],v),ga>256)S.d(C[++ea],C[++ea],v),ha=C[++ea],S.d(ka[ha],la[ha],v),S.d(C[++ea],C[++ea],v);else if(256===ga)break;this.a=S.finish(),this.b=this.a.length;break;default:a("invalid compression type")}return this.a};var I=function(){function b(b){switch(v){case 3===b:return[257,b-3,0];case 4===b:return[258,b-4,0];case 5===b:return[259,b-5,0];case 6===b:return[260,b-6,0];case 7===b:return[261,b-7,0];case 8===b:return[262,b-8,0];case 9===b:return[263,b-9,0];case 10===b:return[264,b-10,0];case 12>=b:return[265,b-11,1];case 14>=b:return[266,b-13,1];case 16>=b:return[267,b-15,1];case 18>=b:return[268,b-17,1];case 22>=b:return[269,b-19,2];case 26>=b:return[270,b-23,2];case 30>=b:return[271,b-27,2];case 34>=b:return[272,b-31,2];case 42>=b:return[273,b-35,3];case 50>=b:return[274,b-43,3];case 58>=b:return[275,b-51,3];case 66>=b:return[276,b-59,3];case 82>=b:return[277,b-67,4];case 98>=b:return[278,b-83,4];case 114>=b:return[279,b-99,4];case 130>=b:return[280,b-115,4];case 162>=b:return[281,b-131,5];case 194>=b:return[282,b-163,5];case 226>=b:return[283,b-195,5];case 257>=b:return[284,b-227,5];case 258===b:return[285,b-258,0];default:a("invalid length: "+b)}}var c,d,e=[];for(c=3;258>=c;c++)d=b(c),e[c]=d[2]<<24|d[1]<<16|d[0];return e}(),J=x?new Uint32Array(I):I,K=0,L=1,M={F:K,D:L};m.prototype.p=function(){for(;!this.s;){var b=n(this,3);switch(1&b&&(this.s=v),b>>>=1){case 0:var c=this.input,d=this.c,e=this.a,f=this.b,g=c.length,h=u,i=u,j=e.length,k=u;switch(this.e=this.g=0,d+1>=g&&a(Error("invalid uncompressed block header: LEN")),h=c[d++]|c[d++]<<8,d+1>=g&&a(Error("invalid uncompressed block header: NLEN")),i=c[d++]|c[d++]<<8,h===~i&&a(Error("invalid uncompressed block header: length verify")),d+h>c.length&&a(Error("input buffer is broken")),this.n){case K:for(;f+h>e.length;){if(k=j-f,h-=k,x)e.set(c.subarray(d,d+k),f),f+=k,d+=k;else for(;k--;)e[f++]=c[d++];this.b=f,e=this.f(),f=this.b}break;case L:for(;f+h>e.length;)e=this.f({v:2});break;default:a(Error("invalid inflate mode"))}if(x)e.set(c.subarray(d,d+h),f),f+=h,d+=h;else for(;h--;)e[f++]=c[d++];this.c=d,this.b=f,this.a=e;break;case 1:this.o(aa,ca);break;case 2:p(this);break;default:a(Error("unknown BTYPE: "+b))}}return this.t()};var N,O,P=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],Q=x?new Uint16Array(P):P,R=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],S=x?new Uint16Array(R):R,T=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],U=x?new Uint8Array(T):T,V=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],W=x?new Uint16Array(V):V,X=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],Y=x?new Uint8Array(X):X,Z=new(x?Uint8Array:Array)(288);for(N=0,O=Z.length;O>N;++N)Z[N]=143>=N?8:255>=N?9:279>=N?7:8;var $,_,aa=e(Z),ba=new(x?Uint8Array:Array)(30);for($=0,_=ba.length;_>$;++$)ba[$]=5;var ca=e(ba);m.prototype.o=function(a,b){var c=this.a,d=this.b;this.u=a;for(var e,f,g,h,i=c.length-258;256!==(e=o(this,a));)if(256>e)d>=i&&(this.b=d,c=this.f(),d=this.b),c[d++]=e;else for(f=e-257,h=S[f],0<U[f]&&(h+=n(this,U[f])),e=o(this,b),g=W[e],0<Y[e]&&(g+=n(this,Y[e])),d>=i&&(this.b=d,c=this.f(),d=this.b);h--;)c[d]=c[d++-g];for(;8<=this.e;)this.e-=8,this.c--;this.b=d},m.prototype.J=function(a,b){var c=this.a,d=this.b;this.u=a;for(var e,f,g,h,i=c.length;256!==(e=o(this,a));)if(256>e)d>=i&&(c=this.f(),i=c.length),c[d++]=e;else for(f=e-257,h=S[f],0<U[f]&&(h+=n(this,U[f])),e=o(this,b),g=W[e],0<Y[e]&&(g+=n(this,Y[e])),d+h>i&&(c=this.f(),i=c.length);h--;)c[d]=c[d++-g];for(;8<=this.e;)this.e-=8,this.c--;this.b=d},m.prototype.f=function(){var a,b,c=new(x?Uint8Array:Array)(this.b-32768),d=this.b-32768,e=this.a;if(x)c.set(e.subarray(32768,c.length));else for(a=0,b=c.length;b>a;++a)c[a]=e[a+32768];if(this.l.push(c),this.q+=c.length,x)e.set(e.subarray(d,d+32768));else for(a=0;32768>a;++a)e[a]=e[d+a];return this.b=32768,e},m.prototype.K=function(a){var b,c,d,e,f=this.input.length/this.c+1|0,g=this.input,h=this.a;return a&&("number"==typeof a.v&&(f=a.v),"number"==typeof a.G&&(f+=a.G)),2>f?(c=(g.length-this.c)/this.u[2],e=258*(c/2)|0,d=e<h.length?h.length+e:h.length<<1):d=h.length*f,x?(b=new Uint8Array(d),b.set(h)):b=h,this.a=b},m.prototype.t=function(){var a,b,c,d,e,f=0,g=this.a,h=this.l,i=new(x?Uint8Array:Array)(this.q+(this.b-32768));if(0===h.length)return x?this.a.subarray(32768,this.b):this.a.slice(32768,this.b);for(b=0,c=h.length;c>b;++b)for(a=h[b],d=0,e=a.length;e>d;++d)i[f++]=a[d];for(b=32768,c=this.b;c>b;++b)i[f++]=g[b];return this.l=[],this.buffer=i},m.prototype.I=function(){var a,b=this.b;return x?this.C?(a=new Uint8Array(b),a.set(this.a.subarray(0,b))):a=this.a.subarray(0,b):(this.a.length>b&&(this.a.length=b),a=this.a),this.buffer=a},r.prototype.p=function(){var b,c,d=this.input;return b=this.B.p(),this.c=this.B.c,this.N&&(c=(d[this.c++]<<24|d[this.c++]<<16|d[this.c++]<<8|d[this.c++])>>>0,c!==q(b)&&a(Error("invalid adler-32 checksum"))),b};var da=8,ea=G;s.prototype.j=function(){var b,c,d,e,f,g,h,i=0;switch(h=this.a,b=da){case da:c=Math.LOG2E*Math.log(32768)-8;break;default:a(Error("invalid compression method"))}switch(d=c<<4|b,h[i++]=d,b){case da:switch(this.h){case ea.NONE:f=0;break;case ea.r:f=1;break;case ea.k:f=2;break;default:a(Error("unsupported compression type"))}break;default:a(Error("invalid compression method"))}return e=f<<6|0,h[i++]=e|31-(256*d+e)%31,g=q(this.input),this.A.b=i,h=this.A.j(),i=h.length,x&&(h=new Uint8Array(h.buffer),h.length<=i+4&&(this.a=new Uint8Array(h.length+4),this.a.set(h),h=this.a),h=h.subarray(0,i+4)),h[i++]=g>>24&255,h[i++]=g>>16&255,h[i++]=g>>8&255,h[i++]=255&g,h},b("Zlib.Inflate",r),b("Zlib.Inflate.prototype.decompress",r.prototype.p),t("Zlib.Inflate.BufferType",{ADAPTIVE:M.D,BLOCK:M.F}),b("Zlib.Deflate",s),b("Zlib.Deflate.compress",function(a,b){return new s(a,b).j()}),b("Zlib.Deflate.prototype.compress",s.prototype.j),t("Zlib.Deflate.CompressionType",{NONE:ea.NONE,FIXED:ea.r,DYNAMIC:ea.k})}).call(this)},{}],16:[function(a,b,c){var d=a("../enums.js");b.exports={prefer_hash_algorithm:d.hash.sha256,encryption_cipher:d.symmetric.aes256,compression:d.compression.zip,integrity_protect:!0,rsa_blinding:!0,useWebCrypto:!0,show_version:!0,show_comment:!0,versionstring:"OpenPGP.js v1.2.0",commentstring:"http://openpgpjs.org",keyserver:"keyserver.linux.it",node_store:"./openpgp.store",debug:!1}},{"../enums.js":43}],17:[function(a,b,c){b.exports=a("./config.js")},{"./config.js":16}],18:[function(a,b,c){"use strict";var d=a("../util.js"),e=a("./cipher");b.exports={encrypt:function(a,b,c,f,g){b=new e[b](f);var h=b.blockSize,i=new Uint8Array(h),j=new Uint8Array(h);a=a+a.charAt(h-2)+a.charAt(h-1);var k,l,m,n=new Uint8Array(c.length+2+2*h),o=g?0:2;for(k=0;h>k;k++)i[k]=0;for(j=b.encrypt(i),k=0;h>k;k++)n[k]=j[k]^a.charCodeAt(k);for(i.set(n.subarray(0,h)),j=b.encrypt(i),n[h]=j[0]^a.charCodeAt(h),n[h+1]=j[1]^a.charCodeAt(h+1),g?i.set(n.subarray(2,h+2)):i.set(n.subarray(0,h)),j=b.encrypt(i),k=0;h>k;k++)n[h+2+k]=j[k+o]^c.charCodeAt(k);for(l=h;l<c.length+o;l+=h)for(m=l+2-o,i.set(n.subarray(m,m+h)),j=b.encrypt(i),k=0;h>k;k++)n[h+m+k]=j[k]^c.charCodeAt(l+k-o);return n=n.subarray(0,c.length+2+h),d.Uint8Array2str(n)},mdc:function(a,b,c){a=new e[a](b);var f,g=a.blockSize,h=new Uint8Array(g),i=new Uint8Array(g);for(f=0;g>f;f++)h[f]=0;for(h=a.encrypt(h),f=0;g>f;f++)i[f]=c.charCodeAt(f),h[f]^=i[f];return i=a.encrypt(i),d.bin2str(h)+String.fromCharCode(i[0]^c.charCodeAt(g))+String.fromCharCode(i[1]^c.charCodeAt(g+1))},decrypt:function(a,b,c,d){a=new e[a](b);var f,g=a.blockSize,h=new Uint8Array(g),i=new Uint8Array(g),j="",k=[];for(f=0;g>f;f++)h[f]=0;for(h=a.encrypt(h),f=0;g>f;f++)i[f]=c.charCodeAt(f),h[f]^=i[f];if(i=a.encrypt(i),h[g-2]!=(i[0]^c.charCodeAt(g))||h[g-1]!=(i[1]^c.charCodeAt(g+1)))throw new Error("CFB decrypt: invalid key");if(d){for(f=0;g>f;f++)h[f]=c.charCodeAt(f+2);for(j=g+2;j<c.length;j+=g)for(i=a.encrypt(h),f=0;g>f&&f+j<c.length;f++)h[f]=c.charCodeAt(j+f),k.push(String.fromCharCode(i[f]^h[f]))}else{for(f=0;g>f;f++)h[f]=c.charCodeAt(f);for(j=g;j<c.length;j+=g)for(i=a.encrypt(h),f=0;g>f&&f+j<c.length;f++)h[f]=c.charCodeAt(j+f),k.push(String.fromCharCode(i[f]^h[f]))}return d||k.splice(0,2),k.splice(c.length-g-2),k},normalEncrypt:function(a,b,c,f){a=new e[a](b);var g=a.blockSize,h="",i="",j=0,k="",l="";for(i=f.substring(0,g);c.length>g*j;){var m=a.encrypt(d.str2bin(i));h=c.substring(j*g,j*g+g);for(var n=0;n<h.length;n++)l+=String.fromCharCode(h.charCodeAt(n)^m[n]);i=l,l="",k+=i,j++}return k},normalDecrypt:function(a,b,c,f){a=new e[a](b);var g,h=a.blockSize,i="",j=0,k="",l=0;if(null===f)for(g=0;h>g;g++)i+=String.fromCharCode(0);else i=f.substring(0,h);for(;c.length>h*j;){var m=a.encrypt(d.str2bin(i));for(i=c.substring(j*h+l,j*h+h+l),g=0;g<i.length;g++)k+=String.fromCharCode(i.charCodeAt(g)^m[g]);j++}return k}}},{"../util.js":74,"./cipher":23}],19:[function(a,b,c){"use strict";function d(a){return 255&a}function e(a){return a>>8&255}function f(a){return a>>16&255}function g(a){return a>>24&255}function h(a,b,c,d){return e(p[255&a])|e(p[b>>8&255])<<8|e(p[c>>16&255])<<16|e(p[d>>>24])<<24}function i(a){var b,c,d=a.length,e=new Array(d/4);if(a&&!(d%4)){for(b=0,c=0;d>c;c+=4)e[b++]=a[c]|a[c+1]<<8|a[c+2]<<16|a[c+3]<<24;return e}}function j(a){var b,c=0,h=a.length,i=new Array(4*h);for(b=0;h>b;b++)i[c++]=d(a[b]),i[c++]=e(a[b]),i[c++]=f(a[b]),i[c++]=g(a[b]);return i}function k(a){var b,c,h,i,j,k,l=new Array(u+1),m=a.length,p=new Array(t),q=new Array(t),r=0;if(16==m)k=10,b=4;else if(24==m)k=12,b=6;else{if(32!=m)throw new Error("Invalid key-length for AES key:"+m);k=14,b=8}for(c=0;u+1>c;c++)l[c]=new Uint32Array(4);for(c=0,h=0;m>h;h++,c+=4)p[h]=a.charCodeAt(c)|a.charCodeAt(c+1)<<8|a.charCodeAt(c+2)<<16|a.charCodeAt(c+3)<<24;for(h=b-1;h>=0;h--)q[h]=p[h];for(i=0,j=0,h=0;b>h&&k+1>i;){for(;b>h&&4>j;h++,j++)l[i][j]=q[h];4==j&&(i++,j=0)}for(;k+1>i;){var s=q[b-1];if(q[0]^=o[e(s)]|o[f(s)]<<8|o[g(s)]<<16|o[d(s)]<<24,q[0]^=n[r++],8!=b)for(h=1;b>h;h++)q[h]^=q[h-1];else{for(h=1;b/2>h;h++)q[h]^=q[h-1];for(s=q[b/2-1],q[b/2]^=o[d(s)]|o[e(s)]<<8|o[f(s)]<<16|o[g(s)]<<24,h=b/2+1;b>h;h++)q[h]^=q[h-1]}for(h=0;b>h&&k+1>i;){for(;b>h&&4>j;h++,j++)l[i][j]=q[h];4==j&&(i++,j=0)}}return{rounds:k,rk:l}}function l(a,b,c){var d,e,f;for(f=i(a),e=b.rounds,d=0;e-1>d;d++)c[0]=f[0]^b.rk[d][0],c[1]=f[1]^b.rk[d][1],c[2]=f[2]^b.rk[d][2],c[3]=f[3]^b.rk[d][3],f[0]=p[255&c[0]]^q[c[1]>>8&255]^r[c[2]>>16&255]^s[c[3]>>>24],f[1]=p[255&c[1]]^q[c[2]>>8&255]^r[c[3]>>16&255]^s[c[0]>>>24],f[2]=p[255&c[2]]^q[c[3]>>8&255]^r[c[0]>>16&255]^s[c[1]>>>24],f[3]=p[255&c[3]]^q[c[0]>>8&255]^r[c[1]>>16&255]^s[c[2]>>>24];return d=e-1,c[0]=f[0]^b.rk[d][0],c[1]=f[1]^b.rk[d][1],c[2]=f[2]^b.rk[d][2],c[3]=f[3]^b.rk[d][3],f[0]=h(c[0],c[1],c[2],c[3])^b.rk[e][0],f[1]=h(c[1],c[2],c[3],c[0])^b.rk[e][1],f[2]=h(c[2],c[3],c[0],c[1])^b.rk[e][2],f[3]=h(c[3],c[0],c[1],c[2])^b.rk[e][3],j(f)}function m(a){var b=function(a){this.key=k(a),this._temp=new Uint32Array(this.blockSize/4),this.encrypt=function(a){return l(a,this.key,this._temp)}};return b.blockSize=b.prototype.blockSize=16,b.keySize=b.prototype.keySize=a/8,b}var n=(a("../../util.js"),new Uint8Array([1,2,4,8,16,32,64,128,27,54,108,216,171,77,154,47,94,188,99,198,151,53,106,212,179,125,250,239,197,145])),o=new Uint8Array([99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22]),p=new Uint32Array([2774754246,2222750968,2574743534,2373680118,234025727,3177933782,2976870366,1422247313,1345335392,50397442,2842126286,2099981142,436141799,1658312629,3870010189,2591454956,1170918031,2642575903,1086966153,2273148410,368769775,3948501426,3376891790,200339707,3970805057,1742001331,4255294047,3937382213,3214711843,4154762323,2524082916,1539358875,3266819957,486407649,2928907069,1780885068,1513502316,1094664062,49805301,1338821763,1546925160,4104496465,887481809,150073849,2473685474,1943591083,1395732834,1058346282,201589768,1388824469,1696801606,1589887901,672667696,2711000631,251987210,3046808111,151455502,907153956,2608889883,1038279391,652995533,1764173646,3451040383,2675275242,453576978,2659418909,1949051992,773462580,756751158,2993581788,3998898868,4221608027,4132590244,1295727478,1641469623,3467883389,2066295122,1055122397,1898917726,2542044179,4115878822,1758581177,0,753790401,1612718144,536673507,3367088505,3982187446,3194645204,1187761037,3653156455,1262041458,3729410708,3561770136,3898103984,1255133061,1808847035,720367557,3853167183,385612781,3309519750,3612167578,1429418854,2491778321,3477423498,284817897,100794884,2172616702,4031795360,1144798328,3131023141,3819481163,4082192802,4272137053,3225436288,2324664069,2912064063,3164445985,1211644016,83228145,3753688163,3249976951,1977277103,1663115586,806359072,452984805,250868733,1842533055,1288555905,336333848,890442534,804056259,3781124030,2727843637,3427026056,957814574,1472513171,4071073621,2189328124,1195195770,2892260552,3881655738,723065138,2507371494,2690670784,2558624025,3511635870,2145180835,1713513028,2116692564,2878378043,2206763019,3393603212,703524551,3552098411,1007948840,2044649127,3797835452,487262998,1994120109,1004593371,1446130276,1312438900,503974420,3679013266,168166924,1814307912,3831258296,1573044895,1859376061,4021070915,2791465668,2828112185,2761266481,937747667,2339994098,854058965,1137232011,1496790894,3077402074,2358086913,1691735473,3528347292,3769215305,3027004632,4199962284,133494003,636152527,2942657994,2390391540,3920539207,403179536,3585784431,2289596656,1864705354,1915629148,605822008,4054230615,3350508659,1371981463,602466507,2094914977,2624877800,555687742,3712699286,3703422305,2257292045,2240449039,2423288032,1111375484,3300242801,2858837708,3628615824,84083462,32962295,302911004,2741068226,1597322602,4183250862,3501832553,2441512471,1489093017,656219450,3114180135,954327513,335083755,3013122091,856756514,3144247762,1893325225,2307821063,2811532339,3063651117,572399164,2458355477,552200649,1238290055,4283782570,2015897680,2061492133,2408352771,4171342169,2156497161,386731290,3669999461,837215959,3326231172,3093850320,3275833730,2962856233,1999449434,286199582,3417354363,4233385128,3602627437,974525996]),q=new Uint32Array([1667483301,2088564868,2004348569,2071721613,4076011277,1802229437,1869602481,3318059348,808476752,16843267,1734856361,724260477,4278118169,3621238114,2880130534,1987505306,3402272581,2189565853,3385428288,2105408135,4210749205,1499050731,1195871945,4042324747,2913812972,3570709351,2728550397,2947499498,2627478463,2762232823,1920132246,3233848155,3082253762,4261273884,2475900334,640044138,909536346,1061125697,4160222466,3435955023,875849820,2779075060,3857043764,4059166984,1903288979,3638078323,825320019,353708607,67373068,3351745874,589514341,3284376926,404238376,2526427041,84216335,2593796021,117902857,303178806,2155879323,3806519101,3958099238,656887401,2998042573,1970662047,151589403,2206408094,741103732,437924910,454768173,1852759218,1515893998,2694863867,1381147894,993752653,3604395873,3014884814,690573947,3823361342,791633521,2223248279,1397991157,3520182632,0,3991781676,538984544,4244431647,2981198280,1532737261,1785386174,3419114822,3200149465,960066123,1246401758,1280088276,1482207464,3486483786,3503340395,4025468202,2863288293,4227591446,1128498885,1296931543,859006549,2240090516,1162185423,4193904912,33686534,2139094657,1347461360,1010595908,2678007226,2829601763,1364304627,2745392638,1077969088,2408514954,2459058093,2644320700,943222856,4126535940,3166462943,3065411521,3671764853,555827811,269492272,4294960410,4092853518,3537026925,3452797260,202119188,320022069,3974939439,1600110305,2543269282,1145342156,387395129,3301217111,2812761586,2122251394,1027439175,1684326572,1566423783,421081643,1936975509,1616953504,2172721560,1330618065,3705447295,572671078,707417214,2425371563,2290617219,1179028682,4008625961,3099093971,336865340,3739133817,1583267042,185275933,3688607094,3772832571,842163286,976909390,168432670,1229558491,101059594,606357612,1549580516,3267534685,3553869166,2896970735,1650640038,2442213800,2509582756,3840201527,2038035083,3890730290,3368586051,926379609,1835915959,2374828428,3587551588,1313774802,2846444e3,1819072692,1448520954,4109693703,3941256997,1701169839,2054878350,2930657257,134746136,3132780501,2021191816,623200879,774790258,471611428,2795919345,3031724999,3334903633,3907570467,3722289532,1953818780,522141217,1263245021,3183305180,2341145990,2324303749,1886445712,1044282434,3048567236,1718013098,1212715224,50529797,4143380225,235805714,1633796771,892693087,1465364217,3115936208,2256934801,3250690392,488454695,2661164985,3789674808,4177062675,2560109491,286335539,1768542907,3654920560,2391672713,2492740519,2610638262,505297954,2273777042,3924412704,3469641545,1431677695,673730680,3755976058,2357986191,2711706104,2307459456,218962455,3216991706,3873888049,1111655622,1751699640,1094812355,2576951728,757946999,252648977,2964356043,1414834428,3149622742,370551866]),r=new Uint32Array([1673962851,2096661628,2012125559,2079755643,4076801522,1809235307,1876865391,3314635973,811618352,16909057,1741597031,727088427,4276558334,3618988759,2874009259,1995217526,3398387146,2183110018,3381215433,2113570685,4209972730,1504897881,1200539975,4042984432,2906778797,3568527316,2724199842,2940594863,2619588508,2756966308,1927583346,3231407040,3077948087,4259388669,2470293139,642542118,913070646,1065238847,4160029431,3431157708,879254580,2773611685,3855693029,4059629809,1910674289,3635114968,828527409,355090197,67636228,3348452039,591815971,3281870531,405809176,2520228246,84545285,2586817946,118360327,304363026,2149292928,3806281186,3956090603,659450151,2994720178,1978310517,152181513,2199756419,743994412,439627290,456535323,1859957358,1521806938,2690382752,1386542674,997608763,3602342358,3011366579,693271337,3822927587,794718511,2215876484,1403450707,3518589137,0,3988860141,541089824,4242743292,2977548465,1538714971,1792327274,3415033547,3194476990,963791673,1251270218,1285084236,1487988824,3481619151,3501943760,4022676207,2857362858,4226619131,1132905795,1301993293,862344499,2232521861,1166724933,4192801017,33818114,2147385727,1352724560,1014514748,2670049951,2823545768,1369633617,2740846243,1082179648,2399505039,2453646738,2636233885,946882616,4126213365,3160661948,3061301686,3668932058,557998881,270544912,4293204735,4093447923,3535760850,3447803085,202904588,321271059,3972214764,1606345055,2536874647,1149815876,388905239,3297990596,2807427751,2130477694,1031423805,1690872932,1572530013,422718233,1944491379,1623236704,2165938305,1335808335,3701702620,574907938,710180394,2419829648,2282455944,1183631942,4006029806,3094074296,338181140,3735517662,1589437022,185998603,3685578459,3772464096,845436466,980700730,169090570,1234361161,101452294,608726052,1555620956,3265224130,3552407251,2890133420,1657054818,2436475025,2503058581,3839047652,2045938553,3889509095,3364570056,929978679,1843050349,2365688973,3585172693,1318900302,2840191145,1826141292,1454176854,4109567988,3939444202,1707781989,2062847610,2923948462,135272456,3127891386,2029029496,625635109,777810478,473441308,2790781350,3027486644,3331805638,3905627112,3718347997,1961401460,524165407,1268178251,3177307325,2332919435,2316273034,1893765232,1048330814,3044132021,1724688998,1217452104,50726147,4143383030,236720654,1640145761,896163637,1471084887,3110719673,2249691526,3248052417,490350365,2653403550,3789109473,4176155640,2553000856,287453969,1775418217,3651760345,2382858638,2486413204,2603464347,507257374,2266337927,3922272489,3464972750,1437269845,676362280,3752164063,2349043596,2707028129,2299101321,219813645,3211123391,3872862694,1115997762,1758509160,1099088705,2569646233,760903469,253628687,2960903088,1420360788,3144537787,371997206]),s=new Uint32Array([3332727651,4169432188,4003034999,4136467323,4279104242,3602738027,3736170351,2438251973,1615867952,33751297,3467208551,1451043627,3877240574,3043153879,1306962859,3969545846,2403715786,530416258,2302724553,4203183485,4011195130,3001768281,2395555655,4211863792,1106029997,3009926356,1610457762,1173008303,599760028,1408738468,3835064946,2606481600,1975695287,3776773629,1034851219,1282024998,1817851446,2118205247,4110612471,2203045068,1750873140,1374987685,3509904869,4178113009,3801313649,2876496088,1649619249,708777237,135005188,2505230279,1181033251,2640233411,807933976,933336726,168756485,800430746,235472647,607523346,463175808,3745374946,3441880043,1315514151,2144187058,3936318837,303761673,496927619,1484008492,875436570,908925723,3702681198,3035519578,1543217312,2767606354,1984772923,3076642518,2110698419,1383803177,3711886307,1584475951,328696964,2801095507,3110654417,0,3240947181,1080041504,3810524412,2043195825,3069008731,3569248874,2370227147,1742323390,1917532473,2497595978,2564049996,2968016984,2236272591,3144405200,3307925487,1340451498,3977706491,2261074755,2597801293,1716859699,294946181,2328839493,3910203897,67502594,4269899647,2700103760,2017737788,632987551,1273211048,2733855057,1576969123,2160083008,92966799,1068339858,566009245,1883781176,4043634165,1675607228,2009183926,2943736538,1113792801,540020752,3843751935,4245615603,3211645650,2169294285,403966988,641012499,3274697964,3202441055,899848087,2295088196,775493399,2472002756,1441965991,4236410494,2051489085,3366741092,3135724893,841685273,3868554099,3231735904,429425025,2664517455,2743065820,1147544098,1417554474,1001099408,193169544,2362066502,3341414126,1809037496,675025940,2809781982,3168951902,371002123,2910247899,3678134496,1683370546,1951283770,337512970,2463844681,201983494,1215046692,3101973596,2673722050,3178157011,1139780780,3299238498,967348625,832869781,3543655652,4069226873,3576883175,2336475336,1851340599,3669454189,25988493,2976175573,2631028302,1239460265,3635702892,2902087254,4077384948,3475368682,3400492389,4102978170,1206496942,270010376,1876277946,4035475576,1248797989,1550986798,941890588,1475454630,1942467764,2538718918,3408128232,2709315037,3902567540,1042358047,2531085131,1641856445,226921355,260409994,3767562352,2084716094,1908716981,3433719398,2430093384,100991747,4144101110,470945294,3265487201,1784624437,2935576407,1775286713,395413126,2572730817,975641885,666476190,3644383713,3943954680,733190296,573772049,3535497577,2842745305,126455438,866620564,766942107,1008868894,361924487,3374377449,2269761230,2868860245,1350051880,2776293343,59739276,1509466529,159418761,437718285,1708834751,3610371814,2227585602,3501746280,2193834305,699439513,1517759789,504434447,2076946608,2835108948,1842789307,742004246]),t=8,u=14;b.exports={};var v=[128,192,256];for(var w in v)b.exports[v[w]]=m(v[w])},{"../../util.js":74}],20:[function(a,b,c){function d(){}function e(a){this.bf=new d,this.bf.init(f.str2bin(a)),this.encrypt=function(a){return this.bf.encrypt_block(a)}}d.prototype.BLOCKSIZE=8,d.prototype.SBOXES=[[3509652390,2564797868,805139163,3491422135,3101798381,1780907670,3128725573,4046225305,614570311,3012652279,134345442,2240740374,1667834072,1901547113,2757295779,4103290238,227898511,1921955416,1904987480,2182433518,2069144605,3260701109,2620446009,720527379,3318853667,677414384,3393288472,3101374703,2390351024,1614419982,1822297739,2954791486,3608508353,3174124327,2024746970,1432378464,3864339955,2857741204,1464375394,1676153920,1439316330,715854006,3033291828,289532110,2706671279,2087905683,3018724369,1668267050,732546397,1947742710,3462151702,2609353502,2950085171,1814351708,2050118529,680887927,999245976,1800124847,3300911131,1713906067,1641548236,4213287313,1216130144,1575780402,4018429277,3917837745,3693486850,3949271944,596196993,3549867205,258830323,2213823033,772490370,2760122372,1774776394,2652871518,566650946,4142492826,1728879713,2882767088,1783734482,3629395816,2517608232,2874225571,1861159788,326777828,3124490320,2130389656,2716951837,967770486,1724537150,2185432712,2364442137,1164943284,2105845187,998989502,3765401048,2244026483,1075463327,1455516326,1322494562,910128902,469688178,1117454909,936433444,3490320968,3675253459,1240580251,122909385,2157517691,634681816,4142456567,3825094682,3061402683,2540495037,79693498,3249098678,1084186820,1583128258,426386531,1761308591,1047286709,322548459,995290223,1845252383,2603652396,3431023940,2942221577,3202600964,3727903485,1712269319,422464435,3234572375,1170764815,3523960633,3117677531,1434042557,442511882,3600875718,1076654713,1738483198,4213154764,2393238008,3677496056,1014306527,4251020053,793779912,2902807211,842905082,4246964064,1395751752,1040244610,2656851899,3396308128,445077038,3742853595,3577915638,679411651,2892444358,2354009459,1767581616,3150600392,3791627101,3102740896,284835224,4246832056,1258075500,768725851,2589189241,3069724005,3532540348,1274779536,3789419226,2764799539,1660621633,3471099624,4011903706,913787905,3497959166,737222580,2514213453,2928710040,3937242737,1804850592,3499020752,2949064160,2386320175,2390070455,2415321851,4061277028,2290661394,2416832540,1336762016,1754252060,3520065937,3014181293,791618072,3188594551,3933548030,2332172193,3852520463,3043980520,413987798,3465142937,3030929376,4245938359,2093235073,3534596313,375366246,2157278981,2479649556,555357303,3870105701,2008414854,3344188149,4221384143,3956125452,2067696032,3594591187,2921233993,2428461,544322398,577241275,1471733935,610547355,4027169054,1432588573,1507829418,2025931657,3646575487,545086370,48609733,2200306550,1653985193,298326376,1316178497,3007786442,2064951626,458293330,2589141269,3591329599,3164325604,727753846,2179363840,146436021,1461446943,4069977195,705550613,3059967265,3887724982,4281599278,3313849956,1404054877,2845806497,146425753,1854211946],[1266315497,3048417604,3681880366,3289982499,290971e4,1235738493,2632868024,2414719590,3970600049,1771706367,1449415276,3266420449,422970021,1963543593,2690192192,3826793022,1062508698,1531092325,1804592342,2583117782,2714934279,4024971509,1294809318,4028980673,1289560198,2221992742,1669523910,35572830,157838143,1052438473,1016535060,1802137761,1753167236,1386275462,3080475397,2857371447,1040679964,2145300060,2390574316,1461121720,2956646967,4031777805,4028374788,33600511,2920084762,1018524850,629373528,3691585981,3515945977,2091462646,2486323059,586499841,988145025,935516892,3367335476,2599673255,2839830854,265290510,3972581182,2759138881,3795373465,1005194799,847297441,406762289,1314163512,1332590856,1866599683,4127851711,750260880,613907577,1450815602,3165620655,3734664991,3650291728,3012275730,3704569646,1427272223,778793252,1343938022,2676280711,2052605720,1946737175,3164576444,3914038668,3967478842,3682934266,1661551462,3294938066,4011595847,840292616,3712170807,616741398,312560963,711312465,1351876610,322626781,1910503582,271666773,2175563734,1594956187,70604529,3617834859,1007753275,1495573769,4069517037,2549218298,2663038764,504708206,2263041392,3941167025,2249088522,1514023603,1998579484,1312622330,694541497,2582060303,2151582166,1382467621,776784248,2618340202,3323268794,2497899128,2784771155,503983604,4076293799,907881277,423175695,432175456,1378068232,4145222326,3954048622,3938656102,3820766613,2793130115,2977904593,26017576,3274890735,3194772133,1700274565,1756076034,4006520079,3677328699,720338349,1533947780,354530856,688349552,3973924725,1637815568,332179504,3949051286,53804574,2852348879,3044236432,1282449977,3583942155,3416972820,4006381244,1617046695,2628476075,3002303598,1686838959,431878346,2686675385,1700445008,1080580658,1009431731,832498133,3223435511,2605976345,2271191193,2516031870,1648197032,4164389018,2548247927,300782431,375919233,238389289,3353747414,2531188641,2019080857,1475708069,455242339,2609103871,448939670,3451063019,1395535956,2413381860,1841049896,1491858159,885456874,4264095073,4001119347,1565136089,3898914787,1108368660,540939232,1173283510,2745871338,3681308437,4207628240,3343053890,4016749493,1699691293,1103962373,3625875870,2256883143,3830138730,1031889488,3479347698,1535977030,4236805024,3251091107,2132092099,1774941330,1199868427,1452454533,157007616,2904115357,342012276,595725824,1480756522,206960106,497939518,591360097,863170706,2375253569,3596610801,1814182875,2094937945,3421402208,1082520231,3463918190,2785509508,435703966,3908032597,1641649973,2842273706,3305899714,1510255612,2148256476,2655287854,3276092548,4258621189,236887753,3681803219,274041037,1734335097,3815195456,3317970021,1899903192,1026095262,4050517792,356393447,2410691914,3873677099,3682840055],[3913112168,2491498743,4132185628,2489919796,1091903735,1979897079,3170134830,3567386728,3557303409,857797738,1136121015,1342202287,507115054,2535736646,337727348,3213592640,1301675037,2528481711,1895095763,1721773893,3216771564,62756741,2142006736,835421444,2531993523,1442658625,3659876326,2882144922,676362277,1392781812,170690266,3921047035,1759253602,3611846912,1745797284,664899054,1329594018,3901205900,3045908486,2062866102,2865634940,3543621612,3464012697,1080764994,553557557,3656615353,3996768171,991055499,499776247,1265440854,648242737,3940784050,980351604,3713745714,1749149687,3396870395,4211799374,3640570775,1161844396,3125318951,1431517754,545492359,4268468663,3499529547,1437099964,2702547544,3433638243,2581715763,2787789398,1060185593,1593081372,2418618748,4260947970,69676912,2159744348,86519011,2512459080,3838209314,1220612927,3339683548,133810670,1090789135,1078426020,1569222167,845107691,3583754449,4072456591,1091646820,628848692,1613405280,3757631651,526609435,236106946,48312990,2942717905,3402727701,1797494240,859738849,992217954,4005476642,2243076622,3870952857,3732016268,765654824,3490871365,2511836413,1685915746,3888969200,1414112111,2273134842,3281911079,4080962846,172450625,2569994100,980381355,4109958455,2819808352,2716589560,2568741196,3681446669,3329971472,1835478071,660984891,3704678404,4045999559,3422617507,3040415634,1762651403,1719377915,3470491036,2693910283,3642056355,3138596744,1364962596,2073328063,1983633131,926494387,3423689081,2150032023,4096667949,1749200295,3328846651,309677260,2016342300,1779581495,3079819751,111262694,1274766160,443224088,298511866,1025883608,3806446537,1145181785,168956806,3641502830,3584813610,1689216846,3666258015,3200248200,1692713982,2646376535,4042768518,1618508792,1610833997,3523052358,4130873264,2001055236,3610705100,2202168115,4028541809,2961195399,1006657119,2006996926,3186142756,1430667929,3210227297,1314452623,4074634658,4101304120,2273951170,1399257539,3367210612,3027628629,1190975929,2062231137,2333990788,2221543033,2438960610,1181637006,548689776,2362791313,3372408396,3104550113,3145860560,296247880,1970579870,3078560182,3769228297,1714227617,3291629107,3898220290,166772364,1251581989,493813264,448347421,195405023,2709975567,677966185,3703036547,1463355134,2715995803,1338867538,1343315457,2802222074,2684532164,233230375,2599980071,2000651841,3277868038,1638401717,4028070440,3237316320,6314154,819756386,300326615,590932579,1405279636,3267499572,3150704214,2428286686,3959192993,3461946742,1862657033,1266418056,963775037,2089974820,2263052895,1917689273,448879540,3550394620,3981727096,150775221,3627908307,1303187396,508620638,2975983352,2726630617,1817252668,1876281319,1457606340,908771278,3720792119,3617206836,2455994898,1729034894,1080033504],[976866871,3556439503,2881648439,1522871579,1555064734,1336096578,3548522304,2579274686,3574697629,3205460757,3593280638,3338716283,3079412587,564236357,2993598910,1781952180,1464380207,3163844217,3332601554,1699332808,1393555694,1183702653,3581086237,1288719814,691649499,2847557200,2895455976,3193889540,2717570544,1781354906,1676643554,2592534050,3230253752,1126444790,2770207658,2633158820,2210423226,2615765581,2414155088,3127139286,673620729,2805611233,1269405062,4015350505,3341807571,4149409754,1057255273,2012875353,2162469141,2276492801,2601117357,993977747,3918593370,2654263191,753973209,36408145,2530585658,25011837,3520020182,2088578344,530523599,2918365339,1524020338,1518925132,3760827505,3759777254,1202760957,3985898139,3906192525,674977740,4174734889,2031300136,2019492241,3983892565,4153806404,3822280332,352677332,2297720250,60907813,90501309,3286998549,1016092578,2535922412,2839152426,457141659,509813237,4120667899,652014361,1966332200,2975202805,55981186,2327461051,676427537,3255491064,2882294119,3433927263,1307055953,942726286,933058658,2468411793,3933900994,4215176142,1361170020,2001714738,2830558078,3274259782,1222529897,1679025792,2729314320,3714953764,1770335741,151462246,3013232138,1682292957,1483529935,471910574,1539241949,458788160,3436315007,1807016891,3718408830,978976581,1043663428,3165965781,1927990952,4200891579,2372276910,3208408903,3533431907,1412390302,2931980059,4132332400,1947078029,3881505623,4168226417,2941484381,1077988104,1320477388,886195818,18198404,3786409e3,2509781533,112762804,3463356488,1866414978,891333506,18488651,661792760,1628790961,3885187036,3141171499,876946877,2693282273,1372485963,791857591,2686433993,3759982718,3167212022,3472953795,2716379847,445679433,3561995674,3504004811,3574258232,54117162,3331405415,2381918588,3769707343,4154350007,1140177722,4074052095,668550556,3214352940,367459370,261225585,2610173221,4209349473,3468074219,3265815641,314222801,3066103646,3808782860,282218597,3406013506,3773591054,379116347,1285071038,846784868,2669647154,3771962079,3550491691,2305946142,453669953,1268987020,3317592352,3279303384,3744833421,2610507566,3859509063,266596637,3847019092,517658769,3462560207,3443424879,370717030,4247526661,2224018117,4143653529,4112773975,2788324899,2477274417,1456262402,2901442914,1517677493,1846949527,2295493580,3734397586,2176403920,1280348187,1908823572,3871786941,846861322,1172426758,3287448474,3383383037,1655181056,3139813346,901632758,1897031941,2986607138,3066810236,3447102507,1393639104,373351379,950779232,625454576,3124240540,4148612726,2007998917,544563296,2244738638,2330496472,2058025392,1291430526,424198748,50039436,29584100,3605783033,2429876329,2791104160,1057563949,3255363231,3075367218,3463963227,1469046755,985887462]],
d.prototype.PARRAY=[608135816,2242054355,320440878,57701188,2752067618,698298832,137296536,3964562569,1160258022,953160567,3193202383,887688300,3232508343,3380367581,1065670069,3041331479,2450970073,2306472731],d.prototype.NN=16,d.prototype._clean=function(a){if(0>a){var b=2147483647&a;a=b+2147483648}return a},d.prototype._F=function(a){var b,c,d,e,f;return e=255&a,a>>>=8,d=255&a,a>>>=8,c=255&a,a>>>=8,b=255&a,f=this.sboxes[0][b]+this.sboxes[1][c],f^=this.sboxes[2][d],f+=this.sboxes[3][e]},d.prototype._encrypt_block=function(a){var b,c=a[0],d=a[1];for(b=0;b<this.NN;++b){c^=this.parray[b],d=this._F(c)^d;var e=c;c=d,d=e}c^=this.parray[this.NN+0],d^=this.parray[this.NN+1],a[0]=this._clean(d),a[1]=this._clean(c)},d.prototype.encrypt_block=function(a){var b,c=[0,0],d=this.BLOCKSIZE/2;for(b=0;b<this.BLOCKSIZE/2;++b)c[0]=c[0]<<8|255&a[b+0],c[1]=c[1]<<8|255&a[b+d];this._encrypt_block(c);var e=[];for(b=0;b<this.BLOCKSIZE/2;++b)e[b+0]=c[0]>>>24-8*b&255,e[b+d]=c[1]>>>24-8*b&255;return e},d.prototype._decrypt_block=function(a){var b,c=a[0],d=a[1];for(b=this.NN+1;b>1;--b){c^=this.parray[b],d=this._F(c)^d;var e=c;c=d,d=e}c^=this.parray[1],d^=this.parray[0],a[0]=this._clean(d),a[1]=this._clean(c)},d.prototype.init=function(a){var b,c=0;for(this.parray=[],b=0;b<this.NN+2;++b){var d,e=0;for(d=0;4>d;++d)e=e<<8|255&a[c],++c>=a.length&&(c=0);this.parray[b]=this.PARRAY[b]^e}for(this.sboxes=[],b=0;4>b;++b)for(this.sboxes[b]=[],c=0;256>c;++c)this.sboxes[b][c]=this.SBOXES[b][c];var f=[0,0];for(b=0;b<this.NN+2;b+=2)this._encrypt_block(f),this.parray[b+0]=f[0],this.parray[b+1]=f[1];for(b=0;4>b;++b)for(c=0;256>c;c+=2)this._encrypt_block(f),this.sboxes[b][c+0]=f[0],this.sboxes[b][c+1]=f[1]};var f=a("../../util.js");b.exports=e,b.exports.keySize=e.prototype.keySize=16,b.exports.blockSize=e.prototype.blockSize=16},{"../../util.js":74}],21:[function(a,b,c){function d(){function a(a,b,c){var d=b+a,e=d<<c|d>>>32-c;return(f[0][e>>>24]^f[1][e>>>16&255])-f[2][e>>>8&255]+f[3][255&e]}function b(a,b,c){var d=b^a,e=d<<c|d>>>32-c;return f[0][e>>>24]-f[1][e>>>16&255]+f[2][e>>>8&255]^f[3][255&e]}function c(a,b,c){var d=b-a,e=d<<c|d>>>32-c;return(f[0][e>>>24]+f[1][e>>>16&255]^f[2][e>>>8&255])-f[3][255&e]}this.BlockSize=8,this.KeySize=16,this.setKey=function(a){if(this.masking=new Array(16),this.rotate=new Array(16),this.reset(),a.length!=this.KeySize)throw new Error("CAST-128: keys must be 16 bytes");return this.keySchedule(a),!0},this.reset=function(){for(var a=0;16>a;a++)this.masking[a]=0,this.rotate[a]=0},this.getBlockSize=function(){return BlockSize},this.encrypt=function(d){for(var e=new Array(d.length),f=0;f<d.length;f+=8){var g,h=d[f]<<24|d[f+1]<<16|d[f+2]<<8|d[f+3],i=d[f+4]<<24|d[f+5]<<16|d[f+6]<<8|d[f+7];g=i,i=h^a(i,this.masking[0],this.rotate[0]),h=g,g=i,i=h^b(i,this.masking[1],this.rotate[1]),h=g,g=i,i=h^c(i,this.masking[2],this.rotate[2]),h=g,g=i,i=h^a(i,this.masking[3],this.rotate[3]),h=g,g=i,i=h^b(i,this.masking[4],this.rotate[4]),h=g,g=i,i=h^c(i,this.masking[5],this.rotate[5]),h=g,g=i,i=h^a(i,this.masking[6],this.rotate[6]),h=g,g=i,i=h^b(i,this.masking[7],this.rotate[7]),h=g,g=i,i=h^c(i,this.masking[8],this.rotate[8]),h=g,g=i,i=h^a(i,this.masking[9],this.rotate[9]),h=g,g=i,i=h^b(i,this.masking[10],this.rotate[10]),h=g,g=i,i=h^c(i,this.masking[11],this.rotate[11]),h=g,g=i,i=h^a(i,this.masking[12],this.rotate[12]),h=g,g=i,i=h^b(i,this.masking[13],this.rotate[13]),h=g,g=i,i=h^c(i,this.masking[14],this.rotate[14]),h=g,g=i,i=h^a(i,this.masking[15],this.rotate[15]),h=g,e[f]=i>>>24&255,e[f+1]=i>>>16&255,e[f+2]=i>>>8&255,e[f+3]=255&i,e[f+4]=h>>>24&255,e[f+5]=h>>>16&255,e[f+6]=h>>>8&255,e[f+7]=255&h}return e},this.decrypt=function(d){for(var e=new Array(d.length),f=0;f<d.length;f+=8){var g,h=d[f]<<24|d[f+1]<<16|d[f+2]<<8|d[f+3],i=d[f+4]<<24|d[f+5]<<16|d[f+6]<<8|d[f+7];g=i,i=h^a(i,this.masking[15],this.rotate[15]),h=g,g=i,i=h^c(i,this.masking[14],this.rotate[14]),h=g,g=i,i=h^b(i,this.masking[13],this.rotate[13]),h=g,g=i,i=h^a(i,this.masking[12],this.rotate[12]),h=g,g=i,i=h^c(i,this.masking[11],this.rotate[11]),h=g,g=i,i=h^b(i,this.masking[10],this.rotate[10]),h=g,g=i,i=h^a(i,this.masking[9],this.rotate[9]),h=g,g=i,i=h^c(i,this.masking[8],this.rotate[8]),h=g,g=i,i=h^b(i,this.masking[7],this.rotate[7]),h=g,g=i,i=h^a(i,this.masking[6],this.rotate[6]),h=g,g=i,i=h^c(i,this.masking[5],this.rotate[5]),h=g,g=i,i=h^b(i,this.masking[4],this.rotate[4]),h=g,g=i,i=h^a(i,this.masking[3],this.rotate[3]),h=g,g=i,i=h^c(i,this.masking[2],this.rotate[2]),h=g,g=i,i=h^b(i,this.masking[1],this.rotate[1]),h=g,g=i,i=h^a(i,this.masking[0],this.rotate[0]),h=g,e[f]=i>>>24&255,e[f+1]=i>>>16&255,e[f+2]=i>>>8&255,e[f+3]=255&i,e[f+4]=h>>>24&255,e[f+5]=h>>16&255,e[f+6]=h>>8&255,e[f+7]=255&h}return e};var d=new Array(4);d[0]=new Array(4),d[0][0]=new Array(4,0,13,15,12,14,8),d[0][1]=new Array(5,2,16,18,17,19,10),d[0][2]=new Array(6,3,23,22,21,20,9),d[0][3]=new Array(7,1,26,25,27,24,11),d[1]=new Array(4),d[1][0]=new Array(0,6,21,23,20,22,16),d[1][1]=new Array(1,4,0,2,1,3,18),d[1][2]=new Array(2,5,7,6,5,4,17),d[1][3]=new Array(3,7,10,9,11,8,19),d[2]=new Array(4),d[2][0]=new Array(4,0,13,15,12,14,8),d[2][1]=new Array(5,2,16,18,17,19,10),d[2][2]=new Array(6,3,23,22,21,20,9),d[2][3]=new Array(7,1,26,25,27,24,11),d[3]=new Array(4),d[3][0]=new Array(0,6,21,23,20,22,16),d[3][1]=new Array(1,4,0,2,1,3,18),d[3][2]=new Array(2,5,7,6,5,4,17),d[3][3]=new Array(3,7,10,9,11,8,19);var e=new Array(4);e[0]=new Array(4),e[0][0]=new Array(24,25,23,22,18),e[0][1]=new Array(26,27,21,20,22),e[0][2]=new Array(28,29,19,18,25),e[0][3]=new Array(30,31,17,16,28),e[1]=new Array(4),e[1][0]=new Array(3,2,12,13,8),e[1][1]=new Array(1,0,14,15,13),e[1][2]=new Array(7,6,8,9,3),e[1][3]=new Array(5,4,10,11,7),e[2]=new Array(4),e[2][0]=new Array(19,18,28,29,25),e[2][1]=new Array(17,16,30,31,28),e[2][2]=new Array(23,22,24,25,18),e[2][3]=new Array(21,20,26,27,22),e[3]=new Array(4),e[3][0]=new Array(8,9,7,6,3),e[3][1]=new Array(10,11,5,4,7),e[3][2]=new Array(12,13,3,2,8),e[3][3]=new Array(14,15,1,0,13),this.keySchedule=function(a){var b,c,g=new Array(8),h=new Array(32);for(b=0;4>b;b++)c=4*b,g[b]=a[c]<<24|a[c+1]<<16|a[c+2]<<8|a[c+3];for(var i,j=[6,7,4,5],k=0,l=0;2>l;l++)for(var m=0;4>m;m++){for(c=0;4>c;c++){var n=d[m][c];i=g[n[1]],i^=f[4][g[n[2]>>>2]>>>24-8*(3&n[2])&255],i^=f[5][g[n[3]>>>2]>>>24-8*(3&n[3])&255],i^=f[6][g[n[4]>>>2]>>>24-8*(3&n[4])&255],i^=f[7][g[n[5]>>>2]>>>24-8*(3&n[5])&255],i^=f[j[c]][g[n[6]>>>2]>>>24-8*(3&n[6])&255],g[n[0]]=i}for(c=0;4>c;c++){var o=e[m][c];i=f[4][g[o[0]>>>2]>>>24-8*(3&o[0])&255],i^=f[5][g[o[1]>>>2]>>>24-8*(3&o[1])&255],i^=f[6][g[o[2]>>>2]>>>24-8*(3&o[2])&255],i^=f[7][g[o[3]>>>2]>>>24-8*(3&o[3])&255],i^=f[4+c][g[o[4]>>>2]>>>24-8*(3&o[4])&255],h[k]=i,k++}}for(b=0;16>b;b++)this.masking[b]=h[b],this.rotate[b]=31&h[16+b]};var f=new Array(8);f[0]=new Array(821772500,2678128395,1810681135,1059425402,505495343,2617265619,1610868032,3483355465,3218386727,2294005173,3791863952,2563806837,1852023008,365126098,3269944861,584384398,677919599,3229601881,4280515016,2002735330,1136869587,3744433750,2289869850,2731719981,2714362070,879511577,1639411079,575934255,717107937,2857637483,576097850,2731753936,1725645e3,2810460463,5111599,767152862,2543075244,1251459544,1383482551,3052681127,3089939183,3612463449,1878520045,1510570527,2189125840,2431448366,582008916,3163445557,1265446783,1354458274,3529918736,3202711853,3073581712,3912963487,3029263377,1275016285,4249207360,2905708351,3304509486,1442611557,3585198765,2712415662,2731849581,3248163920,2283946226,208555832,2766454743,1331405426,1447828783,3315356441,3108627284,2957404670,2981538698,3339933917,1669711173,286233437,1465092821,1782121619,3862771680,710211251,980974943,1651941557,430374111,2051154026,704238805,4128970897,3144820574,2857402727,948965521,3333752299,2227686284,718756367,2269778983,2731643755,718440111,2857816721,3616097120,1113355533,2478022182,410092745,1811985197,1944238868,2696854588,1415722873,1682284203,1060277122,1998114690,1503841958,82706478,2315155686,1068173648,845149890,2167947013,1768146376,1993038550,3566826697,3390574031,940016341,3355073782,2328040721,904371731,1205506512,4094660742,2816623006,825647681,85914773,2857843460,1249926541,1417871568,3287612,3211054559,3126306446,1975924523,1353700161,2814456437,2438597621,1800716203,722146342,2873936343,1151126914,4160483941,2877670899,458611604,2866078500,3483680063,770352098,2652916994,3367839148,3940505011,3585973912,3809620402,718646636,2504206814,2914927912,3631288169,2857486607,2860018678,575749918,2857478043,718488780,2069512688,3548183469,453416197,1106044049,3032691430,52586708,3378514636,3459808877,3211506028,1785789304,218356169,3571399134,3759170522,1194783844,1523787992,3007827094,1975193539,2555452411,1341901877,3045838698,3776907964,3217423946,2802510864,2889438986,1057244207,1636348243,3761863214,1462225785,2632663439,481089165,718503062,24497053,3332243209,3344655856,3655024856,3960371065,1195698900,2971415156,3710176158,2115785917,4027663609,3525578417,2524296189,2745972565,3564906415,1372086093,1452307862,2780501478,1476592880,3389271281,18495466,2378148571,901398090,891748256,3279637769,3157290713,2560960102,1447622437,4284372637,216884176,2086908623,1879786977,3588903153,2242455666,2938092967,3559082096,2810645491,758861177,1121993112,215018983,642190776,4169236812,1196255959,2081185372,3508738393,941322904,4124243163,2877523539,1848581667,2205260958,3180453958,2589345134,3694731276,550028657,2519456284,3789985535,2973870856,2093648313,443148163,46942275,2734146937,1117713533,1115362972,1523183689,3717140224,1551984063),f[1]=new Array(522195092,4010518363,1776537470,960447360,4267822970,4005896314,1435016340,1929119313,2913464185,1310552629,3579470798,3724818106,2579771631,1594623892,417127293,2715217907,2696228731,1508390405,3994398868,3925858569,3695444102,4019471449,3129199795,3770928635,3520741761,990456497,4187484609,2783367035,21106139,3840405339,631373633,3783325702,532942976,396095098,3548038825,4267192484,2564721535,2011709262,2039648873,620404603,3776170075,2898526339,3612357925,4159332703,1645490516,223693667,1567101217,3362177881,1029951347,3470931136,3570957959,1550265121,119497089,972513919,907948164,3840628539,1613718692,3594177948,465323573,2659255085,654439692,2575596212,2699288441,3127702412,277098644,624404830,4100943870,2717858591,546110314,2403699828,3655377447,1321679412,4236791657,1045293279,4010672264,895050893,2319792268,494945126,1914543101,2777056443,3894764339,2219737618,311263384,4275257268,3458730721,669096869,3584475730,3835122877,3319158237,3949359204,2005142349,2713102337,2228954793,3769984788,569394103,3855636576,1425027204,108000370,2736431443,3671869269,3043122623,1750473702,2211081108,762237499,3972989403,2798899386,3061857628,2943854345,867476300,964413654,1591880597,1594774276,2179821409,552026980,3026064248,3726140315,2283577634,3110545105,2152310760,582474363,1582640421,1383256631,2043843868,3322775884,1217180674,463797851,2763038571,480777679,2718707717,2289164131,3118346187,214354409,200212307,3810608407,3025414197,2674075964,3997296425,1847405948,1342460550,510035443,4080271814,815934613,833030224,1620250387,1945732119,2703661145,3966000196,1388869545,3456054182,2687178561,2092620194,562037615,1356438536,3409922145,3261847397,1688467115,2150901366,631725691,3840332284,549916902,3455104640,394546491,837744717,2114462948,751520235,2221554606,2415360136,3999097078,2063029875,803036379,2702586305,821456707,3019566164,360699898,4018502092,3511869016,3677355358,2402471449,812317050,49299192,2570164949,3259169295,2816732080,3331213574,3101303564,2156015656,3705598920,3546263921,143268808,3200304480,1638124008,3165189453,3341807610,578956953,2193977524,3638120073,2333881532,807278310,658237817,2969561766,1641658566,11683945,3086995007,148645947,1138423386,4158756760,1981396783,2401016740,3699783584,380097457,2680394679,2803068651,3334260286,441530178,4016580796,1375954390,761952171,891809099,2183123478,157052462,3683840763,1592404427,341349109,2438483839,1417898363,644327628,2233032776,2353769706,2201510100,220455161,1815641738,182899273,2995019788,3627381533,3702638151,2890684138,1052606899,588164016,1681439879,4038439418,2405343923,4229449282,167996282,1336969661,1688053129,2739224926,1543734051,1046297529,1138201970,2121126012,115334942,1819067631,1902159161,1941945968,2206692869,1159982321),f[2]=new Array(2381300288,637164959,3952098751,3893414151,1197506559,916448331,2350892612,2932787856,3199334847,4009478890,3905886544,1373570990,2450425862,4037870920,3778841987,2456817877,286293407,124026297,3001279700,1028597854,3115296800,4208886496,2691114635,2188540206,1430237888,1218109995,3572471700,308166588,570424558,2187009021,2455094765,307733056,1310360322,3135275007,1384269543,2388071438,863238079,2359263624,2801553128,3380786597,2831162807,1470087780,1728663345,4072488799,1090516929,532123132,2389430977,1132193179,2578464191,3051079243,1670234342,1434557849,2711078940,1241591150,3314043432,3435360113,3091448339,1812415473,2198440252,267246943,796911696,3619716990,38830015,1526438404,2806502096,374413614,2943401790,1489179520,1603809326,1920779204,168801282,260042626,2358705581,1563175598,2397674057,1356499128,2217211040,514611088,2037363785,2186468373,4022173083,2792511869,2913485016,1173701892,4200428547,3896427269,1334932762,2455136706,602925377,2835607854,1613172210,41346230,2499634548,2457437618,2188827595,41386358,4172255629,1313404830,2405527007,3801973774,2217704835,873260488,2528884354,2478092616,4012915883,2555359016,2006953883,2463913485,575479328,2218240648,2099895446,660001756,2341502190,3038761536,3888151779,3848713377,3286851934,1022894237,1620365795,3449594689,1551255054,15374395,3570825345,4249311020,4151111129,3181912732,310226346,1133119310,530038928,136043402,2476768958,3107506709,2544909567,1036173560,2367337196,1681395281,1758231547,3641649032,306774401,1575354324,3716085866,1990386196,3114533736,2455606671,1262092282,3124342505,2768229131,4210529083,1833535011,423410938,660763973,2187129978,1639812e3,3508421329,3467445492,310289298,272797111,2188552562,2456863912,310240523,677093832,1013118031,901835429,3892695601,1116285435,3036471170,1337354835,243122523,520626091,277223598,4244441197,4194248841,1766575121,594173102,316590669,742362309,3536858622,4176435350,3838792410,2501204839,1229605004,3115755532,1552908988,2312334149,979407927,3959474601,1148277331,176638793,3614686272,2083809052,40992502,1340822838,2731552767,3535757508,3560899520,1354035053,122129617,7215240,2732932949,3118912700,2718203926,2539075635,3609230695,3725561661,1928887091,2882293555,1988674909,2063640240,2491088897,1459647954,4189817080,2302804382,1113892351,2237858528,1927010603,4002880361,1856122846,1594404395,2944033133,3855189863,3474975698,1643104450,4054590833,3431086530,1730235576,2984608721,3084664418,2131803598,4178205752,267404349,1617849798,1616132681,1462223176,736725533,2327058232,551665188,2945899023,1749386277,2575514597,1611482493,674206544,2201269090,3642560800,728599968,1680547377,2620414464,1388111496,453204106,4156223445,1094905244,2754698257,2201108165,3757000246,2704524545,3922940700,3996465027),f[3]=new Array(2645754912,532081118,2814278639,3530793624,1246723035,1689095255,2236679235,4194438865,2116582143,3859789411,157234593,2045505824,4245003587,1687664561,4083425123,605965023,672431967,1336064205,3376611392,214114848,4258466608,3232053071,489488601,605322005,3998028058,264917351,1912574028,756637694,436560991,202637054,135989450,85393697,2152923392,3896401662,2895836408,2145855233,3535335007,115294817,3147733898,1922296357,3464822751,4117858305,1037454084,2725193275,2127856640,1417604070,1148013728,1827919605,642362335,2929772533,909348033,1346338451,3547799649,297154785,1917849091,4161712827,2883604526,3968694238,1469521537,3780077382,3375584256,1763717519,136166297,4290970789,1295325189,2134727907,2798151366,1566297257,3672928234,2677174161,2672173615,965822077,2780786062,289653839,1133871874,3491843819,35685304,1068898316,418943774,672553190,642281022,2346158704,1954014401,3037126780,4079815205,2030668546,3840588673,672283427,1776201016,359975446,3750173538,555499703,2769985273,1324923,69110472,152125443,3176785106,3822147285,1340634837,798073664,1434183902,15393959,216384236,1303690150,3881221631,3711134124,3960975413,106373927,2578434224,1455997841,1801814300,1578393881,1854262133,3188178946,3258078583,2302670060,1539295533,3505142565,3078625975,2372746020,549938159,3278284284,2620926080,181285381,2865321098,3970029511,68876850,488006234,1728155692,2608167508,836007927,2435231793,919367643,3339422534,3655756360,1457871481,40520939,1380155135,797931188,234455205,2255801827,3990488299,397000196,739833055,3077865373,2871719860,4022553888,772369276,390177364,3853951029,557662966,740064294,1640166671,1699928825,3535942136,622006121,3625353122,68743880,1742502,219489963,1664179233,1577743084,1236991741,410585305,2366487942,823226535,1050371084,3426619607,3586839478,212779912,4147118561,1819446015,1911218849,530248558,3486241071,3252585495,2886188651,3410272728,2342195030,20547779,2982490058,3032363469,3631753222,312714466,1870521650,1493008054,3491686656,615382978,4103671749,2534517445,1932181,2196105170,278426614,6369430,3274544417,2913018367,697336853,2143000447,2946413531,701099306,1558357093,2805003052,3500818408,2321334417,3567135975,216290473,3591032198,23009561,1996984579,3735042806,2024298078,3739440863,569400510,2339758983,3016033873,3097871343,3639523026,3844324983,3256173865,795471839,2951117563,4101031090,4091603803,3603732598,971261452,534414648,428311343,3389027175,2844869880,694888862,1227866773,2456207019,3043454569,2614353370,3749578031,3676663836,459166190,4132644070,1794958188,51825668,2252611902,3084671440,2036672799,3436641603,1099053433,2469121526,3059204941,1323291266,2061838604,1018778475,2233344254,2553501054,334295216,3556750194,1065731521,183467730),f[4]=new Array(2127105028,745436345,2601412319,2788391185,3093987327,500390133,1155374404,389092991,150729210,3891597772,3523549952,1935325696,716645080,946045387,2901812282,1774124410,3869435775,4039581901,3293136918,3438657920,948246080,363898952,3867875531,1286266623,1598556673,68334250,630723836,1104211938,1312863373,613332731,2377784574,1101634306,441780740,3129959883,1917973735,2510624549,3238456535,2544211978,3308894634,1299840618,4076074851,1756332096,3977027158,297047435,3790297736,2265573040,3621810518,1311375015,1667687725,47300608,3299642885,2474112369,201668394,1468347890,576830978,3594690761,3742605952,1958042578,1747032512,3558991340,1408974056,3366841779,682131401,1033214337,1545599232,4265137049,206503691,103024618,2855227313,1337551222,2428998917,2963842932,4015366655,3852247746,2796956967,3865723491,3747938335,247794022,3755824572,702416469,2434691994,397379957,851939612,2314769512,218229120,1380406772,62274761,214451378,3170103466,2276210409,3845813286,28563499,446592073,1693330814,3453727194,29968656,3093872512,220656637,2470637031,77972100,1667708854,1358280214,4064765667,2395616961,325977563,4277240721,4220025399,3605526484,3355147721,811859167,3069544926,3962126810,652502677,3075892249,4132761541,3498924215,1217549313,3250244479,3858715919,3053989961,1538642152,2279026266,2875879137,574252750,3324769229,2651358713,1758150215,141295887,2719868960,3515574750,4093007735,4194485238,1082055363,3417560400,395511885,2966884026,179534037,3646028556,3738688086,1092926436,2496269142,257381841,3772900718,1636087230,1477059743,2499234752,3811018894,2675660129,3285975680,90732309,1684827095,1150307763,1723134115,3237045386,1769919919,1240018934,815675215,750138730,2239792499,1234303040,1995484674,138143821,675421338,1145607174,1936608440,3238603024,2345230278,2105974004,323969391,779555213,3004902369,2861610098,1017501463,2098600890,2628620304,2940611490,2682542546,1171473753,3656571411,3687208071,4091869518,393037935,159126506,1662887367,1147106178,391545844,3452332695,1891500680,3016609650,1851642611,546529401,1167818917,3194020571,2848076033,3953471836,575554290,475796850,4134673196,450035699,2351251534,844027695,1080539133,86184846,1554234488,3692025454,1972511363,2018339607,1491841390,1141460869,1061690759,4244549243,2008416118,2351104703,2868147542,1598468138,722020353,1027143159,212344630,1387219594,1725294528,3745187956,2500153616,458938280,4129215917,1828119673,544571780,3503225445,2297937496,1241802790,267843827,2694610800,1397140384,1558801448,3782667683,1806446719,929573330,2234912681,400817706,616011623,4121520928,3603768725,1761550015,1968522284,4053731006,4192232858,4005120285,872482584,3140537016,3894607381,2287405443,1963876937,3663887957,1584857e3,2975024454,1833426440,4025083860),f[5]=new Array(4143615901,749497569,1285769319,3795025788,2514159847,23610292,3974978748,844452780,3214870880,3751928557,2213566365,1676510905,448177848,3730751033,4086298418,2307502392,871450977,3222878141,4110862042,3831651966,2735270553,1310974780,2043402188,1218528103,2736035353,4274605013,2702448458,3936360550,2693061421,162023535,2827510090,687910808,23484817,3784910947,3371371616,779677500,3503626546,3473927188,4157212626,3500679282,4248902014,2466621104,3899384794,1958663117,925738300,1283408968,3669349440,1840910019,137959847,2679828185,1239142320,1315376211,1547541505,1690155329,739140458,3128809933,3933172616,3876308834,905091803,1548541325,4040461708,3095483362,144808038,451078856,676114313,2861728291,2469707347,993665471,373509091,2599041286,4025009006,4170239449,2149739950,3275793571,3749616649,2794760199,1534877388,572371878,2590613551,1753320020,3467782511,1405125690,4270405205,633333386,3026356924,3475123903,632057672,2846462855,1404951397,3882875879,3915906424,195638627,2385783745,3902872553,1233155085,3355999740,2380578713,2702246304,2144565621,3663341248,3894384975,2502479241,4248018925,3094885567,1594115437,572884632,3385116731,767645374,1331858858,1475698373,3793881790,3532746431,1321687957,619889600,1121017241,3440213920,2070816767,2833025776,1933951238,4095615791,890643334,3874130214,859025556,360630002,925594799,1764062180,3920222280,4078305929,979562269,2810700344,4087740022,1949714515,546639971,1165388173,3069891591,1495988560,922170659,1291546247,2107952832,1813327274,3406010024,3306028637,4241950635,153207855,2313154747,1608695416,1150242611,1967526857,721801357,1220138373,3691287617,3356069787,2112743302,3281662835,1111556101,1778980689,250857638,2298507990,673216130,2846488510,3207751581,3562756981,3008625920,3417367384,2198807050,529510932,3547516680,3426503187,2364944742,102533054,2294910856,1617093527,1204784762,3066581635,1019391227,1069574518,1317995090,1691889997,3661132003,510022745,3238594800,1362108837,1817929911,2184153760,805817662,1953603311,3699844737,120799444,2118332377,207536705,2282301548,4120041617,145305846,2508124933,3086745533,3261524335,1877257368,2977164480,3160454186,2503252186,4221677074,759945014,254147243,2767453419,3801518371,629083197,2471014217,907280572,3900796746,940896768,2751021123,2625262786,3161476951,3661752313,3260732218,1425318020,2977912069,1496677566,3988592072,2140652971,3126511541,3069632175,977771578,1392695845,1698528874,1411812681,1369733098,1343739227,3620887944,1142123638,67414216,3102056737,3088749194,1626167401,2546293654,3941374235,697522451,33404913,143560186,2595682037,994885535,1247667115,3859094837,2699155541,3547024625,4114935275,2968073508,3199963069,2732024527,1237921620,951448369,1898488916,1211705605,2790989240,2233243581,3598044975),f[6]=new Array(2246066201,858518887,1714274303,3485882003,713916271,2879113490,3730835617,539548191,36158695,1298409750,419087104,1358007170,749914897,2989680476,1261868530,2995193822,2690628854,3443622377,3780124940,3796824509,2976433025,4259637129,1551479e3,512490819,1296650241,951993153,2436689437,2460458047,144139966,3136204276,310820559,3068840729,643875328,1969602020,1680088954,2185813161,3283332454,672358534,198762408,896343282,276269502,3014846926,84060815,197145886,376173866,3943890818,3813173521,3545068822,1316698879,1598252827,2633424951,1233235075,859989710,2358460855,3503838400,3409603720,1203513385,1193654839,2792018475,2060853022,207403770,1144516871,3068631394,1121114134,177607304,3785736302,326409831,1929119770,2983279095,4183308101,3474579288,3200513878,3228482096,119610148,1170376745,3378393471,3163473169,951863017,3337026068,3135789130,2907618374,1183797387,2015970143,4045674555,2182986399,2952138740,3928772205,384012900,2454997643,10178499,2879818989,2596892536,111523738,2995089006,451689641,3196290696,235406569,1441906262,3890558523,3013735005,4158569349,1644036924,376726067,1006849064,3664579700,2041234796,1021632941,1374734338,2566452058,371631263,4007144233,490221539,206551450,3140638584,1053219195,1853335209,3412429660,3562156231,735133835,1623211703,3104214392,2738312436,4096837757,3366392578,3110964274,3956598718,3196820781,2038037254,3877786376,2339753847,300912036,3766732888,2372630639,1516443558,4200396704,1574567987,4069441456,4122592016,2699739776,146372218,2748961456,2043888151,35287437,2596680554,655490400,1132482787,110692520,1031794116,2188192751,1324057718,1217253157,919197030,686247489,3261139658,1028237775,3135486431,3059715558,2460921700,986174950,2661811465,4062904701,2752986992,3709736643,367056889,1353824391,731860949,1650113154,1778481506,784341916,357075625,3608602432,1074092588,2480052770,3811426202,92751289,877911070,3600361838,1231880047,480201094,3756190983,3094495953,434011822,87971354,363687820,1717726236,1901380172,3926403882,2481662265,400339184,1490350766,2661455099,1389319756,2558787174,784598401,1983468483,30828846,3550527752,2716276238,3841122214,1765724805,1955612312,1277890269,1333098070,1564029816,2704417615,1026694237,3287671188,1260819201,3349086767,1016692350,1582273796,1073413053,1995943182,694588404,1025494639,3323872702,3551898420,4146854327,453260480,1316140391,1435673405,3038941953,3486689407,1622062951,403978347,817677117,950059133,4246079218,3278066075,1486738320,1417279718,481875527,2549965225,3933690356,760697757,1452955855,3897451437,1177426808,1702951038,4085348628,2447005172,1084371187,3516436277,3068336338,1073369276,1027665953,3284188590,1230553676,1368340146,2226246512,267243139,2274220762,4070734279,2497715176,2423353163,2504755875),f[7]=new Array(3793104909,3151888380,2817252029,895778965,2005530807,3871412763,237245952,86829237,296341424,3851759377,3974600970,2475086196,709006108,1994621201,2972577594,937287164,3734691505,168608556,3189338153,2225080640,3139713551,3033610191,3025041904,77524477,185966941,1208824168,2344345178,1721625922,3354191921,1066374631,1927223579,1971335949,2483503697,1551748602,2881383779,2856329572,3003241482,48746954,1398218158,2050065058,313056748,4255789917,393167848,1912293076,940740642,3465845460,3091687853,2522601570,2197016661,1727764327,364383054,492521376,1291706479,3264136376,1474851438,1685747964,2575719748,1619776915,1814040067,970743798,1561002147,2925768690,2123093554,1880132620,3151188041,697884420,2550985770,2607674513,2659114323,110200136,1489731079,997519150,1378877361,3527870668,478029773,2766872923,1022481122,431258168,1112503832,897933369,2635587303,669726182,3383752315,918222264,163866573,3246985393,3776823163,114105080,1903216136,761148244,3571337562,1690750982,3166750252,1037045171,1888456500,2010454850,642736655,616092351,365016990,1185228132,4174898510,1043824992,2023083429,2241598885,3863320456,3279669087,3674716684,108438443,2132974366,830746235,606445527,4173263986,2204105912,1844756978,2532684181,4245352700,2969441100,3796921661,1335562986,4061524517,2720232303,2679424040,634407289,885462008,3294724487,3933892248,2094100220,339117932,4048830727,3202280980,1458155303,2689246273,1022871705,2464987878,3714515309,353796843,2822958815,4256850100,4052777845,551748367,618185374,3778635579,4020649912,1904685140,3069366075,2670879810,3407193292,2954511620,4058283405,2219449317,3135758300,1120655984,3447565834,1474845562,3577699062,550456716,3466908712,2043752612,881257467,869518812,2005220179,938474677,3305539448,3850417126,1315485940,3318264702,226533026,965733244,321539988,1136104718,804158748,573969341,3708209826,937399083,3290727049,2901666755,1461057207,4013193437,4066861423,3242773476,2421326174,1581322155,3028952165,786071460,3900391652,3918438532,1485433313,4023619836,3708277595,3678951060,953673138,1467089153,1930354364,1533292819,2492563023,1346121658,1685000834,1965281866,3765933717,4190206607,2052792609,3515332758,690371149,3125873887,2180283551,2903598061,3933952357,436236910,289419410,14314871,1242357089,2904507907,1616633776,2666382180,585885352,3471299210,2699507360,1432659641,277164553,3354103607,770115018,2303809295,3741942315,3177781868,2853364978,2269453327,3774259834,987383833,1290892879,225909803,1741533526,890078084,1496906255,1111072499,916028167,243534141,1252605537,2204162171,531204876,290011180,3916834213,102027703,237315147,209093447,1486785922,220223953,2758195998,4175039106,82940208,3127791296,2569425252,518464269,1353887104,3941492737,2377294467,3935040926)}function e(a){this.cast5=new d,this.cast5.setKey(f.str2bin(a)),this.encrypt=function(a){return this.cast5.encrypt(a)}}var f=a("../../util.js");b.exports=e,b.exports.blockSize=e.prototype.blockSize=8,b.exports.keySize=e.prototype.keySize=16},{"../../util.js":74}],22:[function(a,b,c){function d(a,b,c,d,e,h){var i,j,k,l,m,n,o,p,q,r,s,t,u,v,w=new Array(16843776,0,65536,16843780,16842756,66564,4,65536,1024,16843776,16843780,1024,16778244,16842756,16777216,4,1028,16778240,16778240,66560,66560,16842752,16842752,16778244,65540,16777220,16777220,65540,0,1028,66564,16777216,65536,16843780,4,16842752,16843776,16777216,16777216,1024,16842756,65536,66560,16777220,1024,4,16778244,66564,16843780,65540,16842752,16778244,16777220,1028,66564,16843776,1028,16778240,16778240,0,65540,66560,0,16842756),x=new Array(-2146402272,-2147450880,32768,1081376,1048576,32,-2146435040,-2147450848,-2147483616,-2146402272,-2146402304,-2147483648,-2147450880,1048576,32,-2146435040,1081344,1048608,-2147450848,0,-2147483648,32768,1081376,-2146435072,1048608,-2147483616,0,1081344,32800,-2146402304,-2146435072,32800,0,1081376,-2146435040,1048576,-2147450848,-2146435072,-2146402304,32768,-2146435072,-2147450880,32,-2146402272,1081376,32,32768,-2147483648,32800,-2146402304,1048576,-2147483616,1048608,-2147450848,-2147483616,1048608,1081344,0,-2147450880,32800,-2147483648,-2146435040,-2146402272,1081344),y=new Array(520,134349312,0,134348808,134218240,0,131592,134218240,131080,134217736,134217736,131072,134349320,131080,134348800,520,134217728,8,134349312,512,131584,134348800,134348808,131592,134218248,131584,131072,134218248,8,134349320,512,134217728,134349312,134217728,131080,520,131072,134349312,134218240,0,512,131080,134349320,134218240,134217736,512,0,134348808,134218248,131072,134217728,134349320,8,131592,131584,134217736,134348800,134218248,520,134348800,131592,8,134348808,131584),z=new Array(8396801,8321,8321,128,8396928,8388737,8388609,8193,0,8396800,8396800,8396929,129,0,8388736,8388609,1,8192,8388608,8396801,128,8388608,8193,8320,8388737,1,8320,8388736,8192,8396928,8396929,129,8388736,8388609,8396800,8396929,129,0,0,8396800,8320,8388736,8388737,1,8396801,8321,8321,128,8396929,129,1,8192,8388609,8193,8396928,8388737,8193,8320,8388608,8396801,128,8388608,8192,8396928),A=new Array(256,34078976,34078720,1107296512,524288,256,1073741824,34078720,1074266368,524288,33554688,1074266368,1107296512,1107820544,524544,1073741824,33554432,1074266112,1074266112,0,1073742080,1107820800,1107820800,33554688,1107820544,1073742080,0,1107296256,34078976,33554432,1107296256,524544,524288,1107296512,256,33554432,1073741824,34078720,1107296512,1074266368,33554688,1073741824,1107820544,34078976,1074266368,256,33554432,1107820544,1107820800,524544,1107296256,1107820800,34078720,0,1074266112,1107296256,524544,33554688,1073742080,524288,0,1074266112,34078976,1073742080),B=new Array(536870928,541065216,16384,541081616,541065216,16,541081616,4194304,536887296,4210704,4194304,536870928,4194320,536887296,536870912,16400,0,4194320,536887312,16384,4210688,536887312,16,541065232,541065232,0,4210704,541081600,16400,4210688,541081600,536870912,536887296,16,541065232,4210688,541081616,4194304,16400,536870928,4194304,536887296,536870912,16400,536870928,541081616,4210688,541065216,4210704,541081600,0,541065232,16,16384,541065216,4210704,16384,4194320,536887312,0,541081600,536870912,4194320,536887312),C=new Array(2097152,69206018,67110914,0,2048,67110914,2099202,69208064,69208066,2097152,0,67108866,2,67108864,69206018,2050,67110912,2099202,2097154,67110912,67108866,69206016,69208064,2097154,69206016,2048,2050,69208066,2099200,2,67108864,2099200,67108864,2099200,2097152,67110914,67110914,69206018,69206018,2,2097154,67108864,67110912,2097152,69208064,2050,2099202,69208064,2050,67108866,69208066,69206016,2099200,0,2,69208066,0,2099202,69206016,2048,67108866,67110912,2048,2097154),D=new Array(268439616,4096,262144,268701760,268435456,268439616,64,268435456,262208,268697600,268701760,266240,268701696,266304,4096,64,268697600,268435520,268439552,4160,266240,262208,268697664,268701696,4160,0,0,268697664,268435520,268439552,266304,262144,266304,262144,268701696,4096,64,268697664,4096,266304,268439552,64,268435520,268697600,268697664,268435456,262144,268439616,0,268701760,262208,268435520,268697600,268439552,268439616,0,268701760,266240,266240,4160,4160,262208,268435456,268701696),E=0,F=b.length,G=0,H=32==a.length?3:9;
for(p=3==H?c?new Array(0,32,2):new Array(30,-2,-2):c?new Array(0,32,2,62,30,-2,64,96,2):new Array(94,62,-2,32,64,2,30,-2,-2),c&&(b=f(b,h),F=b.length),result="",tempresult="",1==d&&(q=e.charCodeAt(E++)<<24|e.charCodeAt(E++)<<16|e.charCodeAt(E++)<<8|e.charCodeAt(E++),s=e.charCodeAt(E++)<<24|e.charCodeAt(E++)<<16|e.charCodeAt(E++)<<8|e.charCodeAt(E++),E=0);F>E;){for(n=b.charCodeAt(E++)<<24|b.charCodeAt(E++)<<16|b.charCodeAt(E++)<<8|b.charCodeAt(E++),o=b.charCodeAt(E++)<<24|b.charCodeAt(E++)<<16|b.charCodeAt(E++)<<8|b.charCodeAt(E++),1==d&&(c?(n^=q,o^=s):(r=q,t=s,q=n,s=o)),k=252645135&(n>>>4^o),o^=k,n^=k<<4,k=65535&(n>>>16^o),o^=k,n^=k<<16,k=858993459&(o>>>2^n),n^=k,o^=k<<2,k=16711935&(o>>>8^n),n^=k,o^=k<<8,k=1431655765&(n>>>1^o),o^=k,n^=k<<1,n=n<<1|n>>>31,o=o<<1|o>>>31,j=0;H>j;j+=3){for(u=p[j+1],v=p[j+2],i=p[j];i!=u;i+=v)l=o^a[i],m=(o>>>4|o<<28)^a[i+1],k=n,n=o,o=k^(x[l>>>24&63]|z[l>>>16&63]|B[l>>>8&63]|D[63&l]|w[m>>>24&63]|y[m>>>16&63]|A[m>>>8&63]|C[63&m]);k=n,n=o,o=k}n=n>>>1|n<<31,o=o>>>1|o<<31,k=1431655765&(n>>>1^o),o^=k,n^=k<<1,k=16711935&(o>>>8^n),n^=k,o^=k<<8,k=858993459&(o>>>2^n),n^=k,o^=k<<2,k=65535&(n>>>16^o),o^=k,n^=k<<16,k=252645135&(n>>>4^o),o^=k,n^=k<<4,1==d&&(c?(q=n,s=o):(n^=r,o^=t)),tempresult+=String.fromCharCode(n>>>24,n>>>16&255,n>>>8&255,255&n,o>>>24,o>>>16&255,o>>>8&255,255&o),G+=8,512==G&&(result+=tempresult,tempresult="",G=0)}return result+=tempresult,c||(result=g(result,h)),result}function e(a){pc2bytes0=new Array(0,4,536870912,536870916,65536,65540,536936448,536936452,512,516,536871424,536871428,66048,66052,536936960,536936964),pc2bytes1=new Array(0,1,1048576,1048577,67108864,67108865,68157440,68157441,256,257,1048832,1048833,67109120,67109121,68157696,68157697),pc2bytes2=new Array(0,8,2048,2056,16777216,16777224,16779264,16779272,0,8,2048,2056,16777216,16777224,16779264,16779272),pc2bytes3=new Array(0,2097152,134217728,136314880,8192,2105344,134225920,136323072,131072,2228224,134348800,136445952,139264,2236416,134356992,136454144),pc2bytes4=new Array(0,262144,16,262160,0,262144,16,262160,4096,266240,4112,266256,4096,266240,4112,266256),pc2bytes5=new Array(0,1024,32,1056,0,1024,32,1056,33554432,33555456,33554464,33555488,33554432,33555456,33554464,33555488),pc2bytes6=new Array(0,268435456,524288,268959744,2,268435458,524290,268959746,0,268435456,524288,268959744,2,268435458,524290,268959746),pc2bytes7=new Array(0,65536,2048,67584,536870912,536936448,536872960,536938496,131072,196608,133120,198656,537001984,537067520,537004032,537069568),pc2bytes8=new Array(0,262144,0,262144,2,262146,2,262146,33554432,33816576,33554432,33816576,33554434,33816578,33554434,33816578),pc2bytes9=new Array(0,268435456,8,268435464,0,268435456,8,268435464,1024,268436480,1032,268436488,1024,268436480,1032,268436488),pc2bytes10=new Array(0,32,0,32,1048576,1048608,1048576,1048608,8192,8224,8192,8224,1056768,1056800,1056768,1056800),pc2bytes11=new Array(0,16777216,512,16777728,2097152,18874368,2097664,18874880,67108864,83886080,67109376,83886592,69206016,85983232,69206528,85983744),pc2bytes12=new Array(0,4096,134217728,134221824,524288,528384,134742016,134746112,16,4112,134217744,134221840,524304,528400,134742032,134746128),pc2bytes13=new Array(0,4,256,260,0,4,256,260,1,5,257,261,1,5,257,261);for(var b,c,d,e=a.length>8?3:1,f=new Array(32*e),g=new Array(0,0,1,1,1,1,1,1,0,1,1,1,1,1,1,0),h=0,j=0,k=0;e>k;k++)for(left=a.charCodeAt(h++)<<24|a.charCodeAt(h++)<<16|a.charCodeAt(h++)<<8|a.charCodeAt(h++),right=a.charCodeAt(h++)<<24|a.charCodeAt(h++)<<16|a.charCodeAt(h++)<<8|a.charCodeAt(h++),d=252645135&(left>>>4^right),right^=d,left^=d<<4,d=65535&(right>>>-16^left),left^=d,right^=d<<-16,d=858993459&(left>>>2^right),right^=d,left^=d<<2,d=65535&(right>>>-16^left),left^=d,right^=d<<-16,d=1431655765&(left>>>1^right),right^=d,left^=d<<1,d=16711935&(right>>>8^left),left^=d,right^=d<<8,d=1431655765&(left>>>1^right),right^=d,left^=d<<1,d=left<<8|right>>>20&240,left=right<<24|right<<8&16711680|right>>>8&65280|right>>>24&240,right=d,i=0;i<g.length;i++)g[i]?(left=left<<2|left>>>26,right=right<<2|right>>>26):(left=left<<1|left>>>27,right=right<<1|right>>>27),left&=-15,right&=-15,b=pc2bytes0[left>>>28]|pc2bytes1[left>>>24&15]|pc2bytes2[left>>>20&15]|pc2bytes3[left>>>16&15]|pc2bytes4[left>>>12&15]|pc2bytes5[left>>>8&15]|pc2bytes6[left>>>4&15],c=pc2bytes7[right>>>28]|pc2bytes8[right>>>24&15]|pc2bytes9[right>>>20&15]|pc2bytes10[right>>>16&15]|pc2bytes11[right>>>12&15]|pc2bytes12[right>>>8&15]|pc2bytes13[right>>>4&15],d=65535&(c>>>16^b),f[j++]=b^d,f[j++]=c^d<<16;return f}function f(a,b){var c=8-a.length%8;return 2==b&&8>c?a+="        ".substr(0,c):1==b?a+=String.fromCharCode(c,c,c,c,c,c,c,c).substr(0,c):!b&&8>c&&(a+="\x00\x00\x00\x00\x00\x00\x00\x00".substr(0,c)),a}function g(a,b){if(2==b)a=a.replace(/ *$/g,"");else if(1==b){var c=a.charCodeAt(a.length-1);a=a.substr(0,a.length-c)}else b||(a=a.replace(/\0*$/g,""));return a}function h(a){this.key=[];for(var b=0;3>b;b++)this.key.push(a.substr(8*b,8));this.encrypt=function(a){return k.str2bin(d(e(this.key[2]),d(e(this.key[1]),d(e(this.key[0]),k.bin2str(a),!0,0,null,null),!1,0,null,null),!0,0,null,null))}}function j(a){this.key=a,this.encrypt=function(a,b){var c=e(this.key);return k.str2bin(d(c,k.bin2str(a),!0,0,null,b))},this.decrypt=function(a,b){var c=e(this.key);return k.str2bin(d(c,k.bin2str(a),!1,0,null,b))}}var k=a("../../util.js");h.keySize=h.prototype.keySize=24,h.blockSize=h.prototype.blockSize=8,b.exports={des:h,originalDes:j}},{"../../util.js":74}],23:[function(a,b,c){var d=a("./des.js");b.exports={des:d.originalDes,tripledes:d.des,cast5:a("./cast5.js"),twofish:a("./twofish.js"),blowfish:a("./blowfish.js"),idea:function(){throw new Error("IDEA symmetric-key algorithm not implemented")}};var e=a("./aes.js");for(var f in e)b.exports["aes"+f]=e[f]},{"./aes.js":19,"./blowfish.js":20,"./cast5.js":21,"./des.js":22,"./twofish.js":24}],24:[function(a,b,c){function d(a,b){return(a<<b|a>>>32-b)&k}function e(a,b){return a[b]|a[b+1]<<8|a[b+2]<<16|a[b+3]<<24}function f(a,b,c){a.splice(b,4,255&c,c>>>8&255,c>>>16&255,c>>>24&255)}function g(a,b){return a>>>8*b&255}function h(){function a(a){function b(a){return a^a>>2^[0,90,180,238][3&a]}function c(a){return a^a>>1^a>>2^[0,238,180,90][3&a]}function f(a,b){var c,d,e;for(c=0;8>c;c++)d=b>>>24,b=b<<8&k|a>>>24,a=a<<8&k,e=d<<1,128&d&&(e^=333),b^=d^e<<16,e^=d>>>1,1&d&&(e^=166),b^=e<<24|e<<8;return b}function h(a,b){var c,d,e,f;return c=b>>4,d=15&b,e=A[a][c^d],f=B[a][E[d]^F[c]],D[a][E[f]^F[e]]<<4|C[a][e^f]}function i(a,b){var c=g(a,0),d=g(a,1),e=g(a,2),f=g(a,3);switch(q){case 4:c=G[1][c]^g(b[3],0),d=G[0][d]^g(b[3],1),e=G[0][e]^g(b[3],2),f=G[1][f]^g(b[3],3);case 3:c=G[1][c]^g(b[2],0),d=G[1][d]^g(b[2],1),e=G[0][e]^g(b[2],2),f=G[0][f]^g(b[2],3);case 2:c=G[0][G[0][c]^g(b[1],0)]^g(b[0],0),d=G[0][G[1][d]^g(b[1],1)]^g(b[0],1),e=G[1][G[0][e]^g(b[1],2)]^g(b[0],2),f=G[1][G[1][f]^g(b[1],3)]^g(b[0],3)}return H[0][c]^H[1][d]^H[2][e]^H[3][f]}o=a;var j,l,m,n,p,q,r,u,v,w=[],x=[],y=[],z=[],A=[[8,1,7,13,6,15,3,2,0,11,5,9,14,12,10,4],[2,8,11,13,15,7,6,14,3,1,9,4,0,10,12,5]],B=[[14,12,11,8,1,2,3,5,15,4,10,6,7,0,9,13],[1,14,2,11,4,12,3,7,6,13,10,5,15,9,0,8]],C=[[11,10,5,14,6,13,9,0,12,8,15,3,2,4,7,1],[4,12,7,5,1,6,9,10,0,14,13,8,2,11,3,15]],D=[[13,7,15,4,1,2,6,14,9,11,3,0,8,5,12,10],[11,9,5,1,12,3,13,14,6,4,7,15,2,0,8,10]],E=[0,8,1,9,2,10,3,11,4,12,5,13,6,14,7,15],F=[0,9,2,11,4,13,6,15,8,1,10,3,12,5,14,7],G=[[],[]],H=[[],[],[],[]];for(o=o.slice(0,32),j=o.length;16!=j&&24!=j&&32!=j;)o[j++]=0;for(j=0;j<o.length;j+=4)y[j>>2]=e(o,j);for(j=0;256>j;j++)G[0][j]=h(0,j),G[1][j]=h(1,j);for(j=0;256>j;j++)r=G[1][j],u=b(r),v=c(r),H[0][j]=r+(u<<8)+(v<<16)+(v<<24),H[2][j]=u+(v<<8)+(r<<16)+(v<<24),r=G[0][j],u=b(r),v=c(r),H[1][j]=v+(v<<8)+(u<<16)+(r<<24),H[3][j]=u+(r<<8)+(v<<16)+(u<<24);for(q=y.length/2,j=0;q>j;j++)l=y[j+j],w[j]=l,m=y[j+j+1],x[j]=m,z[q-j-1]=f(l,m);for(j=0;40>j;j+=2)l=16843009*j,m=l+16843009,l=i(l,w),m=d(i(m,x),8),s[j]=l+m&k,s[j+1]=d(l+2*m,9);for(j=0;256>j;j++)switch(l=m=n=p=j,q){case 4:l=G[1][l]^g(z[3],0),m=G[0][m]^g(z[3],1),n=G[0][n]^g(z[3],2),p=G[1][p]^g(z[3],3);case 3:l=G[1][l]^g(z[2],0),m=G[1][m]^g(z[2],1),n=G[0][n]^g(z[2],2),p=G[0][p]^g(z[2],3);case 2:t[0][j]=H[0][G[0][G[0][l]^g(z[1],0)]^g(z[0],0)],t[1][j]=H[1][G[0][G[1][m]^g(z[1],1)]^g(z[0],1)],t[2][j]=H[2][G[1][G[0][n]^g(z[1],2)]^g(z[0],2)],t[3][j]=H[3][G[1][G[1][p]^g(z[1],3)]^g(z[0],3)]}}function b(a){return t[0][g(a,0)]^t[1][g(a,1)]^t[2][g(a,2)]^t[3][g(a,3)]}function c(a){return t[0][g(a,3)]^t[1][g(a,0)]^t[2][g(a,1)]^t[3][g(a,2)]}function h(a,e){var f=b(e[0]),g=c(e[1]);e[2]=d(e[2]^f+g+s[4*a+8]&k,31),e[3]=d(e[3],1)^f+2*g+s[4*a+9]&k,f=b(e[2]),g=c(e[3]),e[0]=d(e[0]^f+g+s[4*a+10]&k,31),e[1]=d(e[1],1)^f+2*g+s[4*a+11]&k}function i(a,e){var f=b(e[0]),g=c(e[1]);e[2]=d(e[2],1)^f+g+s[4*a+10]&k,e[3]=d(e[3]^f+2*g+s[4*a+11]&k,31),f=b(e[2]),g=c(e[3]),e[0]=d(e[0],1)^f+g+s[4*a+8]&k,e[1]=d(e[1]^f+2*g+s[4*a+9]&k,31)}function j(){s=[],t=[[],[],[],[]]}function l(a,b){p=a,q=b;for(var c=[e(p,q)^s[0],e(p,q+4)^s[1],e(p,q+8)^s[2],e(p,q+12)^s[3]],d=0;8>d;d++)h(d,c);return f(p,q,c[2]^s[4]),f(p,q+4,c[3]^s[5]),f(p,q+8,c[0]^s[6]),f(p,q+12,c[1]^s[7]),q+=16,p}function m(a,b){p=a,q=b;for(var c=[e(p,q)^s[4],e(p,q+4)^s[5],e(p,q+8)^s[6],e(p,q+12)^s[7]],d=7;d>=0;d--)i(d,c);f(p,q,c[2]^s[0]),f(p,q+4,c[3]^s[1]),f(p,q+8,c[0]^s[2]),f(p,q+12,c[1]^s[3]),q+=16}function n(){return p}var o=null,p=null,q=-1,r=null;r="twofish";var s=[],t=[[],[],[],[]];return{name:"twofish",blocksize:16,open:a,close:j,encrypt:l,decrypt:m,finalize:n}}function i(a){this.tf=h(),this.tf.open(l.str2bin(a),0),this.encrypt=function(a){return this.tf.encrypt(j(a),0)}}function j(a){for(var b=[],c=0;c<a.length;c++)b[c]=a[c];return b}var k=4294967295,l=a("../../util.js");b.exports=i,b.exports.keySize=i.prototype.keySize=32,b.exports.blockSize=i.prototype.blockSize=16},{"../../util.js":74}],25:[function(a,b,c){var d=a("./random.js"),e=a("./cipher"),f=a("./public_key"),g=a("../type/mpi.js");b.exports={publicKeyEncrypt:function(a,b,c){var d=function(){var d;switch(a){case"rsa_encrypt":case"rsa_encrypt_sign":var e=new f.rsa,g=b[0].toBigInteger(),h=b[1].toBigInteger();return d=c.toBigInteger(),[e.encrypt(d,h,g)];case"elgamal":var i=new f.elgamal,j=b[0].toBigInteger(),k=b[1].toBigInteger(),l=b[2].toBigInteger();return d=c.toBigInteger(),i.encrypt(d,k,j,l);default:return[]}}();return d.map(function(a){var b=new g;return b.fromBigInteger(a),b})},publicKeyDecrypt:function(a,b,c){var d,e=function(){switch(a){case"rsa_encrypt_sign":case"rsa_encrypt":var e=new f.rsa,g=b[0].toBigInteger(),h=b[1].toBigInteger(),i=b[2].toBigInteger();d=b[3].toBigInteger();var j=b[4].toBigInteger(),k=b[5].toBigInteger(),l=c[0].toBigInteger();return e.decrypt(l,g,h,i,d,j,k);case"elgamal":var m=new f.elgamal,n=b[3].toBigInteger(),o=c[0].toBigInteger(),p=c[1].toBigInteger();return d=b[0].toBigInteger(),m.decrypt(o,p,d,n);default:return null}}(),h=new g;return h.fromBigInteger(e),h},getPrivateMpiCount:function(a){switch(a){case"rsa_encrypt":case"rsa_encrypt_sign":case"rsa_sign":return 4;case"elgamal":return 1;case"dsa":return 1;default:throw new Error("Unknown algorithm")}},getPublicMpiCount:function(a){switch(a){case"rsa_encrypt":case"rsa_encrypt_sign":case"rsa_sign":return 2;case"elgamal":return 3;case"dsa":return 4;default:throw new Error("Unknown algorithm.")}},generateMpi:function(a,b){function c(a){return a.map(function(a){var b=new g;return b.fromBigInteger(a),b})}switch(a){case"rsa_encrypt":case"rsa_encrypt_sign":case"rsa_sign":var d=new f.rsa;return d.generate(b,"10001").then(function(a){var b=[];return b.push(a.n),b.push(a.ee),b.push(a.d),b.push(a.p),b.push(a.q),b.push(a.u),c(b)});default:throw new Error("Unsupported algorithm for key generation.")}},getPrefixRandom:function(a){return d.getRandomBytes(e[a].blockSize)},generateSessionKey:function(a){return d.getRandomBytes(e[a].keySize)}}},{"../type/mpi.js":72,"./cipher":23,"./public_key":36,"./random.js":39}],26:[function(a,b,c){var d=b.exports={},e=a("./forge_util.js"),f=null,g=!1,h=null,i=function(){f=String.fromCharCode(128),f+=e.fillString(String.fromCharCode(0),64),h=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],g=!0},j=function(a,b,c){for(var d,e,f,g,i,j,k,l,m,n,o,p,q,r,s,t=c.length();t>=64;){for(k=0;16>k;++k)b[k]=c.getInt32();for(;64>k;++k)d=b[k-2],d=(d>>>17|d<<15)^(d>>>19|d<<13)^d>>>10,e=b[k-15],e=(e>>>7|e<<25)^(e>>>18|e<<14)^e>>>3,b[k]=d+b[k-7]+e+b[k-16]&4294967295;for(l=a.h0,m=a.h1,n=a.h2,o=a.h3,p=a.h4,q=a.h5,r=a.h6,s=a.h7,k=0;64>k;++k)g=(p>>>6|p<<26)^(p>>>11|p<<21)^(p>>>25|p<<7),i=r^p&(q^r),f=(l>>>2|l<<30)^(l>>>13|l<<19)^(l>>>22|l<<10),j=l&m|n&(l^m),d=s+g+i+h[k]+b[k],e=f+j,s=r,r=q,q=p,p=o+d&4294967295,o=n,n=m,m=l,l=d+e&4294967295;a.h0=a.h0+l&4294967295,a.h1=a.h1+m&4294967295,a.h2=a.h2+n&4294967295,a.h3=a.h3+o&4294967295,a.h4=a.h4+p&4294967295,a.h5=a.h5+q&4294967295,a.h6=a.h6+r&4294967295,a.h7=a.h7+s&4294967295,t-=64}};d.create=function(){g||i();var a=null,b=e.createBuffer(),c=new Array(64),d={algorithm:"sha256",blockLength:64,digestLength:32,messageLength:0};return d.start=function(){return d.messageLength=0,b=e.createBuffer(),a={h0:1779033703,h1:3144134277,h2:1013904242,h3:2773480762,h4:1359893119,h5:2600822924,h6:528734635,h7:1541459225},d},d.start(),d.update=function(f,g){return"utf8"===g&&(f=e.encodeUtf8(f)),d.messageLength+=f.length,b.putBytes(f),j(a,c,b),(b.read>2048||0===b.length())&&b.compact(),d},d.digest=function(){var g=d.messageLength,h=e.createBuffer();h.putBytes(b.bytes()),h.putBytes(f.substr(0,64-(g+8)%64)),h.putInt32(g>>>29&255),h.putInt32(g<<3&4294967295);var i={h0:a.h0,h1:a.h1,h2:a.h2,h3:a.h3,h4:a.h4,h5:a.h5,h6:a.h6,h7:a.h7};j(i,c,h);var k=e.createBuffer();return k.putInt32(i.h0),k.putInt32(i.h1),k.putInt32(i.h2),k.putInt32(i.h3),k.putInt32(i.h4),k.putInt32(i.h5),k.putInt32(i.h6),k.putInt32(i.h7),k},d}},{"./forge_util.js":27}],27:[function(a,b,c){var d=b.exports={};d.isArray=Array.isArray||function(a){return"[object Array]"===Object.prototype.toString.call(a)},d.isArrayBuffer=function(a){return"undefined"!=typeof ArrayBuffer&&a instanceof ArrayBuffer};var e=[];"undefined"!=typeof Int8Array&&e.push(Int8Array),"undefined"!=typeof Uint8Array&&e.push(Uint8Array),"undefined"!=typeof Uint8ClampedArray&&e.push(Uint8ClampedArray),"undefined"!=typeof Int16Array&&e.push(Int16Array),"undefined"!=typeof Uint16Array&&e.push(Uint16Array),"undefined"!=typeof Int32Array&&e.push(Int32Array),"undefined"!=typeof Uint32Array&&e.push(Uint32Array),"undefined"!=typeof Float32Array&&e.push(Float32Array),"undefined"!=typeof Float64Array&&e.push(Float64Array),d.isArrayBufferView=function(a){for(var b=0;b<e.length;++b)if(a instanceof e[b])return!0;return!1},d.ByteBuffer=function(a){if(this.data="",this.read=0,"string"==typeof a)this.data=a;else if(d.isArrayBuffer(a)||d.isArrayBufferView(a)){var b=new Uint8Array(a);try{this.data=String.fromCharCode.apply(null,b)}catch(c){for(var e=0;e<b.length;++e)this.putByte(b[e])}}},d.ByteBuffer.prototype.length=function(){return this.data.length-this.read},d.ByteBuffer.prototype.isEmpty=function(){return this.length()<=0},d.ByteBuffer.prototype.putByte=function(a){return this.data+=String.fromCharCode(a),this},d.ByteBuffer.prototype.fillWithByte=function(a,b){a=String.fromCharCode(a);for(var c=this.data;b>0;)1&b&&(c+=a),b>>>=1,b>0&&(a+=a);return this.data=c,this},d.ByteBuffer.prototype.putBytes=function(a){return this.data+=a,this},d.ByteBuffer.prototype.putString=function(a){return this.data+=d.encodeUtf8(a),this},d.ByteBuffer.prototype.putInt16=function(a){return this.data+=String.fromCharCode(a>>8&255)+String.fromCharCode(255&a),this},d.ByteBuffer.prototype.putInt24=function(a){return this.data+=String.fromCharCode(a>>16&255)+String.fromCharCode(a>>8&255)+String.fromCharCode(255&a),this},d.ByteBuffer.prototype.putInt32=function(a){return this.data+=String.fromCharCode(a>>24&255)+String.fromCharCode(a>>16&255)+String.fromCharCode(a>>8&255)+String.fromCharCode(255&a),this},d.ByteBuffer.prototype.putInt16Le=function(a){return this.data+=String.fromCharCode(255&a)+String.fromCharCode(a>>8&255),this},d.ByteBuffer.prototype.putInt24Le=function(a){return this.data+=String.fromCharCode(255&a)+String.fromCharCode(a>>8&255)+String.fromCharCode(a>>16&255),this},d.ByteBuffer.prototype.putInt32Le=function(a){return this.data+=String.fromCharCode(255&a)+String.fromCharCode(a>>8&255)+String.fromCharCode(a>>16&255)+String.fromCharCode(a>>24&255),this},d.ByteBuffer.prototype.putInt=function(a,b){do b-=8,this.data+=String.fromCharCode(a>>b&255);while(b>0);return this},d.ByteBuffer.prototype.putSignedInt=function(a,b){return 0>a&&(a+=2<<b-1),this.putInt(a,b)},d.ByteBuffer.prototype.putBuffer=function(a){return this.data+=a.getBytes(),this},d.ByteBuffer.prototype.getByte=function(){return this.data.charCodeAt(this.read++)},d.ByteBuffer.prototype.getInt16=function(){var a=this.data.charCodeAt(this.read)<<8^this.data.charCodeAt(this.read+1);return this.read+=2,a},d.ByteBuffer.prototype.getInt24=function(){var a=this.data.charCodeAt(this.read)<<16^this.data.charCodeAt(this.read+1)<<8^this.data.charCodeAt(this.read+2);return this.read+=3,a},d.ByteBuffer.prototype.getInt32=function(){var a=this.data.charCodeAt(this.read)<<24^this.data.charCodeAt(this.read+1)<<16^this.data.charCodeAt(this.read+2)<<8^this.data.charCodeAt(this.read+3);return this.read+=4,a},d.ByteBuffer.prototype.getInt16Le=function(){var a=this.data.charCodeAt(this.read)^this.data.charCodeAt(this.read+1)<<8;return this.read+=2,a},d.ByteBuffer.prototype.getInt24Le=function(){var a=this.data.charCodeAt(this.read)^this.data.charCodeAt(this.read+1)<<8^this.data.charCodeAt(this.read+2)<<16;return this.read+=3,a},d.ByteBuffer.prototype.getInt32Le=function(){var a=this.data.charCodeAt(this.read)^this.data.charCodeAt(this.read+1)<<8^this.data.charCodeAt(this.read+2)<<16^this.data.charCodeAt(this.read+3)<<24;return this.read+=4,a},d.ByteBuffer.prototype.getInt=function(a){var b=0;do b=(b<<8)+this.data.charCodeAt(this.read++),a-=8;while(a>0);return b},d.ByteBuffer.prototype.getSignedInt=function(a){var b=this.getInt(a),c=2<<a-2;return b>=c&&(b-=c<<1),b},d.ByteBuffer.prototype.getBytes=function(a){var b;return a?(a=Math.min(this.length(),a),b=this.data.slice(this.read,this.read+a),this.read+=a):0===a?b="":(b=0===this.read?this.data:this.data.slice(this.read),this.clear()),b},d.ByteBuffer.prototype.bytes=function(a){return"undefined"==typeof a?this.data.slice(this.read):this.data.slice(this.read,this.read+a)},d.ByteBuffer.prototype.at=function(a){return this.data.charCodeAt(this.read+a)},d.ByteBuffer.prototype.setAt=function(a,b){return this.data=this.data.substr(0,this.read+a)+String.fromCharCode(b)+this.data.substr(this.read+a+1),this},d.ByteBuffer.prototype.last=function(){return this.data.charCodeAt(this.data.length-1)},d.ByteBuffer.prototype.copy=function(){var a=d.createBuffer(this.data);return a.read=this.read,a},d.ByteBuffer.prototype.compact=function(){return this.read>0&&(this.data=this.data.slice(this.read),this.read=0),this},d.ByteBuffer.prototype.clear=function(){return this.data="",this.read=0,this},d.ByteBuffer.prototype.truncate=function(a){var b=Math.max(0,this.length()-a);return this.data=this.data.substr(this.read,b),this.read=0,this},d.ByteBuffer.prototype.toHex=function(){for(var a="",b=this.read;b<this.data.length;++b){var c=this.data.charCodeAt(b);16>c&&(a+="0"),a+=c.toString(16)}return a},d.ByteBuffer.prototype.toString=function(){return d.decodeUtf8(this.bytes())},d.createBuffer=function(a,b){return b=b||"raw",void 0!==a&&"utf8"===b&&(a=d.encodeUtf8(a)),new d.ByteBuffer(a)},d.fillString=function(a,b){for(var c="";b>0;)1&b&&(c+=a),b>>>=1,b>0&&(a+=a);return c},d.xorBytes=function(a,b,c){for(var d="",e="",f="",g=0,h=0;c>0;--c,++g)e=a.charCodeAt(g)^b.charCodeAt(g),h>=10&&(d+=f,f="",h=0),f+=String.fromCharCode(e),++h;return d+=f},d.hexToBytes=function(a){var b="",c=0;for(a.length&!0&&(c=1,b+=String.fromCharCode(parseInt(a[0],16)));c<a.length;c+=2)b+=String.fromCharCode(parseInt(a.substr(c,2),16));return b},d.bytesToHex=function(a){return d.createBuffer(a).toHex()},d.int32ToBytes=function(a){return String.fromCharCode(a>>24&255)+String.fromCharCode(a>>16&255)+String.fromCharCode(a>>8&255)+String.fromCharCode(255&a)};var f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",g=[62,-1,-1,-1,63,52,53,54,55,56,57,58,59,60,61,-1,-1,-1,64,-1,-1,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,-1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51];d.encode64=function(a,b){for(var c,d,e,g="",h="",i=0;i<a.length;)c=a.charCodeAt(i++),d=a.charCodeAt(i++),e=a.charCodeAt(i++),g+=f.charAt(c>>2),g+=f.charAt((3&c)<<4|d>>4),isNaN(d)?g+="==":(g+=f.charAt((15&d)<<2|e>>6),g+=isNaN(e)?"=":f.charAt(63&e)),b&&g.length>b&&(h+=g.substr(0,b)+"\r\n",g=g.substr(b));return h+=g},d.decode64=function(a){a=a.replace(/[^A-Za-z0-9\+\/\=]/g,"");for(var b,c,d,e,f="",h=0;h<a.length;)b=g[a.charCodeAt(h++)-43],c=g[a.charCodeAt(h++)-43],d=g[a.charCodeAt(h++)-43],e=g[a.charCodeAt(h++)-43],f+=String.fromCharCode(b<<2|c>>4),64!==d&&(f+=String.fromCharCode((15&c)<<4|d>>2),64!==e&&(f+=String.fromCharCode((3&d)<<6|e)));return f},d.encodeUtf8=function(a){return unescape(encodeURIComponent(a))},d.decodeUtf8=function(a){return decodeURIComponent(escape(a))}},{}],28:[function(a,b,c){var d=a("./sha.js"),e=a("./forge_sha256.js");b.exports={md5:a("./md5.js"),sha1:d.sha1,sha224:d.sha224,sha256:d.sha256,sha384:d.sha384,sha512:d.sha512,ripemd:a("./ripe-md.js"),digest:function(a,b){switch(a){case 1:return this.md5(b);case 2:return this.sha1(b);case 3:return this.ripemd(b);case 8:var c=e.create();return c.update(b),c.digest().getBytes();case 9:return this.sha384(b);case 10:return this.sha512(b);case 11:return this.sha224(b);default:throw new Error("Invalid hash function.")}},getHashByteLength:function(a){switch(a){case 1:return 16;case 2:case 3:return 20;case 8:return 32;case 9:return 48;case 10:return 64;case 11:return 28;default:throw new Error("Invalid hash algorithm.")}}}},{"./forge_sha256.js":26,"./md5.js":29,"./ripe-md.js":30,"./sha.js":31}],29:[function(a,b,c){function d(a,b){var c=a[0],d=a[1],e=a[2],j=a[3];c=f(c,d,e,j,b[0],7,-680876936),j=f(j,c,d,e,b[1],12,-389564586),e=f(e,j,c,d,b[2],17,606105819),d=f(d,e,j,c,b[3],22,-1044525330),c=f(c,d,e,j,b[4],7,-176418897),j=f(j,c,d,e,b[5],12,1200080426),e=f(e,j,c,d,b[6],17,-1473231341),d=f(d,e,j,c,b[7],22,-45705983),c=f(c,d,e,j,b[8],7,1770035416),j=f(j,c,d,e,b[9],12,-1958414417),e=f(e,j,c,d,b[10],17,-42063),d=f(d,e,j,c,b[11],22,-1990404162),c=f(c,d,e,j,b[12],7,1804603682),j=f(j,c,d,e,b[13],12,-40341101),e=f(e,j,c,d,b[14],17,-1502002290),d=f(d,e,j,c,b[15],22,1236535329),c=g(c,d,e,j,b[1],5,-165796510),j=g(j,c,d,e,b[6],9,-1069501632),e=g(e,j,c,d,b[11],14,643717713),d=g(d,e,j,c,b[0],20,-373897302),c=g(c,d,e,j,b[5],5,-701558691),j=g(j,c,d,e,b[10],9,38016083),e=g(e,j,c,d,b[15],14,-660478335),d=g(d,e,j,c,b[4],20,-405537848),c=g(c,d,e,j,b[9],5,568446438),j=g(j,c,d,e,b[14],9,-1019803690),e=g(e,j,c,d,b[3],14,-187363961),d=g(d,e,j,c,b[8],20,1163531501),c=g(c,d,e,j,b[13],5,-1444681467),j=g(j,c,d,e,b[2],9,-51403784),e=g(e,j,c,d,b[7],14,1735328473),d=g(d,e,j,c,b[12],20,-1926607734),c=h(c,d,e,j,b[5],4,-378558),j=h(j,c,d,e,b[8],11,-2022574463),e=h(e,j,c,d,b[11],16,1839030562),d=h(d,e,j,c,b[14],23,-35309556),c=h(c,d,e,j,b[1],4,-1530992060),j=h(j,c,d,e,b[4],11,1272893353),e=h(e,j,c,d,b[7],16,-155497632),d=h(d,e,j,c,b[10],23,-1094730640),c=h(c,d,e,j,b[13],4,681279174),j=h(j,c,d,e,b[0],11,-358537222),e=h(e,j,c,d,b[3],16,-722521979),d=h(d,e,j,c,b[6],23,76029189),c=h(c,d,e,j,b[9],4,-640364487),j=h(j,c,d,e,b[12],11,-421815835),e=h(e,j,c,d,b[15],16,530742520),d=h(d,e,j,c,b[2],23,-995338651),c=i(c,d,e,j,b[0],6,-198630844),j=i(j,c,d,e,b[7],10,1126891415),e=i(e,j,c,d,b[14],15,-1416354905),d=i(d,e,j,c,b[5],21,-57434055),c=i(c,d,e,j,b[12],6,1700485571),j=i(j,c,d,e,b[3],10,-1894986606),e=i(e,j,c,d,b[10],15,-1051523),d=i(d,e,j,c,b[1],21,-2054922799),c=i(c,d,e,j,b[8],6,1873313359),j=i(j,c,d,e,b[15],10,-30611744),e=i(e,j,c,d,b[6],15,-1560198380),d=i(d,e,j,c,b[13],21,1309151649),c=i(c,d,e,j,b[4],6,-145523070),j=i(j,c,d,e,b[11],10,-1120210379),e=i(e,j,c,d,b[2],15,718787259),d=i(d,e,j,c,b[9],21,-343485551),a[0]=o(c,a[0]),a[1]=o(d,a[1]),a[2]=o(e,a[2]),a[3]=o(j,a[3])}function e(a,b,c,d,e,f){return b=o(o(b,a),o(d,f)),o(b<<e|b>>>32-e,c)}function f(a,b,c,d,f,g,h){return e(b&c|~b&d,a,b,f,g,h)}function g(a,b,c,d,f,g,h){return e(b&d|c&~d,a,b,f,g,h)}function h(a,b,c,d,f,g,h){return e(b^c^d,a,b,f,g,h)}function i(a,b,c,d,f,g,h){return e(c^(b|~d),a,b,f,g,h)}function j(a){txt="";var b,c=a.length,e=[1732584193,-271733879,-1732584194,271733878];for(b=64;b<=a.length;b+=64)d(e,k(a.substring(b-64,b)));a=a.substring(b-64);var f=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];for(b=0;b<a.length;b++)f[b>>2]|=a.charCodeAt(b)<<(b%4<<3);if(f[b>>2]|=128<<(b%4<<3),b>55)for(d(e,f),b=0;16>b;b++)f[b]=0;return f[14]=8*c,d(e,f),e}function k(a){var b,c=[];for(b=0;64>b;b+=4)c[b>>2]=a.charCodeAt(b)+(a.charCodeAt(b+1)<<8)+(a.charCodeAt(b+2)<<16)+(a.charCodeAt(b+3)<<24);return c}function l(a){for(var b="",c=0;4>c;c++)b+=q[a>>8*c+4&15]+q[a>>8*c&15];return b}function m(a){for(var b=0;b<a.length;b++)a[b]=l(a[b]);return a.join("")}function n(a){return m(j(a))}function o(a,b){return a+b&4294967295}function o(a,b){var c=(65535&a)+(65535&b),d=(a>>16)+(b>>16)+(c>>16);return d<<16|65535&c}var p=a("../../util.js");b.exports=function(a){var b=n(a),c=p.hex2bin(b);return c};var q="0123456789abcdef".split("");"5d41402abc4b2a76b9719d911017c592"!=n("hello")},{"../../util.js":74}],30:[function(a,b,c){function d(a,b){return new Number(a<<b|a>>>32-b)}function e(a,b,c){return new Number(a^b^c)}function f(a,b,c){return new Number(a&b|~a&c)}function g(a,b,c){return new Number((a|~b)^c)}function h(a,b,c){return new Number(a&c|b&~c)}function i(a,b,c){return new Number(a^(b|~c))}function j(a,b,c,j,k,l,m,n){switch(n){case 0:a+=e(b,c,j)+l+0;break;case 1:a+=f(b,c,j)+l+1518500249;break;case 2:a+=g(b,c,j)+l+1859775393;break;case 3:a+=h(b,c,j)+l+2400959708;break;case 4:a+=i(b,c,j)+l+2840853838;break;case 5:a+=i(b,c,j)+l+1352829926;break;case 6:a+=h(b,c,j)+l+1548603684;break;case 7:a+=g(b,c,j)+l+1836072691;break;case 8:a+=f(b,c,j)+l+2053994217;break;case 9:a+=e(b,c,j)+l+0;break;default:throw new Error("Bogus round number")}a=d(a,m)+k,c=d(c,10),a&=4294967295,b&=4294967295,c&=4294967295,j&=4294967295,k&=4294967295;var o=[];return o[0]=a,o[1]=b,o[2]=c,o[3]=j,o[4]=k,o[5]=l,o[6]=m,o}function k(a){a[0]=1732584193,a[1]=4023233417,a[2]=2562383102,a[3]=271733878,a[4]=3285377520}function l(a,b){blockA=[],blockB=[];var c,d,e;for(d=0;5>d;d++)blockA[d]=new Number(a[d]),blockB[d]=new Number(a[d]);var f=0;for(e=0;5>e;e++)for(d=0;16>d;d++)c=j(blockA[(f+0)%5],blockA[(f+1)%5],blockA[(f+2)%5],blockA[(f+3)%5],blockA[(f+4)%5],b[t[e][d]],s[e][d],e),blockA[(f+0)%5]=c[0],blockA[(f+1)%5]=c[1],blockA[(f+2)%5]=c[2],blockA[(f+3)%5]=c[3],blockA[(f+4)%5]=c[4],f+=4;for(f=0,e=5;10>e;e++)for(d=0;16>d;d++)c=j(blockB[(f+0)%5],blockB[(f+1)%5],blockB[(f+2)%5],blockB[(f+3)%5],blockB[(f+4)%5],b[t[e][d]],s[e][d],e),blockB[(f+0)%5]=c[0],blockB[(f+1)%5]=c[1],blockB[(f+2)%5]=c[2],blockB[(f+3)%5]=c[3],blockB[(f+4)%5]=c[4],f+=4;blockB[3]+=blockA[2]+a[1],a[1]=a[2]+blockA[3]+blockB[4],a[2]=a[3]+blockA[4]+blockB[0],a[3]=a[4]+blockA[0]+blockB[1],a[4]=a[0]+blockA[1]+blockB[2],a[0]=blockB[3]}function m(a){for(var b=0;16>b;b++)a[b]=0}function n(a,b,c,d){var e=new Array(16);m(e);for(var f=0,g=0;(63&c)>g;g++)e[g>>>2]^=(255&b.charCodeAt(f++))<<8*(3&g);e[c>>>2&15]^=1<<8*(3&c)+7,(63&c)>55&&(l(a,e),e=new Array(16),m(e)),e[14]=c<<3,e[15]=c>>>29|d<<3,l(a,e)}function o(a){var b=(255&a.charCodeAt(3))<<24;return b|=(255&a.charCodeAt(2))<<16,b|=(255&a.charCodeAt(1))<<8,b|=255&a.charCodeAt(0)}function p(a){var b,c,d=new Array(r/32),e=new Array(r/8);k(d),b=a.length;var f=new Array(16);m(f);var g,h=0;for(c=b;c>63;c-=64){for(g=0;16>g;g++)f[g]=o(a.substr(h,4)),h+=4;l(d,f)}for(n(d,a.substr(h),b,0),g=0;r/8>g;g+=4)e[g]=255&d[g>>>2],e[g+1]=d[g>>>2]>>>8&255,e[g+2]=d[g>>>2]>>>16&255,e[g+3]=d[g>>>2]>>>24&255;return e}function q(a){for(var b=p(a),c="",d=0;r/8>d;d++)c+=String.fromCharCode(b[d]);return c}var r=160,s=[[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8],[7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12],[11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5],[11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12],[9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6],[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6],[9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11],[9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5],[15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8],[8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]],t=[[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8],[3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12],[1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2],[4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13],[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12],[6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2],[15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13],[8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14],[12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]];b.exports=q},{}],31:[function(a,b,c){var d=function(){var a=8,b="",c=0,d=function(a,b){this.highOrder=a,this.lowOrder=b},e=function(b){var c,d=[],e=(1<<a)-1,f=b.length*a;for(c=0;f>c;c+=a)d[c>>5]|=(b.charCodeAt(c/a)&e)<<32-a-c%32;return d},f=function(a){var b,c,d=[],e=a.length;for(b=0;e>b;b+=2){if(c=parseInt(a.substr(b,2),16),isNaN(c))throw new Error("INVALID HEX STRING");d[b>>3]|=c<<24-4*(b%8)}return d},g=function(a){var b,d,e=c?"0123456789ABCDEF":"0123456789abcdef",f="",g=4*a.length;for(b=0;g>b;b+=1)d=a[b>>2]>>8*(3-b%4),f+=e.charAt(d>>4&15)+e.charAt(15&d);return f},h=function(a){var c,d,e,f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",g="",h=4*a.length;for(c=0;h>c;c+=3)for(e=(a[c>>2]>>8*(3-c%4)&255)<<16|(a[c+1>>2]>>8*(3-(c+1)%4)&255)<<8|a[c+2>>2]>>8*(3-(c+2)%4)&255,d=0;4>d;d+=1)g+=8*c+6*d<=32*a.length?f.charAt(e>>6*(3-d)&63):b;return g},i=function(a){for(var b="",c=255,d=0;d<32*a.length;d+=8)b+=String.fromCharCode(a[d>>5]>>>24-d%32&c);return b},j=function(a,b){return a<<b|a>>>32-b},k=function(a,b){return a>>>b|a<<32-b},l=function(a,b){return 32>=b?new d(a.highOrder>>>b|a.lowOrder<<32-b,a.lowOrder>>>b|a.highOrder<<32-b):new d(a.lowOrder>>>b|a.highOrder<<32-b,a.highOrder>>>b|a.lowOrder<<32-b)},m=function(a,b){return a>>>b},n=function(a,b){return 32>=b?new d(a.highOrder>>>b,a.lowOrder>>>b|a.highOrder<<32-b):new d(0,a.highOrder<<32-b)},o=function(a,b,c){return a^b^c},p=function(a,b,c){return a&b^~a&c},q=function(a,b,c){return new d(a.highOrder&b.highOrder^~a.highOrder&c.highOrder,a.lowOrder&b.lowOrder^~a.lowOrder&c.lowOrder)},r=function(a,b,c){return a&b^a&c^b&c},s=function(a,b,c){return new d(a.highOrder&b.highOrder^a.highOrder&c.highOrder^b.highOrder&c.highOrder,a.lowOrder&b.lowOrder^a.lowOrder&c.lowOrder^b.lowOrder&c.lowOrder)},t=function(a){return k(a,2)^k(a,13)^k(a,22)},u=function(a){var b=l(a,28),c=l(a,34),e=l(a,39);return new d(b.highOrder^c.highOrder^e.highOrder,b.lowOrder^c.lowOrder^e.lowOrder)},v=function(a){return k(a,6)^k(a,11)^k(a,25)},w=function(a){var b=l(a,14),c=l(a,18),e=l(a,41);return new d(b.highOrder^c.highOrder^e.highOrder,b.lowOrder^c.lowOrder^e.lowOrder)},x=function(a){return k(a,7)^k(a,18)^m(a,3)},y=function(a){var b=l(a,1),c=l(a,8),e=n(a,7);return new d(b.highOrder^c.highOrder^e.highOrder,b.lowOrder^c.lowOrder^e.lowOrder)},z=function(a){return k(a,17)^k(a,19)^m(a,10)},A=function(a){var b=l(a,19),c=l(a,61),e=n(a,6);return new d(b.highOrder^c.highOrder^e.highOrder,b.lowOrder^c.lowOrder^e.lowOrder);
},B=function(a,b){var c=(65535&a)+(65535&b),d=(a>>>16)+(b>>>16)+(c>>>16);return(65535&d)<<16|65535&c},C=function(a,b,c,d){var e=(65535&a)+(65535&b)+(65535&c)+(65535&d),f=(a>>>16)+(b>>>16)+(c>>>16)+(d>>>16)+(e>>>16);return(65535&f)<<16|65535&e},D=function(a,b,c,d,e){var f=(65535&a)+(65535&b)+(65535&c)+(65535&d)+(65535&e),g=(a>>>16)+(b>>>16)+(c>>>16)+(d>>>16)+(e>>>16)+(f>>>16);return(65535&g)<<16|65535&f},E=function(a,b){var c,e,f,g;return c=(65535&a.lowOrder)+(65535&b.lowOrder),e=(a.lowOrder>>>16)+(b.lowOrder>>>16)+(c>>>16),f=(65535&e)<<16|65535&c,c=(65535&a.highOrder)+(65535&b.highOrder)+(e>>>16),e=(a.highOrder>>>16)+(b.highOrder>>>16)+(c>>>16),g=(65535&e)<<16|65535&c,new d(g,f)},F=function(a,b,c,e){var f,g,h,i;return f=(65535&a.lowOrder)+(65535&b.lowOrder)+(65535&c.lowOrder)+(65535&e.lowOrder),g=(a.lowOrder>>>16)+(b.lowOrder>>>16)+(c.lowOrder>>>16)+(e.lowOrder>>>16)+(f>>>16),h=(65535&g)<<16|65535&f,f=(65535&a.highOrder)+(65535&b.highOrder)+(65535&c.highOrder)+(65535&e.highOrder)+(g>>>16),g=(a.highOrder>>>16)+(b.highOrder>>>16)+(c.highOrder>>>16)+(e.highOrder>>>16)+(f>>>16),i=(65535&g)<<16|65535&f,new d(i,h)},G=function(a,b,c,e,f){var g,h,i,j;return g=(65535&a.lowOrder)+(65535&b.lowOrder)+(65535&c.lowOrder)+(65535&e.lowOrder)+(65535&f.lowOrder),h=(a.lowOrder>>>16)+(b.lowOrder>>>16)+(c.lowOrder>>>16)+(e.lowOrder>>>16)+(f.lowOrder>>>16)+(g>>>16),i=(65535&h)<<16|65535&g,g=(65535&a.highOrder)+(65535&b.highOrder)+(65535&c.highOrder)+(65535&e.highOrder)+(65535&f.highOrder)+(h>>>16),h=(a.highOrder>>>16)+(b.highOrder>>>16)+(c.highOrder>>>16)+(e.highOrder>>>16)+(f.highOrder>>>16)+(g>>>16),j=(65535&h)<<16|65535&g,new d(j,i)},H=function(a,b){var c,d,e,f,g,h,i,k,l,m=[],n=p,q=o,s=r,t=j,u=B,v=D,w=[1732584193,4023233417,2562383102,271733878,3285377520],x=[1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1518500249,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,1859775393,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,2400959708,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782,3395469782];for(a[b>>5]|=128<<24-b%32,a[(b+65>>9<<4)+15]=b,l=a.length,i=0;l>i;i+=16){for(c=w[0],d=w[1],e=w[2],f=w[3],g=w[4],k=0;80>k;k+=1)16>k?m[k]=a[k+i]:m[k]=t(m[k-3]^m[k-8]^m[k-14]^m[k-16],1),h=20>k?v(t(c,5),n(d,e,f),g,x[k],m[k]):40>k?v(t(c,5),q(d,e,f),g,x[k],m[k]):60>k?v(t(c,5),s(d,e,f),g,x[k],m[k]):v(t(c,5),q(d,e,f),g,x[k],m[k]),g=f,f=e,e=t(d,30),d=c,c=h;w[0]=u(c,w[0]),w[1]=u(d,w[1]),w[2]=u(e,w[2]),w[3]=u(f,w[3]),w[4]=u(g,w[4])}return w},I=function(a,b,c){var e,f,g,h,i,j,k,l,m,n,o,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z=[];for("SHA-224"===c||"SHA-256"===c?(H=64,I=(b+65>>9<<4)+15,L=16,M=1,W=Number,N=B,O=C,P=D,Q=x,R=z,S=t,T=v,V=r,U=p,X=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],o="SHA-224"===c?[3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428]:[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]):("SHA-384"===c||"SHA-512"===c)&&(H=80,I=(b+128>>10<<5)+31,L=32,M=2,W=d,N=E,O=F,P=G,Q=y,R=A,S=u,T=w,V=s,U=q,X=[new W(1116352408,3609767458),new W(1899447441,602891725),new W(3049323471,3964484399),new W(3921009573,2173295548),new W(961987163,4081628472),new W(1508970993,3053834265),new W(2453635748,2937671579),new W(2870763221,3664609560),new W(3624381080,2734883394),new W(310598401,1164996542),new W(607225278,1323610764),new W(1426881987,3590304994),new W(1925078388,4068182383),new W(2162078206,991336113),new W(2614888103,633803317),new W(3248222580,3479774868),new W(3835390401,2666613458),new W(4022224774,944711139),new W(264347078,2341262773),new W(604807628,2007800933),new W(770255983,1495990901),new W(1249150122,1856431235),new W(1555081692,3175218132),new W(1996064986,2198950837),new W(2554220882,3999719339),new W(2821834349,766784016),new W(2952996808,2566594879),new W(3210313671,3203337956),new W(3336571891,1034457026),new W(3584528711,2466948901),new W(113926993,3758326383),new W(338241895,168717936),new W(666307205,1188179964),new W(773529912,1546045734),new W(1294757372,1522805485),new W(1396182291,2643833823),new W(1695183700,2343527390),new W(1986661051,1014477480),new W(2177026350,1206759142),new W(2456956037,344077627),new W(2730485921,1290863460),new W(2820302411,3158454273),new W(3259730800,3505952657),new W(3345764771,106217008),new W(3516065817,3606008344),new W(3600352804,1432725776),new W(4094571909,1467031594),new W(275423344,851169720),new W(430227734,3100823752),new W(506948616,1363258195),new W(659060556,3750685593),new W(883997877,3785050280),new W(958139571,3318307427),new W(1322822218,3812723403),new W(1537002063,2003034995),new W(1747873779,3602036899),new W(1955562222,1575990012),new W(2024104815,1125592928),new W(2227730452,2716904306),new W(2361852424,442776044),new W(2428436474,593698344),new W(2756734187,3733110249),new W(3204031479,2999351573),new W(3329325298,3815920427),new W(3391569614,3928383900),new W(3515267271,566280711),new W(3940187606,3454069534),new W(4118630271,4000239992),new W(116418474,1914138554),new W(174292421,2731055270),new W(289380356,3203993006),new W(460393269,320620315),new W(685471733,587496836),new W(852142971,1086792851),new W(1017036298,365543100),new W(1126000580,2618297676),new W(1288033470,3409855158),new W(1501505948,4234509866),new W(1607167915,987167468),new W(1816402316,1246189591)],o="SHA-384"===c?[new W(3418070365,3238371032),new W(1654270250,914150663),new W(2438529370,812702999),new W(355462360,4144912697),new W(1731405415,4290775857),new W(41048885895,1750603025),new W(3675008525,1694076839),new W(1203062813,3204075428)]:[new W(1779033703,4089235720),new W(3144134277,2227873595),new W(1013904242,4271175723),new W(2773480762,1595750129),new W(1359893119,2917565137),new W(2600822924,725511199),new W(528734635,4215389547),new W(1541459225,327033209)]),a[b>>5]|=128<<24-b%32,a[I]=b,Y=a.length,J=0;Y>J;J+=L){for(e=o[0],f=o[1],g=o[2],h=o[3],i=o[4],j=o[5],k=o[6],l=o[7],K=0;H>K;K+=1)16>K?Z[K]=new W(a[K*M+J],a[K*M+J+1]):Z[K]=O(R(Z[K-2]),Z[K-7],Q(Z[K-15]),Z[K-16]),m=P(l,T(i),U(i,j,k),X[K],Z[K]),n=N(S(e),V(e,f,g)),l=k,k=j,j=i,i=N(h,m),h=g,g=f,f=e,e=N(m,n);o[0]=N(e,o[0]),o[1]=N(f,o[1]),o[2]=N(g,o[2]),o[3]=N(h,o[3]),o[4]=N(i,o[4]),o[5]=N(j,o[5]),o[6]=N(k,o[6]),o[7]=N(l,o[7])}switch(c){case"SHA-224":return[o[0],o[1],o[2],o[3],o[4],o[5],o[6]];case"SHA-256":return o;case"SHA-384":return[o[0].highOrder,o[0].lowOrder,o[1].highOrder,o[1].lowOrder,o[2].highOrder,o[2].lowOrder,o[3].highOrder,o[3].lowOrder,o[4].highOrder,o[4].lowOrder,o[5].highOrder,o[5].lowOrder];case"SHA-512":return[o[0].highOrder,o[0].lowOrder,o[1].highOrder,o[1].lowOrder,o[2].highOrder,o[2].lowOrder,o[3].highOrder,o[3].lowOrder,o[4].highOrder,o[4].lowOrder,o[5].highOrder,o[5].lowOrder,o[6].highOrder,o[6].lowOrder,o[7].highOrder,o[7].lowOrder];default:throw new Error("Unknown SHA variant")}},J=function(b,c){if(this.sha1=null,this.sha224=null,this.sha256=null,this.sha384=null,this.sha512=null,this.strBinLen=null,this.strToHash=null,"HEX"===c){if(0!==b.length%2)throw new Error("TEXT MUST BE IN BYTE INCREMENTS");this.strBinLen=4*b.length,this.strToHash=f(b)}else{if("ASCII"!==c&&"undefined"!=typeof c)throw new Error("UNKNOWN TEXT INPUT TYPE");this.strBinLen=b.length*a,this.strToHash=e(b)}};return J.prototype={getHash:function(a,b){var c=null,d=this.strToHash.slice();switch(b){case"HEX":c=g;break;case"B64":c=h;break;case"ASCII":c=i;break;default:throw new Error("FORMAT NOT RECOGNIZED")}switch(a){case"SHA-1":return null===this.sha1&&(this.sha1=H(d,this.strBinLen)),c(this.sha1);case"SHA-224":return null===this.sha224&&(this.sha224=I(d,this.strBinLen,a)),c(this.sha224);case"SHA-256":return null===this.sha256&&(this.sha256=I(d,this.strBinLen,a)),c(this.sha256);case"SHA-384":return null===this.sha384&&(this.sha384=I(d,this.strBinLen,a)),c(this.sha384);case"SHA-512":return null===this.sha512&&(this.sha512=I(d,this.strBinLen,a)),c(this.sha512);default:throw new Error("HASH NOT RECOGNIZED")}},getHMAC:function(b,c,d,j){var k,l,m,n,o,p,q,r,s,t=[],u=[];switch(j){case"HEX":k=g;break;case"B64":k=h;break;case"ASCII":k=i;break;default:throw new Error("FORMAT NOT RECOGNIZED")}switch(d){case"SHA-1":m=64,s=160;break;case"SHA-224":m=64,s=224;break;case"SHA-256":m=64,s=256;break;case"SHA-384":m=128,s=384;break;case"SHA-512":m=128,s=512;break;default:throw new Error("HASH NOT RECOGNIZED")}if("HEX"===c){if(0!==b.length%2)throw new Error("KEY MUST BE IN BYTE INCREMENTS");l=f(b),r=4*b.length}else{if("ASCII"!==c)throw new Error("UNKNOWN KEY INPUT TYPE");l=e(b),r=b.length*a}for(n=8*m,q=m/4-1,r/8>m?(l="SHA-1"===d?H(l,r):I(l,r,d),l[q]&=4294967040):m>r/8&&(l[q]&=4294967040),o=0;q>=o;o+=1)t[o]=909522486^l[o],u[o]=1549556828^l[o];return"SHA-1"===d?(p=H(t.concat(this.strToHash),n+this.strBinLen),p=H(u.concat(p),n+s)):(p=I(t.concat(this.strToHash),n+this.strBinLen,d),p=I(u.concat(p),n+s,d)),k(p)}},J}();b.exports={sha1:function(a){var b=new d(a,"ASCII");return b.getHash("SHA-1","ASCII")},sha224:function(a){var b=new d(a,"ASCII");return b.getHash("SHA-224","ASCII")},sha256:function(a){var b=new d(a,"ASCII");return b.getHash("SHA-256","ASCII")},sha384:function(a){var b=new d(a,"ASCII");return b.getHash("SHA-384","ASCII")},sha512:function(a){var b=new d(a,"ASCII");return b.getHash("SHA-512","ASCII")}}},{}],32:[function(a,b,c){b.exports={cipher:a("./cipher"),hash:a("./hash"),cfb:a("./cfb.js"),publicKey:a("./public_key"),signature:a("./signature.js"),random:a("./random.js"),pkcs1:a("./pkcs1.js")};var d=a("./crypto.js");for(var e in d)b.exports[e]=d[e]},{"./cfb.js":18,"./cipher":23,"./crypto.js":25,"./hash":28,"./pkcs1.js":33,"./public_key":36,"./random.js":39,"./signature.js":40}],33:[function(a,b,c){function d(a){for(var b,c="";c.length<a;)b=f.getSecureRandomOctet(),0!==b&&(c+=String.fromCharCode(b));return c}var e=[];e[1]=[48,32,48,12,6,8,42,134,72,134,247,13,2,5,5,0,4,16],e[2]=[48,33,48,9,6,5,43,14,3,2,26,5,0,4,20],e[3]=[48,33,48,9,6,5,43,36,3,2,1,5,0,4,20],e[8]=[48,49,48,13,6,9,96,134,72,1,101,3,4,2,1,5,0,4,32],e[9]=[48,65,48,13,6,9,96,134,72,1,101,3,4,2,2,5,0,4,48],e[10]=[48,81,48,13,6,9,96,134,72,1,101,3,4,2,3,5,0,4,64],e[11]=[48,45,48,13,6,9,96,134,72,1,101,3,4,2,4,5,0,4,28];var f=(a("./crypto.js"),a("./random.js")),g=a("../util.js"),h=a("./public_key/jsbn.js"),i=a("./hash");b.exports={eme:{encode:function(a,b){var c=a.length;if(c>b-11)throw new Error("Message too long");var e=d(b-c-3),f=String.fromCharCode(0)+String.fromCharCode(2)+e+String.fromCharCode(0)+a;return f},decode:function(a){0!==a.charCodeAt(0)&&(a=String.fromCharCode(0)+a);for(var b=a.charCodeAt(0),c=a.charCodeAt(1),d=2;0!==a.charCodeAt(d)&&d<a.length;)d++;var e=d-2,f=a.charCodeAt(d++);if(0===b&&2===c&&e>=8&&0===f)return a.substr(d);throw new Error("Decryption error")}},emsa:{encode:function(a,b,c){var d,f=i.digest(a,b);if(f.length!==i.getHashByteLength(a))throw new Error("Invalid hash length");var j="";for(d=0;d<e[a].length;d++)j+=String.fromCharCode(e[a][d]);j+=f;var k=j.length;if(k+11>c)throw new Error("Intended encoded message length too short");var l="";for(d=0;c-k-3>d;d++)l+=String.fromCharCode(255);var m=String.fromCharCode(0)+String.fromCharCode(1)+l+String.fromCharCode(0)+j;return new h(g.hexstrdump(m),16)}}}},{"../util.js":74,"./crypto.js":25,"./hash":28,"./public_key/jsbn.js":37,"./random.js":39}],34:[function(a,b,c){function d(){function a(a,b,c,d,i,j){for(var k,l,m,n=h.getLeftNBits(g.digest(a,b),i.bitLength()),o=new e(h.hexstrdump(n),16);;)if(k=f.getRandomBigIntegerInRange(e.ONE,i.subtract(e.ONE)),l=c.modPow(k,d).mod(i),m=k.modInverse(i).multiply(o.add(j.multiply(l))).mod(i),0!=l&&0!=m)break;var p=[];return p[0]=l.toMPI(),p[1]=m.toMPI(),p}function b(a){var b=i.prefer_hash_algorithm;switch(Math.round(a.bitLength()/8)){case 20:return 2!=b&&b>11&&10!=b&&8>b?2:b;case 28:return b>11&&8>b?11:b;case 32:return b>10&&8>b?8:b;default:return h.print_debug("DSA select hash algorithm: returning null for an unknown length of q"),null}}function c(a,b,c,d,f,i,j,k){var l=h.getLeftNBits(g.digest(a,d),i.bitLength()),m=new e(h.hexstrdump(l),16);if(e.ZERO.compareTo(b)>=0||b.compareTo(i)>=0||e.ZERO.compareTo(c)>=0||c.compareTo(i)>=0)return h.print_debug("invalid DSA Signature"),null;var n=c.modInverse(i);if(0==e.ZERO.compareTo(n))return h.print_debug("invalid DSA Signature"),null;var o=m.multiply(n).mod(i),p=b.multiply(n).mod(i);return j.modPow(o,f).multiply(k.modPow(p,f)).mod(f).mod(i)}this.select_hash_algorithm=b,this.sign=a,this.verify=c}var e=a("./jsbn.js"),f=a("../random.js"),g=a("../hash"),h=a("../../util.js"),i=a("../../config");b.exports=d},{"../../config":17,"../../util.js":74,"../hash":28,"../random.js":39,"./jsbn.js":37}],35:[function(a,b,c){function d(){function a(a,b,c,d){var g=c.subtract(e.TWO),h=f.getRandomBigIntegerInRange(e.ONE,g);h=h.mod(g).add(e.ONE);var i=[];return i[0]=b.modPow(h,c),i[1]=d.modPow(h,c).multiply(a).mod(c),i}function b(a,b,c,d){return g.print_debug("Elgamal Decrypt:\nc1:"+g.hexstrdump(a.toMPI())+"\nc2:"+g.hexstrdump(b.toMPI())+"\np:"+g.hexstrdump(c.toMPI())+"\nx:"+g.hexstrdump(d.toMPI())),a.modPow(d,c).modInverse(c).multiply(b).mod(c)}this.encrypt=a,this.decrypt=b}var e=a("./jsbn.js"),f=a("../random.js"),g=a("../../util.js");b.exports=d},{"../../util.js":74,"../random.js":39,"./jsbn.js":37}],36:[function(a,b,c){b.exports={rsa:a("./rsa.js"),elgamal:a("./elgamal.js"),dsa:a("./dsa.js")}},{"./dsa.js":34,"./elgamal.js":35,"./rsa.js":38}],37:[function(a,b,c){function d(a,b,c){null!=a&&("number"==typeof a?this.fromNumber(a,b,c):null==b&&"string"!=typeof a?this.fromString(a,256):this.fromString(a,b))}function e(){return new d(null)}function f(a,b,c,d,e,f){for(;--f>=0;){var g=b*this[a++]+c[d]+e;e=Math.floor(g/67108864),c[d++]=67108863&g}return e}function g(a){return fb.charAt(a)}function h(a,b){var c=gb[a.charCodeAt(b)];return null==c?-1:c}function i(a){for(var b=this.t-1;b>=0;--b)a[b]=this[b];a.t=this.t,a.s=this.s}function j(a){this.t=1,this.s=0>a?-1:0,a>0?this[0]=a:-1>a?this[0]=a+this.DV:this.t=0}function k(a){var b=e();return b.fromInt(a),b}function l(a,b){var c;if(16==b)c=4;else if(8==b)c=3;else if(256==b)c=8;else if(2==b)c=1;else if(32==b)c=5;else{if(4!=b)return void this.fromRadix(a,b);c=2}this.t=0,this.s=0;for(var e=a.length,f=!1,g=0;--e>=0;){var i=8==c?255&a[e]:h(a,e);0>i?"-"==a.charAt(e)&&(f=!0):(f=!1,0==g?this[this.t++]=i:g+c>this.DB?(this[this.t-1]|=(i&(1<<this.DB-g)-1)<<g,this[this.t++]=i>>this.DB-g):this[this.t-1]|=i<<g,g+=c,g>=this.DB&&(g-=this.DB))}8==c&&0!=(128&a[0])&&(this.s=-1,g>0&&(this[this.t-1]|=(1<<this.DB-g)-1<<g)),this.clamp(),f&&d.ZERO.subTo(this,this)}function m(){for(var a=this.s&this.DM;this.t>0&&this[this.t-1]==a;)--this.t}function n(a){if(this.s<0)return"-"+this.negate().toString(a);var b;if(16==a)b=4;else if(8==a)b=3;else if(2==a)b=1;else if(32==a)b=5;else{if(4!=a)return this.toRadix(a);b=2}var c,d=(1<<b)-1,e=!1,f="",h=this.t,i=this.DB-h*this.DB%b;if(h-->0)for(i<this.DB&&(c=this[h]>>i)>0&&(e=!0,f=g(c));h>=0;)b>i?(c=(this[h]&(1<<i)-1)<<b-i,c|=this[--h]>>(i+=this.DB-b)):(c=this[h]>>(i-=b)&d,0>=i&&(i+=this.DB,--h)),c>0&&(e=!0),e&&(f+=g(c));return e?f:"0"}function o(){var a=e();return d.ZERO.subTo(this,a),a}function p(){return this.s<0?this.negate():this}function q(a){var b=this.s-a.s;if(0!=b)return b;var c=this.t;if(b=c-a.t,0!=b)return this.s<0?-b:b;for(;--c>=0;)if(0!=(b=this[c]-a[c]))return b;return 0}function r(a){var b,c=1;return 0!=(b=a>>>16)&&(a=b,c+=16),0!=(b=a>>8)&&(a=b,c+=8),0!=(b=a>>4)&&(a=b,c+=4),0!=(b=a>>2)&&(a=b,c+=2),0!=(b=a>>1)&&(a=b,c+=1),c}function s(){return this.t<=0?0:this.DB*(this.t-1)+r(this[this.t-1]^this.s&this.DM)}function t(a,b){var c;for(c=this.t-1;c>=0;--c)b[c+a]=this[c];for(c=a-1;c>=0;--c)b[c]=0;b.t=this.t+a,b.s=this.s}function u(a,b){for(var c=a;c<this.t;++c)b[c-a]=this[c];b.t=Math.max(this.t-a,0),b.s=this.s}function v(a,b){var c,d=a%this.DB,e=this.DB-d,f=(1<<e)-1,g=Math.floor(a/this.DB),h=this.s<<d&this.DM;for(c=this.t-1;c>=0;--c)b[c+g+1]=this[c]>>e|h,h=(this[c]&f)<<d;for(c=g-1;c>=0;--c)b[c]=0;b[g]=h,b.t=this.t+g+1,b.s=this.s,b.clamp()}function w(a,b){b.s=this.s;var c=Math.floor(a/this.DB);if(c>=this.t)return void(b.t=0);var d=a%this.DB,e=this.DB-d,f=(1<<d)-1;b[0]=this[c]>>d;for(var g=c+1;g<this.t;++g)b[g-c-1]|=(this[g]&f)<<e,b[g-c]=this[g]>>d;d>0&&(b[this.t-c-1]|=(this.s&f)<<e),b.t=this.t-c,b.clamp()}function x(a,b){for(var c=0,d=0,e=Math.min(a.t,this.t);e>c;)d+=this[c]-a[c],b[c++]=d&this.DM,d>>=this.DB;if(a.t<this.t){for(d-=a.s;c<this.t;)d+=this[c],b[c++]=d&this.DM,d>>=this.DB;d+=this.s}else{for(d+=this.s;c<a.t;)d-=a[c],b[c++]=d&this.DM,d>>=this.DB;d-=a.s}b.s=0>d?-1:0,-1>d?b[c++]=this.DV+d:d>0&&(b[c++]=d),b.t=c,b.clamp()}function y(a,b){var c=this.abs(),e=a.abs(),f=c.t;for(b.t=f+e.t;--f>=0;)b[f]=0;for(f=0;f<e.t;++f)b[f+c.t]=c.am(0,e[f],b,f,0,c.t);b.s=0,b.clamp(),this.s!=a.s&&d.ZERO.subTo(b,b)}function z(a){for(var b=this.abs(),c=a.t=2*b.t;--c>=0;)a[c]=0;for(c=0;c<b.t-1;++c){var d=b.am(c,b[c],a,2*c,0,1);(a[c+b.t]+=b.am(c+1,2*b[c],a,2*c+1,d,b.t-c-1))>=b.DV&&(a[c+b.t]-=b.DV,a[c+b.t+1]=1)}a.t>0&&(a[a.t-1]+=b.am(c,b[c],a,2*c,0,1)),a.s=0,a.clamp()}function A(a,b,c){var f=a.abs();if(!(f.t<=0)){var g=this.abs();if(g.t<f.t)return null!=b&&b.fromInt(0),void(null!=c&&this.copyTo(c));null==c&&(c=e());var h=e(),i=this.s,j=a.s,k=this.DB-r(f[f.t-1]);k>0?(f.lShiftTo(k,h),g.lShiftTo(k,c)):(f.copyTo(h),g.copyTo(c));var l=h.t,m=h[l-1];if(0!=m){var n=m*(1<<this.F1)+(l>1?h[l-2]>>this.F2:0),o=this.FV/n,p=(1<<this.F1)/n,q=1<<this.F2,s=c.t,t=s-l,u=null==b?e():b;for(h.dlShiftTo(t,u),c.compareTo(u)>=0&&(c[c.t++]=1,c.subTo(u,c)),d.ONE.dlShiftTo(l,u),u.subTo(h,h);h.t<l;)h[h.t++]=0;for(;--t>=0;){var v=c[--s]==m?this.DM:Math.floor(c[s]*o+(c[s-1]+q)*p);if((c[s]+=h.am(0,v,c,t,0,l))<v)for(h.dlShiftTo(t,u),c.subTo(u,c);c[s]<--v;)c.subTo(u,c)}null!=b&&(c.drShiftTo(l,b),i!=j&&d.ZERO.subTo(b,b)),c.t=l,c.clamp(),k>0&&c.rShiftTo(k,c),0>i&&d.ZERO.subTo(c,c)}}}function B(a){var b=e();return this.abs().divRemTo(a,null,b),this.s<0&&b.compareTo(d.ZERO)>0&&a.subTo(b,b),b}function C(a){this.m=a}function D(a){return a.s<0||a.compareTo(this.m)>=0?a.mod(this.m):a}function E(a){return a}function F(a){a.divRemTo(this.m,null,a)}function G(a,b,c){a.multiplyTo(b,c),this.reduce(c)}function H(a,b){a.squareTo(b),this.reduce(b)}function I(){if(this.t<1)return 0;var a=this[0];if(0==(1&a))return 0;var b=3&a;return b=b*(2-(15&a)*b)&15,b=b*(2-(255&a)*b)&255,b=b*(2-((65535&a)*b&65535))&65535,b=b*(2-a*b%this.DV)%this.DV,b>0?this.DV-b:-b}function J(a){this.m=a,this.mp=a.invDigit(),this.mpl=32767&this.mp,this.mph=this.mp>>15,this.um=(1<<a.DB-15)-1,this.mt2=2*a.t}function K(a){var b=e();return a.abs().dlShiftTo(this.m.t,b),b.divRemTo(this.m,null,b),a.s<0&&b.compareTo(d.ZERO)>0&&this.m.subTo(b,b),b}function L(a){var b=e();return a.copyTo(b),this.reduce(b),b}function M(a){for(;a.t<=this.mt2;)a[a.t++]=0;for(var b=0;b<this.m.t;++b){var c=32767&a[b],d=c*this.mpl+((c*this.mph+(a[b]>>15)*this.mpl&this.um)<<15)&a.DM;for(c=b+this.m.t,a[c]+=this.m.am(0,d,a,b,0,this.m.t);a[c]>=a.DV;)a[c]-=a.DV,a[++c]++}a.clamp(),a.drShiftTo(this.m.t,a),a.compareTo(this.m)>=0&&a.subTo(this.m,a)}function N(a,b){a.squareTo(b),this.reduce(b)}function O(a,b,c){a.multiplyTo(b,c),this.reduce(c)}function P(){return 0==(this.t>0?1&this[0]:this.s)}function Q(a,b){if(a>4294967295||1>a)return d.ONE;var c=e(),f=e(),g=b.convert(this),h=r(a)-1;for(g.copyTo(c);--h>=0;)if(b.sqrTo(c,f),(a&1<<h)>0)b.mulTo(f,g,c);else{var i=c;c=f,f=i}return b.revert(c)}function R(a,b){var c;return c=256>a||b.isEven()?new C(b):new J(b),this.exp(a,c)}function S(){var a=e();return this.copyTo(a),a}function T(){if(this.s<0){if(1==this.t)return this[0]-this.DV;if(0==this.t)return-1}else{if(1==this.t)return this[0];if(0==this.t)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]}function U(){return 0==this.t?this.s:this[0]<<24>>24}function V(){return 0==this.t?this.s:this[0]<<16>>16}function W(a){return Math.floor(Math.LN2*this.DB/Math.log(a))}function X(){return this.s<0?-1:this.t<=0||1==this.t&&this[0]<=0?0:1}function Y(a){if(null==a&&(a=10),0==this.signum()||2>a||a>36)return"0";var b=this.chunkSize(a),c=Math.pow(a,b),d=k(c),f=e(),g=e(),h="";for(this.divRemTo(d,f,g);f.signum()>0;)h=(c+g.intValue()).toString(a).substr(1)+h,f.divRemTo(d,f,g);return g.intValue().toString(a)+h}function Z(a,b){this.fromInt(0),null==b&&(b=10);for(var c=this.chunkSize(b),e=Math.pow(b,c),f=!1,g=0,i=0,j=0;j<a.length;++j){var k=h(a,j);0>k?"-"==a.charAt(j)&&0==this.signum()&&(f=!0):(i=b*i+k,++g>=c&&(this.dMultiply(e),this.dAddOffset(i,0),g=0,i=0))}g>0&&(this.dMultiply(Math.pow(b,g)),this.dAddOffset(i,0)),f&&d.ZERO.subTo(this,this)}function $(a,b,c){if("number"==typeof b)if(2>a)this.fromInt(1);else for(this.fromNumber(a,c),this.testBit(a-1)||this.bitwiseTo(d.ONE.shiftLeft(a-1),ga,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(b);)this.dAddOffset(2,0),this.bitLength()>a&&this.subTo(d.ONE.shiftLeft(a-1),this);else{var e=new Array,f=7&a;e.length=(a>>3)+1,b.nextBytes(e),f>0?e[0]&=(1<<f)-1:e[0]=0,this.fromString(e,256)}}function _(){var a=this.t,b=new Array;b[0]=this.s;var c,d=this.DB-a*this.DB%8,e=0;if(a-->0)for(d<this.DB&&(c=this[a]>>d)!=(this.s&this.DM)>>d&&(b[e++]=c|this.s<<this.DB-d);a>=0;)8>d?(c=(this[a]&(1<<d)-1)<<8-d,c|=this[--a]>>(d+=this.DB-8)):(c=this[a]>>(d-=8)&255,0>=d&&(d+=this.DB,--a)),(e>0||c!=this.s)&&(b[e++]=c);return b}function aa(a){return 0==this.compareTo(a)}function ba(a){return this.compareTo(a)<0?this:a}function ca(a){return this.compareTo(a)>0?this:a}function da(a,b,c){var d,e,f=Math.min(a.t,this.t);for(d=0;f>d;++d)c[d]=b(this[d],a[d]);if(a.t<this.t){for(e=a.s&this.DM,d=f;d<this.t;++d)c[d]=b(this[d],e);c.t=this.t}else{for(e=this.s&this.DM,d=f;d<a.t;++d)c[d]=b(e,a[d]);c.t=a.t}c.s=b(this.s,a.s),c.clamp()}function ea(a,b){return a&b}function fa(a){var b=e();return this.bitwiseTo(a,ea,b),b}function ga(a,b){return a|b}function ha(a){var b=e();return this.bitwiseTo(a,ga,b),b}function ia(a,b){return a^b}function ja(a){var b=e();return this.bitwiseTo(a,ia,b),b}function ka(a,b){return a&~b}function la(a){var b=e();return this.bitwiseTo(a,ka,b),b}function ma(){for(var a=e(),b=0;b<this.t;++b)a[b]=this.DM&~this[b];return a.t=this.t,a.s=~this.s,a}function na(a){var b=e();return 0>a?this.rShiftTo(-a,b):this.lShiftTo(a,b),b}function oa(a){var b=e();return 0>a?this.lShiftTo(-a,b):this.rShiftTo(a,b),b}function pa(a){if(0==a)return-1;var b=0;return 0==(65535&a)&&(a>>=16,b+=16),0==(255&a)&&(a>>=8,b+=8),0==(15&a)&&(a>>=4,b+=4),0==(3&a)&&(a>>=2,b+=2),0==(1&a)&&++b,b}function qa(){for(var a=0;a<this.t;++a)if(0!=this[a])return a*this.DB+pa(this[a]);return this.s<0?this.t*this.DB:-1}function ra(a){for(var b=0;0!=a;)a&=a-1,++b;return b}function sa(){for(var a=0,b=this.s&this.DM,c=0;c<this.t;++c)a+=ra(this[c]^b);return a}function ta(a){var b=Math.floor(a/this.DB);return b>=this.t?0!=this.s:0!=(this[b]&1<<a%this.DB)}function ua(a,b){var c=d.ONE.shiftLeft(a);return this.bitwiseTo(c,b,c),c}function va(a){return this.changeBit(a,ga)}function wa(a){return this.changeBit(a,ka)}function xa(a){return this.changeBit(a,ia)}function ya(a,b){for(var c=0,d=0,e=Math.min(a.t,this.t);e>c;)d+=this[c]+a[c],b[c++]=d&this.DM,d>>=this.DB;if(a.t<this.t){for(d+=a.s;c<this.t;)d+=this[c],b[c++]=d&this.DM,d>>=this.DB;d+=this.s}else{for(d+=this.s;c<a.t;)d+=a[c],b[c++]=d&this.DM,d>>=this.DB;d+=a.s}b.s=0>d?-1:0,d>0?b[c++]=d:-1>d&&(b[c++]=this.DV+d),b.t=c,b.clamp()}function za(a){var b=e();return this.addTo(a,b),b}function Aa(a){var b=e();return this.subTo(a,b),b}function Ba(a){var b=e();return this.multiplyTo(a,b),b}function Ca(){var a=e();return this.squareTo(a),a}function Da(a){var b=e();return this.divRemTo(a,b,null),b}function Ea(a){var b=e();return this.divRemTo(a,null,b),b}function Fa(a){var b=e(),c=e();return this.divRemTo(a,b,c),new Array(b,c)}function Ga(a){this[this.t]=this.am(0,a-1,this,0,0,this.t),++this.t,this.clamp()}function Ha(a,b){if(0!=a){for(;this.t<=b;)this[this.t++]=0;for(this[b]+=a;this[b]>=this.DV;)this[b]-=this.DV,++b>=this.t&&(this[this.t++]=0),++this[b]}}function Ia(){}function Ja(a){return a}function Ka(a,b,c){a.multiplyTo(b,c)}function La(a,b){a.squareTo(b)}function Ma(a){return this.exp(a,new Ia)}function Na(a,b,c){var d=Math.min(this.t+a.t,b);for(c.s=0,c.t=d;d>0;)c[--d]=0;var e;for(e=c.t-this.t;e>d;++d)c[d+this.t]=this.am(0,a[d],c,d,0,this.t);for(e=Math.min(a.t,b);e>d;++d)this.am(0,a[d],c,d,0,b-d);c.clamp()}function Oa(a,b,c){--b;var d=c.t=this.t+a.t-b;for(c.s=0;--d>=0;)c[d]=0;for(d=Math.max(b-this.t,0);d<a.t;++d)c[this.t+d-b]=this.am(b-d,a[d],c,0,0,this.t+d-b);c.clamp(),c.drShiftTo(1,c)}function Pa(a){this.r2=e(),this.q3=e(),d.ONE.dlShiftTo(2*a.t,this.r2),this.mu=this.r2.divide(a),this.m=a}function Qa(a){if(a.s<0||a.t>2*this.m.t)return a.mod(this.m);if(a.compareTo(this.m)<0)return a;var b=e();return a.copyTo(b),this.reduce(b),b}function Ra(a){return a}function Sa(a){for(a.drShiftTo(this.m.t-1,this.r2),a.t>this.m.t+1&&(a.t=this.m.t+1,a.clamp()),this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3),this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);a.compareTo(this.r2)<0;)a.dAddOffset(1,this.m.t+1);for(a.subTo(this.r2,a);a.compareTo(this.m)>=0;)a.subTo(this.m,a)}function Ta(a,b){a.squareTo(b),this.reduce(b)}function Ua(a,b,c){a.multiplyTo(b,c),this.reduce(c)}function Va(a,b){var c,d,f=a.bitLength(),g=k(1);if(0>=f)return g;c=18>f?1:48>f?3:144>f?4:768>f?5:6,d=8>f?new C(b):b.isEven()?new Pa(b):new J(b);var h=new Array,i=3,j=c-1,l=(1<<c)-1;if(h[1]=d.convert(this),c>1){var m=e();for(d.sqrTo(h[1],m);l>=i;)h[i]=e(),d.mulTo(m,h[i-2],h[i]),i+=2}var n,o,p=a.t-1,q=!0,s=e();for(f=r(a[p])-1;p>=0;){for(f>=j?n=a[p]>>f-j&l:(n=(a[p]&(1<<f+1)-1)<<j-f,p>0&&(n|=a[p-1]>>this.DB+f-j)),i=c;0==(1&n);)n>>=1,--i;if((f-=i)<0&&(f+=this.DB,--p),q)h[n].copyTo(g),q=!1;else{for(;i>1;)d.sqrTo(g,s),d.sqrTo(s,g),i-=2;i>0?d.sqrTo(g,s):(o=g,g=s,s=o),d.mulTo(s,h[n],g)}for(;p>=0&&0==(a[p]&1<<f);)d.sqrTo(g,s),o=g,g=s,s=o,--f<0&&(f=this.DB-1,--p)}return d.revert(g)}function Wa(a){var b=this.s<0?this.negate():this.clone(),c=a.s<0?a.negate():a.clone();if(b.compareTo(c)<0){var d=b;b=c,c=d}var e=b.getLowestSetBit(),f=c.getLowestSetBit();if(0>f)return b;for(f>e&&(f=e),f>0&&(b.rShiftTo(f,b),c.rShiftTo(f,c));b.signum()>0;)(e=b.getLowestSetBit())>0&&b.rShiftTo(e,b),(e=c.getLowestSetBit())>0&&c.rShiftTo(e,c),b.compareTo(c)>=0?(b.subTo(c,b),b.rShiftTo(1,b)):(c.subTo(b,c),c.rShiftTo(1,c));return f>0&&c.lShiftTo(f,c),c}function Xa(a){if(0>=a)return 0;var b=this.DV%a,c=this.s<0?a-1:0;if(this.t>0)if(0==b)c=this[0]%a;else for(var d=this.t-1;d>=0;--d)c=(b*c+this[d])%a;return c}function Ya(a){var b=a.isEven();if(this.isEven()&&b||0==a.signum())return d.ZERO;for(var c=a.clone(),e=this.clone(),f=k(1),g=k(0),h=k(0),i=k(1);0!=c.signum();){for(;c.isEven();)c.rShiftTo(1,c),b?(f.isEven()&&g.isEven()||(f.addTo(this,f),g.subTo(a,g)),f.rShiftTo(1,f)):g.isEven()||g.subTo(a,g),g.rShiftTo(1,g);for(;e.isEven();)e.rShiftTo(1,e),b?(h.isEven()&&i.isEven()||(h.addTo(this,h),i.subTo(a,i)),h.rShiftTo(1,h)):i.isEven()||i.subTo(a,i),i.rShiftTo(1,i);c.compareTo(e)>=0?(c.subTo(e,c),b&&f.subTo(h,f),g.subTo(i,g)):(e.subTo(c,e),b&&h.subTo(f,h),i.subTo(g,i))}return 0!=e.compareTo(d.ONE)?d.ZERO:i.compareTo(a)>=0?i.subtract(a):i.signum()<0?(i.addTo(a,i),i.signum()<0?i.add(a):i):i}function Za(a){var b,c=this.abs();if(1==c.t&&c[0]<=hb[hb.length-1]){for(b=0;b<hb.length;++b)if(c[0]==hb[b])return!0;return!1}if(c.isEven())return!1;for(b=1;b<hb.length;){for(var d=hb[b],e=b+1;e<hb.length&&ib>d;)d*=hb[e++];for(d=c.modInt(d);e>b;)if(d%hb[b++]==0)return!1}return c.millerRabin(a)}function r(a){var b,c=1;return 0!=(b=a>>>16)&&(a=b,c+=16),0!=(b=a>>8)&&(a=b,c+=8),0!=(b=a>>4)&&(a=b,c+=4),0!=(b=a>>2)&&(a=b,c+=2),0!=(b=a>>1)&&(a=b,c+=1),c}function $a(){var a=this.toByteArray(),b=8*(a.length-1)+r(a[0]),c="";return c+=String.fromCharCode((65280&b)>>8),c+=String.fromCharCode(255&b),c+=bb.bin2str(a)}function _a(a){var b=this.subtract(d.ONE),c=b.getLowestSetBit();if(0>=c)return!1;var f=b.shiftRight(c);a=a+1>>1,a>hb.length&&(a=hb.length);for(var g,h=e(),i=[],j=0;a>j;++j){for(;g=hb[Math.floor(Math.random()*hb.length)],-1!=i.indexOf(g););i.push(g),h.fromInt(g);var k=h.modPow(f,this);if(0!=k.compareTo(d.ONE)&&0!=k.compareTo(b)){for(var g=1;g++<c&&0!=k.compareTo(b);)if(k=k.modPowInt(2,this),0==k.compareTo(d.ONE))return!1;if(0!=k.compareTo(b))return!1}}return!0}var ab,bb=a("../../util.js");d.prototype.am=f,ab=26,d.prototype.DB=ab,d.prototype.DM=(1<<ab)-1,d.prototype.DV=1<<ab;var cb=52;d.prototype.FV=Math.pow(2,cb),d.prototype.F1=cb-ab,d.prototype.F2=2*ab-cb;var db,eb,fb="0123456789abcdefghijklmnopqrstuvwxyz",gb=new Array;for(db="0".charCodeAt(0),eb=0;9>=eb;++eb)gb[db++]=eb;for(db="a".charCodeAt(0),eb=10;36>eb;++eb)gb[db++]=eb;for(db="A".charCodeAt(0),eb=10;36>eb;++eb)gb[db++]=eb;C.prototype.convert=D,C.prototype.revert=E,C.prototype.reduce=F,C.prototype.mulTo=G,C.prototype.sqrTo=H,J.prototype.convert=K,J.prototype.revert=L,J.prototype.reduce=M,J.prototype.mulTo=O,J.prototype.sqrTo=N,d.prototype.copyTo=i,d.prototype.fromInt=j,d.prototype.fromString=l,d.prototype.clamp=m,d.prototype.dlShiftTo=t,d.prototype.drShiftTo=u,d.prototype.lShiftTo=v,d.prototype.rShiftTo=w,d.prototype.subTo=x,d.prototype.multiplyTo=y,d.prototype.squareTo=z,d.prototype.divRemTo=A,d.prototype.invDigit=I,d.prototype.isEven=P,d.prototype.exp=Q,d.prototype.toString=n,d.prototype.negate=o,d.prototype.abs=p,d.prototype.compareTo=q,d.prototype.bitLength=s,d.prototype.mod=B,d.prototype.modPowInt=R,d.ZERO=k(0),d.ONE=k(1),d.TWO=k(2),b.exports=d,Ia.prototype.convert=Ja,Ia.prototype.revert=Ja,Ia.prototype.mulTo=Ka,Ia.prototype.sqrTo=La,Pa.prototype.convert=Qa,Pa.prototype.revert=Ra,Pa.prototype.reduce=Sa,Pa.prototype.mulTo=Ua,Pa.prototype.sqrTo=Ta;var hb=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997],ib=(1<<26)/hb[hb.length-1],d=a("./jsbn.js");d.prototype.chunkSize=W,d.prototype.toRadix=Y,d.prototype.fromRadix=Z,d.prototype.fromNumber=$,d.prototype.bitwiseTo=da,d.prototype.changeBit=ua,d.prototype.addTo=ya,d.prototype.dMultiply=Ga,d.prototype.dAddOffset=Ha,d.prototype.multiplyLowerTo=Na,d.prototype.multiplyUpperTo=Oa,d.prototype.modInt=Xa,d.prototype.millerRabin=_a,d.prototype.clone=S,d.prototype.intValue=T,d.prototype.byteValue=U,d.prototype.shortValue=V,d.prototype.signum=X,d.prototype.toByteArray=_,d.prototype.equals=aa,d.prototype.min=ba,d.prototype.max=ca,d.prototype.and=fa,d.prototype.or=ha,
d.prototype.xor=ja,d.prototype.andNot=la,d.prototype.not=ma,d.prototype.shiftLeft=na,d.prototype.shiftRight=oa,d.prototype.getLowestSetBit=qa,d.prototype.bitCount=sa,d.prototype.testBit=ta,d.prototype.setBit=va,d.prototype.clearBit=wa,d.prototype.flipBit=xa,d.prototype.add=za,d.prototype.subtract=Aa,d.prototype.multiply=Ba,d.prototype.divide=Da,d.prototype.remainder=Ea,d.prototype.divideAndRemainder=Fa,d.prototype.modPow=Va,d.prototype.modInverse=Ya,d.prototype.pow=Ma,d.prototype.gcd=Wa,d.prototype.isProbablePrime=Za,d.prototype.toMPI=$a,d.prototype.square=Ca},{"../../util.js":74,"./jsbn.js":37}],38:[function(a,b,c){function d(){function a(a){for(var b=0;b<a.length;b++)a[b]=j.getSecureRandomOctet()}this.nextBytes=a}function e(a,b,c){return m=m.bitLength()===b.bitLength()?m.square().mod(b):j.getRandomBigIntegerInRange(h.TWO,b),l=m.modInverse(b).modPow(c,b),a.multiply(l).mod(b)}function f(a,b){return a.multiply(m).mod(b)}function g(){function a(a,b,c,d,g,j,l){k.rsa_blinding&&(a=e(a,b,c));var m=a.mod(g).modPow(d.mod(g.subtract(h.ONE)),g),n=a.mod(j).modPow(d.mod(j.subtract(h.ONE)),j);i.print_debug("rsa.js decrypt\nxpn:"+i.hexstrdump(m.toMPI())+"\nxqn:"+i.hexstrdump(n.toMPI()));var o=n.subtract(m);return 0===o[0]?(o=m.subtract(n),o=o.multiply(l).mod(j),o=j.subtract(o)):o=o.multiply(l).mod(j),o=o.multiply(g).add(m),k.rsa_blinding&&(o=f(o,b)),o}function b(a,b,c){return a.modPowInt(b,c)}function c(a,b,c){return a.modPow(b,c)}function g(a,b,c){return a.modPowInt(b,c)}function j(){this.n=null,this.e=0,this.ee=null,this.d=null,this.p=null,this.q=null,this.dmp1=null,this.dmq1=null,this.u=null}function l(a,b){function c(a){var b=g.exportKey("jwk",a.privateKey);return b instanceof Promise||(b=f(b,"Error exporting RSA key pair.")),b}function e(a){function c(a){var b=a.replace(/\-/g,"+").replace(/_/g,"/"),c=i.hexstrdump(atob(b));return new h(c,16)}var d=new j;return d.n=c(a.n),d.ee=new h(b,16),d.d=c(a.d),d.p=c(a.p),d.q=c(a.q),d.u=d.p.modInverse(d.q),d}function f(a,b){return new Promise(function(c,d){a.onerror=function(a){d(new Error(b))},a.oncomplete=function(a){c(a.target.result)}})}var g=i.getWebCrypto();if(g){var k,l,m=new Uint32Array([parseInt(b,16)]),n=new Uint8Array(m.buffer);return window.crypto&&window.crypto.webkitSubtle?(k={name:"RSA-OAEP",modulusLength:a,publicExponent:n.subarray(0,3)},l=g.generateKey(k,!0,["encrypt","decrypt"])):(k={name:"RSASSA-PKCS1-v1_5",modulusLength:a,publicExponent:n.subarray(0,3),hash:{name:"SHA-1"}},l=g.generateKey(k,!0,["sign","verify"]),l instanceof Promise||(l=f(l,"Error generating RSA key pair."))),l.then(c).then(function(a){return e(a instanceof ArrayBuffer?JSON.parse(String.fromCharCode.apply(null,new Uint8Array(a))):a)})}return new Promise(function(c){var e=new j,f=new d,g=a>>1;for(e.e=parseInt(b,16),e.ee=new h(b,16);;){for(;e.p=new h(a-g,1,f),0!==e.p.subtract(h.ONE).gcd(e.ee).compareTo(h.ONE)||!e.p.isProbablePrime(10););for(;e.q=new h(g,1,f),0!==e.q.subtract(h.ONE).gcd(e.ee).compareTo(h.ONE)||!e.q.isProbablePrime(10););if(e.p.compareTo(e.q)<=0){var i=e.p;e.p=e.q,e.q=i}var k=e.p.subtract(h.ONE),l=e.q.subtract(h.ONE),m=k.multiply(l);if(0===m.gcd(e.ee).compareTo(h.ONE)){e.n=e.p.multiply(e.q),e.d=e.ee.modInverse(m),e.dmp1=e.d.mod(k),e.dmq1=e.d.mod(l),e.u=e.p.modInverse(e.q);break}}c(e)})}this.encrypt=b,this.decrypt=a,this.verify=g,this.sign=c,this.generate=l,this.keyObject=j}var h=a("./jsbn.js"),i=a("../../util.js"),j=a("../random.js"),k=a("../../config"),l=h.ZERO,m=h.ZERO;b.exports=g},{"../../config":17,"../../util.js":74,"../random.js":39,"./jsbn.js":37}],39:[function(a,b,c){function d(){this.buffer=null,this.size=null}var e=a("../type/mpi.js"),f=null;"undefined"==typeof window&&(f=a("crypto")),b.exports={getRandomBytes:function(a){for(var b="",c=0;a>c;c++)b+=String.fromCharCode(this.getSecureRandomOctet());return b},getSecureRandom:function(a,b){for(var c=this.getSecureRandomUint(),d=(b-a).toString(2).length;(c&Math.pow(2,d)-1)>b-a;)c=this.getSecureRandomUint();return a+Math.abs(c&Math.pow(2,d)-1)},getSecureRandomOctet:function(){var a=new Uint8Array(1);return this.getRandomValues(a),a[0]},getSecureRandomUint:function(){var a=new Uint8Array(4),b=new DataView(a.buffer);return this.getRandomValues(a),b.getUint32(0)},getRandomValues:function(a){if(!(a instanceof Uint8Array))throw new Error("Invalid type: buf not an Uint8Array");if("undefined"!=typeof window&&window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(a);else if("undefined"!=typeof window&&"object"==typeof window.msCrypto&&"function"==typeof window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(a);else if(f){var b=f.randomBytes(a.length);a.set(b)}else{if(!this.randomBuffer.buffer)throw new Error("No secure random number generator available.");this.randomBuffer.get(a)}},getRandomBigInteger:function(a){if(1>a)throw new Error("Illegal parameter value: bits < 1");var b=Math.floor((a+7)/8),c=this.getRandomBytes(b);a%8>0&&(c=String.fromCharCode(Math.pow(2,a%8)-1&c.charCodeAt(0))+c.substring(1));var d=new e;return d.fromBytes(c),d.toBigInteger()},getRandomBigIntegerInRange:function(a,b){if(b.compareTo(a)<=0)throw new Error("Illegal parameter value: max <= min");for(var c=b.subtract(a),d=this.getRandomBigInteger(c.bitLength());d.compareTo(c)>0;)d=this.getRandomBigInteger(c.bitLength());return a.add(d)},randomBuffer:new d},d.prototype.init=function(a){this.buffer=new Uint8Array(a),this.size=0},d.prototype.set=function(a){if(!this.buffer)throw new Error("RandomBuffer is not initialized");if(!(a instanceof Uint8Array))throw new Error("Invalid type: buf not an Uint8Array");var b=this.buffer.length-this.size;a.length>b&&(a=a.subarray(0,b)),this.buffer.set(a,this.size),this.size+=a.length},d.prototype.get=function(a){if(!this.buffer)throw new Error("RandomBuffer is not initialized");if(!(a instanceof Uint8Array))throw new Error("Invalid type: buf not an Uint8Array");if(this.size<a.length)throw new Error("Random number buffer depleted");for(var b=0;b<a.length;b++)a[b]=this.buffer[--this.size],this.buffer[this.size]=0}},{"../type/mpi.js":72,crypto:!1}],40:[function(a,b,c){var d=a("./public_key"),e=a("./pkcs1.js");a("./hash");b.exports={verify:function(a,b,c,f,g){switch(a){case 1:case 2:case 3:var h=new d.rsa,i=f[0].toBigInteger(),j=f[0].byteLength(),k=f[1].toBigInteger(),l=c[0].toBigInteger(),m=h.verify(l,k,i),n=e.emsa.encode(b,g,j);return 0===m.compareTo(n);case 16:throw new Error("signing with Elgamal is not defined in the OpenPGP standard.");case 17:var o=new d.dsa,p=c[0].toBigInteger(),q=c[1].toBigInteger(),r=f[0].toBigInteger(),s=f[1].toBigInteger(),t=f[2].toBigInteger(),u=f[3].toBigInteger(),l=g,v=o.verify(b,p,q,l,r,s,t,u);return 0===v.compareTo(p);default:throw new Error("Invalid signature algorithm.")}},sign:function(a,b,c,f){var g;switch(b){case 1:case 2:case 3:var h=new d.rsa,i=c[2].toBigInteger(),j=c[0].toBigInteger();return g=e.emsa.encode(a,f,c[0].byteLength()),h.sign(g,i,j).toMPI();case 17:var k=new d.dsa,l=c[0].toBigInteger(),m=c[1].toBigInteger(),n=c[2].toBigInteger(),o=(c[3].toBigInteger(),c[4].toBigInteger());g=f;var p=k.sign(a,g,n,l,m,o);return p[0].toString()+p[1].toString();case 16:throw new Error("Signing with Elgamal is not defined in the OpenPGP standard.");default:throw new Error("Invalid signature algorithm.")}}}},{"./hash":28,"./pkcs1.js":33,"./public_key":36}],41:[function(a,b,c){function d(a){var b=/^-----BEGIN PGP (MESSAGE, PART \d+\/\d+|MESSAGE, PART \d+|SIGNED MESSAGE|MESSAGE|PUBLIC KEY BLOCK|PRIVATE KEY BLOCK|SIGNATURE)-----$\n/m,c=a.match(b);if(!c)throw new Error("Unknown ASCII armor type");return c[1].match(/MESSAGE, PART \d+\/\d+/)?o.armor.multipart_section:c[1].match(/MESSAGE, PART \d+/)?o.armor.multipart_last:c[1].match(/SIGNED MESSAGE/)?o.armor.signed:c[1].match(/MESSAGE/)?o.armor.message:c[1].match(/PUBLIC KEY BLOCK/)?o.armor.public_key:c[1].match(/PRIVATE KEY BLOCK/)?o.armor.private_key:void 0}function e(){var a="";return p.show_version&&(a+="Version: "+p.versionstring+"\r\n"),p.show_comment&&(a+="Comment: "+p.commentstring+"\r\n"),a+="\r\n"}function f(a){var b=h(a),c=""+String.fromCharCode(b>>16)+String.fromCharCode(b>>8&255)+String.fromCharCode(255&b);return n.encode(c)}function g(a,b){var c=f(a),d=b;return c[0]==d[0]&&c[1]==d[1]&&c[2]==d[2]&&c[3]==d[3]}function h(a){for(var b=11994318,c=0;a.length-c>16;)b=b<<8^q[255&(b>>16^a.charCodeAt(c))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+1))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+2))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+3))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+4))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+5))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+6))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+7))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+8))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+9))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+10))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+11))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+12))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+13))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+14))],b=b<<8^q[255&(b>>16^a.charCodeAt(c+15))],c+=16;for(var d=c;d<a.length;d++)b=b<<8^q[255&(b>>16^a.charCodeAt(c++))];return 16777215&b}function i(a){var b=/^[ \f\r\t\u00a0\u2000-\u200a\u202f\u205f\u3000]*\n/m,c="",d=a,e=b.exec(a);if(null===e)throw new Error("Mandatory blank line missing between armor headers and armor data");return c=a.slice(0,e.index),d=a.slice(e.index+e[0].length),c=c.split("\n"),c.pop(),{headers:c,body:d}}function j(a){for(var b=0;b<a.length;b++)if(!a[b].match(/^(Version|Comment|MessageID|Hash|Charset): .+$/))throw new Error("Improperly formatted armor header: "+a[b])}function k(a){var b=/^=/m,c=a,d="",e=b.exec(a);return null!==e&&(c=a.slice(0,e.index),d=a.slice(e.index+1)),{body:c,checksum:d}}function l(a){var b=/^-----[^-]+-----$\n/m;a=a.replace(/[\t\r ]+\n/g,"\n");var c,e,h,l=d(a),m=a.split(b),o=1;if(a.search(b)!=m[0].length&&(o=0),2!=l){h=i(m[o]);var p=k(h.body);c={data:n.decode(p.body),headers:h.headers,type:l},e=p.checksum}else{h=i(m[o].replace(/^- /gm,""));var q=i(m[o+1].replace(/^- /gm,""));j(q.headers);var r=k(q.body);c={text:h.body.replace(/\n$/,"").replace(/\n/g,"\r\n"),data:n.decode(r.body),headers:h.headers,type:l},e=r.checksum}if(e=e.substr(0,4),!g(c.data,e))throw new Error("Ascii armor integrity check on message failed: '"+e+"' should be '"+f(c.data)+"'");return j(c.headers),c}function m(a,b,c,d){var g=[];switch(a){case o.armor.multipart_section:g.push("-----BEGIN PGP MESSAGE, PART "+c+"/"+d+"-----\r\n"),g.push(e()),g.push(n.encode(b)),g.push("\r\n="+f(b)+"\r\n"),g.push("-----END PGP MESSAGE, PART "+c+"/"+d+"-----\r\n");break;case o.armor.multipart_last:g.push("-----BEGIN PGP MESSAGE, PART "+c+"-----\r\n"),g.push(e()),g.push(n.encode(b)),g.push("\r\n="+f(b)+"\r\n"),g.push("-----END PGP MESSAGE, PART "+c+"-----\r\n");break;case o.armor.signed:g.push("\r\n-----BEGIN PGP SIGNED MESSAGE-----\r\n"),g.push("Hash: "+b.hash+"\r\n\r\n"),g.push(b.text.replace(/\n-/g,"\n- -")),g.push("\r\n-----BEGIN PGP SIGNATURE-----\r\n"),g.push(e()),g.push(n.encode(b.data)),g.push("\r\n="+f(b.data)+"\r\n"),g.push("-----END PGP SIGNATURE-----\r\n");break;case o.armor.message:g.push("-----BEGIN PGP MESSAGE-----\r\n"),g.push(e()),g.push(n.encode(b)),g.push("\r\n="+f(b)+"\r\n"),g.push("-----END PGP MESSAGE-----\r\n");break;case o.armor.public_key:g.push("-----BEGIN PGP PUBLIC KEY BLOCK-----\r\n"),g.push(e()),g.push(n.encode(b)),g.push("\r\n="+f(b)+"\r\n"),g.push("-----END PGP PUBLIC KEY BLOCK-----\r\n\r\n");break;case o.armor.private_key:g.push("-----BEGIN PGP PRIVATE KEY BLOCK-----\r\n"),g.push(e()),g.push(n.encode(b)),g.push("\r\n="+f(b)+"\r\n"),g.push("-----END PGP PRIVATE KEY BLOCK-----\r\n")}return g.join("")}var n=a("./base64.js"),o=a("../enums.js"),p=a("../config"),q=[0,8801531,25875725,17603062,60024545,51751450,35206124,44007191,128024889,120049090,103502900,112007375,70412248,78916387,95990485,88014382,264588937,256049778,240098180,248108927,207005800,215016595,232553829,224014750,140824496,149062475,166599357,157832774,200747345,191980970,176028764,184266919,520933865,529177874,512099556,503334943,480196360,471432179,487973381,496217854,414011600,405478443,422020573,430033190,457094705,465107658,448029500,439496647,281648992,273666971,289622637,298124950,324696449,333198714,315665548,307683447,392699481,401494690,383961940,375687087,352057528,343782467,359738805,368533838,1041867730,1050668841,1066628831,1058355748,1032471859,1024199112,1006669886,1015471301,968368875,960392720,942864358,951368477,975946762,984451313,1000411399,992435708,836562267,828023200,810956886,818967725,844041146,852051777,868605623,860066380,914189410,922427545,938981743,930215316,904825475,896059e3,878993294,887231349,555053627,563297984,547333942,538569677,579245274,570480673,588005847,596249900,649392898,640860153,658384399,666397428,623318499,631331096,615366894,606833685,785398962,777416777,794487231,802989380,759421523,767923880,751374174,743392165,695319947,704115056,687564934,679289981,719477610,711202705,728272487,737067676,2083735460,2092239711,2109313705,2101337682,2141233477,2133257662,2116711496,2125215923,2073216669,2064943718,2048398224,2057199467,2013339772,2022141063,2039215473,2030942602,1945504045,1936737750,1920785440,1929023707,1885728716,1893966647,1911503553,1902736954,1951893524,1959904495,1977441561,1968902626,2009362165,2000822798,1984871416,1992881923,1665111629,1673124534,1656046400,1647513531,1621913772,1613380695,1629922721,1637935450,1688082292,1679317903,1695859321,1704103554,1728967061,1737211246,1720132760,1711368291,1828378820,1820103743,1836060105,1844855090,1869168165,1877963486,1860430632,1852155859,1801148925,1809650950,1792118e3,1784135691,1757986588,1750004711,1765960209,1774462698,1110107254,1118611597,1134571899,1126595968,1102643863,1094667884,1077139354,1085643617,1166763343,1158490548,1140961346,1149762745,1176011694,1184812885,1200772771,1192499800,1307552511,1298785796,1281720306,1289958153,1316768798,1325007077,1341561107,1332794856,1246636998,1254647613,1271201483,1262662192,1239272743,1230733788,1213667370,1221678289,1562785183,1570797924,1554833554,1546300521,1588974462,1580441477,1597965939,1605978760,1518843046,1510078557,1527603627,1535847760,1494504007,1502748348,1486784330,1478020017,1390639894,1382365165,1399434779,1408230112,1366334967,1375129868,1358579962,1350304769,1430452783,1438955220,1422405410,1414423513,1456544974,1448562741,1465633219,1474135352];b.exports={encode:m,decode:l}},{"../config":17,"../enums.js":43,"./base64.js":42}],42:[function(a,b,c){function d(a,b){var c,d,e,g=b?b:[],h=0,i=0,j=a.length;for(e=0;j>e;e++)d=a.charCodeAt(e),0===i?(g.push(f.charAt(d>>2&63)),c=(3&d)<<4):1==i?(g.push(f.charAt(c|d>>4&15)),c=(15&d)<<2):2==i&&(g.push(f.charAt(c|d>>6&3)),h+=1,h%60===0&&g.push("\n"),g.push(f.charAt(63&d))),h+=1,h%60===0&&g.push("\n"),i+=1,3==i&&(i=0);return i>0&&(g.push(f.charAt(c)),h+=1,h%60===0&&g.push("\n"),g.push("="),h+=1),1==i&&(h%60===0&&g.push("\n"),g.push("=")),b?void 0:g.join("")}function e(a){var b,c,d=[],e=0,g=0,h=a.length;for(c=0;h>c;c++)b=f.indexOf(a.charAt(c)),b>=0&&(e&&d.push(String.fromCharCode(g|b>>6-e&255)),e=e+2&7,g=b<<e&255);return d.join("")}var f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";b.exports={encode:d,decode:e}},{}],43:[function(a,b,c){"use strict";b.exports={s2k:{simple:0,salted:1,iterated:3,gnu:101},publicKey:{rsa_encrypt_sign:1,rsa_encrypt:2,rsa_sign:3,elgamal:16,dsa:17},symmetric:{plaintext:0,idea:1,tripledes:2,cast5:3,blowfish:4,aes128:7,aes192:8,aes256:9,twofish:10},compression:{uncompressed:0,zip:1,zlib:2,bzip2:3},hash:{md5:1,sha1:2,ripemd:3,sha256:8,sha384:9,sha512:10,sha224:11},packet:{publicKeyEncryptedSessionKey:1,signature:2,symEncryptedSessionKey:3,onePassSignature:4,secretKey:5,publicKey:6,secretSubkey:7,compressed:8,symmetricallyEncrypted:9,marker:10,literal:11,trust:12,userid:13,publicSubkey:14,userAttribute:17,symEncryptedIntegrityProtected:18,modificationDetectionCode:19},literal:{binary:"b".charCodeAt(),text:"t".charCodeAt(),utf8:"u".charCodeAt()},signature:{binary:0,text:1,standalone:2,cert_generic:16,cert_persona:17,cert_casual:18,cert_positive:19,cert_revocation:48,subkey_binding:24,key_binding:25,key:31,key_revocation:32,subkey_revocation:40,timestamp:64,third_party:80},signatureSubpacket:{signature_creation_time:2,signature_expiration_time:3,exportable_certification:4,trust_signature:5,regular_expression:6,revocable:7,key_expiration_time:9,placeholder_backwards_compatibility:10,preferred_symmetric_algorithms:11,revocation_key:12,issuer:16,notation_data:20,preferred_hash_algorithms:21,preferred_compression_algorithms:22,key_server_preferences:23,preferred_key_server:24,primary_user_id:25,policy_uri:26,key_flags:27,signers_user_id:28,reason_for_revocation:29,features:30,signature_target:31,embedded_signature:32},keyFlags:{certify_keys:1,sign_data:2,encrypt_communication:4,encrypt_storage:8,split_private_key:16,authentication:32,shared_private_key:128},keyStatus:{invalid:0,expired:1,revoked:2,valid:3,no_self_cert:4},armor:{multipart_section:0,multipart_last:1,signed:2,message:3,public_key:4,private_key:5},write:function(a,b){if("number"==typeof b&&(b=this.read(a,b)),void 0!==a[b])return a[b];throw new Error("Invalid enum value.")},read:function(a,b){for(var c in a)if(a[c]==b)return c;throw new Error("Invalid enum value.")}}},{}],44:[function(a,b,c){"use strict";b.exports=a("./openpgp.js"),b.exports.key=a("./key.js"),b.exports.message=a("./message.js"),b.exports.cleartext=a("./cleartext.js"),b.exports.util=a("./util.js"),b.exports.packet=a("./packet"),b.exports.MPI=a("./type/mpi.js"),b.exports.S2K=a("./type/s2k.js"),b.exports.Keyid=a("./type/keyid.js"),b.exports.armor=a("./encoding/armor.js"),b.exports.enums=a("./enums.js"),b.exports.config=a("./config/config.js"),b.exports.crypto=a("./crypto"),b.exports.Keyring=a("./keyring"),b.exports.AsyncProxy=a("./worker/async_proxy.js")},{"./cleartext.js":12,"./config/config.js":16,"./crypto":32,"./encoding/armor.js":41,"./enums.js":43,"./key.js":45,"./keyring":46,"./message.js":49,"./openpgp.js":50,"./packet":53,"./type/keyid.js":71,"./type/mpi.js":72,"./type/s2k.js":73,"./util.js":74,"./worker/async_proxy.js":75}],45:[function(a,b,c){"use strict";function d(a){if(!(this instanceof d))return new d(a);if(this.primaryKey=null,this.revocationSignature=null,this.directSignatures=null,this.users=null,this.subKeys=null,this.packetlist2structure(a),!this.primaryKey||!this.users)throw new Error("Invalid key: need at least key and user ID packet")}function e(a,b){return a.algorithm!==o.read(o.publicKey,o.publicKey.dsa)&&a.algorithm!==o.read(o.publicKey,o.publicKey.rsa_sign)&&(!b.keyFlags||0!==(b.keyFlags[0]&o.keyFlags.encrypt_communication)||0!==(b.keyFlags[0]&o.keyFlags.encrypt_storage))}function f(a,b){return!(a.algorithm!=o.read(o.publicKey,o.publicKey.dsa)&&a.algorithm!=o.read(o.publicKey,o.publicKey.rsa_sign)&&a.algorithm!=o.read(o.publicKey,o.publicKey.rsa_encrypt_sign)||b.keyFlags&&0===(b.keyFlags[0]&o.keyFlags.sign_data))}function g(a,b){return 3==a.version&&0!==a.expirationTimeV3?new Date(a.created.getTime()+24*a.expirationTimeV3*3600*1e3):4==a.version&&b.keyNeverExpires===!1?new Date(a.created.getTime()+1e3*b.keyExpirationTime):null}function h(a,b,c,d){a=a[c],a&&(b[c]?a.forEach(function(a){a.isExpired()||d&&!d(a)||b[c].some(function(b){return b.signature===a.signature})||b[c].push(a)}):b[c]=a)}function i(a){return this instanceof i?(this.userId=a.tag==o.packet.userid?a:null,this.userAttribute=a.tag==o.packet.userAttribute?a:null,this.selfCertifications=null,this.otherCertifications=null,void(this.revocationCertifications=null)):new i(a)}function j(a){return this instanceof j?(this.subKey=a,this.bindingSignature=null,void(this.revocationSignature=null)):new j(a)}function k(a){var b={};b.keys=[];try{var c=p.decode(a);if(c.type!=o.armor.public_key&&c.type!=o.armor.private_key)throw new Error("Armored text not of type key");var e=new n.List;e.read(c.data);var f=e.indexOfTag(o.packet.publicKey,o.packet.secretKey);if(0===f.length)throw new Error("No key packet found in armored text");for(var g=0;g<f.length;g++){var h=e.slice(f[g],f[g+1]);try{var i=new d(h);b.keys.push(i)}catch(j){b.err=b.err||[],b.err.push(j)}}}catch(j){b.err=b.err||[],b.err.push(j)}return b}function l(a){function b(){return g=new n.SecretKey,g.algorithm=o.read(o.publicKey,a.keyType),g.generate(a.numBits)}function c(){return k=new n.SecretSubkey,k.algorithm=o.read(o.publicKey,a.keyType),k.generate(a.numBits)}function e(){return a.passphrase&&(g.encrypt(a.passphrase),k.encrypt(a.passphrase)),f=new n.List,h=new n.Userid,h.read(a.userId),i={},i.userid=h,i.key=g,j=new n.Signature,j.signatureType=o.signature.cert_generic,j.publicKeyAlgorithm=a.keyType,j.hashAlgorithm=q.prefer_hash_algorithm,j.keyFlags=[o.keyFlags.certify_keys|o.keyFlags.sign_data],j.preferredSymmetricAlgorithms=[],j.preferredSymmetricAlgorithms.push(o.symmetric.aes256),j.preferredSymmetricAlgorithms.push(o.symmetric.aes192),j.preferredSymmetricAlgorithms.push(o.symmetric.aes128),j.preferredSymmetricAlgorithms.push(o.symmetric.cast5),j.preferredSymmetricAlgorithms.push(o.symmetric.tripledes),j.preferredHashAlgorithms=[],j.preferredHashAlgorithms.push(o.hash.sha256),j.preferredHashAlgorithms.push(o.hash.sha1),j.preferredHashAlgorithms.push(o.hash.sha512),j.preferredCompressionAlgorithms=[],j.preferredCompressionAlgorithms.push(o.compression.zlib),j.preferredCompressionAlgorithms.push(o.compression.zip),q.integrity_protect&&(j.features=[],j.features.push(1)),j.sign(g,i),i={},i.key=g,i.bind=k,l=new n.Signature,l.signatureType=o.signature.subkey_binding,l.publicKeyAlgorithm=a.keyType,l.hashAlgorithm=q.prefer_hash_algorithm,l.keyFlags=[o.keyFlags.encrypt_communication|o.keyFlags.encrypt_storage],l.sign(g,i),f.push(g),f.push(h),f.push(j),f.push(k),f.push(l),a.unlocked||(g.clearPrivateMPIs(),k.clearPrivateMPIs()),new d(f)}var f,g,h,i,j,k,l;if(a.keyType=a.keyType||o.publicKey.rsa_encrypt_sign,a.keyType!==o.publicKey.rsa_encrypt_sign)throw new Error("Only RSA Encrypt or Sign supported");a.passphrase||(a.unlocked=!0);var m=b(),p=c();return Promise.all([m,p]).then(e)}function m(a){for(var b={},c=0;c<a.length;c++){var d=a[c].getPrimaryUser();if(!d||!d.selfCertificate.preferredSymmetricAlgorithms)return q.encryption_cipher;d.selfCertificate.preferredSymmetricAlgorithms.forEach(function(a,c){var d=b[a]||(b[a]={prio:0,count:0,algo:a});d.prio+=64>>c,d.count++})}var e={prio:0,algo:q.encryption_cipher};for(var f in b)try{f!==o.symmetric.plaintext&&f!==o.symmetric.idea&&o.read(o.symmetric,f)&&b[f].count===a.length&&b[f].prio>e.prio&&(e=b[f])}catch(g){}return e.algo}var n=a("./packet"),o=a("./enums.js"),p=a("./encoding/armor.js"),q=a("./config"),r=a("./util");d.prototype.packetlist2structure=function(a){for(var b,c,d,e=0;e<a.length;e++)switch(a[e].tag){case o.packet.publicKey:case o.packet.secretKey:this.primaryKey=a[e],c=this.primaryKey.getKeyId();break;case o.packet.userid:case o.packet.userAttribute:b=new i(a[e]),this.users||(this.users=[]),this.users.push(b);break;case o.packet.publicSubkey:case o.packet.secretSubkey:b=null,this.subKeys||(this.subKeys=[]),d=new j(a[e]),this.subKeys.push(d);break;case o.packet.signature:switch(a[e].signatureType){case o.signature.cert_generic:case o.signature.cert_persona:case o.signature.cert_casual:case o.signature.cert_positive:if(!b){r.print_debug("Dropping certification signatures without preceding user packet");continue}a[e].issuerKeyId.equals(c)?(b.selfCertifications||(b.selfCertifications=[]),b.selfCertifications.push(a[e])):(b.otherCertifications||(b.otherCertifications=[]),b.otherCertifications.push(a[e]));break;case o.signature.cert_revocation:b?(b.revocationCertifications||(b.revocationCertifications=[]),b.revocationCertifications.push(a[e])):(this.directSignatures||(this.directSignatures=[]),this.directSignatures.push(a[e]));break;case o.signature.key:this.directSignatures||(this.directSignatures=[]),this.directSignatures.push(a[e]);break;case o.signature.subkey_binding:if(!d){r.print_debug("Dropping subkey binding signature without preceding subkey packet");continue}d.bindingSignature=a[e];break;case o.signature.key_revocation:this.revocationSignature=a[e];break;case o.signature.subkey_revocation:if(!d){r.print_debug("Dropping subkey revocation signature without preceding subkey packet");continue}d.revocationSignature=a[e]}}},d.prototype.toPacketlist=function(){var a=new n.List;a.push(this.primaryKey),a.push(this.revocationSignature),a.concat(this.directSignatures);var b;for(b=0;b<this.users.length;b++)a.concat(this.users[b].toPacketlist());if(this.subKeys)for(b=0;b<this.subKeys.length;b++)a.concat(this.subKeys[b].toPacketlist());return a},d.prototype.getSubkeyPackets=function(){var a=[];if(this.subKeys)for(var b=0;b<this.subKeys.length;b++)a.push(this.subKeys[b].subKey);return a},d.prototype.getAllKeyPackets=function(){return[this.primaryKey].concat(this.getSubkeyPackets())},d.prototype.getKeyIds=function(){for(var a=[],b=this.getAllKeyPackets(),c=0;c<b.length;c++)a.push(b[c].getKeyId());return a},d.prototype.getKeyPacket=function(a){for(var b=this.getAllKeyPackets(),c=0;c<b.length;c++)for(var d=b[c].getKeyId(),e=0;e<a.length;e++)if(d.equals(a[e]))return b[c];return null},d.prototype.getUserIds=function(){for(var a=[],b=0;b<this.users.length;b++)this.users[b].userId&&a.push(this.users[b].userId.write());return a},d.prototype.isPublic=function(){return this.primaryKey.tag==o.packet.publicKey},d.prototype.isPrivate=function(){return this.primaryKey.tag==o.packet.secretKey},d.prototype.toPublic=function(){for(var a,b=new n.List,c=this.toPacketlist(),e=0;e<c.length;e++)switch(c[e].tag){case o.packet.secretKey:a=c[e].writePublicKey();var f=new n.PublicKey;f.read(a),b.push(f);break;case o.packet.secretSubkey:a=c[e].writePublicKey();var g=new n.PublicSubkey;g.read(a),b.push(g);break;default:b.push(c[e])}return new d(b)},d.prototype.armor=function(){var a=this.isPublic()?o.armor.public_key:o.armor.private_key;return p.encode(a,this.toPacketlist().write())},d.prototype.getSigningKeyPacket=function(a){var b=this.getPrimaryUser();if(b&&f(this.primaryKey,b.selfCertificate)&&(!a||this.primaryKey.getKeyId().equals(a)))return this.primaryKey;if(this.subKeys)for(var c=0;c<this.subKeys.length;c++)if(this.subKeys[c].isValidSigningKey(this.primaryKey)&&(!a||this.subKeys[c].subKey.getKeyId().equals(a)))return this.subKeys[c].subKey;return null},d.prototype.getPreferredHashAlgorithm=function(){var a=this.getPrimaryUser();return a&&a.selfCertificate.preferredHashAlgorithms?a.selfCertificate.preferredHashAlgorithms[0]:q.prefer_hash_algorithm},d.prototype.getEncryptionKeyPacket=function(){if(this.subKeys)for(var a=0;a<this.subKeys.length;a++)if(this.subKeys[a].isValidEncryptionKey(this.primaryKey))return this.subKeys[a].subKey;var b=this.getPrimaryUser();return b&&e(this.primaryKey,b.selfCertificate)?this.primaryKey:null},d.prototype.decrypt=function(a){if(!this.isPrivate())throw new Error("Nothing to decrypt in a public key");for(var b=this.getAllKeyPackets(),c=0;c<b.length;c++){var d=b[c].decrypt(a);if(!d)return!1}return!0},d.prototype.decryptKeyPacket=function(a,b){if(!this.isPrivate())throw new Error("Nothing to decrypt in a public key");for(var c=this.getAllKeyPackets(),d=0;d<c.length;d++)for(var e=c[d].getKeyId(),f=0;f<a.length;f++)if(e.equals(a[f])){var g=c[d].decrypt(b);if(!g)return!1}return!0},d.prototype.verifyPrimaryKey=function(){if(this.revocationSignature&&!this.revocationSignature.isExpired()&&(this.revocationSignature.verified||this.revocationSignature.verify(this.primaryKey,{key:this.primaryKey})))return o.keyStatus.revoked;if(3==this.primaryKey.version&&0!==this.primaryKey.expirationTimeV3&&Date.now()>this.primaryKey.created.getTime()+24*this.primaryKey.expirationTimeV3*3600*1e3)return o.keyStatus.expired;for(var a=!1,b=0;b<this.users.length;b++)this.users[b].userId&&this.users[b].selfCertifications&&(a=!0);if(!a)return o.keyStatus.no_self_cert;var c=this.getPrimaryUser();return c?4==this.primaryKey.version&&c.selfCertificate.keyNeverExpires===!1&&Date.now()>this.primaryKey.created.getTime()+1e3*c.selfCertificate.keyExpirationTime?o.keyStatus.expired:o.keyStatus.valid:o.keyStatus.invalid},d.prototype.getExpirationTime=function(){if(3==this.primaryKey.version)return g(this.primaryKey);if(4==this.primaryKey.version){var a=this.getPrimaryUser();return a?g(this.primaryKey,a.selfCertificate):null}},d.prototype.getPrimaryUser=function(){for(var a=[],b=0;b<this.users.length;b++)if(this.users[b].userId&&this.users[b].selfCertifications)for(var c=0;c<this.users[b].selfCertifications.length;c++)a.push({user:this.users[b],selfCertificate:this.users[b].selfCertifications[c]});a=a.sort(function(a,b){return a.selfCertificate.isPrimaryUserID>b.selfCertificate.isPrimaryUserID?-1:a.selfCertificate.isPrimaryUserID<b.selfCertificate.isPrimaryUserID?1:a.selfCertificate.created>b.selfCertificate.created?-1:a.selfCertificate.created<b.selfCertificate.created?1:0});for(var b=0;b<a.length;b++)if(a[b].user.isValidSelfCertificate(this.primaryKey,a[b].selfCertificate))return a[b];return null},d.prototype.update=function(a){var b=this;if(a.verifyPrimaryKey()!==o.keyStatus.invalid){if(this.primaryKey.getFingerprint()!==a.primaryKey.getFingerprint())throw new Error("Key update method: fingerprints of keys not equal");if(this.isPublic()&&a.isPrivate()){var c=(this.subKeys&&this.subKeys.length)===(a.subKeys&&a.subKeys.length)&&(!this.subKeys||this.subKeys.every(function(b){return a.subKeys.some(function(a){return b.subKey.getFingerprint()===a.subKey.getFingerprint()})}));if(!c)throw new Error("Cannot update public key with private key if subkey mismatch");this.primaryKey=a.primaryKey}this.revocationSignature||!a.revocationSignature||a.revocationSignature.isExpired()||!a.revocationSignature.verified&&!a.revocationSignature.verify(a.primaryKey,{key:a.primaryKey})||(this.revocationSignature=a.revocationSignature),h(a,this,"directSignatures"),a.users.forEach(function(a){for(var c=!1,d=0;d<b.users.length;d++)if(a.userId&&a.userId.userid===b.users[d].userId.userid||a.userAttribute&&a.userAttribute.equals(b.users[d].userAttribute)){b.users[d].update(a,b.primaryKey),c=!0;break}c||b.users.push(a)}),a.subKeys&&a.subKeys.forEach(function(a){for(var c=!1,d=0;d<b.subKeys.length;d++)if(a.subKey.getFingerprint()===b.subKeys[d].subKey.getFingerprint()){b.subKeys[d].update(a,b.primaryKey),c=!0;break}c||b.subKeys.push(a)})}},d.prototype.revoke=function(){},i.prototype.toPacketlist=function(){var a=new n.List;return a.push(this.userId||this.userAttribute),a.concat(this.revocationCertifications),a.concat(this.selfCertifications),a.concat(this.otherCertifications),a},i.prototype.isRevoked=function(a,b){if(this.revocationCertifications){var c=this;return this.revocationCertifications.some(function(d){return d.issuerKeyId.equals(a.issuerKeyId)&&!d.isExpired()&&(d.verified||d.verify(b,{userid:c.userId||c.userAttribute,key:b}))})}return!1},i.prototype.getValidSelfCertificate=function(a){if(!this.selfCertifications)return null;for(var b=this.selfCertifications.sort(function(a,b){return a=a.created,b=b.created,a>b?-1:b>a?1:0}),c=0;c<b.length;c++)if(this.isValidSelfCertificate(a,b[c]))return b[c];return null},i.prototype.isValidSelfCertificate=function(a,b){return this.isRevoked(b,a)?!1:b.isExpired()||!b.verified&&!b.verify(a,{userid:this.userId||this.userAttribute,key:a})?!1:!0},i.prototype.verify=function(a){if(!this.selfCertifications)return o.keyStatus.no_self_cert;for(var b,c=0;c<this.selfCertifications.length;c++)if(this.isRevoked(this.selfCertifications[c],a))b=o.keyStatus.revoked;else if(this.selfCertifications[c].verified||this.selfCertifications[c].verify(a,{userid:this.userId||this.userAttribute,key:a})){if(!this.selfCertifications[c].isExpired()){b=o.keyStatus.valid;break}b=o.keyStatus.expired}else b=o.keyStatus.invalid;return b},i.prototype.update=function(a,b){var c=this;h(a,this,"selfCertifications",function(a){return a.verified||a.verify(b,{userid:c.userId||c.userAttribute,key:b})}),h(a,this,"otherCertifications"),h(a,this,"revocationCertifications")},j.prototype.toPacketlist=function(){
var a=new n.List;return a.push(this.subKey),a.push(this.revocationSignature),a.push(this.bindingSignature),a},j.prototype.isValidEncryptionKey=function(a){return this.verify(a)==o.keyStatus.valid&&e(this.subKey,this.bindingSignature)},j.prototype.isValidSigningKey=function(a){return this.verify(a)==o.keyStatus.valid&&f(this.subKey,this.bindingSignature)},j.prototype.verify=function(a){return this.revocationSignature&&!this.revocationSignature.isExpired()&&(this.revocationSignature.verified||this.revocationSignature.verify(a,{key:a,bind:this.subKey}))?o.keyStatus.revoked:3==this.subKey.version&&0!==this.subKey.expirationTimeV3&&Date.now()>this.subKey.created.getTime()+24*this.subKey.expirationTimeV3*3600*1e3?o.keyStatus.expired:this.bindingSignature?this.bindingSignature.isExpired()?o.keyStatus.expired:this.bindingSignature.verified||this.bindingSignature.verify(a,{key:a,bind:this.subKey})?4==this.subKey.version&&this.bindingSignature.keyNeverExpires===!1&&Date.now()>this.subKey.created.getTime()+1e3*this.bindingSignature.keyExpirationTime?o.keyStatus.expired:o.keyStatus.valid:o.keyStatus.invalid:o.keyStatus.invalid},j.prototype.getExpirationTime=function(){return g(this.subKey,this.bindingSignature)},j.prototype.update=function(a,b){if(a.verify(b)!==o.keyStatus.invalid){if(this.subKey.getFingerprint()!==a.subKey.getFingerprint())throw new Error("SubKey update method: fingerprints of subkeys not equal");this.subKey.tag===o.packet.publicSubkey&&a.subKey.tag===o.packet.secretSubkey&&(this.subKey=a.subKey),!this.bindingSignature&&a.bindingSignature&&(a.bindingSignature.verified||a.bindingSignature.verify(b,{key:b,bind:this.subKey}))&&(this.bindingSignature=a.bindingSignature),this.revocationSignature||!a.revocationSignature||a.revocationSignature.isExpired()||!a.revocationSignature.verified&&!a.revocationSignature.verify(b,{key:b,bind:this.subKey})||(this.revocationSignature=a.revocationSignature)}},c.Key=d,c.readArmored=k,c.generate=l,c.getPreferredSymAlgo=m},{"./config":17,"./encoding/armor.js":41,"./enums.js":43,"./packet":53,"./util":74}],46:[function(a,b,c){b.exports=a("./keyring.js"),b.exports.localstore=a("./localstore.js")},{"./keyring.js":47,"./localstore.js":48}],47:[function(a,b,c){function d(b){this.storeHandler=b||new(a("./localstore.js")),this.publicKeys=new e(this.storeHandler.loadPublic()),this.privateKeys=new e(this.storeHandler.loadPrivate())}function e(a){this.keys=a}function f(a,b){a=a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");for(var c=new RegExp("<"+a+">"),d=b.getUserIds(),e=0;e<d.length;e++)if(c.test(d[e].toLowerCase()))return!0;return!1}function g(a,b){return 16===a.length?a===b.getKeyId().toHex():a===b.getFingerprint()}var h=(a("../enums.js"),a("../key.js"));a("../util.js");b.exports=d,d.prototype.store=function(){this.storeHandler.storePublic(this.publicKeys.keys),this.storeHandler.storePrivate(this.privateKeys.keys)},d.prototype.clear=function(){this.publicKeys.keys=[],this.privateKeys.keys=[]},d.prototype.getKeysForId=function(a,b){var c=[];return c=c.concat(this.publicKeys.getForId(a,b)||[]),c=c.concat(this.privateKeys.getForId(a,b)||[]),c.length?c:null},d.prototype.removeKeysForId=function(a){var b=[];return b=b.concat(this.publicKeys.removeForId(a)||[]),b=b.concat(this.privateKeys.removeForId(a)||[]),b.length?b:null},d.prototype.getAllKeys=function(){return this.publicKeys.keys.concat(this.privateKeys.keys)},e.prototype.getForAddress=function(a){for(var b=[],c=0;c<this.keys.length;c++)f(a,this.keys[c])&&b.push(this.keys[c]);return b},e.prototype.getForId=function(a,b){for(var c=0;c<this.keys.length;c++){if(g(a,this.keys[c].primaryKey))return this.keys[c];if(b&&this.keys[c].subKeys)for(var d=0;d<this.keys[c].subKeys.length;d++)if(g(a,this.keys[c].subKeys[d].subKey))return this.keys[c]}return null},e.prototype.importKey=function(a){var b=h.readArmored(a),c=this;return b.keys.forEach(function(a){var b=a.primaryKey.getKeyId().toHex(),d=c.getForId(b);d?d.update(a):c.push(a)}),b.err?b.err:null},e.prototype.push=function(a){return this.keys.push(a)},e.prototype.removeForId=function(a){for(var b=0;b<this.keys.length;b++)if(g(a,this.keys[b].primaryKey))return this.keys.splice(b,1)[0];return null}},{"../enums.js":43,"../key.js":45,"../util.js":74,"./localstore.js":48}],48:[function(a,b,c){function d(b){b=b||"openpgp-",this.publicKeysItem=b+this.publicKeysItem,this.privateKeysItem=b+this.privateKeysItem,"undefined"!=typeof window&&window.localStorage?this.storage=window.localStorage:this.storage=new(a("node-localstorage").LocalStorage)(g.node_store)}function e(a,b){var c=JSON.parse(a.getItem(b)),d=[];if(null!==c&&0!==c.length)for(var e,f=0;f<c.length;f++)e=h.readArmored(c[f]),e.err?i.print_debug("Error reading armored key from keyring index: "+f):d.push(e.keys[0]);return d}function f(a,b,c){for(var d=[],e=0;e<c.length;e++)d.push(c[e].armor());a.setItem(b,JSON.stringify(d))}b.exports=d;var g=a("../config"),h=a("../key.js"),i=a("../util.js");d.prototype.publicKeysItem="public-keys",d.prototype.privateKeysItem="private-keys",d.prototype.loadPublic=function(){return e(this.storage,this.publicKeysItem)},d.prototype.loadPrivate=function(){return e(this.storage,this.privateKeysItem)},d.prototype.storePublic=function(a){f(this.storage,this.publicKeysItem,a)},d.prototype.storePrivate=function(a){f(this.storage,this.privateKeysItem,a)}},{"../config":17,"../key.js":45,"../util.js":74,"node-localstorage":!1}],49:[function(a,b,c){"use strict";function d(a){return this instanceof d?void(this.packets=a||new i.List):new d(a)}function e(a){var b=k.decode(a).data,c=new i.List;c.read(b);var e=new d(c);return e}function f(a,b){var c=new i.Literal;c.setBytes(a,j.read(j.literal,j.literal.binary));var e=new i.List;e.push(c);var f=k.decode(b).data;e.read(f);var g=new d(e);return g}function g(a){var b=new i.Literal;b.setText(a);var c=new i.List;c.push(b);var e=new d(c);return e}function h(a){var b=new i.Literal;b.setBytes(a,j.read(j.literal,j.literal.binary));var c=new i.List;c.push(b);var e=new d(c);return e}var i=a("./packet"),j=a("./enums.js"),k=a("./encoding/armor.js"),l=a("./config"),m=a("./crypto"),n=a("./key.js");d.prototype.getEncryptionKeyIds=function(){var a=[],b=this.packets.filterByTag(j.packet.publicKeyEncryptedSessionKey);return b.forEach(function(b){a.push(b.publicKeyId)}),a},d.prototype.getSigningKeyIds=function(){var a=[],b=this.unwrapCompressed(),c=b.packets.filterByTag(j.packet.onePassSignature);if(c.forEach(function(b){a.push(b.signingKeyId)}),!a.length){var d=b.packets.filterByTag(j.packet.signature);d.forEach(function(b){a.push(b.issuerKeyId)})}return a},d.prototype.decrypt=function(a){var b=this.getEncryptionKeyIds();if(!b.length)return this;var c=a.getKeyPacket(b);if(!c.isDecrypted)throw new Error("Private key is not decrypted.");for(var e,f=this.packets.filterByTag(j.packet.publicKeyEncryptedSessionKey),g=0;g<f.length;g++)if(f[g].publicKeyId.equals(c.getKeyId())){e=f[g],e.decrypt(c);break}if(e){var h=this.packets.filterByTag(j.packet.symmetricallyEncrypted,j.packet.symEncryptedIntegrityProtected);if(0!==h.length){var k=h[0];k.decrypt(e.sessionKeyAlgorithm,e.sessionKey);var l=new d(k.packets);return k.packets=new i.List,l}}},d.prototype.getLiteralData=function(){var a=this.packets.findPacket(j.packet.literal);return a&&a.data||null},d.prototype.getText=function(){var a=this.packets.findPacket(j.packet.literal);return a?a.getText():null},d.prototype.encrypt=function(a){var b=new i.List,c=n.getPreferredSymAlgo(a),e=m.generateSessionKey(j.read(j.symmetric,c));a.forEach(function(a){var d=a.getEncryptionKeyPacket();if(!d)throw new Error("Could not find valid key packet for encryption in key "+a.primaryKey.getKeyId().toHex());var f=new i.PublicKeyEncryptedSessionKey;f.publicKeyId=d.getKeyId(),f.publicKeyAlgorithm=d.algorithm,f.sessionKey=e,f.sessionKeyAlgorithm=j.read(j.symmetric,c),f.encrypt(d),b.push(f)});var f;return f=l.integrity_protect?new i.SymEncryptedIntegrityProtected:new i.SymmetricallyEncrypted,f.packets=this.packets,f.encrypt(j.read(j.symmetric,c),e),b.push(f),f.packets=new i.List,new d(b)},d.prototype.symEncrypt=function(a){if(!a)throw new Error("The passphrase cannot be empty!");var b=j.read(j.symmetric,l.encryption_cipher),c=new i.List,e=new i.SymEncryptedSessionKey;e.sessionKeyAlgorithm=b,e.decrypt(a),c.push(e);var f=new i.SymEncryptedIntegrityProtected;return f.packets=this.packets,f.encrypt(b,e.sessionKey),c.push(f),f.packets=new i.List,new d(c)},d.prototype.symDecrypt=function(a){var b=this.packets.filterByTag(j.packet.symEncryptedSessionKey,j.packet.symEncryptedIntegrityProtected),c=b[0];c.decrypt(a);var e=b[1];e.decrypt(c.sessionKeyAlgorithm,c.sessionKey);var f=new d(e.packets);return e.packets=new i.List,f},d.prototype.sign=function(a){var b=new i.List,c=this.packets.findPacket(j.packet.literal);if(!c)throw new Error("No literal data packet to sign.");var e,f=j.write(j.literal,c.format),g=f==j.literal.binary?j.signature.binary:j.signature.text;for(e=0;e<a.length;e++){if(a[e].isPublic())throw new Error("Need private key for signing");var h=new i.OnePassSignature;h.type=g,h.hashAlgorithm=l.prefer_hash_algorithm;var k=a[e].getSigningKeyPacket();if(!k)throw new Error("Could not find valid key packet for signing in key "+a[e].primaryKey.getKeyId().toHex());h.publicKeyAlgorithm=k.algorithm,h.signingKeyId=k.getKeyId(),b.push(h)}for(b.push(c),e=a.length-1;e>=0;e--){var m=new i.Signature;if(m.signatureType=g,m.hashAlgorithm=l.prefer_hash_algorithm,m.publicKeyAlgorithm=k.algorithm,!k.isDecrypted)throw new Error("Private key is not decrypted.");m.sign(k,c),b.push(m)}return new d(b)},d.prototype.verify=function(a){var b=[],c=this.unwrapCompressed(),d=c.packets.filterByTag(j.packet.literal);if(1!==d.length)throw new Error("Can only verify message with one literal data packet.");for(var e=c.packets.filterByTag(j.packet.signature),f=0;f<e.length;f++){for(var g=null,h=0;h<a.length&&!(g=a[h].getSigningKeyPacket(e[f].issuerKeyId));h++);var i={};g?(i.keyid=e[f].issuerKeyId,i.valid=e[f].verify(g,d[0])):(i.keyid=e[f].issuerKeyId,i.valid=null),b.push(i)}return b},d.prototype.unwrapCompressed=function(){var a=this.packets.filterByTag(j.packet.compressed);return a.length?new d(a[0].packets):this},d.prototype.armor=function(){return k.encode(j.armor.message,this.packets.write())},c.Message=d,c.readArmored=e,c.readSignedContent=f,c.fromText=g,c.fromBinary=h},{"./config":17,"./crypto":32,"./encoding/armor.js":41,"./enums.js":43,"./key.js":45,"./packet":53}],50:[function(a,b,c){"use strict";function d(a,b){return b&&b.worker||"undefined"!=typeof window&&window.Worker?(b=b||{},b.config=this.config,v=new u(a,b),!0):!1}function e(){return v}function f(a,b){return a.length||(a=[a]),v?v.encryptMessage(a,b):m(function(){var c,d;return c=q.fromText(b),c=c.encrypt(a),d=o.encode(p.armor.message,c.packets.write())},"Error encrypting message!")}function g(a,b,c){return a.length||(a=[a]),v?v.signAndEncryptMessage(a,b,c):m(function(){var d,e;return d=q.fromText(c),d=d.sign([b]),d=d.encrypt(a),e=o.encode(p.armor.message,d.packets.write())},"Error signing and encrypting message!")}function h(a,b){return v?v.decryptMessage(a,b):m(function(){return b=b.decrypt(a),b.getText()},"Error decrypting message!")}function i(a,b,c){return b.length||(b=[b]),v?v.decryptAndVerifyMessage(a,b,c):m(function(){var d={};return c=c.decrypt(a),d.text=c.getText(),d.text?(d.signatures=c.verify(b),d):null},"Error decrypting and verifying message!")}function j(a,b){return a.length||(a=[a]),v?v.signClearMessage(a,b):m(function(){var c=new r.CleartextMessage(b);return c.sign(a),c.armor()},"Error signing cleartext message!")}function k(a,b){return a.length||(a=[a]),v?v.verifyClearSignedMessage(a,b):m(function(){var c={};if(!(b instanceof r.CleartextMessage))throw new Error("Parameter [message] needs to be of type CleartextMessage.");return c.text=b.getText(),c.signatures=b.verify(a),c},"Error verifying cleartext signed message!")}function l(a){return!t.getWebCrypto()&&v?v.generateKeyPair(a):s.generate(a).then(function(a){var b={};return b.key=a,b.privateKeyArmored=a.armor(),b.publicKeyArmored=a.toPublic().armor(),b})["catch"](function(b){if(console.error(b),!t.getWebCrypto())throw new Error("Error generating keypair using js fallback!");return console.log("Error generating keypair using native WebCrypto... falling back back to js!"),v.generateKeyPair(a)})["catch"](n.bind(null,"Error generating keypair!"))}function m(a,b){var c=new Promise(function(b){var c=a();b(c)});return c["catch"](n.bind(null,b))}function n(a,b){throw console.error(b.stack),new Error(a)}var o=a("./encoding/armor.js"),p=a("./enums.js"),q=a("./message.js"),r=a("./cleartext.js"),s=a("./key.js"),t=a("./util"),u=a("./worker/async_proxy.js");"undefined"==typeof Promise&&a("es6-promise").polyfill();var v=null;c.initWorker=d,c.getWorker=e,c.encryptMessage=f,c.signAndEncryptMessage=g,c.decryptMessage=h,c.decryptAndVerifyMessage=i,c.signClearMessage=j,c.verifyClearSignedMessage=k,c.generateKeyPair=l},{"./cleartext.js":12,"./encoding/armor.js":41,"./enums.js":43,"./key.js":45,"./message.js":49,"./util":74,"./worker/async_proxy.js":75,"es6-promise":2}],51:[function(a,b,c){function d(a){return a.substr(0,1).toUpperCase()+a.substr(1)}var e=a("../enums.js");b.exports={Compressed:a("./compressed.js"),SymEncryptedIntegrityProtected:a("./sym_encrypted_integrity_protected.js"),PublicKeyEncryptedSessionKey:a("./public_key_encrypted_session_key.js"),SymEncryptedSessionKey:a("./sym_encrypted_session_key.js"),Literal:a("./literal.js"),PublicKey:a("./public_key.js"),SymmetricallyEncrypted:a("./symmetrically_encrypted.js"),Marker:a("./marker.js"),PublicSubkey:a("./public_subkey.js"),UserAttribute:a("./user_attribute.js"),OnePassSignature:a("./one_pass_signature.js"),SecretKey:a("./secret_key.js"),Userid:a("./userid.js"),SecretSubkey:a("./secret_subkey.js"),Signature:a("./signature.js"),Trust:a("./trust.js"),newPacketFromTag:function(a){return new(this[d(a)])},fromStructuredClone:function(a){var b=e.read(e.packet,a.tag),c=this.newPacketFromTag(b);for(var d in a)a.hasOwnProperty(d)&&(c[d]=a[d]);return c.postCloneTypeFix&&c.postCloneTypeFix(),c}}},{"../enums.js":43,"./compressed.js":52,"./literal.js":54,"./marker.js":55,"./one_pass_signature.js":56,"./public_key.js":59,"./public_key_encrypted_session_key.js":60,"./public_subkey.js":61,"./secret_key.js":62,"./secret_subkey.js":63,"./signature.js":64,"./sym_encrypted_integrity_protected.js":65,"./sym_encrypted_session_key.js":66,"./symmetrically_encrypted.js":67,"./trust.js":68,"./user_attribute.js":69,"./userid.js":70}],52:[function(a,b,c){function d(){this.tag=e.packet.compressed,this.packets=null,this.algorithm="zip",this.compressed=null}b.exports=d;var e=a("../enums.js"),f=a("../util.js"),g=a("../compression/zlib.min.js"),h=a("../compression/rawinflate.min.js"),i=a("../compression/rawdeflate.min.js");d.prototype.read=function(a){this.algorithm=e.read(e.compression,a.charCodeAt(0)),this.compressed=a.substr(1),this.decompress()},d.prototype.write=function(){return null===this.compressed&&this.compress(),String.fromCharCode(e.write(e.compression,this.algorithm))+this.compressed},d.prototype.decompress=function(){var a;switch(this.algorithm){case"uncompressed":a=this.compressed;break;case"zip":var b=new h.Zlib.RawInflate(f.str2Uint8Array(this.compressed));a=f.Uint8Array2str(b.decompress());break;case"zlib":var b=new g.Zlib.Inflate(f.str2Uint8Array(this.compressed));a=f.Uint8Array2str(b.decompress());break;case"bzip2":throw new Error("Compression algorithm BZip2 [BZ2] is not implemented.");default:throw new Error("Compression algorithm unknown :"+this.alogrithm)}this.packets.read(a)},d.prototype.compress=function(){var a,b;switch(a=this.packets.write(),this.algorithm){case"uncompressed":this.compressed=a;break;case"zip":b=new i.Zlib.RawDeflate(f.str2Uint8Array(a)),this.compressed=f.Uint8Array2str(b.compress());break;case"zlib":b=new g.Zlib.Deflate(f.str2Uint8Array(a)),this.compressed=f.Uint8Array2str(b.compress());break;case"bzip2":throw new Error("Compression algorithm BZip2 [BZ2] is not implemented.");default:throw new Error("Compression algorithm unknown :"+this.type)}}},{"../compression/rawdeflate.min.js":13,"../compression/rawinflate.min.js":14,"../compression/zlib.min.js":15,"../enums.js":43,"../util.js":74}],53:[function(a,b,c){a("../enums.js");b.exports={List:a("./packetlist.js")};var d=a("./all_packets.js");for(var e in d)b.exports[e]=d[e]},{"../enums.js":43,"./all_packets.js":51,"./packetlist.js":58}],54:[function(a,b,c){function d(){this.tag=f.packet.literal,this.format="utf8",this.data="",this.date=new Date,this.filename="msg.txt"}b.exports=d;var e=a("../util.js"),f=a("../enums.js");d.prototype.setText=function(a){a=a.replace(/\r/g,"").replace(/\n/g,"\r\n"),this.data="utf8"==this.format?e.encode_utf8(a):a},d.prototype.getText=function(){var a=e.decode_utf8(this.data);return a.replace(/\r\n/g,"\n")},d.prototype.setBytes=function(a,b){this.format=b,this.data=a},d.prototype.getBytes=function(){return this.data},d.prototype.setFilename=function(a){this.filename=a},d.prototype.getFilename=function(){return this.filename},d.prototype.read=function(a){var b=f.read(f.literal,a.charCodeAt(0)),c=a.charCodeAt(1);this.filename=e.decode_utf8(a.substr(2,c)),this.date=e.readDate(a.substr(2+c,4));var d=a.substring(6+c);this.setBytes(d,b)},d.prototype.write=function(){var a=e.encode_utf8(this.filename),b=this.getBytes(),c="";return c+=String.fromCharCode(f.write(f.literal,this.format)),c+=String.fromCharCode(a.length),c+=a,c+=e.writeDate(this.date),c+=b}},{"../enums.js":43,"../util.js":74}],55:[function(a,b,c){function d(){this.tag=e.packet.marker}b.exports=d;var e=a("../enums.js");d.prototype.read=function(a){return 80==a.charCodeAt(0)&&71==a.charCodeAt(1)&&80==a.charCodeAt(2)?!0:!1}},{"../enums.js":43}],56:[function(a,b,c){function d(){this.tag=e.packet.onePassSignature,this.version=null,this.type=null,this.hashAlgorithm=null,this.publicKeyAlgorithm=null,this.signingKeyId=null,this.flags=null}b.exports=d;var e=a("../enums.js"),f=a("../type/keyid.js");d.prototype.read=function(a){var b=0;return this.version=a.charCodeAt(b++),this.type=e.read(e.signature,a.charCodeAt(b++)),this.hashAlgorithm=e.read(e.hash,a.charCodeAt(b++)),this.publicKeyAlgorithm=e.read(e.publicKey,a.charCodeAt(b++)),this.signingKeyId=new f,this.signingKeyId.read(a.substr(b)),b+=8,this.flags=a.charCodeAt(b++),this},d.prototype.write=function(){var a="";return a+=String.fromCharCode(3),a+=String.fromCharCode(e.write(e.signature,this.type)),a+=String.fromCharCode(e.write(e.hash,this.hashAlgorithm)),a+=String.fromCharCode(e.write(e.publicKey,this.publicKeyAlgorithm)),a+=this.signingKeyId.write(),a+=String.fromCharCode(this.flags)},d.prototype.postCloneTypeFix=function(){this.signingKeyId=f.fromClone(this.signingKeyId)}},{"../enums.js":43,"../type/keyid.js":71}],57:[function(a,b,c){var d=(a("../enums.js"),a("../util.js"));b.exports={readSimpleLength:function(a){var b,c=0,e=a.charCodeAt(0);return 192>e?(c=a.charCodeAt(0),b=1):255>e?(c=(a.charCodeAt(0)-192<<8)+a.charCodeAt(1)+192,b=2):255==e&&(c=d.readNumber(a.substr(1,4)),b=5),{len:c,offset:b}},writeSimpleLength:function(a){var b="";return 192>a?b+=String.fromCharCode(a):a>191&&8384>a?(b+=String.fromCharCode((a-192>>8)+192),b+=String.fromCharCode(a-192&255)):(b+=String.fromCharCode(255),b+=d.writeNumber(a,4)),b},writeHeader:function(a,b){var c="";return c+=String.fromCharCode(192|a),c+=this.writeSimpleLength(b)},writeOldHeader:function(a,b){var c="";return 256>b?(c+=String.fromCharCode(128|a<<2),c+=String.fromCharCode(b)):65536>b?(c+=String.fromCharCode(128|a<<2|1),c+=d.writeNumber(b,2)):(c+=String.fromCharCode(128|a<<2|2),c+=d.writeNumber(b,4)),c},read:function(a,b,c){if(null===a||a.length<=b||a.substring(b).length<2||0===(128&a.charCodeAt(b)))throw new Error("Error during parsing. This message / key is probably not containing a valid OpenPGP format.");var e,f=b,g=-1,h=-1;h=0,0!==(64&a.charCodeAt(f))&&(h=1);var i;h?g=63&a.charCodeAt(f):(g=(63&a.charCodeAt(f))>>2,i=3&a.charCodeAt(f)),f++;var j=null,k=-1;if(h)if(a.charCodeAt(f)<192)e=a.charCodeAt(f++),d.print_debug("1 byte length:"+e);else if(a.charCodeAt(f)>=192&&a.charCodeAt(f)<224)e=(a.charCodeAt(f++)-192<<8)+a.charCodeAt(f++)+192,d.print_debug("2 byte length:"+e);else if(a.charCodeAt(f)>223&&a.charCodeAt(f)<255){e=1<<(31&a.charCodeAt(f++)),d.print_debug("4 byte length:"+e);var l=f+e;j=a.substring(f,f+e);for(var m;;){if(a.charCodeAt(l)<192){m=a.charCodeAt(l++),e+=m,j+=a.substring(l,l+m),l+=m;break}if(a.charCodeAt(l)>=192&&a.charCodeAt(l)<224){m=(a.charCodeAt(l++)-192<<8)+a.charCodeAt(l++)+192,e+=m,j+=a.substring(l,l+m),l+=m;break}if(!(a.charCodeAt(l)>223&&a.charCodeAt(l)<255)){l++,m=a.charCodeAt(l++)<<24|a.charCodeAt(l++)<<16|a.charCodeAt(l++)<<8|a.charCodeAt(l++),j+=a.substring(l,l+m),e+=m,l+=m;break}m=1<<(31&a.charCodeAt(l++)),e+=m,j+=a.substring(l,l+m),l+=m}k=l-f}else f++,e=a.charCodeAt(f++)<<24|a.charCodeAt(f++)<<16|a.charCodeAt(f++)<<8|a.charCodeAt(f++);else switch(i){case 0:e=a.charCodeAt(f++);break;case 1:e=a.charCodeAt(f++)<<8|a.charCodeAt(f++);break;case 2:e=a.charCodeAt(f++)<<24|a.charCodeAt(f++)<<16|a.charCodeAt(f++)<<8|a.charCodeAt(f++);break;default:e=c}return-1==k&&(k=e),null===j&&(j=a.substring(f,f+k)),{tag:g,packet:j,offset:f+k}}}},{"../enums.js":43,"../util.js":74}],58:[function(a,b,c){function d(){this.length=0}b.exports=d;var e=a("./packet.js"),f=a("./all_packets.js"),g=a("../enums.js");d.prototype.read=function(a){for(var b=0;b<a.length;){var c=e.read(a,b,a.length-b);b=c.offset;var d=g.read(g.packet,c.tag),h=f.newPacketFromTag(d);this.push(h),h.read(c.packet)}},d.prototype.write=function(){for(var a="",b=0;b<this.length;b++){var c=this[b].write();a+=e.writeHeader(this[b].tag,c.length),a+=c}return a},d.prototype.push=function(a){a&&(a.packets=a.packets||new d,this[this.length]=a,this.length++)},d.prototype.filter=function(a){for(var b=new d,c=0;c<this.length;c++)a(this[c],c,this)&&b.push(this[c]);return b},d.prototype.filterByTag=function(){for(var a=Array.prototype.slice.call(arguments),b=new d,c=this,e=0;e<this.length;e++)a.some(function(a){return c[e].tag==a})&&b.push(this[e]);return b},d.prototype.forEach=function(a){for(var b=0;b<this.length;b++)a(this[b])},d.prototype.findPacket=function(a){var b=this.filterByTag(a);if(b.length)return b[0];for(var c=null,d=0;d<this.length;d++)if(this[d].packets.length&&(c=this[d].packets.findPacket(a)))return c;return null},d.prototype.indexOfTag=function(){for(var a=Array.prototype.slice.call(arguments),b=[],c=this,d=0;d<this.length;d++)a.some(function(a){return c[d].tag==a})&&b.push(d);return b},d.prototype.slice=function(a,b){b||(b=this.length);for(var c=new d,e=a;b>e;e++)c.push(this[e]);return c},d.prototype.concat=function(a){if(a)for(var b=0;b<a.length;b++)this.push(a[b])},b.exports.fromStructuredClone=function(a){for(var b=new d,c=0;c<a.length;c++)b.push(f.fromStructuredClone(a[c])),0!==b[c].packets.length?b[c].packets=this.fromStructuredClone(b[c].packets):b[c].packets=new d;return b}},{"../enums.js":43,"./all_packets.js":51,"./packet.js":57}],59:[function(a,b,c){function d(){this.tag=h.packet.publicKey,this.version=4,this.created=new Date,this.mpi=[],this.algorithm="rsa_sign",this.expirationTimeV3=0,this.fingerprint=null,this.keyid=null}b.exports=d;var e=a("../util.js"),f=a("../type/mpi.js"),g=a("../type/keyid.js"),h=a("../enums.js"),i=a("../crypto");d.prototype.read=function(a){var b=0;if(this.version=a.charCodeAt(b++),3==this.version||4==this.version){this.created=e.readDate(a.substr(b,4)),b+=4,3==this.version&&(this.expirationTimeV3=e.readNumber(a.substr(b,2)),b+=2),this.algorithm=h.read(h.publicKey,a.charCodeAt(b++));var c=i.getPublicMpiCount(this.algorithm);this.mpi=[];for(var d=a.substr(b),g=0,j=0;c>j&&g<d.length;j++)if(this.mpi[j]=new f,g+=this.mpi[j].read(d.substr(g)),g>d.length)throw new Error("Error reading MPI @:"+g);return g+6}throw new Error("Version "+this.version+" of the key packet is unsupported.")},d.prototype.readPublicKey=d.prototype.read,d.prototype.write=function(){var a=String.fromCharCode(this.version);a+=e.writeDate(this.created),3==this.version&&(a+=e.writeNumber(this.expirationTimeV3,2)),a+=String.fromCharCode(h.write(h.publicKey,this.algorithm));for(var b=i.getPublicMpiCount(this.algorithm),c=0;b>c;c++)a+=this.mpi[c].write();return a},d.prototype.writePublicKey=d.prototype.write,d.prototype.writeOld=function(){var a=this.writePublicKey();return String.fromCharCode(153)+e.writeNumber(a.length,2)+a},d.prototype.getKeyId=function(){return this.keyid?this.keyid:(this.keyid=new g,4==this.version?this.keyid.read(e.hex2bin(this.getFingerprint()).substr(12,8)):3==this.version&&this.keyid.read(this.mpi[0].write().substr(-8)),this.keyid)},d.prototype.getFingerprint=function(){if(this.fingerprint)return this.fingerprint;var a="";if(4==this.version)a=this.writeOld(),this.fingerprint=i.hash.sha1(a);else if(3==this.version){for(var b=i.getPublicMpiCount(this.algorithm),c=0;b>c;c++)a+=this.mpi[c].toBytes();this.fingerprint=i.hash.md5(a)}return this.fingerprint=e.hexstrdump(this.fingerprint),this.fingerprint},d.prototype.getBitSize=function(){return 8*this.mpi[0].byteLength()},d.prototype.postCloneTypeFix=function(){for(var a=0;a<this.mpi.length;a++)this.mpi[a]=f.fromClone(this.mpi[a]);this.keyid&&(this.keyid=g.fromClone(this.keyid))}},{"../crypto":32,"../enums.js":43,"../type/keyid.js":71,"../type/mpi.js":72,"../util.js":74}],60:[function(a,b,c){function d(){this.tag=h.packet.publicKeyEncryptedSessionKey,this.version=3,this.publicKeyId=new e,this.publicKeyAlgorithm="rsa_encrypt",this.sessionKey=null,this.sessionKeyAlgorithm="aes256",this.encrypted=[]}b.exports=d;var e=a("../type/keyid.js"),f=a("../util.js"),g=a("../type/mpi.js"),h=a("../enums.js"),i=a("../crypto");d.prototype.read=function(a){this.version=a.charCodeAt(0),this.publicKeyId.read(a.substr(1)),this.publicKeyAlgorithm=h.read(h.publicKey,a.charCodeAt(9));var b=10,c=function(a){switch(a){case"rsa_encrypt":case"rsa_encrypt_sign":return 1;case"elgamal":return 2;default:throw new Error("Invalid algorithm.")}}(this.publicKeyAlgorithm);this.encrypted=[];for(var d=0;c>d;d++){var e=new g;b+=e.read(a.substr(b)),this.encrypted.push(e)}},d.prototype.write=function(){var a=String.fromCharCode(this.version);a+=this.publicKeyId.write(),a+=String.fromCharCode(h.write(h.publicKey,this.publicKeyAlgorithm));for(var b=0;b<this.encrypted.length;b++)a+=this.encrypted[b].write();return a},d.prototype.encrypt=function(a){var b=String.fromCharCode(h.write(h.symmetric,this.sessionKeyAlgorithm));b+=this.sessionKey;var c=f.calc_checksum(this.sessionKey);b+=f.writeNumber(c,2);var d=new g;d.fromBytes(i.pkcs1.eme.encode(b,a.mpi[0].byteLength())),this.encrypted=i.publicKeyEncrypt(this.publicKeyAlgorithm,a.mpi,d)},d.prototype.decrypt=function(a){var b=i.publicKeyDecrypt(this.publicKeyAlgorithm,a.mpi,this.encrypted).toBytes(),c=f.readNumber(b.substr(b.length-2)),d=i.pkcs1.eme.decode(b);if(a=d.substring(1,d.length-2),c!=f.calc_checksum(a))throw new Error("Checksum mismatch");this.sessionKey=a,this.sessionKeyAlgorithm=h.read(h.symmetric,d.charCodeAt(0))},d.prototype.postCloneTypeFix=function(){this.publicKeyId=e.fromClone(this.publicKeyId);for(var a=0;a<this.encrypted.length;a++)this.encrypted[a]=g.fromClone(this.encrypted[a])}},{"../crypto":32,"../enums.js":43,"../type/keyid.js":71,"../type/mpi.js":72,"../util.js":74}],61:[function(a,b,c){function d(){e.call(this),this.tag=f.packet.publicSubkey}b.exports=d;var e=a("./public_key.js"),f=a("../enums.js");d.prototype=new e,d.prototype.constructor=d},{"../enums.js":43,"./public_key.js":59}],62:[function(a,b,c){function d(){j.call(this),this.tag=k.packet.secretKey,this.encrypted=null,this.isDecrypted=!1}function e(a){return"sha1"==a?20:2}function f(a){return"sha1"==a?m.hash.sha1:function(a){return l.writeNumber(l.calc_checksum(a),2)}}function g(a,b,c){var d=e(a),g=f(a),h=b.substr(b.length-d);b=b.substr(0,b.length-d);var i=g(b);if(i!=h)return new Error("Hash mismatch.");for(var j=m.getPrivateMpiCount(c),k=0,l=[],o=0;j>o&&k<b.length;o++)l[o]=new n,k+=l[o].read(b.substr(k));return l}function h(a,b,c){for(var d="",e=m.getPublicMpiCount(b),g=e;g<c.length;g++)d+=c[g].write();return d+=f(a)(d)}function i(a,b,c){return a.produce_key(b,m.cipher[c].keySize)}b.exports=d;var j=a("./public_key.js"),k=a("../enums.js"),l=a("../util.js"),m=a("../crypto"),n=a("../type/mpi.js"),o=a("../type/s2k.js");d.prototype=new j,d.prototype.constructor=d,d.prototype.read=function(a){var b=this.readPublicKey(a);a=a.substr(b);var c=a.charCodeAt(0);if(c)this.encrypted=a;else{var d=g("mod",a.substr(1),this.algorithm);if(d instanceof Error)throw d;this.mpi=this.mpi.concat(d),this.isDecrypted=!0}},d.prototype.write=function(){var a=this.writePublicKey();return this.encrypted?a+=this.encrypted:(a+=String.fromCharCode(0),a+=h("mod",this.algorithm,this.mpi)),a},d.prototype.encrypt=function(a){if(this.isDecrypted&&!a)return void(this.encrypted=null);if(!a)throw new Error("The key must be decrypted before removing passphrase protection.");var b=new o,c="aes256",d=h("sha1",this.algorithm,this.mpi),e=i(b,a,c),f=m.cipher[c].blockSize,g=m.random.getRandomBytes(f);this.encrypted="",this.encrypted+=String.fromCharCode(254),this.encrypted+=String.fromCharCode(k.write(k.symmetric,c)),this.encrypted+=b.write(),this.encrypted+=g,this.encrypted+=m.cfb.normalEncrypt(c,e,d,g)},d.prototype.decrypt=function(a){if(this.isDecrypted)return!0;var b,c,d=0,e=this.encrypted.charCodeAt(d++);if(255==e||254==e){b=this.encrypted.charCodeAt(d++),b=k.read(k.symmetric,b);var f=new o;d+=f.read(this.encrypted.substr(d)),c=i(f,a,b)}else b=e,b=k.read(k.symmetric,b),c=m.hash.md5(a);var h=this.encrypted.substr(d,m.cipher[b].blockSize);d+=h.length;var j,l=this.encrypted.substr(d);j=m.cfb.normalDecrypt(b,c,l,h);var n=254==e?"sha1":"mod",p=g(n,j,this.algorithm);return p instanceof Error?!1:(this.mpi=this.mpi.concat(p),this.isDecrypted=!0,!0)},d.prototype.generate=function(a){var b=this;return m.generateMpi(b.algorithm,a).then(function(a){b.mpi=a,b.isDecrypted=!0})},d.prototype.clearPrivateMPIs=function(){if(!this.encrypted)throw new Error("If secret key is not encrypted, clearing private MPIs is irreversible.");this.mpi=this.mpi.slice(0,m.getPublicMpiCount(this.algorithm)),this.isDecrypted=!1}},{"../crypto":32,"../enums.js":43,"../type/mpi.js":72,"../type/s2k.js":73,"../util.js":74,"./public_key.js":59}],63:[function(a,b,c){function d(){e.call(this),this.tag=f.packet.secretSubkey}b.exports=d;var e=a("./secret_key.js"),f=a("../enums.js");d.prototype=new e,d.prototype.constructor=d},{"../enums.js":43,"./secret_key.js":62}],64:[function(a,b,c){function d(){this.tag=h.packet.signature,this.version=4,this.signatureType=null,this.hashAlgorithm=null,this.publicKeyAlgorithm=null,this.signatureData=null,this.unhashedSubpackets=null,this.signedHashValue=null,this.created=new Date,this.signatureExpirationTime=null,this.signatureNeverExpires=!0,this.exportable=null,this.trustLevel=null,this.trustAmount=null,this.regularExpression=null,this.revocable=null,this.keyExpirationTime=null,this.keyNeverExpires=null,this.preferredSymmetricAlgorithms=null,this.revocationKeyClass=null,this.revocationKeyAlgorithm=null,this.revocationKeyFingerprint=null,this.issuerKeyId=new k,this.notation=null,this.preferredHashAlgorithms=null,this.preferredCompressionAlgorithms=null,this.keyServerPreferences=null,this.preferredKeyServer=null,this.isPrimaryUserID=null,this.policyURI=null,this.keyFlags=null,this.signersUserId=null,this.reasonForRevocationFlag=null,this.reasonForRevocationString=null,this.features=null,this.signatureTargetPublicKeyAlgorithm=null,this.signatureTargetHashAlgorithm=null,this.signatureTargetHash=null,this.embeddedSignature=null,this.verified=!1}function e(a,b){var c="";return c+=g.writeSimpleLength(b.length+1),c+=String.fromCharCode(a),c+=b}b.exports=d;var f=a("../util.js"),g=a("./packet.js"),h=a("../enums.js"),i=a("../crypto"),j=a("../type/mpi.js"),k=a("../type/keyid.js");d.prototype.read=function(a){
function b(a){for(var b=f.readNumber(a.substr(0,2)),c=2;2+b>c;){var d=g.readSimpleLength(a.substr(c));c+=d.offset,this.read_sub_packet(a.substr(c,d.len)),c+=d.len}return c}var c=0;switch(this.version=a.charCodeAt(c++),this.version){case 3:5!=a.charCodeAt(c++)&&f.print_debug("packet/signature.js\ninvalid One-octet length of following hashed material.MUST be 5. @:"+(c-1));var d=c;this.signatureType=a.charCodeAt(c++),this.created=f.readDate(a.substr(c,4)),c+=4,this.signatureData=a.substring(d,c),this.issuerKeyId.read(a.substring(c,c+8)),c+=8,this.publicKeyAlgorithm=a.charCodeAt(c++),this.hashAlgorithm=a.charCodeAt(c++);break;case 4:this.signatureType=a.charCodeAt(c++),this.publicKeyAlgorithm=a.charCodeAt(c++),this.hashAlgorithm=a.charCodeAt(c++),c+=b.call(this,a.substr(c),!0),this.signatureData=a.substr(0,c);var e=c;c+=b.call(this,a.substr(c),!1),this.unhashedSubpackets=a.substr(e,c-e);break;default:throw new Error("Version "+this.version+" of the signature is unsupported.")}this.signedHashValue=a.substr(c,2),c+=2,this.signature=a.substr(c)},d.prototype.write=function(){var a="";switch(this.version){case 3:a+=String.fromCharCode(3),a+=String.fromCharCode(5),a+=this.signatureData,a+=this.issuerKeyId.write(),a+=String.fromCharCode(this.publicKeyAlgorithm),a+=String.fromCharCode(this.hashAlgorithm);break;case 4:a+=this.signatureData,a+=this.unhashedSubpackets?this.unhashedSubpackets:f.writeNumber(0,2)}return a+=this.signedHashValue+this.signature},d.prototype.sign=function(a,b){var c=h.write(h.signature,this.signatureType),d=h.write(h.publicKey,this.publicKeyAlgorithm),e=h.write(h.hash,this.hashAlgorithm),f=String.fromCharCode(4);f+=String.fromCharCode(c),f+=String.fromCharCode(d),f+=String.fromCharCode(e),this.issuerKeyId=a.getKeyId(),f+=this.write_all_sub_packets(),this.signatureData=f;var g=this.calculateTrailer(),j=this.toSign(c,b)+this.signatureData+g,k=i.hash.digest(e,j);this.signedHashValue=k.substr(0,2),this.signature=i.signature.sign(e,d,a.mpi,j)},d.prototype.write_all_sub_packets=function(){var a=h.signatureSubpacket,b="",c="";if(null!==this.created&&(b+=e(a.signature_creation_time,f.writeDate(this.created))),null!==this.signatureExpirationTime&&(b+=e(a.signature_expiration_time,f.writeNumber(this.signatureExpirationTime,4))),null!==this.exportable&&(b+=e(a.exportable_certification,String.fromCharCode(this.exportable?1:0))),null!==this.trustLevel&&(c=String.fromCharCode(this.trustLevel)+String.fromCharCode(this.trustAmount),b+=e(a.trust_signature,c)),null!==this.regularExpression&&(b+=e(a.regular_expression,this.regularExpression)),null!==this.revocable&&(b+=e(a.revocable,String.fromCharCode(this.revocable?1:0))),null!==this.keyExpirationTime&&(b+=e(a.key_expiration_time,f.writeNumber(this.keyExpirationTime,4))),null!==this.preferredSymmetricAlgorithms&&(c=f.bin2str(this.preferredSymmetricAlgorithms),b+=e(a.preferred_symmetric_algorithms,c)),null!==this.revocationKeyClass&&(c=String.fromCharCode(this.revocationKeyClass),c+=String.fromCharCode(this.revocationKeyAlgorithm),c+=this.revocationKeyFingerprint,b+=e(a.revocation_key,c)),this.issuerKeyId.isNull()||(b+=e(a.issuer,this.issuerKeyId.write())),null!==this.notation)for(var d in this.notation)if(this.notation.hasOwnProperty(d)){var g=this.notation[d];c=String.fromCharCode(128),c+=String.fromCharCode(0),c+=String.fromCharCode(0),c+=String.fromCharCode(0),c+=f.writeNumber(d.length,2),c+=f.writeNumber(g.length,2),c+=d+g,b+=e(a.notation_data,c)}return null!==this.preferredHashAlgorithms&&(c=f.bin2str(this.preferredHashAlgorithms),b+=e(a.preferred_hash_algorithms,c)),null!==this.preferredCompressionAlgorithms&&(c=f.bin2str(this.preferredCompressionAlgorithms),b+=e(a.preferred_compression_algorithms,c)),null!==this.keyServerPreferences&&(c=f.bin2str(this.keyServerPreferences),b+=e(a.key_server_preferences,c)),null!==this.preferredKeyServer&&(b+=e(a.preferred_key_server,this.preferredKeyServer)),null!==this.isPrimaryUserID&&(b+=e(a.primary_user_id,String.fromCharCode(this.isPrimaryUserID?1:0))),null!==this.policyURI&&(b+=e(a.policy_uri,this.policyURI)),null!==this.keyFlags&&(c=f.bin2str(this.keyFlags),b+=e(a.key_flags,c)),null!==this.signersUserId&&(b+=e(a.signers_user_id,this.signersUserId)),null!==this.reasonForRevocationFlag&&(c=String.fromCharCode(this.reasonForRevocationFlag),c+=this.reasonForRevocationString,b+=e(a.reason_for_revocation,c)),null!==this.features&&(c=f.bin2str(this.features),b+=e(a.features,c)),null!==this.signatureTargetPublicKeyAlgorithm&&(c=String.fromCharCode(this.signatureTargetPublicKeyAlgorithm),c+=String.fromCharCode(this.signatureTargetHashAlgorithm),c+=this.signatureTargetHash,b+=e(a.signature_target,c)),null!==this.embeddedSignature&&(b+=e(a.embedded_signature,this.embeddedSignature.write())),b=f.writeNumber(b.length,2)+b},d.prototype.read_sub_packet=function(a){function b(a,b){this[a]=[];for(var c=0;c<b.length;c++)this[a].push(b.charCodeAt(c))}var c,e=0,g=127&a.charCodeAt(e++);switch(g){case 2:this.created=f.readDate(a.substr(e));break;case 3:c=f.readNumber(a.substr(e)),this.signatureNeverExpires=0===c,this.signatureExpirationTime=c;break;case 4:this.exportable=1==a.charCodeAt(e++);break;case 5:this.trustLevel=a.charCodeAt(e++),this.trustAmount=a.charCodeAt(e++);break;case 6:this.regularExpression=a.substr(e);break;case 7:this.revocable=1==a.charCodeAt(e++);break;case 9:c=f.readNumber(a.substr(e)),this.keyExpirationTime=c,this.keyNeverExpires=0===c;break;case 11:b.call(this,"preferredSymmetricAlgorithms",a.substr(e));break;case 12:this.revocationKeyClass=a.charCodeAt(e++),this.revocationKeyAlgorithm=a.charCodeAt(e++),this.revocationKeyFingerprint=a.substr(e,20);break;case 16:this.issuerKeyId.read(a.substr(e));break;case 20:if(128==a.charCodeAt(e)){e+=4;var h=f.readNumber(a.substr(e,2));e+=2;var j=f.readNumber(a.substr(e,2));e+=2;var k=a.substr(e,h),l=a.substr(e+h,j);this.notation=this.notation||{},this.notation[k]=l}else f.print_debug("Unsupported notation flag "+a.charCodeAt(e));break;case 21:b.call(this,"preferredHashAlgorithms",a.substr(e));break;case 22:b.call(this,"preferredCompressionAlgorithms",a.substr(e));break;case 23:b.call(this,"keyServerPreferencess",a.substr(e));break;case 24:this.preferredKeyServer=a.substr(e);break;case 25:this.isPrimaryUserID=0!==a[e++];break;case 26:this.policyURI=a.substr(e);break;case 27:b.call(this,"keyFlags",a.substr(e));break;case 28:this.signersUserId+=a.substr(e);break;case 29:this.reasonForRevocationFlag=a.charCodeAt(e++),this.reasonForRevocationString=a.substr(e);break;case 30:b.call(this,"features",a.substr(e));break;case 31:this.signatureTargetPublicKeyAlgorithm=a.charCodeAt(e++),this.signatureTargetHashAlgorithm=a.charCodeAt(e++);var m=i.getHashByteLength(this.signatureTargetHashAlgorithm);this.signatureTargetHash=a.substr(e,m);break;case 32:this.embeddedSignature=new d,this.embeddedSignature.read(a.substr(e));break;default:f.print_debug("Unknown signature subpacket type "+g+" @:"+e)}},d.prototype.toSign=function(a,b){var c=h.signature;switch(a){case c.binary:case c.text:return b.getBytes();case c.standalone:return"";case c.cert_generic:case c.cert_persona:case c.cert_casual:case c.cert_positive:case c.cert_revocation:var d,e;if(void 0!==b.userid)e=180,d=b.userid;else{if(void 0===b.userattribute)throw new Error("Either a userid or userattribute packet needs to be supplied for certification.");e=209,d=b.userattribute}var g=d.write();if(4==this.version)return this.toSign(c.key,b)+String.fromCharCode(e)+f.writeNumber(g.length,4)+g;if(3==this.version)return this.toSign(c.key,b)+g;break;case c.subkey_binding:case c.subkey_revocation:case c.key_binding:return this.toSign(c.key,b)+this.toSign(c.key,{key:b.bind});case c.key:if(void 0===b.key)throw new Error("Key packet is required for this signature.");return b.key.writeOld();case c.key_revocation:return this.toSign(c.key,b);case c.timestamp:return"";case c.third_party:throw new Error("Not implemented");default:throw new Error("Unknown signature type.")}},d.prototype.calculateTrailer=function(){var a="";return 3==this.version?a:(a+=String.fromCharCode(4),a+=String.fromCharCode(255),a+=f.writeNumber(this.signatureData.length,4))},d.prototype.verify=function(a,b){var c=h.write(h.signature,this.signatureType),d=h.write(h.publicKey,this.publicKeyAlgorithm),e=h.write(h.hash,this.hashAlgorithm),f=this.toSign(c,b),g=this.calculateTrailer(),k=0;d>0&&4>d?k=1:17==d&&(k=2);for(var l=[],m=0,n=0;k>n;n++)l[n]=new j,m+=l[n].read(this.signature.substr(m));return this.verified=i.signature.verify(d,e,l,a.mpi,f+this.signatureData+g),this.verified},d.prototype.isExpired=function(){return this.signatureNeverExpires?!1:Date.now()>this.created.getTime()+1e3*this.signatureExpirationTime},d.prototype.postCloneTypeFix=function(){this.issuerKeyId=k.fromClone(this.issuerKeyId)}},{"../crypto":32,"../enums.js":43,"../type/keyid.js":71,"../type/mpi.js":72,"../util.js":74,"./packet.js":57}],65:[function(a,b,c){function d(){this.tag=f.packet.symEncryptedIntegrityProtected,this.encrypted=null,this.modification=!1,this.packets=null}b.exports=d;var e=(a("../util.js"),a("../crypto")),f=a("../enums.js");d.prototype.read=function(a){var b=a.charCodeAt(0);if(1!=b)throw new Error("Invalid packet version.");this.encrypted=a.substr(1)},d.prototype.write=function(){return String.fromCharCode(1)+this.encrypted},d.prototype.encrypt=function(a,b){var c=this.packets.write(),d=e.getPrefixRandom(a),f=d+d.charAt(d.length-2)+d.charAt(d.length-1),g=c;g+=String.fromCharCode(211),g+=String.fromCharCode(20),g+=e.hash.sha1(f+g),this.encrypted=e.cfb.encrypt(d,a,g,b,!1),f.length+g.length!=this.encrypted.length&&(this.encrypted=this.encrypted.substring(0,f.length+g.length))},d.prototype.decrypt=function(a,b){var c=e.cfb.decrypt(a,b,this.encrypted,!1),d=c.slice(c.length-20,c.length).join("");if(c.splice(c.length-20),this.hash=e.hash.sha1(e.cfb.mdc(a,b,this.encrypted)+c.join("")),this.hash!=d)throw new Error("Modification detected.");c.splice(c.length-2),this.packets.read(c.join(""))}},{"../crypto":32,"../enums.js":43,"../util.js":74}],66:[function(a,b,c){function d(){this.tag=f.packet.symEncryptedSessionKey,this.version=4,this.sessionKeyEncryptionAlgorithm=null,this.sessionKeyAlgorithm="aes256",this.encrypted=null,this.s2k=new e}var e=a("../type/s2k.js"),f=a("../enums.js"),g=a("../crypto");b.exports=d,d.prototype.read=function(a){this.version=a.charCodeAt(0);var b=f.read(f.symmetric,a.charCodeAt(1)),c=this.s2k.read(a.substr(2)),d=c+2;d<a.length?(this.encrypted=a.substr(d),this.sessionKeyEncryptionAlgorithm=b):this.sessionKeyAlgorithm=b},d.prototype.write=function(){var a=null===this.encrypted?this.sessionKeyAlgorithm:this.sessionKeyEncryptionAlgorithm,b=String.fromCharCode(this.version)+String.fromCharCode(f.write(f.symmetric,a))+this.s2k.write();return null!==this.encrypted&&(b+=this.encrypted),b},d.prototype.decrypt=function(a){var b=null!==this.sessionKeyEncryptionAlgorithm?this.sessionKeyEncryptionAlgorithm:this.sessionKeyAlgorithm,c=g.cipher[b].keySize,d=this.s2k.produce_key(a,c);if(null===this.encrypted)this.sessionKey=d;else{var e=g.cfb.decrypt(this.sessionKeyEncryptionAlgorithm,d,this.encrypted,!0);e=e.join(""),this.sessionKeyAlgorithm=f.read(f.symmetric,e[0].keyCodeAt()),this.sessionKey=e.substr(1)}},d.prototype.encrypt=function(a){var b=g.getKeyLength(this.sessionKeyEncryptionAlgorithm),c=this.s2k.produce_key(a,b),d=String.fromCharCode(f.write(f.symmetric,this.sessionKeyAlgorithm))+g.getRandomBytes(g.getKeyLength(this.sessionKeyAlgorithm));this.encrypted=g.cfb.encrypt(g.getPrefixRandom(this.sessionKeyEncryptionAlgorithm),this.sessionKeyEncryptionAlgorithm,c,d,!0)},d.prototype.postCloneTypeFix=function(){this.s2k=e.fromClone(this.s2k)}},{"../crypto":32,"../enums.js":43,"../type/s2k.js":73}],67:[function(a,b,c){function d(){this.tag=f.packet.symmetricallyEncrypted,this.encrypted=null,this.packets=null}b.exports=d;var e=a("../crypto"),f=a("../enums.js");d.prototype.read=function(a){this.encrypted=a},d.prototype.write=function(){return this.encrypted},d.prototype.decrypt=function(a,b){var c=e.cfb.decrypt(a,b,this.encrypted,!0);this.packets.read(c.join(""))},d.prototype.encrypt=function(a,b){var c=this.packets.write();this.encrypted=e.cfb.encrypt(e.getPrefixRandom(a),a,c,b,!0)}},{"../crypto":32,"../enums.js":43}],68:[function(a,b,c){function d(){this.tag=e.packet.trust}b.exports=d;var e=a("../enums.js");d.prototype.read=function(a){}},{"../enums.js":43}],69:[function(a,b,c){function d(){this.tag=f.packet.userAttribute,this.attributes=[]}var e=(a("../util.js"),a("./packet.js")),f=a("../enums.js");b.exports=d,d.prototype.read=function(a){for(var b=0;b<a.length;){var c=e.readSimpleLength(a.substr(b));b+=c.offset,this.attributes.push(a.substr(b,c.len)),b+=c.len}},d.prototype.write=function(){for(var a="",b=0;b<this.attributes.length;b++)a+=e.writeSimpleLength(this.attributes[b].length),a+=this.attributes[b];return a},d.prototype.equals=function(a){return a&&a instanceof d?this.attributes.every(function(b,c){return b===a.attributes[c]}):!1}},{"../enums.js":43,"../util.js":74,"./packet.js":57}],70:[function(a,b,c){function d(){this.tag=f.packet.userid,this.userid=""}b.exports=d;var e=a("../util.js"),f=a("../enums.js");d.prototype.read=function(a){this.userid=e.decode_utf8(a)},d.prototype.write=function(){return e.encode_utf8(this.userid)}},{"../enums.js":43,"../util.js":74}],71:[function(a,b,c){function d(){this.bytes=""}b.exports=d;var e=a("../util.js");d.prototype.read=function(a){this.bytes=a.substr(0,8)},d.prototype.write=function(){return this.bytes},d.prototype.toHex=function(){return e.hexstrdump(this.bytes)},d.prototype.equals=function(a){return this.bytes==a.bytes},d.prototype.isNull=function(){return""===this.bytes},b.exports.mapToHex=function(a){return a.toHex()},b.exports.fromClone=function(a){var b=new d;return b.bytes=a.bytes,b},b.exports.fromId=function(a){var b=new d;return b.read(e.hex2bin(a)),b}},{"../util.js":74}],72:[function(a,b,c){function d(){this.data=null}b.exports=d;var e=a("../crypto/public_key/jsbn.js"),f=a("../util.js");d.prototype.read=function(a){var b=a.charCodeAt(0)<<8|a.charCodeAt(1),c=Math.ceil(b/8),d=a.substr(2,c);return this.fromBytes(d),2+c},d.prototype.fromBytes=function(a){this.data=new e(f.hexstrdump(a),16)},d.prototype.toBytes=function(){return this.write().substr(2)},d.prototype.byteLength=function(){return this.toBytes().length},d.prototype.write=function(){return this.data.toMPI()},d.prototype.toBigInteger=function(){return this.data.clone()},d.prototype.fromBigInteger=function(a){this.data=a.clone()},b.exports.fromClone=function(a){a.data.copyTo=e.prototype.copyTo;var b=new e;a.data.copyTo(b);var c=new d;return c.data=b,c}},{"../crypto/public_key/jsbn.js":37,"../util.js":74}],73:[function(a,b,c){function d(){this.algorithm="sha256",this.type="iterated",this.c=96,this.salt=g.random.getRandomBytes(8)}b.exports=d;var e=a("../enums.js"),f=a("../util.js"),g=a("../crypto");d.prototype.get_count=function(){var a=6;return 16+(15&this.c)<<(this.c>>4)+a},d.prototype.read=function(a){var b=0;switch(this.type=e.read(e.s2k,a.charCodeAt(b++)),this.algorithm=e.read(e.hash,a.charCodeAt(b++)),this.type){case"simple":break;case"salted":this.salt=a.substr(b,8),b+=8;break;case"iterated":this.salt=a.substr(b,8),b+=8,this.c=a.charCodeAt(b++);break;case"gnu":if("GNU"!=a.substr(b,3))throw new Error("Unknown s2k type.");b+=3;var c=1e3+a.charCodeAt(b++);if(1001!=c)throw new Error("Unknown s2k gnu protection mode.");this.type=c;break;default:throw new Error("Unknown s2k type.")}return b},d.prototype.write=function(){var a=String.fromCharCode(e.write(e.s2k,this.type));switch(a+=String.fromCharCode(e.write(e.hash,this.algorithm)),this.type){case"simple":break;case"salted":a+=this.salt;break;case"iterated":a+=this.salt,a+=String.fromCharCode(this.c)}return a},d.prototype.produce_key=function(a,b){function c(b,c){var d=e.write(e.hash,c.algorithm);switch(c.type){case"simple":return g.hash.digest(d,b+a);case"salted":return g.hash.digest(d,b+c.salt+a);case"iterated":var f=[],h=c.get_count();for(data=c.salt+a;f.length*data.length<h;)f.push(data);return f=f.join(""),f.length>h&&(f=f.substr(0,h)),g.hash.digest(d,b+f)}}a=f.encode_utf8(a);for(var d="",h="";d.length<=b;)d+=c(h,this),h+=String.fromCharCode(0);return d.substr(0,b)},b.exports.fromClone=function(a){var b=new d;return this.algorithm=a.algorithm,this.type=a.type,this.c=a.c,this.salt=a.salt,b}},{"../crypto":32,"../enums.js":43,"../util.js":74}],74:[function(a,b,c){"use strict";var d=a("./config");b.exports={readNumber:function(a){for(var b=0,c=0;c<a.length;c++)b<<=8,b+=a.charCodeAt(c);return b},writeNumber:function(a,b){for(var c="",d=0;b>d;d++)c+=String.fromCharCode(a>>8*(b-d-1)&255);return c},readDate:function(a){var b=this.readNumber(a),c=new Date;return c.setTime(1e3*b),c},writeDate:function(a){var b=Math.round(a.getTime()/1e3);return this.writeNumber(b,4)},emailRegEx:/^[+a-zA-Z0-9_.-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]{2,6}$/,hexdump:function(a){for(var b,c=[],d=a.length,e=0,f=0;d>e;){for(b=a.charCodeAt(e++).toString(16);b.length<2;)b="0"+b;c.push(" "+b),f++,f%32===0&&c.push("\n           ")}return c.join("")},hexstrdump:function(a){if(null===a)return"";for(var b,c=[],d=a.length,e=0;d>e;){for(b=a.charCodeAt(e++).toString(16);b.length<2;)b="0"+b;c.push(""+b)}return c.join("")},hex2bin:function(a){for(var b="",c=0;c<a.length;c+=2)b+=String.fromCharCode(parseInt(a.substr(c,2),16));return b},hexidump:function(a){for(var b,c=[],d=a.length,e=0;d>e;){for(b=a[e++].toString(16);b.length<2;)b="0"+b;c.push(""+b)}return c.join("")},encode_utf8:function(a){return unescape(encodeURIComponent(a))},decode_utf8:function(a){if("string"!=typeof a)throw new Error('Parameter "utf8" is not of type string');try{return decodeURIComponent(escape(a))}catch(b){return a}},bin2str:function(a){for(var b=[],c=0;c<a.length;c++)b[c]=String.fromCharCode(a[c]);return b.join("")},str2bin:function(a){for(var b=[],c=0;c<a.length;c++)b[c]=a.charCodeAt(c);return b},str2Uint8Array:function(a){for(var b=new Uint8Array(a.length),c=0;c<a.length;c++)b[c]=a.charCodeAt(c);return b},Uint8Array2str:function(a){for(var b=[],c=0;c<a.length;c++)b[c]=String.fromCharCode(a[c]);return b.join("")},calc_checksum:function(a){for(var b={s:0,add:function(a){this.s=(this.s+a)%65536}},c=0;c<a.length;c++)b.add(a.charCodeAt(c));return b.s},print_debug:function(a){d.debug&&console.log(a)},print_debug_hexstr_dump:function(a,b){d.debug&&(a+=this.hexstrdump(b),console.log(a))},getLeftNBits:function(a,b){var c=b%8;if(0===c)return a.substring(0,b/8);var d=(b-c)/8+1,e=a.substring(0,d);return this.shiftRight(e,8-c)},shiftRight:function(a,b){var c=util.str2bin(a);if(b%8===0)return a;for(var d=c.length-1;d>=0;d--)c[d]>>=b%8,d>0&&(c[d]|=c[d-1]<<8-b%8&255);return util.bin2str(c)},get_hashAlgorithmString:function(a){switch(a){case 1:return"MD5";case 2:return"SHA1";case 3:return"RIPEMD160";case 8:return"SHA256";case 9:return"SHA384";case 10:return"SHA512";case 11:return"SHA224"}return"unknown"},getWebCrypto:function(){if(d.useWebCrypto!==!1&&"undefined"!=typeof window){if(window.crypto)return window.crypto.subtle||window.crypto.webkitSubtle;if(window.msCrypto)return window.msCrypto.subtle}}}},{"./config":17}],75:[function(a,b,c){"use strict";function d(a,b){b&&b.worker?this.worker=b.worker:this.worker=new Worker(a||"openpgp.worker.js"),this.worker.onmessage=this.onMessage.bind(this),this.worker.onerror=function(a){throw new Error("Unhandled error in openpgp worker: "+a.message+" ("+a.filename+":"+a.lineno+")")},this.seedRandom(i),this.tasks=[],b&&b.config&&this.worker.postMessage({event:"configure",config:b.config})}var e=a("../crypto"),f=a("../packet"),g=a("../key.js"),h=a("../type/keyid.js"),i=5e4,j=2e4;d.prototype.execute=function(a){var b=this,c=new Promise(function(c,d){a(),b.tasks.push({resolve:c,reject:d})});return c},d.prototype.onMessage=function(a){var b=a.data;switch(b.event){case"method-return":b.err?this.tasks.shift().reject(new Error(b.err)):this.tasks.shift().resolve(b.data);break;case"request-seed":this.seedRandom(j);break;default:throw new Error("Unknown Worker Event.")}},d.prototype.seedRandom=function(a){var b=this.getRandomBuffer(a);this.worker.postMessage({event:"seed-random",buf:b})},d.prototype.getRandomBuffer=function(a){if(!a)return null;var b=new Uint8Array(a);return e.random.getRandomValues(b),b},d.prototype.terminate=function(){this.worker.terminate()},d.prototype.encryptMessage=function(a,b){var c=this;return c.execute(function(){a.length||(a=[a]),a=a.map(function(a){return a.toPacketlist()}),c.worker.postMessage({event:"encrypt-message",keys:a,text:b})})},d.prototype.signAndEncryptMessage=function(a,b,c){var d=this;return d.execute(function(){a.length||(a=[a]),a=a.map(function(a){return a.toPacketlist()}),b=b.toPacketlist(),d.worker.postMessage({event:"sign-and-encrypt-message",publicKeys:a,privateKey:b,text:c})})},d.prototype.decryptMessage=function(a,b){var c=this;return c.execute(function(){a=a.toPacketlist(),c.worker.postMessage({event:"decrypt-message",privateKey:a,message:b})})},d.prototype.decryptAndVerifyMessage=function(a,b,c){var d=this,e=new Promise(function(e,f){a=a.toPacketlist(),b.length||(b=[b]),b=b.map(function(a){return a.toPacketlist()}),d.worker.postMessage({event:"decrypt-and-verify-message",privateKey:a,publicKeys:b,message:c}),d.tasks.push({resolve:function(a){a.signatures=a.signatures.map(function(a){return a.keyid=h.fromClone(a.keyid),a}),e(a)},reject:f})});return e},d.prototype.signClearMessage=function(a,b){var c=this;return c.execute(function(){a.length||(a=[a]),a=a.map(function(a){return a.toPacketlist()}),c.worker.postMessage({event:"sign-clear-message",privateKeys:a,text:b})})},d.prototype.verifyClearSignedMessage=function(a,b){var c=this,d=new Promise(function(d,e){a.length||(a=[a]),a=a.map(function(a){return a.toPacketlist()}),c.worker.postMessage({event:"verify-clear-signed-message",publicKeys:a,message:b}),c.tasks.push({resolve:function(a){a.signatures=a.signatures.map(function(a){return a.keyid=h.fromClone(a.keyid),a}),d(a)},reject:e})});return d},d.prototype.generateKeyPair=function(a){var b=this,c=new Promise(function(c,d){b.worker.postMessage({event:"generate-key-pair",options:a}),b.tasks.push({resolve:function(a){var b=f.List.fromStructuredClone(a.key);a.key=new g.Key(b),c(a)},reject:d})});return c},d.prototype.decryptKey=function(a,b){var c=this,d=new Promise(function(d,e){a=a.toPacketlist(),c.worker.postMessage({event:"decrypt-key",privateKey:a,password:b}),c.tasks.push({resolve:function(a){var b=f.List.fromStructuredClone(a);a=new g.Key(b),d(a)},reject:e})});return d},d.prototype.decryptKeyPacket=function(a,b,c){var d=this,e=new Promise(function(e,h){a=a.toPacketlist(),d.worker.postMessage({event:"decrypt-key-packet",privateKey:a,keyIds:b,password:c}),d.tasks.push({resolve:function(a){var b=f.List.fromStructuredClone(a);a=new g.Key(b),e(a)},reject:h})});return e},b.exports=d},{"../crypto":32,"../key.js":45,"../packet":53,"../type/keyid.js":71}]},{},[44])(44)});
define('Utils',[],function() {

    var instance = null;

    function Utils() {
        if (instance !== null)
            throw new Error("Utils instance already exists");
    }


    /* 
     * adds an event listener to every element with X class
     * @param className {string}	the name of the classes the listener should be added to
     * @param listener  {string} 	the event to be listened for 
     * @param callback  {function}  the function to be executed when event is fired
     */
    Utils.prototype.addListenerToClass = function(className, listener, callback) {

        var elements = document.getElementsByClassName(className);

        if (elements.length === 0) {
            return false;
        }

        for (var i = 0; i < elements.length; i++) {
            elements[i].addEventListener(listener, callback, false);
        }
        return true;
    }


    /*
     * little helper function to check if page has element with X class name
     * @param className {string} the name of the class
     */
    Utils.prototype.classExists = function(className){

        if(document.getElementsByClassName(className)[0])
            return true;
        
        return false;
    }


    /* removes x attribute from a node & its' subtree
     * @param attribute {string} the name of the attribute to be remove
     * @param node {string} the root of the subtree
     */ 
    Utils.prototype.removeNestedAttributes = function(attribute, node) {

        node.removeAttribute(attribute);

        if (node.children !== undefined)
            for (var i = 0; i < node.children.length; i++) {
                this.removeNestedAttributes(attribute, node.children[i]);
            }
    }


    // find an object from an array by property value
    Utils.prototype.findObjWithAttribute = function(array, attr, value) {
        for(var i = 0; i < array.length; i += 1) {
            if(array[i][attr] === value) {
                return i;
            }
        }
    };


    // return singleton instance
    Utils.getInstance = function() {
        if (instance === null)
            instance = new Utils();
        return instance;
    }

    return Utils.getInstance();
});

define("EventManager", [],function() {

    var instance = null;
    var events = {};


    function EventManager() {
        if (instance !== null)
            throw new Error("EventManager instance already exists");
    }


    /* pushes an event and calls function(s) of any listeners
     * @param event {string} the name of the event being triggered
     * @param data  {any}    data associated with an event trigger
     */
    EventManager.prototype.publish = function(event, data) {
        if (!events[event])
            return false;

        events[event].forEach(function(listener) {
            if (data)
                listener(data);
            else
                listener();
        });
    }


    /* 
     * adds functions to listen for events
     * @param listener {function} the function called when an event is pushed to
     */
    EventManager.prototype.subscribe = function(event, listeners) {
        if (!events[event])
            events[event] = [];

        if (!Array.isArray(listeners)) listeners = [listeners];

        for (var i = 0; i < listeners.length; i++) {
            events[event].push(listeners[i])
        };
    }


    /* 
     * TODO: removing by index is horrible...
     * removes a listener function from an event
     * @param listenerIndex {int} the position of the event in the event array
     */
    EventManager.prototype.removeListener = function(event, listenerIndex) {
        if (!events[event])
            return false;

        events[event].splice(listenerIndex, 1);
    };


    // return singleton instance
    EventManager.getInstance = function() {
        if (instance === null)
            instance = new EventManager();
        return instance;
    }

    return EventManager.getInstance();
});

define('Key',['openpgp'], function(openpgp) {

    /*
     * @param pgpKey {dict} contains a public key, optional private key and a facebook id
     */
    function Key(pgpKey) {
        this.pubKey = openpgp.key.readArmored(pgpKey['pubKey']).keys[0];
        this.privKey = pgpKey['privKey'] === undefined ? null : openpgp.key.readArmored(pgpKey['privKey']).keys[0];
        this.fb_id = pgpKey['fb_id'];
    }


    /*
     * @returns {string} the id of the key, format: FirstName LastName <email@domain.com>
     */
    Key.prototype.getId = function() {
        return this.pubKey.users[0].userId.userid;
    }


    /* 
     * @returns {boolean} whether the private key has been decrypted or not
     */
    Key.prototype.isUnlocked = function() {
        return this.privKey.primaryKey.isDecrypted;
    };


    /*
     * @returns {string} the name part of the key's id
     */
    Key.prototype.getName = function() {
        var id = this.getId();
        var name = id.split('<')[0];
        return name;
    }


    /*
     * @returns {string} the email part of the key's id
     */
    Key.prototype.getEmail = function() {
        var id = this.getId();
        var email = id.split('<')[1].replace('>', '');
        return email;
    }


    /*
     * @returns {integer} the length of the key
     */
    Key.prototype.getPubKeyLength = function() {
        var publicKeyPacket = this.pubKey.primaryKey;

        if (publicKeyPacket !== null) {
            strength = getBitLength(publicKeyPacket);
        }

        function getBitLength(publicKeyPacket) {
            var size = -1;
            if (publicKeyPacket.mpi.length > 0) {
                size = (publicKeyPacket.mpi[0].byteLength() * 8);
            }
            return size;
        }
        return strength;
    }

    return Key;
});

define("StoreController", ['Key'], function(Key) {

    var instance = null;

    function StoreController() {
        if (instance !== null)
            throw new Error("StoreController instance already exists");
    }


    /*
     * Get a key from local storage
     * @param key      {string} the key used to store data
     * @param callback {function} the function to execute when storing is complete
     */
    StoreController.prototype.getKey = function(key, callback) {
        chrome.storage.local.get(key, function(result) {
            // TODO: Should probably convert to keys here instead of in hasFriends()

            // remove the settings object, don't need it here
            delete result['settings'];

            if (key === null) {
                callback(result);
            } else if (result[key] === undefined) {
                callback(false);
            } else {
                callback(new Key(result[key]));
            }
        });
    }


    /* 
     * Stores armored keys
     * @param fb_id    {string} facebook id used in the key
     * @param pubKey   {string} public part of the keypair
     * @param privKey  {string} private part of the keypair
     * @param callback {function} the function to execute when retreival is complete
     */
    StoreController.prototype.setKey = function(fb_id, pubKey, privKey, callback) {

        var data = {};

        if (privKey !== null) {
            data['whisper_key'] = {
                'fb_id': fb_id,
                'privKey': privKey,
                'pubKey': pubKey
            };
        } else {
            data[fb_id] = {
                'fb_id': fb_id,
                'pubKey': pubKey
            };
        }

        chrome.storage.local.set(data, callback);
    }


    /* 
     * removes a key from local storage
     * @param key_id {string} the key used in localstorage 
     * @param callback {function} runs upon deletion/failure
     */
    StoreController.prototype.delKey = function(key_id, callback) {
        this.getKey(key_id, function(key) {
            if (!key) {
                callback(false);
            } else {
                chrome.storage.local.remove(key_id, callback(true));
            }
        })
    };


    // tiny wrapper function to check if user has private key
    StoreController.prototype.hasPrivKey = function(callback) {
        this.getKey('whisper_key', callback);
    };


    /* 
     * Find out if user has any friends/public keys in storages
     * @param callback {function} executed when retreival from ls is complete
     */
    StoreController.prototype.hasFriends = function(callback) {

        this.getKey(null, function(results) {

            var friends = false;
            delete results['whisper_key'];

            // since user only has one key pair, we can assume the remaining 
            // items in the dict are their friends' public keys
            if (Object.keys(results).length > 0) {
                friends = [];
                for (key in results) {
                    friends.push(new Key({
                        "fb_id": results[key].fb_id,
                        "pubKey": results[key].pubKey
                    }));
                }
            }
            callback(friends);
        });
    }


    // Returns the settings for a conversation (if encryption is on/off)
    StoreController.prototype.getSettings = function(key, callback) {
        chrome.storage.local.get({settings: {}}, function(result){

            var settings = result.settings;

            if(settings[key] === undefined){
                callback(false);
            } else {
                callback(settings[key]);
            }
        })
    };


    // Sets whether encryption is enabled/disabled for a conversation
    StoreController.prototype.setSettings = function(key, callback) {

        chrome.storage.local.get({settings: {}}, function(result){

            var settings = result.settings;

            if (settings[key] === false || settings[key] === undefined)
                settings[key] = true;
            else
                settings[key] = false;

            chrome.storage.local.set({settings:settings}, callback);
        });
    };


    // return singleton instance
    StoreController.getInstance = function() {
        if (instance === null)
            instance = new StoreController();
        return instance;
    }

    return StoreController.getInstance();
});
define("KeyController", ['StoreController', 'Key', 'openpgp', 'EventManager'],
    function(StoreController, Key, openpgp, EventManager) {

        var instance = null;

        function KeyController() {
            self = this;
            if (instance !== null)
                throw new Error("KeyController instance already exists");
        }

        /*
         * runs initially when the options page loads, checks if the user has a key / friends
         * and publishes the results to EventManager
         */
        KeyController.prototype.init = function() {

            EventManager.subscribe('newKey', this.generateKey);
            EventManager.subscribe('privKeyInsert', this.insertPrivKey);
            EventManager.subscribe('pubKeyInsert', this.insertPubKey);

            // check if the user has a key 
            StoreController.hasPrivKey(function(key) {
                if (!key)
                    EventManager.publish('noPrivKey', {
                        keys: false
                    });
                else
                    EventManager.publish('newPrivKey', {
                        keys: key
                    });
            });

            // check if the user has any friends
            StoreController.hasFriends(function(keys) {
                if (!keys)
                    EventManager.publish('noPubKeys', {
                        keys: false
                    });  
                else
                    EventManager.publish('newPubKey', {
                        keys: keys
                    });
            })
        }


        /*
         * generates a new openpgp key and stores in localstorge
         * @param data {object} contains form data for creating the key
         */
        KeyController.prototype.generateKey = function(data) {
            // options used to generate the key
            var options = {
                numBits: data.numBits,
                userId: data.name + ' <' + data.email + '>',
                passphrase: data.password
            }

            openpgp.generateKeyPair(options).then(function(keypair) {
                var privKey = keypair.privateKeyArmored;
                var pubKey = keypair.publicKeyArmored;

                // store the key and notify subscribers of its' creation
                StoreController.setKey(data.fb_id, pubKey, privKey, function() {
                    EventManager.publish('newPrivKey', {
                        visible: true,
                        keys: new Key({
                            'fb_id': data.fb_id,
                            'pubKey': pubKey,
                            'privKey': privKey
                        })
                    });
                });
            });
        }


        /*
         * Used when a user wants to insert an already generate private key
         * @param data {object} contains facebook id and private key
         */
        KeyController.prototype.insertPrivKey = function(data) {

            var result = self.checkKeyIntegrity(data.privKey);

            // malformed key check
            if (result['err']) {
                EventManager.publish('error', {
                    error: 'Invalid Key'
                });
                return;
            }

            // key is not private
            if (!result['key'].isPrivate()) {
                EventManager.publish('error', {
                    error: 'Please Insert a Private Key'
                });
                return;
            }

            // wrong password
            if (!self.validateKeyPassword(result['key'], data.password)) {
                EventManager.publish('error', {
                    error: 'Wrong password'
                });
                return;
            }

            // key associated with an existing fb_id
            StoreController.getKey(null, function(keys) {
                if (keys[data.fb_id] !== undefined) {
                    EventManager.publish('error', {
                        error: 'Key Already Exists For: ' + data.fb_id
                    });
                    return;
                }

                var pubKey = result['key'].toPublic().armor();

                // everything ok, store the key
                StoreController.setKey(data.fb_id, pubKey, data.privKey, function() {
                    EventManager.publish('newPrivKey', {
                        visible: true,
                        keys: new Key({
                            'fb_id': data.fb_id,
                            'pubKey': pubKey,
                            'privKey': data.privKey
                        })
                    });
                });
            });
        }


        /*
         * Used when a user wants to insert an already generate private key
         * @param data {object} contains facebook id and public key
         */
        KeyController.prototype.insertPubKey = function(data) {

            var result = self.checkKeyIntegrity(data.pubKey);

            if (result['err']) {
                EventManager.publish('error', {
                    error: 'Invalid Key'
                });
                return;
            }

            if (!result['key'].isPublic()) {
                EventManager.publish('error', {
                    error: 'Please Insert a Public Key'
                });
                return;
            }

            StoreController.getKey(null, function(keys) {

                // key associated with an existing fb_id
                if (keys[data.fb_id] !== undefined) {
                    EventManager.publish('error', {
                        error: 'Key Already Exists For: ' + data.fb_id
                    });
                    return;
                }

                // if for some weird reason their facebook id is 'whisper_key'...
                if (keys['whisper_key'] !== undefined) {
                    if (keys['whisper_key'].fb_id === data.fb_id) {
                        EventManager.publish('error', {
                            error: 'Public key cannot have same ID as private key'
                        });
                        return;
                    }
                }

                // Everything is ok, so store the key and publish the newly stored key
                StoreController.setKey(data.fb_id, data.pubKey, null, function() {
                    EventManager.publish('newPubKey', {
                        visible: true,
                        keys: new Key({
                            'fb_id': data.fb_id,
                            'pubKey': data.pubKey
                        })
                    });
                });
            });
        }


        /*
         * checks if the key is a valid
         * @param key {string} public/private openpgp key
         */
        KeyController.prototype.checkKeyIntegrity = function(key) {

            var result = openpgp.key.readArmored(key);

            if (result['err'])
                return {
                    'err': result['err'][0].message
                };

            return {
                'key': result.keys[0]
            };

        }


        /*
         * checks if the correct password has been entered for the private key
         * @param key {string} private openpgp key
         * @param password {string} password associated with private key
         * @return {boolean} true if the password successfully decrypts key
         */
        KeyController.prototype.validateKeyPassword = function(key, password) {
            // wrong password check
            if (!key.decrypt(password))
                return false;
            return true;
        }


        // return singleton instance
        KeyController.getInstance = function() {
            if (instance === null)
                instance = new KeyController();
            return instance;
        }

        return KeyController.getInstance();
    });
define('Thread',[],function() {

	function Thread(id){
		this.id = id;
		this.isEncrypted = false;
		this.hasAllKeys = true;
		this.numPeople = 0;
		this.keys = [];
	}


	Thread.prototype.setEncrypted = function(encrypted) {
		this.isEncrypted = encrypted;
	};


	Thread.prototype.setNumPeople = function() {
		this.numPeople +=1;
	};


	Thread.prototype.addKey = function(key) {
		this.keys.push(key);
		this.setNumPeople();
	};


	Thread.prototype.removeKey = function(key) {

		var index = this.keys.indexOf(key);

		if (index > -1)
			this.keys.splice(index, 1);
	};


	Thread.prototype.makeMessage = function(message, sender) {

		var payload = {
			sender: sender,
			messages: []
		};

		(function(){
			var i = 0;

			function encryptMessage(){
				if (i < this.numPeople){
					openpgp.encryptMessage(keys[i].pubKey.keys, message).then(function(pgpMessage){

						var message = {
							recipient: keys[i],
							content: pgpMessage
						};

						payload.messages.push(message);

						i++;
						encryptMessage();
					})
				}
				else{

				}
			}
		});
	};


	return Thread;
});
define("MessageController", ["EventManager", "StoreController", "Key", "Thread", "Utils", "openpgp"], function(e, Store, Key, Thread, Utils, openpgp){

	var instance = null;
	var thread, myKey;

	function MessageController() {
		self = this;
		if (instance !== null)
			throw new Error("MessageController instance already exists");
	}


	MessageController.prototype.init = function(callback) {

        Store.hasPrivKey(function(key) {
            if (!key){
                myKey = false;
            }
            else{
                myKey = key;
				e.subscribe('setThread', self.getThreadInfo);
				e.subscribe('setEncryption', self.setEncryption);
				e.subscribe('decryptKey', self.decryptKey);   
				self.listen();   
            }
            callback(myKey);
        });
	};


	MessageController.prototype.listen = function() {

		// send the content script the fields needed to make requests to facebook
		chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){

			console.log('-->>: ', request.url);

			self.parseMessage(request.data, sendResponse);

			return true;
       
		});

	};


	MessageController.prototype.parseMessage = function(data, callback) {

		var expr = /\[body\]=(.*?)&/;
		var messageBody = data.match(expr)[1];

		// can't find message for some reason
		if(messageBody === undefined)
			return false;

		messageBody = decodeURIComponent(messageBody);
		
		if (thread.isEncrypted){
			var payload = {
				sender: myKey.fb_id,
				messages: []
			};

			(function(){
				var i = 0;
				function encryptMessage(){
					if (i < thread.numPeople){

						openpgp.encryptMessage(thread.keys[i].key.pubKey, messageBody).then(function(pgpMessage){

							var message = {
								recipient: thread.keys[i].vanity,
								content: pgpMessage
							};

							payload.messages.push(message);
							console.log('-', payload);
							i++;
							encryptMessage();
						});
					}
					else{
						payload = '[body]=' + JSON.stringify(payload) + '&';
						data = data.replace(expr, payload);
						callback({message:data});
					}
				}
				encryptMessage();
			})();
		}
		else
			callback({message:data});

		// console.log(message);
	};


	/*
	 * Grabs thread id and participants for the current active thread, using fb's api
	 * @param data {object} contains index of the current thread & the site
	 */
	MessageController.prototype.getThreadInfo = function(data) {

		// get the id of the thread
		chrome.runtime.sendMessage({type: 'getThreadInfo', site: data.site}, function(response){
			user = response.user;
            self.makeRequest("/ajax/mercury/threadlist_info.php", 
                        {type  : 'POST',
                         params: 'inbox[offset]=' + data.threadIndex + '&inbox[limit]=1&__user=' + user.id + '&__a=1b&__req=1&fb_dtsg=' + user.fb_dtsg}, 
                         self.setActiveThread)
		});
	};


	/*
	 * decrypts the user's private key
	 * @param data {object} contains password from dialog in the view
	 */
	MessageController.prototype.decryptKey = function(data) {

        if (!myKey.privKey.decrypt(data.password)){
            e.publish('wrongPassword');
            return;
        }
        e.publish('correctPassword');
	};


	/* Constructs a new thread object & retrieves key's for every participant
	 * Notifies the view as to whether encryption was on/off for the current thread
	 * @param data {object} ajax response from facebook's api to threadlist_info
	 */
    MessageController.prototype.setActiveThread = function(data){

    	var threadInfo, threadId, participants, keys = {};

    	// parse respons from threadlist_info.php
        threadInfo = JSON.parse(data);

        // array of participants in the active thread
        participants = threadInfo.payload.participants;

        // get the index of our fbid as we don't want this in the thread
        var myKeyIndex = Utils.findObjWithAttribute(participants, 'vanity', myKey.fb_id);

        // store a refrence to our id in the keys obj as the view needs to know what locks to render
        var fbid = participants[myKeyIndex].fbid;
        keys[fbid] = true;
        participants.splice(myKeyIndex, 1);

        // id of the active thread (group-convo)
        threadId = threadInfo.payload.ordered_threadlists[0].thread_fbids[0];

        // id of the active thread (solo-convo)
        if (threadId === undefined)
        	threadId = threadInfo.payload.ordered_threadlists[0].other_user_fbids[0];

        // make a new thread, store its' id
        thread = new Thread(threadId);

        // get the settings for the current thread, check what public
        // keys are in storage then notify the view
        Store.getSettings(thread.id, function(encrypted){

    		(function(){
    			var i = 0;

    			function forloop(){
        			if (i < participants.length){

        				Store.getKey(participants[i].vanity, function(result){

        					var key = {};
        					var fbid = participants[i].fbid;
        					var vanity = participants[i].vanity;

        					// if we found a key 
        					if(result){
        						// need to store vanity -> key as this is 
        						// how the key is stored in local storage
        						key.vanity = vanity;
        						key.key = result;
        						// view needs numeric id for placement
        						// of lock icons
        						keys[fbid] = true;
        						thread.addKey(key);
        					}
        						
        					else{
        						key[vanity] = false
        						keys[fbid] = false
        						thread.addKey(key);
        						thread.hasAllKeys = false;
        					}
        					i++;
        					forloop();
        				});
        			}
        			else{
        				// if we're missing a key, we'll tell the view to disable
        				// the encryption controls
        				if(thread.hasAllKeys)
	    					e.publish('renderThreadSettings', {isEncrypted: encrypted,
	    										   		   	   keys: keys,
	    										   		   	   hasAllKeys: true});
	    				else
	    					e.publish('renderThreadSettings', {isEncrypted: encrypted,
	    										   		   	   keys: keys,
	    										   		   	   hasAllKeys: false});

	    				// if we have all the keys and the thread is tagged as encrypted
	    				// ask for the user's password if needed
			        	thread.setEncrypted(encrypted);

			        	if(encrypted && !myKey.isUnlocked())
			        		e.publish('getPassword');	    				
        			}
        		}
        		forloop();
    		})();
        });
    }


    /* Toggles encryption on/off for the current thread & stores settings
     * @param data {object} contains a boolean for encrypted state
     */ 
    MessageController.prototype.setEncryption = function(data) {
    	thread.setEncrypted(data.encrypted);

    	if(data.encrypted && !myKey.isUnlocked())
    		e.publish('getPassword');

    	Store.setSettings(thread.id, function(){
    		// don't need anything in this callback yet
    	});
    };


	// ajax helper function
	MessageController.prototype.makeRequest = function(url, options, callback) {
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function(){
            if(xhr.readyState == 4 && xhr.status == 200)
                callback(xhr.responseText.replace('for (;;);', ''));
        }

        xhr.open(options.type, url, true);

        if(options.type === 'POST')
            xhr.send(options.params);
        else
            xhr.send();
	};


	MessageController.getInstance = function() {
		if (instance === null)
			instance = new MessageController();
		return instance;
	}

	return MessageController.getInstance();
});

define('Person',["Key"], function(Key) {

	function Person(vanity, fbid){
		this.vanity = vanity;
		this.fbid = fbid;
		this.key = false;
	}


	Person.prototype.setKey = function(key) {
		this.key = new Key(key);
	};

	return Person;
});
// View for messenger.com

define("messengerView", ["Utils", "EventManager"], function (Utils, em){

	// Styles used when injecting plugin elements into messenger.com
	var STYLES = {
		// heading of the current chat window
		heading : '_3oh-',
		// currently selected thread
		activeThread: '_1ht2',
		// right column 
		threadInfoPane: '_3tkv',
		// name of person in 1-1 thread
		threadPersonName: '_3eur',
		// list of people in a group thread
		threadPeopleList: '_4wc-',
		// wrapper that toggles visibility of right col
		threadInfoPaneWrapper: '_4_j5',
		// span tag in column row
		colSpan: '_3x6u',
		// information button in active state
		infoBtn: '_fl3 _30yy',
	}

	// ignore checking these styles as they are not always used in the page
	// dom checking function is pretty bad really...
	var exceptions = ['rightCol', 'colSpan', 'threadPeopleList', 'threadPersonName'];


	function init(){
		
		if (!validateDom()){
			alert('Could not initialise Whisper. Please refresh the page. If this issue persists please check for an updated version of the plugin.');
			return;
		}
		
		// inject the checkbox needed to toggle encryption on/off
		injectToThread();

		// makes the popup dialog for entering password
		makeDialog();

		// add event listeners
		bindDomEvents();

		// listen to controller events
		subscribeEvents();

		setThread();
	}


	// checks that facebook's markup hasn't changed
	function validateDom(){

		for(var key in STYLES){
			if ( !Utils.classExists(STYLES[key]) && exceptions.indexOf(key) === -1){
				console.log('STYLE: ', key, ' was not found.');
				return false;
			}
				
		}
		return true;
	}


	// subscribes to events emitted by the event manager
	function subscribeEvents(){
		em.subscribe('renderThreadSettings', renderThreadSettings);

		em.subscribe('getPassword', function(){
			document.getElementById('pwDialog').showModal();
		});

		em.subscribe('wrongPassword', function(){
			document.getElementById('pwDialog').children[0].style.display = 'block';
		});

		em.subscribe('correctPassword', function(){
			document.getElementById('pwDialog').children[0].style.display = 'none';
			document.getElementById('pwDialog').close();
		});
	}


	// adds all the event listeners
	function bindDomEvents(){

		// watches for changes between threads
		var threadTitle = document.getElementsByClassName(STYLES.heading)[0];
		var config = { attributes: true, childList: true, characterData: true, subtree: true };
		var titleObserver = new MutationObserver(function() {
			setThread();
		});
		titleObserver.observe(threadTitle, config);

		// watches for change in the right colum / where thread interactions are
		var threadInfoWrapper = document.getElementsByClassName(STYLES.threadInfoPaneWrapper)[0];
		var config = { attributes: true, subtree: false };
		var threadInfoPaneObserver = new MutationObserver(function(mutations) {
			injectToThread();  	
		});
		threadInfoPaneObserver.observe(threadInfoWrapper, config);

		
		checkBox = document.getElementById('encryption-toggle').getElementsByTagName('INPUT')[0];

		// enable / disable encryption for current conversation
		checkBox.addEventListener('click', function(){
			em.publish('setEncryption', {encrypted: checkBox.checked});
		});

		// listen for dialog close event when entering password, will turn off encryption
		document.getElementById('closeDialog').addEventListener('click', function(e){
			e.preventDefault();
			checkBox.checked = false;
			document.getElementById('pwDialog').children[0].style.display = 'none';
			document.getElementById('keyPw').value = '';
			em.publish('setEncryption', {encrypted: false});
			document.getElementById('pwDialog').close();
		});

		// submitting password on enter press
		document.getElementById('keyPw').onkeydown = function(e){
			if(e.keyCode == 13){
				e.preventDefault();
				processForm(e);
			}
		};

		// submitting password with ok button
		document.getElementById('submitDialog').addEventListener('click', processForm);
	}


	// gets the index of the selected thread and pushes an event to retrieve
	// the participants and thread id
	function setThread(){

		// currently selected thread
		var activeThread = document.getElementsByClassName(STYLES.activeThread)[0];
		// get the list of threads
		var threadList = Array.prototype.slice.call(activeThread.parentElement.children);
		// index of the active thread needed for finding thread info 
		activeThread = threadList.indexOf(activeThread);

		checkBox.disabled = true;
		checkBox.checked = false;
		em.publish('setThread', {site:'messenger', threadIndex: activeThread});
	}


	function processForm(e){
		e.preventDefault();
		var password = document.getElementById('keyPw').value;
		em.publish('decryptKey', {password: password});
	}


	function renderThreadSettings(data){

		var encryptionText = checkBox.parentNode.parentNode.children[1];

		if(!data.hasAllKeys){
			checkBox.disabled = true;
			encryptionText.style.textDecoration = 'line-through';
			encryptionText.style.color = '#F0F0F0';		
		}
		else{
			checkBox.disabled = false;
			encryptionText.style.textDecoration = 'none';	
			encryptionText.style.color = '#141823';
			checkBox.checked = data.isEncrypted;	
		}

		var parent = document.getElementsByClassName('_3eur')[0];

		if(parent){	
			parent = parent.children[0];

			if (parent.children.length > 0){
				for (var i = 0; i < parent.children.length; i++) {
					if ( parent.children[i].tagName == 'SPAN' )
						parent.removeChild(parent.children[i]);
				};
			}
			makeLock(data.hasAllKeys, parent)
			return;
		}

		var peopleList = document.getElementsByClassName(STYLES.threadPeopleList)[0].getElementsByTagName('UL')[0].children;
			
		for (var i = 0; i < peopleList.length; i++) {

			var lockIcon = document.createElement('SPAN');

			var fbid = peopleList[i].getAttribute('data-reactid').split('$fbid=2')[1];

			var parent = peopleList[i].getElementsByClassName('_364g')[0];

			var hasKey = data.keys[fbid] == true ? true : false;
			if(parent.children.length < 1)
				makeLock(hasKey, parent);
		};	

		function makeLock(hasKey, parent){
			var lockIcon = document.createElement('SPAN');

			if(hasKey){
				lockIcon.className = 'ion-locked ion-padded ion-blue';
			}
			else{
				lockIcon.className = 'ion-unlocked ion-padded';
			}
			parent.appendChild(lockIcon);		
		}
	}


	// inject the checkbox toggle option into the current thread
	function injectToThread(){

		var threadInfoPane = document.getElementsByClassName(STYLES.threadInfoPane)[0];

		if (threadInfoPane === undefined || document.getElementById('encryption-toggle') !== null)
			return;

		var threadInfoRow = threadInfoPane.childNodes[1].cloneNode(true)
		threadInfoRow.id = 'encryption-toggle';
		threadInfoRow.getElementsByClassName(STYLES.colSpan)[0].innerHTML = 'Encryption';

		Utils.removeNestedAttributes('data-reactid', threadInfoRow);
		threadInfoPane.childNodes[1].insertAdjacentElement('afterEnd', threadInfoRow);
	}


	// create a popup dialog for the user to enter their private key password
	function makeDialog(){
		var dialog = document.createElement("DIALOG");
		var errorMsg = document.createElement("P");
		var form = document.createElement("FORM");
		var btnWrapper = document.createElement("DIV");
		var passwordField = document.createElement("INPUT");
		var submitBtn = document.createElement("BUTTON");
		var closeBtn = document.createElement("BUTTON");

		dialog.id = "pwDialog";

		errorMsg.innerHTML = "Incorrect Password";

		passwordField.type = "text";
		passwordField.id = 'keyPw';
		passwordField.placeholder = 'Private Key Password';

		submitBtn.id = "submitDialog";
		submitBtn.innerHTML = "OK";

		closeBtn.id = "closeDialog";
		closeBtn.innerHTML = "Close";
		
		form.appendChild(passwordField);
		form.appendChild(btnWrapper);
		btnWrapper.appendChild(closeBtn);
		btnWrapper.appendChild(submitBtn);
		dialog.appendChild(errorMsg);
		dialog.appendChild(form);
		document.body.appendChild(dialog);
	}

	return{
		init: init
	}
});

define("messenger", ["messengerView", "MessageController"], function (messengerView, MessageController) {
		
	MessageController.init(function(success){

		if(!success){
			return;
		}

		// injects script - credit: http://bit.ly/1JW19AK
		var s = document.createElement('script');
		s.src = chrome.extension.getURL('js/ajaxProxy.js');
		s.onload = function() {
		    this.parentNode.removeChild(this);
		};
		(document.head||document.documentElement).appendChild(s);

		messengerView.init();		
	});
});	

	//The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    window.addEventListener('load', function(){
    	return require('messenger');
    })
}));