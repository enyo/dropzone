import Emitter from "./emitter.js";
import defaultOptions from "./options.js";

export default class Dropzone extends Emitter {
  static initClass() {
    // Exposing the emitter class, mainly for tests
    this.prototype.Emitter = Emitter;

    /*
     This is a list of all available events you can register on a dropzone object.

     You can register an event handler like this:

     dropzone.on("dragEnter", function() { });

     */
    this.prototype.events = [
      "drop",
      "dragstart",
      "dragend",
      "dragenter",
      "dragover",
      "dragleave",
      "addedfile",
      "addedfiles",
      "removedfile",
      "thumbnail",
      "error",
      "errormultiple",
      "processing",
      "processingmultiple",
      "uploadprogress",
      "totaluploadprogress",
      "sending",
      "sendingmultiple",
      "success",
      "successmultiple",
      "canceled",
      "canceledmultiple",
      "complete",
      "completemultiple",
      "reset",
      "maxfilesexceeded",
      "maxfilesreached",
      "queuecomplete",
    ];

    this.prototype._thumbnailQueue = [];
    this.prototype._processingThumbnail = false;
  }

  // global utility
  static extend(target, ...objects) {
    for (let object of objects) {
      for (let key in object) {
        let val = object[key];
        target[key] = val;
      }
    }
    return target;
  }

  constructor(el, options) {
    super();
    let fallback, left;
    this.element = el;
    // For backwards compatibility since the version was in the prototype previously
    this.version = Dropzone.version;

    this.clickableElements = [];
    this.listeners = [];
    this.files = []; // All files

    if (typeof this.element === "string") {
      this.element = document.querySelector(this.element);
    }

    // Not checking if instance of HTMLElement or Element since IE9 is extremely weird.
    if (!this.element || this.element.nodeType == null) {
      throw new Error("Invalid dropzone element.");
    }

    if (this.element.dropzone) {
      throw new Error("Dropzone already attached.");
    }

    // Now add this dropzone to the instances.
    Dropzone.instances.push(this);

    // Put the dropzone inside the element itself.
    this.element.dropzone = this;

    let elementOptions =
      (left = Dropzone.optionsForElement(this.element)) != null ? left : {};

    this.options = Dropzone.extend(
      {},
      defaultOptions,
      elementOptions,
      options != null ? options : {}
    );

    this.options.previewTemplate = this.options.previewTemplate.replace(
      /\n*/g,
      ""
    );

    // If the browser failed, just call the fallback and leave
    if (this.options.forceFallback || !Dropzone.isBrowserSupported()) {
      return this.options.fallback.call(this);
    }

    // @options.url = @element.getAttribute "action" unless @options.url?
    if (this.options.url == null) {
      this.options.url = this.element.getAttribute("action");
    }

    if (!this.options.url) {
      throw new Error("No URL provided.");
    }

    if (this.options.acceptedFiles && this.options.acceptedMimeTypes) {
      throw new Error(
        "You can't provide both 'acceptedFiles' and 'acceptedMimeTypes'. 'acceptedMimeTypes' is deprecated."
      );
    }

    if (this.options.uploadMultiple && this.options.chunking) {
      throw new Error("You cannot set both: uploadMultiple and chunking.");
    }

    // Backwards compatibility
    if (this.options.acceptedMimeTypes) {
      this.options.acceptedFiles = this.options.acceptedMimeTypes;
      delete this.options.acceptedMimeTypes;
    }

    // Backwards compatibility
    if (this.options.renameFilename != null) {
      this.options.renameFile = (file) =>
        this.options.renameFilename.call(this, file.name, file);
    }

    if (typeof this.options.method === "string") {
      this.options.method = this.options.method.toUpperCase();
    }

    if ((fallback = this.getExistingFallback()) && fallback.parentNode) {
      // Remove the fallback
      fallback.parentNode.removeChild(fallback);
    }

    // Display previews in the previewsContainer element or the Dropzone element unless explicitly set to false
    if (this.options.previewsContainer !== false) {
      if (this.options.previewsContainer) {
        this.previewsContainer = Dropzone.getElement(
          this.options.previewsContainer,
          "previewsContainer"
        );
      } else {
        this.previewsContainer = this.element;
      }
    }

    if (this.options.clickable) {
      if (this.options.clickable === true) {
        this.clickableElements = [this.element];
      } else {
        this.clickableElements = Dropzone.getElements(
          this.options.clickable,
          "clickable"
        );
      }
    }

    this.init();
  }

  // Returns all files that have been accepted
  getAcceptedFiles() {
    return this.files.filter((file) => file.accepted).map((file) => file);
  }

  // Returns all files that have been rejected
  // Not sure when that's going to be useful, but added for completeness.
  getRejectedFiles() {
    return this.files.filter((file) => !file.accepted).map((file) => file);
  }

  getFilesWithStatus(status) {
    return this.files
      .filter((file) => file.status === status)
      .map((file) => file);
  }

  // Returns all files that are in the queue
  getQueuedFiles() {
    return this.getFilesWithStatus(Dropzone.QUEUED);
  }

  getUploadingFiles() {
    return this.getFilesWithStatus(Dropzone.UPLOADING);
  }

  getAddedFiles() {
    return this.getFilesWithStatus(Dropzone.ADDED);
  }

  // Files that are either queued or uploading
  getActiveFiles() {
    return this.files
      .filter(
        (file) =>
          file.status === Dropzone.UPLOADING || file.status === Dropzone.QUEUED
      )
      .map((file) => file);
  }

