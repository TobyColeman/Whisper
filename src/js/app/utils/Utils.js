define(function() {

    var instance = null;

    function Utils() {
        if (instance !== null)
            throw new Error("Utils instance already exists");
    }

    /* 
     * adds an event listener to every element with X class
     * @param className {string}    the name of the classes the listener should be added to
     * @param listener  {string}    the event to be listened for 
     * @param callback  {function}  the function to be executed when event is fired
     */
    Utils.prototype.addListenerToClass = function(className, listener,
        callback) {

        var elements = document.getElementsByClassName(className);

        if (elements.length === 0) {
            return false;
        }

        for (var i = 0; i < elements.length; i++) {
            elements[i].addEventListener(listener, callback, false);
        }

        return true;
    }

    /*
     * little helper function to check if page has element with X class name
     * @param className {string} the name of the class
     */
    Utils.prototype.classExists = function(className) {

        if (document.getElementsByClassName(className)[0])
            return true;

        return false;
    }

    /* 
     * calls a function for each child of an element
     * @param node {Element} the root of the subtree
     * @param callback {function} operation performed on each node/child
     */
    Utils.prototype.forEachChild = function(node, callback) {

        callback(node);

        if (node.children !== undefined) {
            for (var i = 0; i < node.children.length; i++) {
                this.forEachChild(node.children[i], callback);
            }
        }
    }

    // find an object from an array by property value
    Utils.prototype.findObjWithAttribute = function(array, attr, value) {
        for (var i = 0; i < array.length; i += 1) {
            if (array[i][attr] === value) {
                return i;
            }
        }
    };

    // return singleton instance
    Utils.getInstance = function() {
        if (instance === null)
            instance = new Utils();
      
        return instance;
    }

    return Utils.getInstance();
    
});
