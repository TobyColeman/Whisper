define(function() {

    var instance = null;

    function Utils() {
        if (instance !== null)
            throw new Error("Utils instance already exists");
    }


    /* 
     * adds an event listener to every element with X class
     * @param className {string}	the name of the classes the listener should be added to
     * @param listener  {string} 	the event to be listened for 
     * @param callback  {function} the function to be executed when event is fired
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

    // return singleton instance
    Utils.getInstance = function() {
        if (instance === null)
            instance = new Utils();
        return instance;
    }

    return Utils.getInstance();
});