  // The function that gets called when Dropzone is initialized. You
  // can (and should) setup event listeners inside this function.
  init() {
    // In case it isn't set already
    if (this.element.tagName === "form") {
      this.element.setAttribute("enctype", "multipart/form-data");
    }

    if (
      this.element.classList.contains("dropzone") &&
      !this.element.querySelector(".dz-message")
    ) {
      this.element.appendChild(
        Dropzone.createElement(
          `<div class="dz-default dz-message"><button class="dz-button" type="button">${this.options.dictDefaultMessage}</button></div>`
        )
      );
    }

    if (this.clickableElements.length) {
      let setupHiddenFileInput = () => {
        if (this.hiddenFileInput) {
          this.hiddenFileInput.parentNode.removeChild(this.hiddenFileInput);
        }
        this.hiddenFileInput = document.createElement("input");
        this.hiddenFileInput.setAttribute("type", "file");
        if (this.options.maxFiles === null || this.options.maxFiles > 1) {
          this.hiddenFileInput.setAttribute("multiple", "multiple");
        }
        this.hiddenFileInput.className = "dz-hidden-input";

        if (this.options.acceptedFiles !== null) {
          this.hiddenFileInput.setAttribute(
            "accept",
            this.options.acceptedFiles
          );
        }
        if (this.options.capture !== null) {
          this.hiddenFileInput.setAttribute("capture", this.options.capture);
        }

        // Making sure that no one can "tab" into this field.
        this.hiddenFileInput.setAttribute("tabindex", "-1");

        // Not setting `display="none"` because some browsers don't accept clicks
        // on elements that aren't displayed.
        this.hiddenFileInput.style.visibility = "hidden";
        this.hiddenFileInput.style.position = "absolute";
        this.hiddenFileInput.style.top = "0";
        this.hiddenFileInput.style.left = "0";
        this.hiddenFileInput.style.height = "0";
        this.hiddenFileInput.style.width = "0";
        Dropzone.getElement(
          this.options.hiddenInputContainer,
          "hiddenInputContainer"
        ).appendChild(this.hiddenFileInput);
        this.hiddenFileInput.addEventListener("change", () => {
          let { files } = this.hiddenFileInput;
          if (files.length) {
            for (let file of files) {
              this.addFile(file);
            }
          }
          this.emit("addedfiles", files);
          setupHiddenFileInput();
        });
      };
      setupHiddenFileInput();
    }

    this.URL = window.URL !== null ? window.URL : window.webkitURL;

    // Setup all event listeners on the Dropzone object itself.
    // They're not in @setupEventListeners() because they shouldn't be removed
    // again when the dropzone gets disabled.
    for (let eventName of this.events) {
      this.on(eventName, this.options[eventName]);
    }

    this.on("uploadprogress", () => this.updateTotalUploadProgress());

    this.on("removedfile", () => this.updateTotalUploadProgress());

    this.on("canceled", (file) => this.emit("complete", file));

    // Emit a `queuecomplete` event if all files finished uploading.
    this.on("complete", (file) => {
      if (
        this.getAddedFiles().length === 0 &&
        this.getUploadingFiles().length === 0 &&
        this.getQueuedFiles().length === 0
      ) {
        // This needs to be deferred so that `queuecomplete` really triggers after `complete`
        return setTimeout(() => this.emit("queuecomplete"), 0);
      }
    });

    const containsFiles = function (e) {
      if (e.dataTransfer.types) {
        // Because e.dataTransfer.types is an Object in
        // IE, we need to iterate like this instead of
        // using e.dataTransfer.types.some()
        for (var i = 0; i < e.dataTransfer.types.length; i++) {
          if (e.dataTransfer.types[i] === "Files") return true;
        }
      }
      return false;
    };

    let noPropagation = function (e) {
      // If there are no files, we don't want to stop
      // propagation so we don't interfere with other
      // drag and drop behaviour.
      if (!containsFiles(e)) return;
      e.stopPropagation();
      if (e.preventDefault) {
        return e.preventDefault();
      } else {
        return (e.returnValue = false);
      }
    };

    // Create the listeners
    this.listeners = [
      {
        element: this.element,
        events: {
          dragstart: (e) => {
            return this.emit("dragstart", e);
          },
          dragenter: (e) => {
            noPropagation(e);
            return this.emit("dragenter", e);
          },
          dragover: (e) => {
            // Makes it possible to drag files from chrome's download bar
            // http://stackoverflow.com/questions/19526430/drag-and-drop-file-uploads-from-chrome-downloads-bar
            // Try is required to prevent bug in Internet Explorer 11 (SCRIPT65535 exception)
            let efct;
            try {
              efct = e.dataTransfer.effectAllowed;
            } catch (error) {}
            e.dataTransfer.dropEffect =
              "move" === efct || "linkMove" === efct ? "move" : "copy";

            noPropagation(e);
            return this.emit("dragover", e);
          },
          dragleave: (e) => {
            return this.emit("dragleave", e);
          },
          drop: (e) => {
            noPropagation(e);
            return this.drop(e);
          },
          dragend: (e) => {
            return this.emit("dragend", e);
          },
        },

        // This is disabled right now, because the browsers don't implement it properly.
        // "paste": (e) =>
        //   noPropagation e
        //   @paste e
      },
    ];

    this.clickableElements.forEach((clickableElement) => {
      return this.listeners.push({
        element: clickableElement,
        events: {
          click: (evt) => {
            // Only the actual dropzone or the message element should trigger file selection
            if (
              clickableElement !== this.element ||
              evt.target === this.element ||
              Dropzone.elementInside(
                evt.target,
                this.element.querySelector(".dz-message")
              )
            ) {
              this.hiddenFileInput.click(); // Forward the click
            }
            return true;
          },
        },
      });
    });

    this.enable();

    return this.options.init.call(this);
  }

  // Not fully tested yet
  destroy() {
    this.disable();
    this.removeAllFiles(true);
    if (
      this.hiddenFileInput != null ? this.hiddenFileInput.parentNode : undefined
    ) {
      this.hiddenFileInput.parentNode.removeChild(this.hiddenFileInput);
      this.hiddenFileInput = null;
    }
    delete this.element.dropzone;
    return Dropzone.instances.splice(Dropzone.instances.indexOf(this), 1);
  }

  updateTotalUploadProgress() {
    let totalUploadProgress;
    let totalBytesSent = 0;
    let totalBytes = 0;

    let activeFiles = this.getActiveFiles();

    if (activeFiles.length) {
      for (let file of this.getActiveFiles()) {
        totalBytesSent += file.upload.bytesSent;
        totalBytes += file.upload.total;
      }
      totalUploadProgress = (100 * totalBytesSent) / totalBytes;
    } else {
      totalUploadProgress = 100;
    }

    return this.emit(
      "totaluploadprogress",
      totalUploadProgress,
      totalBytes,
      totalBytesSent
    );
  }

  // @options.paramName can be a function taking one parameter rather than a string.
  // A parameter name for a file is obtained simply by calling this with an index number.
  _getParamName(n) {
    if (typeof this.options.paramName === "function") {
      return this.options.paramName(n);
    } else {
      return `${this.options.paramName}${
        this.options.uploadMultiple ? `[${n}]` : ""
      }`;
    }
  }

  // If @options.renameFile is a function,
  // the function will be used to rename the file.name before appending it to the formData
  _renameFile(file) {
    if (typeof this.options.renameFile !== "function") {
      return file.name;
    }
    return this.options.renameFile(file);
  }

  // Returns a form that can be used as fallback if the browser does not support DragnDrop
  //
  // If the dropzone is already a form, only the input field and button are returned. Otherwise a complete form element is provided.
  // This code has to pass in IE7 :(
  getFallbackForm() {
    let existingFallback, form;
    if ((existingFallback = this.getExistingFallback())) {
      return existingFallback;
    }

    let fieldsString = '<div class="dz-fallback">';
    if (this.options.dictFallbackText) {
      fieldsString += `<p>${this.options.dictFallbackText}</p>`;
    }
    fieldsString += `<input type="file" name="${this._getParamName(0)}" ${
      this.options.uploadMultiple ? 'multiple="multiple"' : undefined
    } /><input type="submit" value="Upload!"></div>`;

    let fields = Dropzone.createElement(fieldsString);
    if (this.element.tagName !== "FORM") {
      form = Dropzone.createElement(
        `<form action="${this.options.url}" enctype="multipart/form-data" method="${this.options.method}"></form>`
      );
      form.appendChild(fields);
    } else {
      // Make sure that the enctype and method attributes are set properly
      this.element.setAttribute("enctype", "multipart/form-data");
      this.element.setAttribute("method", this.options.method);
    }
    return form != null ? form : fields;
  }

  // Returns the fallback elements if they exist already
  //
  // This code has to pass in IE7 :(
  getExistingFallback() {
    let getFallback = function (elements) {
      for (let el of elements) {
        if (/(^| )fallback($| )/.test(el.className)) {
          return el;
        }
      }
    };

    for (let tagName of ["div", "form"]) {
      var fallback;
      if (
        (fallback = getFallback(this.element.getElementsByTagName(tagName)))
      ) {
        return fallback;
      }
    }
  }

  // Activates all listeners stored in @listeners
  setupEventListeners() {
    return this.listeners.map((elementListeners) =>
      (() => {
        let result = [];
        for (let event in elementListeners.events) {
          let listener = elementListeners.events[event];
          result.push(
            elementListeners.element.addEventListener(event, listener, false)
          );
        }
        return result;
      })()
    );
  }

  // Deactivates all listeners stored in @listeners
  removeEventListeners() {
    return this.listeners.map((elementListeners) =>
      (() => {
        let result = [];
        for (let event in elementListeners.events) {
          let listener = elementListeners.events[event];
          result.push(
            elementListeners.element.removeEventListener(event, listener, false)
          );
        }
        return result;
      })()
    );
  }

