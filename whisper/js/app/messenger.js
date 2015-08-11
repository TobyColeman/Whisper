define("messenger", ["KeyController", "messengerView", "MessageController"], function (KeyController, messengerView, MessageController) {
	KeyController.init();
	if (MessageController.init() === false){
		return;
	}
	messengerView.init();
});	
