define("options", ['KeyController', 'optionsView'], function (KeyController, optionsView) {
    KeyController.init();
    optionsView.bindEvents();
});