  // Removes all event listeners and cancels all files in the queue or being processed.
  disable() {
    this.clickableElements.forEach((element) =>
      element.classList.remove("dz-clickable")
    );
    this.removeEventListeners();
    this.disabled = true;

    return this.files.map((file) => this.cancelUpload(file));
  }

  enable() {
    delete this.disabled;
    this.clickableElements.forEach((element) =>
      element.classList.add("dz-clickable")
    );
    return this.setupEventListeners();
  }

  // Returns a nicely formatted filesize
  filesize(size) {
    let selectedSize = 0;
    let selectedUnit = "b";

    if (size > 0) {
      let units = ["tb", "gb", "mb", "kb", "b"];

      for (let i = 0; i < units.length; i++) {
        let unit = units[i];
        let cutoff = Math.pow(this.options.filesizeBase, 4 - i) / 10;

        if (size >= cutoff) {
          selectedSize = size / Math.pow(this.options.filesizeBase, 4 - i);
          selectedUnit = unit;
          break;
        }
      }

      selectedSize = Math.round(10 * selectedSize) / 10; // Cutting of digits
    }

    return `<strong>${selectedSize}</strong> ${this.options.dictFileSizeUnits[selectedUnit]}`;
  }

  // Adds or removes the `dz-max-files-reached` class from the form.
  _updateMaxFilesReachedClass() {
    if (
      this.options.maxFiles != null &&
      this.getAcceptedFiles().length >= this.options.maxFiles
    ) {
      if (this.getAcceptedFiles().length === this.options.maxFiles) {
        this.emit("maxfilesreached", this.files);
      }
      return this.element.classList.add("dz-max-files-reached");
    } else {
      return this.element.classList.remove("dz-max-files-reached");
    }
  }

  drop(e) {
    if (!e.dataTransfer) {
      return;
    }
    this.emit("drop", e);

    // Convert the FileList to an Array
    // This is necessary for IE11
    let files = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      files[i] = e.dataTransfer.files[i];
    }

    // Even if it's a folder, files.length will contain the folders.
    if (files.length) {
      let { items } = e.dataTransfer;
      if (items && items.length && items[0].webkitGetAsEntry != null) {
        // The browser supports dropping of folders, so handle items instead of files
        this._addFilesFromItems(items);
      } else {
        this.handleFiles(files);
      }
    }

