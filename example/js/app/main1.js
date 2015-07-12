define('main', function (require) {
    var $ = require('jquery'),
        lib = require('lib'),
        controller = require('c1'),
        model = require('m1');

    //A fabricated API to show interaction of
    //common and specific pieces.
    controller.setModel(model);
    $(function () {
    	console.log('hi')
        controller.render(lib.getBody());
    });
});
