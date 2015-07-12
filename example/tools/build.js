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
    baseUrl: "../js",
    locale: "en-us",
//  optimize: "uglify",
    optimize: "none", // For debugging built versions


    paths: {
        app: 'app',
        'BaseController': 'app/Controllers/Base',
        'c1': 'app/Controllers/c1',
        'c2': 'app/Controllers/c2',

        'BaseModel': 'app/Models/Base',
        'm1': 'app/Models/m1',
        'm2': 'app/Models/m2',

        'main1': 'app/main1',
        'main2': 'app/main2',

        'lib': 'app/lib',

        'jquery': 'lib/jquery',
        'almond': 'lib/almond',
    },
    wrap: {
        startFile: '../frags/start.js',
        // true = load synchronously. This is a feature of almond.js
        endFile: '../frags/end.js',
    },

    
    //All the built layers will use almond.
    // name: 'lib/almond'
 };

//Create an array of build configs, the baseConfig will
//be mixed in to each one of these below. Since each one needs to
//stand on their own, they all include jquery and the noConflict.js file

var configs = [
    {
        include: ['almond', 'jquery', 'lib', 'BaseController', 'c1', 'm1', 'main1'],
        // insertRequire: ['main1'],
        out: '../build/c1-main.js',
        skipModuleInsertion: true,
    },

    {
        include: ['almond', 'jquery', 'lib', 'BaseController', 'c2', 'm2', 'main2'],
        // insertRequire: ['main2'],
        out: '../build/c2-main.js',
        skipModuleInsertion: true,
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