    this.emit("addedfiles", files);
  }

  paste(e) {
    if (
      __guard__(e != null ? e.clipboardData : undefined, (x) => x.items) == null
    ) {
      return;
    }

    this.emit("paste", e);
    let { items } = e.clipboardData;

    if (items.length) {
      return this._addFilesFromItems(items);
    }
  }

  handleFiles(files) {
    for (let file of files) {
      this.addFile(file);
    }
  }

  // When a folder is dropped (or files are pasted), items must be handled
  // instead of files.
  _addFilesFromItems(items) {
    return (() => {
      let result = [];
      for (let item of items) {
        var entry;
        if (
          item.webkitGetAsEntry != null &&
          (entry = item.webkitGetAsEntry())
        ) {
          if (entry.isFile) {
            result.push(this.addFile(item.getAsFile()));
          } else if (entry.isDirectory) {
            // Append all files from that directory to files
            result.push(this._addFilesFromDirectory(entry, entry.name));
          } else {
            result.push(undefined);
          }
        } else if (item.getAsFile != null) {
          if (item.kind == null || item.kind === "file") {
            result.push(this.addFile(item.getAsFile()));
          } else {
            result.push(undefined);
          }
        } else {
          result.push(undefined);
        }
      }
      return result;
    })();
  }

  // Goes through the directory, and adds each file it finds recursively
  _addFilesFromDirectory(directory, path) {
    let dirReader = directory.createReader();

    let errorHandler = (error) =>
      __guardMethod__(console, "log", (o) => o.log(error));

    var readEntries = () => {
      return dirReader.readEntries((entries) => {
        if (entries.length > 0) {
          for (let entry of entries) {
            if (entry.isFile) {
              entry.file((file) => {
                if (
                  this.options.ignoreHiddenFiles &&
                  file.name.substring(0, 1) === "."
                ) {
                  return;
                }
                file.fullPath = `${path}/${file.name}`;
                return this.addFile(file);
              });
            } else if (entry.isDirectory) {
              this._addFilesFromDirectory(entry, `${path}/${entry.name}`);
            }
          }

          // Recursively call readEntries() again, since browser only handle
          // the first 100 entries.
          // See: https://developer.mozilla.org/en-US/docs/Web/API/DirectoryReader#readEntries
          readEntries();
        }
        return null;
      }, errorHandler);
    };

    return readEntries();
  }

  // If `done()` is called without argument the file is accepted
  // If you call it with an error message, the file is rejected
  // (This allows for asynchronous validation)
  //
  // This function checks the filesize, and if the file.type passes the
  // `acceptedFiles` check.
  accept(file, done) {
    if (
      this.options.maxFilesize &&
      file.size > this.options.maxFilesize * 1024 * 1024
    ) {
      done(
        this.options.dictFileTooBig
          .replace("{{filesize}}", Math.round(file.size / 1024 / 10.24) / 100)
          .replace("{{maxFilesize}}", this.options.maxFilesize)
      );
    } else if (!Dropzone.isValidFile(file, this.options.acceptedFiles)) {
      done(this.options.dictInvalidFileType);
    } else if (
      this.options.maxFiles != null &&
      this.getAcceptedFiles().length >= this.options.maxFiles
    ) {
      done(
        this.options.dictMaxFilesExceeded.replace(
          "{{maxFiles}}",
          this.options.maxFiles
        )
      );
      this.emit("maxfilesexceeded", file);
    } else {
      this.options.accept.call(this, file, done);
    }
  }

  addFile(file) {
    file.upload = {
      uuid: Dropzone.uuidv4(),
      progress: 0,
      // Setting the total upload size to file.size for the beginning
      // It's actual different than the size to be transmitted.
      total: file.size,
      bytesSent: 0,
      filename: this._renameFile(file),
      // Not setting chunking information here, because the acutal data — and
      // thus the chunks — might change if `options.transformFile` is set
      // and does something to the data.
    };
    this.files.push(file);

    file.status = Dropzone.ADDED;

    this.emit("addedfile", file);

    this._enqueueThumbnail(file);

    this.accept(file, (error) => {
      if (error) {
        file.accepted = false;
        this._errorProcessing([file], error); // Will set the file.status
      } else {
        file.accepted = true;
        if (this.options.autoQueue) {
          this.enqueueFile(file);
        } // Will set .accepted = true
      }
      this._updateMaxFilesReachedClass();
    });
  }

  // Wrapper for enqueueFile
  enqueueFiles(files) {
    for (let file of files) {
      this.enqueueFile(file);
    }
    return null;
  }

  enqueueFile(file) {
    if (file.status === Dropzone.ADDED && file.accepted === true) {
      file.status = Dropzone.QUEUED;
      if (this.options.autoProcessQueue) {
        return setTimeout(() => this.processQueue(), 0); // Deferring the call
      }
    } else {
      throw new Error(
        "This file can't be queued because it has already been processed or was rejected."
      );
    }
  }

  _enqueueThumbnail(file) {
    if (
      this.options.createImageThumbnails &&
      file.type.match(/image.*/) &&
      file.size <= this.options.maxThumbnailFilesize * 1024 * 1024
    ) {
      this._thumbnailQueue.push(file);
      return setTimeout(() => this._processThumbnailQueue(), 0); // Deferring the call
    }
  }

  _processThumbnailQueue() {
    if (this._processingThumbnail || this._thumbnailQueue.length === 0) {
      return;
    }

    this._processingThumbnail = true;
    let file = this._thumbnailQueue.shift();
    return this.createThumbnail(
      file,
      this.options.thumbnailWidth,
      this.options.thumbnailHeight,
      this.options.thumbnailMethod,
      true,
      (dataUrl) => {
        this.emit("thumbnail", file, dataUrl);
        this._processingThumbnail = false;
        return this._processThumbnailQueue();
      }
    );
  }

  // Can be called by the user to remove a file
  removeFile(file) {
    if (file.status === Dropzone.UPLOADING) {
      this.cancelUpload(file);
    }
    this.files = without(this.files, file);

    this.emit("removedfile", file);
    if (this.files.length === 0) {
      return this.emit("reset");
    }
  }

  // Removes all files that aren't currently processed from the list
  removeAllFiles(cancelIfNecessary) {
    // Create a copy of files since removeFile() changes the @files array.
    if (cancelIfNecessary == null) {
      cancelIfNecessary = false;
    }
    for (let file of this.files.slice()) {
      if (file.status !== Dropzone.UPLOADING || cancelIfNecessary) {
        this.removeFile(file);
      }
    }
    return null;
  }

  // Resizes an image before it gets sent to the server. This function is the default behavior of
  // `options.transformFile` if `resizeWidth` or `resizeHeight` are set. The callback is invoked with
  // the resized blob.
  resizeImage(file, width, height, resizeMethod, callback) {
    return this.createThumbnail(
      file,
      width,
      height,
      resizeMethod,
      true,
      (dataUrl, canvas) => {
        if (canvas == null) {
          // The image has not been resized
          return callback(file);
        } else {
          let { resizeMimeType } = this.options;
          if (resizeMimeType == null) {
            resizeMimeType = file.type;
          }
          let resizedDataURL = canvas.toDataURL(
            resizeMimeType,
            this.options.resizeQuality
          );
          if (
            resizeMimeType === "image/jpeg" ||
            resizeMimeType === "image/jpg"
          ) {
            // Now add the original EXIF information
            resizedDataURL = restoreExif(file.dataURL, resizedDataURL);
          }
          return callback(Dropzone.dataURItoBlob(resizedDataURL));
        }
      },
      true
    );
  }

  createThumbnail(file, width, height, resizeMethod, fixOrientation, callback, ignoreExif = false) {
    let fileReader = new FileReader();

    fileReader.onload = () => {
      file.dataURL = fileReader.result;

      // Don't bother creating a thumbnail for SVG images since they're vector
      if (file.type === "image/svg+xml") {
        if (callback != null) {
          callback(fileReader.result);
        }
        return;
      }

      this.createThumbnailFromUrl(
        file,
        width,
        height,
        resizeMethod,
        fixOrientation,
        callback,
        undefined,
        ignoreExif
      );
    };

    fileReader.readAsDataURL(file);
  }

  // `mockFile` needs to have these attributes:
  //
  //     { name: 'name', size: 12345, imageUrl: '' }
  //
  // `callback` will be invoked when the image has been downloaded and displayed.
  // `crossOrigin` will be added to the `img` tag when accessing the file.
  displayExistingFile(
    mockFile,
    imageUrl,
    callback,
    crossOrigin,
    resizeThumbnail = true
  ) {
    this.emit("addedfile", mockFile);
    this.emit("complete", mockFile);

    if (!resizeThumbnail) {
      this.emit("thumbnail", mockFile, imageUrl);
      if (callback) callback();
    } else {
      let onDone = (thumbnail) => {
        this.emit("thumbnail", mockFile, thumbnail);
        if (callback) callback();
      };
      mockFile.dataURL = imageUrl;

      this.createThumbnailFromUrl(
        mockFile,
        this.options.thumbnailWidth,
        this.options.thumbnailHeight,
        this.options.resizeMethod,
        this.options.fixOrientation,
        onDone,
        crossOrigin
      );
    }
  }

  createThumbnailFromUrl(
    file,
    width,
    height,
    resizeMethod,
    fixOrientation,
    callback,
    crossOrigin,
    ignoreExif = false
  ) {
    // Not using `new Image` here because of a bug in latest Chrome versions.
    // See https://github.com/enyo/dropzone/pull/226
    let img = document.createElement("img");

    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }

    // fixOrientation is not needed anymore with browsers handling imageOrientation
    fixOrientation =
      getComputedStyle(document.body)["imageOrientation"] == "from-image"
        ? false
        : fixOrientation;

    img.onload = () => {
      let loadExif = (callback) => callback(1);
      if (typeof EXIF !== "undefined" && EXIF !== null && fixOrientation) {
        loadExif = (callback) =>
          EXIF.getData(img, function () {
            return callback(EXIF.getTag(this, "Orientation"));
          });
      }

      return loadExif((orientation) => {
        file.width = img.width;
        file.height = img.height;

        let resizeInfo = this.options.resize.call(
          this,
          file,
          width,
          height,
          resizeMethod
        );

        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");

        canvas.width = resizeInfo.trgWidth;
        canvas.height = resizeInfo.trgHeight;

        if (orientation > 4) {
          canvas.width = resizeInfo.trgHeight;
          canvas.height = resizeInfo.trgWidth;
        }

        switch (orientation) {
          case 2:
            // horizontal flip
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            break;
          case 3:
            // 180° rotate left
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 4:
            // vertical flip
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            break;
          case 5:
            // vertical flip + 90 rotate right
            ctx.rotate(0.5 * Math.PI);
            ctx.scale(1, -1);
            break;
          case 6:
            // 90° rotate right
            ctx.rotate(0.5 * Math.PI);
            ctx.translate(0, -canvas.width);
            break;
          case 7:
            // horizontal flip + 90 rotate right
            ctx.rotate(0.5 * Math.PI);
            ctx.translate(canvas.height, -canvas.width);
            ctx.scale(-1, 1);
            break;
          case 8:
            // 90° rotate left
            ctx.rotate(-0.5 * Math.PI);
            ctx.translate(-canvas.height, 0);
            break;
        }

        // This is a bugfix for iOS' scaling bug.
        drawImageIOSFix(
          ctx,
          img,
          resizeInfo.srcX != null ? resizeInfo.srcX : 0,
          resizeInfo.srcY != null ? resizeInfo.srcY : 0,
          resizeInfo.srcWidth,
          resizeInfo.srcHeight,
          resizeInfo.trgX != null ? resizeInfo.trgX : 0,
          resizeInfo.trgY != null ? resizeInfo.trgY : 0,
          resizeInfo.trgWidth,
          resizeInfo.trgHeight
        );

        let thumbnail = canvas.toDataURL("image/png");

        if (callback != null) {
          return callback(thumbnail, canvas);
        }
      });
    };

    if (callback != null) {
      img.onerror = callback;
    }

    var dataURL = file.dataURL;
    if (ignoreExif) {
       dataURL = removeExif(dataURL);
    }

    return (img.src = dataURL);
  }

  // Goes through the queue and processes files if there aren't too many already.
  processQueue() {
    let { parallelUploads } = this.options;
    let processingLength = this.getUploadingFiles().length;
    let i = processingLength;

    // There are already at least as many files uploading than should be
    if (processingLength >= parallelUploads) {
      return;
    }

    let queuedFiles = this.getQueuedFiles();

    if (!(queuedFiles.length > 0)) {
      return;
    }

    if (this.options.uploadMultiple) {
      // The files should be uploaded in one request
      return this.processFiles(
        queuedFiles.slice(0, parallelUploads - processingLength)
      );
    } else {
      while (i < parallelUploads) {
        if (!queuedFiles.length) {
          return;
        } // Nothing left to process
        this.processFile(queuedFiles.shift());
        i++;
      }
    }
  }

  // Wrapper for `processFiles`
  processFile(file) {
    return this.processFiles([file]);
  }

  // Loads the file, then calls finishedLoading()
  processFiles(files) {
    for (let file of files) {
      file.processing = true; // Backwards compatibility
      file.status = Dropzone.UPLOADING;

      this.emit("processing", file);
    }

    if (this.options.uploadMultiple) {
      this.emit("processingmultiple", files);
    }

    return this.uploadFiles(files);
  }

  _getFilesWithXhr(xhr) {
    let files;
    return (files = this.files
      .filter((file) => file.xhr === xhr)
      .map((file) => file));
  }

  // Cancels the file upload and sets the status to CANCELED
  // **if** the file is actually being uploaded.
  // If it's still in the queue, the file is being removed from it and the status
  // set to CANCELED.
  cancelUpload(file) {
    if (file.status === Dropzone.UPLOADING) {
      let groupedFiles = this._getFilesWithXhr(file.xhr);
      for (let groupedFile of groupedFiles) {
        groupedFile.status = Dropzone.CANCELED;
      }
      if (typeof file.xhr !== "undefined") {
        file.xhr.abort();
      }
      for (let groupedFile of groupedFiles) {
        this.emit("canceled", groupedFile);
      }
      if (this.options.uploadMultiple) {
        this.emit("canceledmultiple", groupedFiles);
      }
    } else if (
      file.status === Dropzone.ADDED ||
      file.status === Dropzone.QUEUED
    ) {
      file.status = Dropzone.CANCELED;
      this.emit("canceled", file);
      if (this.options.uploadMultiple) {
        this.emit("canceledmultiple", [file]);
      }
    }

    if (this.options.autoProcessQueue) {
      return this.processQueue();
    }
  }

  resolveOption(option, ...args) {
    if (typeof option === "function") {
      return option.apply(this, args);
    }
    return option;
  }

  uploadFile(file) {
    return this.uploadFiles([file]);
  }

  uploadFiles(files) {
    this._transformFiles(files, (transformedFiles) => {
      if (this.options.chunking) {
        // Chunking is not allowed to be used with `uploadMultiple` so we know
        // that there is only __one__file.
        let transformedFile = transformedFiles[0];
        files[0].upload.chunked =
          this.options.chunking &&
          (this.options.forceChunking ||
            transformedFile.size > this.options.chunkSize);
        files[0].upload.totalChunkCount = Math.ceil(
          transformedFile.size / this.options.chunkSize
        );
      }

      if (files[0].upload.chunked) {
        // This file should be sent in chunks!

        // If the chunking option is set, we **know** that there can only be **one** file, since
        // uploadMultiple is not allowed with this option.
        let file = files[0];
        let transformedFile = transformedFiles[0];
        let startedChunkCount = 0;

        file.upload.chunks = [];

        let handleNextChunk = () => {
          let chunkIndex = 0;

          // Find the next item in file.upload.chunks that is not defined yet.
          while (file.upload.chunks[chunkIndex] !== undefined) {
            chunkIndex++;
          }

          // This means, that all chunks have already been started.
          if (chunkIndex >= file.upload.totalChunkCount) return;

          startedChunkCount++;

          let start = chunkIndex * this.options.chunkSize;
          let end = Math.min(
            start + this.options.chunkSize,
            transformedFile.size
          );

          let dataBlock = {
            name: this._getParamName(0),
            data: transformedFile.webkitSlice
              ? transformedFile.webkitSlice(start, end)
              : transformedFile.slice(start, end),
            filename: file.upload.filename,
            chunkIndex: chunkIndex,
          };

          file.upload.chunks[chunkIndex] = {
            file: file,
            index: chunkIndex,
            dataBlock: dataBlock, // In case we want to retry.
            status: Dropzone.UPLOADING,
            progress: 0,
            retries: 0, // The number of times this block has been retried.
          };

          this._uploadData(files, [dataBlock]);
        };

        file.upload.finishedChunkUpload = (chunk, response) => {
          let allFinished = true;
          chunk.status = Dropzone.SUCCESS;

          // Clear the data from the chunk
          chunk.dataBlock = null;
          // Leaving this reference to xhr intact here will cause memory leaks in some browsers
          chunk.xhr = null;

          for (let i = 0; i < file.upload.totalChunkCount; i++) {
            if (file.upload.chunks[i] === undefined) {
              return handleNextChunk();
            }
            if (file.upload.chunks[i].status !== Dropzone.SUCCESS) {
              allFinished = false;
            }
          }

          if (allFinished) {
            this.options.chunksUploaded(file, () => {
              this._finished(files, response, null);
            });
          }
        };

        if (this.options.parallelChunkUploads) {
          for (let i = 0; i < file.upload.totalChunkCount; i++) {
            handleNextChunk();
          }
        } else {
          handleNextChunk();
        }
      } else {
        let dataBlocks = [];
        for (let i = 0; i < files.length; i++) {
          dataBlocks[i] = {
            name: this._getParamName(i),
            data: transformedFiles[i],
            filename: files[i].upload.filename,
          };
        }
        this._uploadData(files, dataBlocks);
      }
    });
  }

  /// Returns the right chunk for given file and xhr
  _getChunk(file, xhr) {
    for (let i = 0; i < file.upload.totalChunkCount; i++) {
      if (
        file.upload.chunks[i] !== undefined &&
        file.upload.chunks[i].xhr === xhr
      ) {
        return file.upload.chunks[i];
      }
    }
  }

  // This function actually uploads the file(s) to the server.
  // If dataBlocks contains the actual data to upload (meaning, that this could either be transformed
  // files, or individual chunks for chunked upload).
  _uploadData(files, dataBlocks) {
    let xhr = new XMLHttpRequest();

    // Put the xhr object in the file objects to be able to reference it later.
    for (let file of files) {
      file.xhr = xhr;
    }
    if (files[0].upload.chunked) {
      // Put the xhr object in the right chunk object, so it can be associated later, and found with _getChunk
      files[0].upload.chunks[dataBlocks[0].chunkIndex].xhr = xhr;
    }

    let method = this.resolveOption(this.options.method, files);
    let url = this.resolveOption(this.options.url, files);
    xhr.open(method, url, true);

    // Setting the timeout after open because of IE11 issue: https://gitlab.com/meno/dropzone/issues/8
    let timeout = this.resolveOption(this.options.timeout, files);
    if (timeout) xhr.timeout = this.resolveOption(this.options.timeout, files);

    // Has to be after `.open()`. See https://github.com/enyo/dropzone/issues/179
    xhr.withCredentials = !!this.options.withCredentials;

    xhr.onload = (e) => {
      this._finishedUploading(files, xhr, e);
    };

    xhr.ontimeout = () => {
      this._handleUploadError(
        files,
        xhr,
        `Request timedout after ${this.options.timeout / 1000} seconds`
      );
    };

    xhr.onerror = () => {
      this._handleUploadError(files, xhr);
    };

    // Some browsers do not have the .upload property
    let progressObj = xhr.upload != null ? xhr.upload : xhr;
    progressObj.onprogress = (e) =>
      this._updateFilesUploadProgress(files, xhr, e);

    let headers = {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (this.options.headers) {
      Dropzone.extend(headers, this.options.headers);
    }

    for (let headerName in headers) {
      let headerValue = headers[headerName];
      if (headerValue) {
        xhr.setRequestHeader(headerName, headerValue);
      }
    }

    let formData = new FormData();

    // Adding all @options parameters
    if (this.options.params) {
      let additionalParams = this.options.params;
      if (typeof additionalParams === "function") {
        additionalParams = additionalParams.call(
          this,
          files,
          xhr,
          files[0].upload.chunked ? this._getChunk(files[0], xhr) : null
        );
      }

      for (let key in additionalParams) {
        let value = additionalParams[key];
        if (Array.isArray(value)) {
          // The additional parameter contains an array,
          // so lets iterate over it to attach each value
          // individually.
          for (let i = 0; i < value.length; i++) {
            formData.append(key, value[i]);
          }
        } else {
          formData.append(key, value);
        }
      }
    }

    // Let the user add additional data if necessary
    for (let file of files) {
      this.emit("sending", file, xhr, formData);
    }
    if (this.options.uploadMultiple) {
      this.emit("sendingmultiple", files, xhr, formData);
    }

    this._addFormElementData(formData);

    // Finally add the files
    // Has to be last because some servers (eg: S3) expect the file to be the last parameter
    for (let i = 0; i < dataBlocks.length; i++) {
      let dataBlock = dataBlocks[i];
      formData.append(dataBlock.name, dataBlock.data, dataBlock.filename);
    }

    this.submitRequest(xhr, formData, files);
  }

  // Transforms all files with this.options.transformFile and invokes done with the transformed files when done.
  _transformFiles(files, done) {
    let transformedFiles = [];
    // Clumsy way of handling asynchronous calls, until I get to add a proper Future library.
    let doneCounter = 0;
    for (let i = 0; i < files.length; i++) {
      this.options.transformFile.call(this, files[i], (transformedFile) => {
        transformedFiles[i] = transformedFile;
        if (++doneCounter === files.length) {
          done(transformedFiles);
        }
      });
    }
  }

  // Takes care of adding other input elements of the form to the AJAX request
  _addFormElementData(formData) {
    // Take care of other input elements
    if (this.element.tagName === "FORM") {
      for (let input of this.element.querySelectorAll(
        "input, textarea, select, button"
      )) {
        let inputName = input.getAttribute("name");
        let inputType = input.getAttribute("type");
        if (inputType) inputType = inputType.toLowerCase();

        // If the input doesn't have a name, we can't use it.
        if (typeof inputName === "undefined" || inputName === null) continue;

        if (input.tagName === "SELECT" && input.hasAttribute("multiple")) {
          // Possibly multiple values
          for (let option of input.options) {
            if (option.selected) {
              formData.append(inputName, option.value);
            }
          }
        } else if (
          !inputType ||
          (inputType !== "checkbox" && inputType !== "radio") ||
          input.checked
        ) {
          formData.append(inputName, input.value);
        }
      }
    }
  }

  // Invoked when there is new progress information about given files.
  // If e is not provided, it is assumed that the upload is finished.
  _updateFilesUploadProgress(files, xhr, e) {
    if (!files[0].upload.chunked) {
      // Handle file uploads without chunking
      for (let file of files) {
        if (
          file.upload.total &&
          file.upload.bytesSent &&
          file.upload.bytesSent == file.upload.total
        ) {
          // If both, the `total` and `bytesSent` have already been set, and
          // they are equal (meaning progress is at 100%), we can skip this
          // file, since an upload progress shouldn't go down.
          continue;
        }

        if (e) {
          file.upload.progress = (100 * e.loaded) / e.total;
          file.upload.total = e.total;
          file.upload.bytesSent = e.loaded;
        } else {
          // No event, so we're at 100%
          file.upload.progress = 100;
          file.upload.bytesSent = file.upload.total;
        }

        this.emit(
          "uploadprogress",
          file,
          file.upload.progress,
          file.upload.bytesSent
        );
      }
    } else {
      // Handle chunked file uploads

      // Chunked upload is not compatible with uploading multiple files in one
      // request, so we know there's only one file.
      let file = files[0];

      // Since this is a chunked upload, we need to update the appropriate chunk
      // progress.
      let chunk = this._getChunk(file, xhr);

      if (e) {
        chunk.progress = (100 * e.loaded) / e.total;
        chunk.total = e.total;
        chunk.bytesSent = e.loaded;
      } else {
        // No event, so we're at 100%
        chunk.progress = 100;
        chunk.bytesSent = chunk.total;
      }

      // Now tally the *file* upload progress from its individual chunks
      file.upload.progress = 0;
      file.upload.total = 0;
      file.upload.bytesSent = 0;
      for (let i = 0; i < file.upload.totalChunkCount; i++) {
        if (
          file.upload.chunks[i] &&
          typeof file.upload.chunks[i].progress !== "undefined"
        ) {
          file.upload.progress += file.upload.chunks[i].progress;
          file.upload.total += file.upload.chunks[i].total;
          file.upload.bytesSent += file.upload.chunks[i].bytesSent;
        }
      }
      // Since the process is a percentage, we need to divide by the amount of
      // chunks we've used.
      file.upload.progress = file.upload.progress / file.upload.totalChunkCount;

      this.emit(
        "uploadprogress",
        file,
        file.upload.progress,
        file.upload.bytesSent
      );
    }
  }

  _finishedUploading(files, xhr, e) {
    let response;

    if (files[0].status === Dropzone.CANCELED) {
      return;
    }

    if (xhr.readyState !== 4) {
      return;
    }

    if (xhr.responseType !== "arraybuffer" && xhr.responseType !== "blob") {
      response = xhr.responseText;

      if (
        xhr.getResponseHeader("content-type") &&
        ~xhr.getResponseHeader("content-type").indexOf("application/json")
      ) {
        try {
          response = JSON.parse(response);
        } catch (error) {
          e = error;
          response = "Invalid JSON response from server.";
        }
      }
    }

    this._updateFilesUploadProgress(files, xhr);

    if (!(200 <= xhr.status && xhr.status < 300)) {
      this._handleUploadError(files, xhr, response);
    } else {
      if (files[0].upload.chunked) {
        files[0].upload.finishedChunkUpload(
          this._getChunk(files[0], xhr),
          response
        );
      } else {
        this._finished(files, response, e);
      }
    }
  }

  _handleUploadError(files, xhr, response) {
    if (files[0].status === Dropzone.CANCELED) {
      return;
    }

    if (files[0].upload.chunked && this.options.retryChunks) {
      let chunk = this._getChunk(files[0], xhr);
      if (chunk.retries++ < this.options.retryChunksLimit) {
        this._uploadData(files, [chunk.dataBlock]);
        return;
      } else {
        console.warn("Retried this chunk too often. Giving up.");
      }
    }

    this._errorProcessing(
      files,
      response ||
        this.options.dictResponseError.replace("{{statusCode}}", xhr.status),
      xhr
    );
  }

  submitRequest(xhr, formData, files) {
    if (xhr.readyState != 1) {
      console.warn(
        "Cannot send this request because the XMLHttpRequest.readyState is not OPENED."
      );
      return;
    }
    xhr.send(formData);
  }

  // Called internally when processing is finished.
  // Individual callbacks have to be called in the appropriate sections.
  _finished(files, responseText, e) {
    for (let file of files) {
      file.status = Dropzone.SUCCESS;
      this.emit("success", file, responseText, e);
      this.emit("complete", file);
    }
    if (this.options.uploadMultiple) {
      this.emit("successmultiple", files, responseText, e);
      this.emit("completemultiple", files);
    }

    if (this.options.autoProcessQueue) {
      return this.processQueue();
    }
  }

  // Called internally when processing is finished.
  // Individual callbacks have to be called in the appropriate sections.
  _errorProcessing(files, message, xhr) {
    for (let file of files) {
      file.status = Dropzone.ERROR;
      this.emit("error", file, message, xhr);
      this.emit("complete", file);
    }
    if (this.options.uploadMultiple) {
      this.emit("errormultiple", files, message, xhr);
      this.emit("completemultiple", files);
    }

    if (this.options.autoProcessQueue) {
      return this.processQueue();
    }
  }

  static uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}
