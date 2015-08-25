define("main", ["messengerView", "MessageController"], function(messengerView,
    MessageController) {

    MessageController.init(function(success) {

        if (success) {
            window.addEventListener('load', function() {
                messengerView.init();
            });
        }

    });
});
