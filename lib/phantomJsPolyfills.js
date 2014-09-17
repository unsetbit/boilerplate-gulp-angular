// From http://stackoverflow.com/questions/15739263/phantomjs-click-an-element
// Patch since PhantomJS does not implement click() on HTMLElement. In some 
// cases we need to execute the native click on an element. However, jQuery's 
// $.fn.click() does not dispatch to the native function on <a> elements, so we
// can't use it in our implementations: $el[0].click() to correctly dispatch.
if (!HTMLElement.prototype.click) {
  HTMLElement.prototype.click = function() {
    var ev = document.createEvent('MouseEvent');
    ev.initMouseEvent(
        'click',
        /*bubble*/true, /*cancelable*/true,
        window, null,
        0, 0, 0, 0, /*coordinates*/
        false, false, false, false, /*modifier keys*/
        0/*button=left*/, null
    );
    this.dispatchEvent(ev);
  };
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                 ? this
                 : oThis,
                 aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}