class DebouncedInput extends HTMLElement {
  static get observedAttributes() {
    return ["delay", "class"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    
    // Add styles that inherit from the host
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: inline-block;
      }
      input {
        border: none;
        background: inherit;
        color: inherit;
        font: inherit;
        padding: 0;
        margin: 0;
        border-radius: inherit;
        outline: inherit;
        width: 100%;
        box-sizing: border-box;
      }
    `;
    this.shadowRoot.appendChild(style);
    
    this.input = document.createElement("input");
    this.input.type = "text";
    this.shadowRoot.appendChild(this.input);

    // Bind event handler
    this._onInput = this._onInput.bind(this);

    // Debounce timer and state
    this._debounceTimer = null;
    this._delayMs = this._getDelayMs();
    this._changeSessionActive = false; // Track if input:started has been emitted
  }

  connectedCallback() {
    this.input.addEventListener("input", this._onInput);

    // Apply classes to the internal input
    this._updateInputClasses();

    // Forward all relevant native events from the internal input to the custom element
    const eventsToForward = [
      "input",
      "change",
      "keydown",
      "keyup",
      "keypress",
      "click",
      "dblclick",
      "mousedown",
      "mouseup",
      "mouseenter",
      "mouseleave",
      "paste",
      "cut",
      "copy",
      "compositionstart",
      "compositionupdate",
      "compositionend",
    ];

    this._forwardedEventHandlers = [];

    eventsToForward.forEach((eventType) => {
      const handler = (e) => {
        // Forward the event using its constructor to preserve properties
        const event = new e.constructor(e.type, e);
        this.dispatchEvent(event);
      };
      this.input.addEventListener(eventType, handler);
      this._forwardedEventHandlers.push({ eventType, handler });
    });

    // Forward focus and blur manually to avoid duplicates
    this._focusHandler = () => {
      this.dispatchEvent(new Event("focus", { bubbles: true, composed: true }));
    };
    this._blurHandler = () => {
      this.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    };
    this.input.addEventListener("focus", this._focusHandler);
    this.input.addEventListener("blur", this._blurHandler);
  }

  disconnectedCallback() {
    this.input.removeEventListener("input", this._onInput);
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    // Remove forwarded event listeners
    if (this._forwardedEventHandlers) {
      this._forwardedEventHandlers.forEach(({ eventType, handler }) => {
        this.input.removeEventListener(eventType, handler);
      });
      this._forwardedEventHandlers = [];
    }
    // Remove manual focus/blur forwarding
    if (this._focusHandler) {
      this.input.removeEventListener("focus", this._focusHandler);
      this._focusHandler = null;
    }
    if (this._blurHandler) {
      this.input.removeEventListener("blur", this._blurHandler);
      this._blurHandler = null;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "delay":
        this._delayMs = this._getDelayMs();
        break;
      case "class":
        this._updateInputClasses();
        break;
    }
  }

  _updateInputClasses() {
    const classes = this.getAttribute("class");
    if (classes) {
      this.input.className = classes;
    } else {
      this.input.className = "";
    }
  }

  _getDelayMs() {
    const attr = this.getAttribute("delay");
    const ms = parseInt(attr, 10);
    return isNaN(ms) ? 0 : ms;
  }

  _onInput(event) {
    // Emit input:started if not already in a change session
    if (!this._changeSessionActive) {
      this._emitInputStarted();
      this._changeSessionActive = true;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    if (this._delayMs > 0) {
      this._debounceTimer = setTimeout(() => {
        this._emitInputEnded();
        this._debounceTimer = null;
        this._changeSessionActive = false;
      }, this._delayMs);
    } else {
      this._emitInputEnded();
      this._changeSessionActive = false;
    }
  }

  _emitInputStarted() {
    this.dispatchEvent(
      new CustomEvent("input:started", {
        detail: { value: this.input.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _emitInputEnded() {
    this.dispatchEvent(
      new CustomEvent("input:ended", {
        detail: { value: this.input.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Optional: value property for convenience
  get value() {
    return this.input.value;
  }
  set value(val) {
    this.input.value = val;
  }
}

customElements.define("debounced-input", DebouncedInput);
