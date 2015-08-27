// Based on this gist: https://gist.github.com/jrburke/1509135


//Download jquery.js and place it in the build, do not use require-jquery.js 
//in the build, since each of the build layers just needs almond and not the 
//full require.js file.
//This file is run in nodejs to do the build: node build.js

//Load the requirejs optimizer
var requirejs = require('./r.js');

//Set up basic config, include config that is
//common to all the requirejs.optimize() calls.
var baseConfig = {
    baseUrl: "../src/js",
    locale: "en-us",
    optimize: "uglify2",

    paths: {
        app: 'app',

        // Controllers
        'KeyController' : 'app/controllers/KeyController',
        'StoreController': 'app/controllers/StoreController',
        'MessageController' : 'app/controllers/MessageController',

        // Models
        'Key': 'app/models/Key',
        'Thread': 'app/models/Thread',
        'Tab': 'app/models/Tab',

        // Views
        'optionsView': 'app/views/optionsView',
        'messengerView': 'app/views/messengerView',

        // libraries
        'openpgp': 'empty:',
        'almond': 'lib/almond',

        // utility/helper classes
        'Utils': 'app/utils/Utils',
        'EventManager': 'app/utils/EventManager',

        // injected scripts
        'injector': 'app/injected/injector',
        'ajaxProxy': 'app/injected/ajaxProxy',
        'fb-overrides': 'app/injected/fb-overrides',

        // 'main' files / entry point for the app
        'main': 'app/main',
        'options': 'app/options',

        // background
        'background': 'app/Background/background',
        'MessageReader': 'app/background/MessageReader',
        'MessageWriter': 'app/background/MessageWriter',
        'TabManager': 'app/background/TabManager'
    }
 };

//Create an array of build configs, the baseConfig will
//be mixed in to each one of these below. Since each one needs to
//stand on their own, they all include jquery and the noConflict.js file

var configs = [
    
    // options build
    {
        include: ['almond', 'Utils','EventManager', 'KeyController',
                  'StoreController', 'Key', 'optionsView', 'options'],
        out: '../dist/js/options.js',
        skipModuleInsertion: true,
        wrap: {
            start: '(function(){',
            end: 'require(["options"], null, null, true);})();'
        }
    },
    
    
    // messenger build
    {
        include: ['almond', 'Utils', 'EventManager', 'KeyController',
                  'StoreController', 'MessageController', 'Key', 'Thread', 'MessageWriter',
                  'messengerView', 'main'],
        out: '../dist/js/main.js',
        skipModuleInsertion: true,
        wrap: {
            start: '(function(){',
            end: 'require(["main"], null, null, true);})();'
        }
    },

    // injected scripts
    {
        include: ['ajaxProxy', 'fb-overrides'],
        out: '../dist/js/injected.js',
        skipModuleInsertion: true
    },


    {
        include: ['injector'],
        out: '../dist/js/injector.js',
        skipModuleInsertion: true
    },

    {
        include: ['almond', 'MessageReader', 'MessageWriter', 'StoreController', 'Key', 'background', 'TabManager', 'Tab'],
        out: '../dist/js/background.js',
        skipModuleInsertion: true,
        wrap: {
            start: '(function(){',
            end: 'require(["background"], null, null, true);})();'
        }
    }

]; 


// Function used to mix in baseConfig to a new config target
function mix(target) {
    for (var prop in baseConfig) {
        if (baseConfig.hasOwnProperty(prop)) {
            target[prop] = baseConfig[prop];
        }
    }
    return target;
}

//Create a runner that will run a separate build for each item
//in the configs array. Thanks to @jwhitley for this cleverness
var runner = configs.reduceRight(function(prev, currentConfig) {
  return function (buildReportText) { 
    console.log(buildReportText);
    requirejs.optimize(mix(currentConfig), prev);
  };
}, function(buildReportText) {
    console.log(buildReportText);
});

//Run the builds
runner();