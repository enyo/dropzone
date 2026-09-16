// The Emitter class provides the ability to call `.on()` on Dropzone to listen
// to events.
// It is strongly based on component's emitter class, and I removed the
// functionality because of the dependency hell with different frameworks.
export type EmitterListener = (...args: any[]) => void;

export default class Emitter {
  _callbacks?: Record<string, EmitterListener[]>;
  // Set by Dropzone: the element the DOM events are dispatched on.
  element?: HTMLElement;

  // Add an event listener for given event
  on(event: string, fn: EmitterListener): this {
    this._callbacks = this._callbacks || {};
    // Create namespace for this event
    if (!this._callbacks[event]) {
      this._callbacks[event] = [];
    }
    this._callbacks[event].push(fn);
    return this;
  }

  emit(event: string, ...args: any[]): this {
    this._callbacks = this._callbacks || {};
    let callbacks = this._callbacks[event!];

    if (callbacks) {
      // Iterating the live array would skip a listener whenever one of them
      // removes itself: `off` splices in place, so everything after the
      // removed entry shifts down past the loop's index. Snapshotting also
      // means a listener added by another listener does not run until the
      // next emit, which is how EventEmitter behaves. See #2367.
      for (let callback of callbacks.slice()) {
        callback.apply(this, args);
      }
    }
    // trigger a corresponding DOM event
    if (this.element) {
      this.element.dispatchEvent(this.makeEvent("dropzone:" + event, { args: args }));
    }
    return this;
  }

  makeEvent(eventName: string, detail: unknown): CustomEvent {
    let params = { bubbles: true, cancelable: true, detail: detail };

    if (typeof window.CustomEvent === "function") {
      return new CustomEvent(eventName, params);
    } else {
      // IE 11 support
      // https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent
      var evt = document.createEvent("CustomEvent");
      evt.initCustomEvent(eventName, params.bubbles, params.cancelable, params.detail);
      return evt;
    }
  }

  // Remove event listener for given event. If fn is not provided, all event
  // listeners for that event will be removed. If neither is provided, all
  // event listeners will be removed.
  off(event?: string, fn?: EmitterListener): this {
    if (!this._callbacks || arguments.length === 0) {
      this._callbacks = {};
      return this;
    }

    // specific event
    let callbacks = this._callbacks[event!];
    if (!callbacks) {
      return this;
    }

    // remove all handlers
    if (arguments.length === 1) {
      delete this._callbacks[event!];
      return this;
    }

    // remove specific handler
    for (let i = 0; i < callbacks.length; i++) {
      let callback = callbacks[i];
      if (callback === fn) {
        callbacks.splice(i, 1);
        break;
      }
    }

    return this;
  }
}