Dropzone.initClass();

Dropzone.version = "dev";

// This is a map of options for your different dropzones. Add configurations
// to this object for your different dropzone elemens.
//
// Example:
//
//     Dropzone.options.myDropzoneElementId = { maxFilesize: 1 };
//
// To disable autoDiscover for a specific element, you can set `false` as an option:
//
//     Dropzone.options.myDisabledElementId = false;
//
// And in html:
//
//     <form action="/upload" id="my-dropzone-element-id" class="dropzone"></form>
Dropzone.options = {};

// Returns the options for an element or undefined if none available.
Dropzone.optionsForElement = function (element) {
  // Get the `Dropzone.options.elementId` for this element if it exists
  if (element.getAttribute("id")) {
    return Dropzone.options[camelize(element.getAttribute("id"))];
  } else {
    return undefined;
  }
};

// Holds a list of all dropzone instances
Dropzone.instances = [];

// Returns the dropzone for given element if any
Dropzone.forElement = function (element) {
  if (typeof element === "string") {
    element = document.querySelector(element);
  }
  if ((element != null ? element.dropzone : undefined) == null) {
    throw new Error(
      "No Dropzone found for given element. This is probably because you're trying to access it before Dropzone had the time to initialize. Use the `init` option to setup any additional observers on your Dropzone."
    );
  }
  return element.dropzone;
};

