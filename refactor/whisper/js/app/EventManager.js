define("EventManager", function(){

    var instance = null;
    var events = {};


    function EventManager(){
        if(instance !== null)
            throw new Error("EventManager instance already exists");
    }


    /* pushes an event and calls function(s) of any listeners
     * @param event {string} the name of the event being triggered
     * @param data  {any}	 data associated with an event trigger
     */
    EventManager.prototype.publish = function(event, data){
    	if(!events[event])
    		return false;

    	events[event].forEach(function(listener){
    		listener(data);
    	});
    }


    /* 
     * adds functions to listen for events
     * @param listener {function} the function called when an event is pushed to
     */
    EventManager.prototype.subscribe = function(event, listener){
    	if(!events[event])
    		events[event] = [];

    	events[event].push(listener);
    }


    /*
     * return singleton instance
     */
    EventManager.getInstance = function(){
        if(instance === null)
            instance = new EventManager();
        return instance;
    }

    return EventManager.getInstance();
});