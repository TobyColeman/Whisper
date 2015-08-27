define("EventManager", function() {
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
    EventManager.prototype.removeListener = function(event,
        listenerIndex) {

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