// Set to false if you don't want Dropzone to automatically find and attach to .dropzone elements.
Dropzone.autoDiscover = true;

// Looks for all .dropzone elements and creates a dropzone for them
Dropzone.discover = function () {
  let dropzones;
  if (document.querySelectorAll) {
    dropzones = document.querySelectorAll(".dropzone");
  } else {
    dropzones = [];
    // IE :(
    let checkElements = (elements) =>
      (() => {
        let result = [];
        for (let el of elements) {
          if (/(^| )dropzone($| )/.test(el.className)) {
            result.push(dropzones.push(el));
          } else {
            result.push(undefined);
          }
        }
        return result;
      })();
    checkElements(document.getElementsByTagName("div"));
    checkElements(document.getElementsByTagName("form"));
  }

  return (() => {
    let result = [];
    for (let dropzone of dropzones) {
      // Create a dropzone unless auto discover has been disabled for specific element
      if (Dropzone.optionsForElement(dropzone) !== false) {
        result.push(new Dropzone(dropzone));
      } else {
        result.push(undefined);
      }
    }
    return result;
  })();
};

// Some browsers support drag and drog functionality, but not correctly.
//
// So I created a blocklist of userAgents. Yes, yes. Browser sniffing, I know.
// But what to do when browsers *theoretically* support an API, but crash
// when using it.
//
// This is a list of regular expressions tested against navigator.userAgent
//
// ** It should only be used on browser that *do* support the API, but
// incorrectly **
Dropzone.blockedBrowsers = [
  // The mac os and windows phone version of opera 12 seems to have a problem with the File drag'n'drop API.
  /opera.*(Macintosh|Windows Phone).*version\/12/i,
];

