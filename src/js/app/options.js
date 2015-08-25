define("options", ['KeyController', 'optionsView'], function(KeyController,
    optionsView) {

    optionsView.bindEvents();
    
    KeyController.init();
    
});