// Checks if the browser is supported
Dropzone.isBrowserSupported = function () {
  let capableBrowser = true;

  if (
    window.File &&
    window.FileReader &&
    window.FileList &&
    window.Blob &&
    window.FormData &&
    document.querySelector
  ) {
    if (!("classList" in document.createElement("a"))) {
      capableBrowser = false;
    } else {
      if (Dropzone.blacklistedBrowsers !== undefined) {
        // Since this has been renamed, this makes sure we don't break older
        // configuration.
        Dropzone.blockedBrowsers = Dropzone.blacklistedBrowsers;
      }
      // The browser supports the API, but may be blocked.
      for (let regex of Dropzone.blockedBrowsers) {
        if (regex.test(navigator.userAgent)) {
          capableBrowser = false;
          continue;
        }
      }
    }
  } else {
    capableBrowser = false;
  }

  return capableBrowser;
};

Dropzone.dataURItoBlob = function (dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  let byteString = atob(dataURI.split(",")[1]);

  // separate out the mime component
  let mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

  // write the bytes of the string to an ArrayBuffer
  let ab = new ArrayBuffer(byteString.length);
  let ia = new Uint8Array(ab);
  for (
    let i = 0, end = byteString.length, asc = 0 <= end;
    asc ? i <= end : i >= end;
    asc ? i++ : i--
  ) {
    ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob
  return new Blob([ab], { type: mimeString });
};

// Returns an array without the rejected item
const without = (list, rejectedItem) =>
  list.filter((item) => item !== rejectedItem).map((item) => item);

// abc-def_ghi -> abcDefGhi
const camelize = (str) =>
  str.replace(/[\-_](\w)/g, (match) => match.charAt(1).toUpperCase());

// Creates an element from string
Dropzone.createElement = function (string) {
  let div = document.createElement("div");
  div.innerHTML = string;
  return div.childNodes[0];
};

// Tests if given element is inside (or simply is) the container
Dropzone.elementInside = function (element, container) {
  if (element === container) {
    return true;
  } // Coffeescript doesn't support do/while loops
  while ((element = element.parentNode)) {
    if (element === container) {
      return true;
    }
  }
  return false;
};

Dropzone.getElement = function (el, name) {
  let element;
  if (typeof el === "string") {
    element = document.querySelector(el);
  } else if (el.nodeType != null) {
    element = el;
  }
  if (element == null) {
    throw new Error(
      `Invalid \`${name}\` option provided. Please provide a CSS selector or a plain HTML element.`
    );
  }
  return element;
};

Dropzone.getElements = function (els, name) {
  let el, elements;
  if (els instanceof Array) {
    elements = [];
    try {
      for (el of els) {
        elements.push(this.getElement(el, name));
      }
    } catch (e) {
      elements = null;
    }
  } else if (typeof els === "string") {
    elements = [];
    for (el of document.querySelectorAll(els)) {
      elements.push(el);
    }
  } else if (els.nodeType != null) {
    elements = [els];
  }

  if (elements == null || !elements.length) {
    throw new Error(
      `Invalid \`${name}\` option provided. Please provide a CSS selector, a plain HTML element or a list of those.`
    );
  }

  return elements;
};

// Asks the user the question and calls accepted or rejected accordingly
//
// The default implementation just uses `window.confirm` and then calls the
// appropriate callback.
Dropzone.confirm = function (question, accepted, rejected) {
  if (window.confirm(question)) {
    return accepted();
  } else if (rejected != null) {
    return rejected();
  }
};

// Validates the mime type like this:
//
// https://developer.mozilla.org/en-US/docs/HTML/Element/input#attr-accept
Dropzone.isValidFile = function (file, acceptedFiles) {
  if (!acceptedFiles) {
    return true;
  } // If there are no accepted mime types, it's OK
  acceptedFiles = acceptedFiles.split(",");

  let mimeType = file.type;
  let baseMimeType = mimeType.replace(/\/.*$/, "");

  for (let validType of acceptedFiles) {
    validType = validType.trim();
    if (validType.charAt(0) === ".") {
      if (
        file.name
          .toLowerCase()
          .indexOf(
            validType.toLowerCase(),
            file.name.length - validType.length
          ) !== -1
      ) {
        return true;
      }
    } else if (/\/\*$/.test(validType)) {
      // This is something like a image/* mime type
      if (baseMimeType === validType.replace(/\/.*$/, "")) {
        return true;
      }
    } else {
      if (mimeType === validType) {
        return true;
      }
    }
  }

  return false;
};

// Augment jQuery
if (typeof jQuery !== "undefined" && jQuery !== null) {
  jQuery.fn.dropzone = function (options) {
    return this.each(function () {
      return new Dropzone(this, options);
    });
  };
}

// Dropzone file status codes
Dropzone.ADDED = "added";

Dropzone.QUEUED = "queued";
// For backwards compatibility. Now, if a file is accepted, it's either queued
// or uploading.
Dropzone.ACCEPTED = Dropzone.QUEUED;

Dropzone.UPLOADING = "uploading";
Dropzone.PROCESSING = Dropzone.UPLOADING; // alias

Dropzone.CANCELED = "canceled";
Dropzone.ERROR = "error";
Dropzone.SUCCESS = "success";

/*

 Bugfix for iOS 6 and 7
 Source: http://stackoverflow.com/questions/11929099/html5-canvas-drawimage-ratio-bug-ios
 based on the work of https://github.com/stomita/ios-imagefile-megapixel

 */

// Detecting vertical squash in loaded image.
// Fixes a bug which squash image vertically while drawing into canvas for some images.
// This is a bug in iOS6 devices. This function from https://github.com/stomita/ios-imagefile-megapixel
let detectVerticalSquash = function (img) {
  let iw = img.naturalWidth;
  let ih = img.naturalHeight;
  let canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = ih;
  let ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  let { data } = ctx.getImageData(1, 0, 1, ih);

  // search image edge pixel position in case it is squashed vertically.
  let sy = 0;
  let ey = ih;
  let py = ih;
  while (py > sy) {
    let alpha = data[(py - 1) * 4 + 3];

    if (alpha === 0) {
      ey = py;
    } else {
      sy = py;
    }

    py = (ey + sy) >> 1;
  }
  let ratio = py / ih;

  if (ratio === 0) {
    return 1;
  } else {
    return ratio;
  }
};

// A replacement for context.drawImage
// (args are for source and destination).
var drawImageIOSFix = function (ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
  let vertSquashRatio = detectVerticalSquash(img);
  return ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh / vertSquashRatio);
};

// Inspired by MinifyJpeg
// Source: http://www.perry.cz/files/ExifRestorer.js
// http://elicon.blog57.fc2.com/blog-entry-206.html
function removeExif(origFileBase64) {

   var marker = 'data:image/jpeg;base64,';

   if (!origFileBase64.startsWith(marker)) {
      return origFileBase64;
   }

   var origFile = window.atob(origFileBase64.slice(marker.length));

   if (!origFile.startsWith("\xFF\xD8\xFF")) {
      return origFileBase64;
   }

   // loop through the JPEG file segments and copy all but Exif segments into the filtered file.
   var head = 0;
   var filteredFile = "";
   while (head < origFile.length) {

     if (origFile.slice(head, head+2) == "\xFF\xDA") {
       // this is the start of the image data, we don't expect exif data after that.
       filteredFile += origFile.slice(head);
       break;
     } else if (origFile.slice(head, head+2) == "\xFF\xD8") {
       // this is the global start marker.
       filteredFile += origFile.slice(head, head+2);
       head += 2;
     } else {
       // we have a segment of variable size.
       var length = origFile.charCodeAt(head + 2) * 256 + origFile.charCodeAt(head + 3);
       var endPoint = head + length + 2;
       var segment = origFile.slice(head, endPoint);
       if (!segment.startsWith("\xFF\xE1")) {
         filteredFile += segment;
       }
       head = endPoint;
     }
   }

   return marker + window.btoa(filteredFile);
}


function restoreExif(origFileBase64, resizedFileBase64) {

   var marker = 'data:image/jpeg;base64,';

   if (!(origFileBase64.startsWith(marker) && resizedFileBase64.startsWith(marker))) {
      return resizedFileBase64;
   }

   var origFile = window.atob(origFileBase64.slice(marker.length));

   if (!origFile.startsWith("\xFF\xD8\xFF")) {
      return resizedFileBase64;
   }

   // Go through the JPEG file segments one by one and collect any Exif segments we find.
   var head = 0;
   var exifData = "";
   while (head < origFile.length) {

     if (origFile.slice(head, head+2) == "\xFF\xDA") {
       // this is the start of the image data, we don't expect exif data after that.
       break;
     } else if (origFile.slice(head, head+2) == "\xFF\xD8") {
       // this is the global start marker.
       head += 2;
     } else {
       // we have a segment of variable size.
       var length = origFile.charCodeAt(head + 2) * 256 + origFile.charCodeAt(head + 3);
       var endPoint = head + length + 2;
       var segment = origFile.slice(head, endPoint);
       if (segment.startsWith("\xFF\xE1")) {
         exifData += segment;
       }
       head = endPoint;
     }

   }

   if (exifData == "") {
      return resizedFileBase64;
   }

   var resizedFile = window.atob(resizedFileBase64.slice(marker.length));

   if (!resizedFile.startsWith("\xFF\xD8\xFF")) {
      return resizedFileBase64;
   }

   // The first file segment is always header information so insert the Exif data as second segment.
   var splitPoint = 4 + resizedFile.charCodeAt(4) * 256 + resizedFile.charCodeAt(5)
   resizedFile = resizedFile.slice(0, splitPoint) + exifData + resizedFile.slice(splitPoint);

   return marker + window.btoa(resizedFile);
}


/*
 * contentloaded.js
 *
 * Author: Diego Perini (diego.perini at gmail.com)
 * Summary: cross-browser wrapper for DOMContentLoaded
 * Updated: 20101020
 * License: MIT
 * Version: 1.2
 *
 * URL:
 * http://javascript.nwbox.com/ContentLoaded/
 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
 */

// @win window reference
// @fn function reference
let contentLoaded = function (win, fn) {
  let done = false;
  let top = true;
  let doc = win.document;
  let root = doc.documentElement;
  let add = doc.addEventListener ? "addEventListener" : "attachEvent";
  let rem = doc.addEventListener ? "removeEventListener" : "detachEvent";
  let pre = doc.addEventListener ? "" : "on";
  var init = function (e) {
    if (e.type === "readystatechange" && doc.readyState !== "complete") {
      return;
    }
    (e.type === "load" ? win : doc)[rem](pre + e.type, init, false);
    if (!done && (done = true)) {
      return fn.call(win, e.type || e);
    }
  };

  var poll = function () {
    try {
      root.doScroll("left");
    } catch (e) {
      setTimeout(poll, 50);
      return;
    }
    return init("poll");
  };

  if (doc.readyState !== "complete") {
    if (doc.createEventObject && root.doScroll) {
      try {
        top = !win.frameElement;
      } catch (error) {}
      if (top) {
        poll();
      }
    }
    doc[add](pre + "DOMContentLoaded", init, false);
    doc[add](pre + "readystatechange", init, false);
    return win[add](pre + "load", init, false);
  }
};

// As a single function to be able to write tests.
Dropzone._autoDiscoverFunction = function () {
  if (Dropzone.autoDiscover) {
    return Dropzone.discover();
  }
};
contentLoaded(window, Dropzone._autoDiscoverFunction);

function __guard__(value, transform) {
  return typeof value !== "undefined" && value !== null
    ? transform(value)
    : undefined;
}
function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== "undefined" &&
    obj !== null &&
    typeof obj[methodName] === "function"
  ) {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}

export { Dropzone };
