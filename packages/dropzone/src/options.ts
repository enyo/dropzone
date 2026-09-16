import Dropzone from "./dropzone";
import type {
  DropzoneAcceptCallback,
  DropzoneFile,
  DropzoneStyles,
  DropzoneTransformCallback,
} from "./dropzone";
import defaultPreviewTemplate from "./preview-template.html?raw";

let defaultOptions = {
  /**
   * Has to be specified on elements other than form (or when the form doesn't
   * have an `action` attribute).
   *
   * You can also provide a function that will be called with `files` and
   * `dataBlocks`  and must return the url as string.
   */
  url: null as string | ((files: DropzoneFile[], dataBlocks?: any[]) => string) | null,

  /**
   * Can be changed to `"put"` if necessary. You can also provide a function
   * that will be called with `files` and must return the method (since `v3.12.0`).
   */
  method: "post",

  /**
   * Will be set on the XHRequest.
   */
  withCredentials: false,

  /**
   * The timeout for the XHR requests in milliseconds (since `v4.4.0`).
   * If set to null or 0, no timeout is going to be set.
   */
  timeout: null as number | null,

  /**
   * How many file uploads to process in parallel (See the
   * Enqueuing file uploads documentation section for more info)
   */
  parallelUploads: 2,

  /**
   * Whether to send multiple files in one request. If
   * this it set to true, then the fallback file input element will
   * have the `multiple` attribute as well. This option will
   * also trigger additional events (like `processingmultiple`). See the events
   * documentation section for more information.
   */
  uploadMultiple: false,

  /**
   * Whether you want files to be uploaded in chunks to your server. This can't be
   * used in combination with `uploadMultiple`.
   *
   * See [chunksUploaded](#config-chunksUploaded) for the callback to finalise an upload.
   */
  chunking: false,

  /**
   * If `chunking` is enabled, this defines whether **every** file should be chunked,
   * even if the file size is below chunkSize. This means, that the additional chunk
   * form data will be submitted and the `chunksUploaded` callback will be invoked.
   */
  forceChunking: false,

  /**
   * If `chunking` is `true`, then this defines the chunk size in bytes.
   */
  chunkSize: 2 * 1024 * 1024,

  /**
   * If `true`, the individual chunks of a file are uploaded simultaneously, at
   * most `parallelUploads` of them at a time. Set a number to use a different
   * limit, or `Infinity` to start every chunk at once.
   */
  parallelChunkUploads: false,

  /**
   * Whether a chunk should be retried if it fails.
   */
  retryChunks: false,

  /**
   * If `retryChunks` is true, how many times should it be retried.
   */
  retryChunksLimit: 3,

  /**
   * The maximum filesize (in MiB) that is allowed to be uploaded.
   */
  maxFilesize: 256,

  /**
   * The name of the file param that gets transferred.
   * **NOTE**: If you have the option  `uploadMultiple` set to `true`, then
   * Dropzone will append `[]` to the name.
   */
  paramName: "file",

  /**
   * Whether thumbnails for images should be generated
   */
  createImageThumbnails: true,

  /**
   * In MB. When the filename exceeds this limit, the thumbnail will not be generated.
   */
  maxThumbnailFilesize: 10,

  /**
   * If `null`, the ratio of the image will be used to calculate it.
   */
  thumbnailWidth: 120,

  /**
   * The same as `thumbnailWidth`. If both are null, images will not be resized.
   */
  thumbnailHeight: 120,

  /**
   * How the images should be scaled down in case both, `thumbnailWidth` and `thumbnailHeight` are provided.
   * Can be either `contain` or `crop`.
   */
  thumbnailMethod: "crop",

  /**
   * If set, images will be resized to these dimensions before being **uploaded**.
   * If only one, `resizeWidth` **or** `resizeHeight` is provided, the original aspect
   * ratio of the file will be preserved.
   *
   * The `options.transformFile` function uses these options, so if the `transformFile` function
   * is overridden, these options don't do anything.
   */
  resizeWidth: null as number | null,

  /**
   * See `resizeWidth`.
   */
  resizeHeight: null as number | null,

  /**
   * The mime type of the resized image (before it gets uploaded to the server).
   * If `null` the original mime type will be used. To force jpeg, for example, use `image/jpeg`.
   * See `resizeWidth` for more information.
   */
  resizeMimeType: null as string | null,

  /**
   * The quality of the resized images. See `resizeWidth`.
   */
  resizeQuality: 0.8,

  /**
   * How the images should be scaled down in case both, `resizeWidth` and `resizeHeight` are provided.
   * Can be either `contain` or `crop`.
   */
  resizeMethod: "contain",

  /**
   * The color to show through transparent parts of a resized image, as any
   * CSS color. Formats without an alpha channel cannot store transparency, so
   * a transparent PNG resized to `image/jpeg` comes out with black where it
   * used to be see-through; setting this to `"#fff"` makes it white instead.
   *
   * `null` leaves transparency alone, which only produces black once the image
   * is encoded to a format that cannot represent it. This has no effect on the
   * preview thumbnails, which are always PNG.
   */
  resizeTransparencyFill: null as string | null,

  /**
   * The base that is used to calculate the **displayed** filesize. You can
   * change this to 1024 if you would rather display kibibytes, mebibytes,
   * etc... 1024 is technically incorrect, because `1024 bytes` are `1 kibibyte`
   * not `1 kilobyte`. You can change this to `1024` if you don't care about
   * validity.
   */
  filesizeBase: 1000,

  /**
   * If not `null` defines how many files this Dropzone handles. If it exceeds,
   * the event `maxfilesexceeded` will be called. The dropzone element gets the
   * class `dz-max-files-reached` accordingly so you can provide visual
   * feedback.
   */
  maxFiles: null as number | null,

  /**
   * An optional object to send additional headers to the server. Eg:
   * `{ "My-Awesome-Header": "header value" }`
   */
  headers: null as Record<string, string> | null,

  /**
   * Should the default headers be set or not?
   * Accept: application/json <- for requesting json response
   * Cache-Control: no-cache <- Request shouldnt be cached
   * X-Requested-With: XMLHttpRequest <- We sent the request via XMLHttpRequest
   */
  defaultHeaders: true,

  /**
   * If `true`, the dropzone element itself will be clickable, if `false`
   * nothing will be clickable.
   *
   * You can also pass an HTML element, a CSS selector (for multiple elements)
   * or an array of those. In that case, all of those elements will trigger an
   * upload when clicked.
   */
  clickable: true,

  /**
   * Whether hidden files in directories should be ignored.
   */
  ignoreHiddenFiles: true,

  /**
   * The default implementation of `accept` checks the file's mime type or
   * extension against this list. This is a comma separated list of mime
   * types or file extensions.
   *
   * Eg.: `image/*,application/pdf,.psd`
   *
   * If the Dropzone is `clickable` this option will also be used as
   * [`accept`](https://developer.mozilla.org/en-US/docs/HTML/Element/input#attr-accept)
   * parameter on the hidden file input as well.
   */
  acceptedFiles: null as string | null,

  /**
   * **Deprecated!**
   * Use acceptedFiles instead.
   */
  acceptedMimeTypes: null as string | null,

  /**
   * If false, files will be added to the queue but the queue will not be
   * processed automatically.
   * This can be useful if you need some additional user input before sending
   * files (or if you want want all files sent at once).
   * If you're ready to send the file simply call `myDropzone.processQueue()`.
   *
   * See the [enqueuing file uploads](#enqueuing-file-uploads) documentation
   * section for more information.
   */
  autoProcessQueue: true,

  /**
   * If false, files added to the dropzone will not be queued by default.
   * You'll have to call `enqueueFile(file)` manually.
   */
  autoQueue: true,

  /**
   * Adds Dropzone's stylesheet to the document itself, so there is no `<link>`
   * to remember and no path to keep in step with the package.
   *
   * - `false` — add nothing. The default.
   * - `true` or `"full"` — `dist/dropzone.css`, the ready-to-go styling.
   * - `"basic"` — `dist/basic.css`, layout only, for styling it yourself.
   *
   * The two stylesheets are alternatives rather than layers: `basic` is not a
   * subset of `full`, so picking one excludes the other.
   *
   * It is inserted once into `<head>` however many dropzones are on the page,
   * and inserted *first*, so your own rules win on equal specificity without
   * needing `!important`. If two dropzones ask for different ones, the first
   * to be constructed wins.
   *
   * Defaults to false so that nothing changes for anyone on an upgrade.
   *
   * It is not the cheaper setting, though. The stylesheets travel inside the
   * JavaScript whether or not this is switched on -- a runtime flag cannot be
   * tree-shaken -- so importing the CSS through a bundler as well ships it
   * twice. Turning this on is about 1.2 kB gzipped smaller than importing it.
   *
   * One thing a `<link>` does that this cannot: block the first paint. These
   * styles arrive when the script does, so if the script is slow the browser
   * can paint before them. Everything Dropzone creates is made after the
   * styles go in and is never seen unstyled, and an empty dropzone element
   * has nothing to show either way -- but your own markup inside it will be
   * visible unstyled until then, and will shift when the styling lands. Link
   * the stylesheet if that matters.
   *
   * ```js
   * new Dropzone("#my-form", { url: "/upload", injectStyles: true });
   * new Dropzone("#other", { url: "/upload", injectStyles: "basic" });
   * ```
   */
  injectStyles: false as DropzoneStyles,

  /**
   * If `true`, this will add a link to every file preview to remove or cancel (if
   * already uploading) the file. The `dictCancelUpload`, `dictCancelUploadConfirmation`
   * and `dictRemoveFile` options are used for the wording.
   */
  addRemoveLinks: false,

  /**
   * Defines where to display the file previews – if `null` the
   * Dropzone element itself is used. Can be a plain `HTMLElement` or a CSS
   * selector. The element should have the `dropzone-previews` class so
   * the previews are displayed properly.
   */
  previewsContainer: null as string | HTMLElement | false | null,

  /**
   * Set this to `true` if you don't want previews to be shown.
   */
  disablePreviews: false,

  /**
   * This is the element the hidden input field (which is used when clicking on the
   * dropzone to trigger file selection) will be appended to. This might
   * be important in case you use frameworks to switch the content of your page.
   *
   * Can be a selector string, or an element directly.
   */
  hiddenInputContainer: "body",

  /**
   * If null, no capture type will be specified
   * If camera, mobile devices will skip the file selection and choose camera
   * If microphone, mobile devices will skip the file selection and choose the microphone
   * If camcorder, mobile devices will skip the file selection and choose the camera in video mode
   * On apple devices multiple must be set to false.  AcceptedFiles may need to
   * be set to an appropriate mime type (e.g. "image/*", "audio/*", or "video/*").
   */
  capture: null as string | null,

  /**
   * **Deprecated**. Use `renameFile` instead.
   */
  renameFilename: null as ((name: string, file: DropzoneFile) => string) | null,

  /**
   * A function that is invoked before the file is uploaded to the server and renames the file.
   * This function gets the `File` as argument and can use the `file.name`. The actual name of the
   * file that gets used during the upload can be accessed through `file.upload.filename`.
   */
  renameFile: null as ((file: DropzoneFile) => string) | null,

  /**
   * If `true` the fallback will be forced. This is very useful to test your server
   * implementations first and make sure that everything works as
   * expected without dropzone if you experience problems, and to test
   * how your fallbacks will look.
   */
  forceFallback: false,

  /**
   * The text used before any files are dropped.
   */
  dictDefaultMessage: "Drop files here to upload",

  /**
   * The text that replaces the default message text it the browser is not supported.
   */
  dictFallbackMessage: "Your browser does not support drag'n'drop file uploads.",

  /**
   * The text that will be added before the fallback form.
   * If you provide a  fallback element yourself, or if this option is `null` this will
   * be ignored.
   */
  dictFallbackText:
    "Please use the fallback form below to upload your files like in the olden days.",

  /**
   * If the filesize is too big.
   * `{{filesize}}` and `{{maxFilesize}}` will be replaced with the respective configuration values.
   */
  dictFileTooBig: "File is too big ({{filesize}}MiB). Max filesize: {{maxFilesize}}MiB.",

  /**
   * If the file doesn't match the file type.
   */
  dictInvalidFileType: "You can't upload files of this type.",

  /**
   * If the file looks like an image but cannot be decoded, so no thumbnail can
   * be generated for it.
   */
  dictThumbnailError: "Failed to load the image. The file may be corrupted.",

  /**
   * If the server response was invalid.
   * `{{statusCode}}` will be replaced with the servers status code.
   */
  dictResponseError: "Server responded with {{statusCode}} code.",

  /**
   * If `addRemoveLinks` is true, the text to be used for the cancel upload link.
   */
  dictCancelUpload: "Cancel upload",

  /**
   * The text that is displayed if an upload was manually canceled
   */
  dictUploadCanceled: "Upload canceled.",

  /**
   * If `addRemoveLinks` is true, the text to be used for confirmation when cancelling upload.
   */
  dictCancelUploadConfirmation: "Are you sure you want to cancel this upload?",

  /**
   * If `addRemoveLinks` is true, the text to be used to remove a file.
   */
  dictRemoveFile: "Remove file",

  /**
   * If this is not null, then the user will be prompted before removing a file.
   */
  dictRemoveFileConfirmation: null as string | null,

  /**
   * Displayed if `maxFiles` is set and exceeded.
   * The string `{{maxFiles}}` will be replaced by the configuration value.
   */
  dictMaxFilesExceeded: "You cannot upload any more files.",

  /**
   * Allows you to translate the different units. Starting with `tb` for terabytes and going down to
   * `b` for bytes.
   */
  dictFileSizeUnits: { tb: "TB", gb: "GB", mb: "MB", kb: "KB", b: "b" },
  /**
   * Called when dropzone initialized
   * You can add event listeners here
   */
  init() {},

  /**
   * Can be an **object** of additional parameters to transfer to the server, **or** a `Function`
   * that gets invoked with the `files`, `xhr` and, if it's a chunked upload, `chunk` arguments. In case
   * of a function, this needs to return a map.
   *
   * The default implementation does nothing for normal uploads, but adds relevant information for
   * chunked uploads.
   *
   * This is the same as adding hidden input fields in the form element.
   */
  params(this: Dropzone, files: DropzoneFile[], xhr: XMLHttpRequest, chunk: any) {
    if (chunk) {
      return {
        dzuuid: chunk.file.upload.uuid,
        dzchunkindex: chunk.index,
        dztotalfilesize: chunk.file.size,
        dzchunksize: this.options.chunkSize,
        dztotalchunkcount: chunk.file.upload.totalChunkCount,
        dzchunkbyteoffset: chunk.index * this.options.chunkSize,
      };
    }
    return undefined;
  },

  /**
   * A function that gets a [file](https://developer.mozilla.org/en-US/docs/DOM/File)
   * and a `done` function as parameters.
   *
   * If the done function is invoked without arguments, the file is "accepted" and will
   * be processed. If you pass an error message, the file is rejected, and the error
   * message will be displayed.
   * This function will not be called if the file is too big or doesn't match the mime types.
   */
  accept(file: DropzoneFile, done: DropzoneAcceptCallback) {
    return done();
  },

  /**
   * The callback that will be invoked when all chunks have been uploaded for a file.
   * It gets the file for which the chunks have been uploaded as the first parameter,
   * and the `done` function as second. `done()` needs to be invoked when everything
   * needed to finish the upload process is done.
   */
  chunksUploaded: function (file: DropzoneFile, done: () => void) {
    done();
  },

  /**
   * Sends the file as binary blob in body instead of form data.
   * If this is set, the `params` option will be ignored.
   * It's an error to set this to `true` along with `uploadMultiple` since
   * multiple files cannot be in a single binary body.
   */
  binaryBody: false,

  /**
   * Gets called when the browser is not supported.
   * The default implementation shows the fallback input field and adds
   * a text.
   */
  fallback(this: Dropzone) {
    // This code should pass in IE7... :(
    let messageElement;
    this.element.className = `${this.element.className} dz-browser-not-supported`;

    for (let child of this.element.getElementsByTagName("div")) {
      if (/(^| )dz-message($| )/.test(child.className)) {
        messageElement = child;
        child.className = "dz-message"; // Removes the 'dz-default' class
        break;
      }
    }
    if (!messageElement) {
      messageElement = Dropzone.createElement('<div class="dz-message"><span></span></div>');
      this.element.appendChild(messageElement);
    }

    let span = messageElement.getElementsByTagName("span")[0];
    if (span) {
      if (span.textContent != null) {
        span.textContent = this.options.dictFallbackMessage;
      } else if (span.innerText != null) {
        span.innerText = this.options.dictFallbackMessage;
      }
    }

    return this.element.appendChild(this.getFallbackForm());
  },

  /**
   * Gets called to calculate the thumbnail dimensions.
   *
   * It gets `file`, `width` and `height` (both may be `null`) as parameters and must return an object containing:
   *
   *  - `srcWidth` & `srcHeight` (required)
   *  - `trgWidth` & `trgHeight` (required)
   *  - `srcX` & `srcY` (optional, default `0`)
   *  - `trgX` & `trgY` (optional, default `0`)
   *
   * Those values are going to be used by `ctx.drawImage()`.
   */
  resize(file: DropzoneFile, width: number | null, height: number | null, resizeMethod: string) {
    let info: Record<string, number> = {
      srcX: 0,
      srcY: 0,
      srcWidth: file.width!,
      srcHeight: file.height!,
    };

    let srcRatio = file.width! / file.height!;

    // Automatically calculate dimensions if not specified
    if (width == null && height == null) {
      width = info.srcWidth;
      height = info.srcHeight;
    } else if (width == null) {
      // Reaching here means height is set: the branch above took both-null.
      width = height! * srcRatio;
    } else if (height == null) {
      height = width / srcRatio;
    }

    // Make sure images aren't upscaled. Both are set by the chain above,
    // whichever branch it took.
    width = Math.min(width!, info.srcWidth);
    height = Math.min(height!, info.srcHeight);

    let trgRatio = width / height;

    if (info.srcWidth > width || info.srcHeight > height) {
      // Image is bigger and needs rescaling
      if (resizeMethod === "crop") {
        if (srcRatio > trgRatio) {
          info.srcHeight = file.height!;
          info.srcWidth = info.srcHeight * trgRatio;
        } else {
          info.srcWidth = file.width!;
          info.srcHeight = info.srcWidth / trgRatio;
        }
      } else if (resizeMethod === "contain") {
        // Method 'contain'
        if (srcRatio > trgRatio) {
          height = width / srcRatio;
        } else {
          width = height * srcRatio;
        }
      } else {
        throw new Error(`Unknown resizeMethod '${resizeMethod}'`);
      }
    }

    info.srcX = (file.width! - info.srcWidth) / 2;
    info.srcY = (file.height! - info.srcHeight) / 2;

    info.trgWidth = width;
    info.trgHeight = height;

    return info;
  },

  /**
   * Can be used to transform the file (for example, resize an image if necessary).
   *
   * The default implementation uses `resizeWidth` and `resizeHeight` (if provided) and resizes
   * images according to those dimensions.
   *
   * Gets the `file` as the first parameter, and a `done()` function as the second, that needs
   * to be invoked with the file when the transformation is done.
   */
  transformFile(this: Dropzone, file: DropzoneFile, done: DropzoneTransformCallback) {
    if ((this.options.resizeWidth || this.options.resizeHeight) && file.type.match(/image.*/)) {
      return this.resizeImage(
        file,
        this.options.resizeWidth,
        this.options.resizeHeight,
        this.options.resizeMethod,
        done,
      );
    } else {
      return done(file);
    }
  },

  /**
   * A string that contains the template used for each dropped
   * file. Change it to fulfill your needs but make sure to properly
   * provide all elements.
   *
   * If you want to use an actual HTML element instead of providing a String
   * as a config option, you could create a div with the id `tpl`,
   * put the template inside it and provide the element like this:
   *
   *     document
   *       .querySelector('#tpl')
   *       .innerHTML
   *
   */
  previewTemplate: defaultPreviewTemplate,

  /*
   Those functions register themselves to the events on init and handle all
   the user interface specific stuff. Overwriting them won't break the upload
   but can break the way it's displayed.
   You can overwrite them if you don't like the default behavior. If you just
   want to add an additional event handler, register it on the dropzone object
   and don't overwrite those options.
   */

  // Those are self explanatory and simply concern the DragnDrop.
  drop(this: Dropzone, e: any) {
    return this.element.classList.remove("dz-drag-hover");
  },
  dragstart(e: any) {},
  dragend(this: Dropzone, e: any) {
    return this.element.classList.remove("dz-drag-hover");
  },
  dragenter(this: Dropzone, e: any) {
    return this.element.classList.add("dz-drag-hover");
  },
  dragover(this: Dropzone, e: any) {
    return this.element.classList.add("dz-drag-hover");
  },
  dragleave(this: Dropzone, e: any) {
    return this.element.classList.remove("dz-drag-hover");
  },

  paste(e: any) {},

  // Called whenever there are no files left in the dropzone anymore, and the
  // dropzone should be displayed as if in the initial state.
  reset(this: Dropzone) {
    return this.element.classList.remove("dz-started");
  },

  // Called when a file is added to the queue
  // Receives `file`
  addedfile(this: Dropzone, file: DropzoneFile) {
    if (this.element === this.previewsContainer) {
      this.element.classList.add("dz-started");
    }

    if (this.previewsContainer && !this.options.disablePreviews) {
      file.previewElement = Dropzone.createElement(this.options.previewTemplate.trim());
      file.previewTemplate = file.previewElement; // Backwards compatibility

      this.previewsContainer.appendChild(file.previewElement);
      for (var node of file.previewElement.querySelectorAll("[data-dz-name]")) {
        node.textContent = file.name;
      }
      for (node of file.previewElement.querySelectorAll("[data-dz-size]")) {
        node.innerHTML = this.filesize(file.size);
      }

      if (this.options.addRemoveLinks) {
        file._removeLink = Dropzone.createElement(
          `<a class="dz-remove" href="javascript:undefined;" data-dz-remove>${this.options.dictRemoveFile}</a>`,
        );
        file.previewElement.appendChild(file._removeLink);
      }

      let removeFileEvent = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        if (file.status === Dropzone.UPLOADING) {
          return Dropzone.confirm(this.options.dictCancelUploadConfirmation, () =>
            this.removeFile(file),
          );
        } else {
          if (this.options.dictRemoveFileConfirmation) {
            return Dropzone.confirm(this.options.dictRemoveFileConfirmation, () =>
              this.removeFile(file),
            );
          } else {
            return this.removeFile(file);
          }
        }
      };

      for (let removeLink of file.previewElement.querySelectorAll("[data-dz-remove]")) {
        removeLink.addEventListener("click", removeFileEvent);
      }
    }
  },

  // Called whenever a file is removed.
  removedfile(this: Dropzone, file: DropzoneFile) {
    if (file.previewElement != null && file.previewElement.parentNode != null) {
      file.previewElement.parentNode.removeChild(file.previewElement);
    }
    return this._updateMaxFilesReachedClass();
  },

  // Called when a thumbnail has been generated
  // Receives `file` and `dataUrl`
  thumbnail(file: DropzoneFile, dataUrl: string) {
    if (file.previewElement) {
      file.previewElement.classList.remove("dz-file-preview");
      for (let thumbnailElement of file.previewElement.querySelectorAll<HTMLImageElement>(
        "[data-dz-thumbnail]",
      )) {
        thumbnailElement.alt = file.name;
        thumbnailElement.src = dataUrl;
      }

      return setTimeout(() => file.previewElement!.classList.add("dz-image-preview"), 1);
    }
    return undefined;
  },

  // Called whenever an error occurs
  // Receives `file` and `message`
  error(file: DropzoneFile, message: string) {
    if (file.previewElement) {
      file.previewElement.classList.add("dz-error");
      if (typeof message !== "string" && (message as any).error) {
        message = (message as any).error;
      }
      for (let node of file.previewElement.querySelectorAll("[data-dz-errormessage]")) {
        node.textContent = message;
      }
    }
  },

  errormultiple() {},

  // Called when a file gets processed. Since there is a queue, not all added
  // files are processed immediately.
  // Receives `file`
  processing(this: Dropzone, file: DropzoneFile) {
    if (file.previewElement) {
      file.previewElement.classList.add("dz-processing");
      if (file._removeLink) {
        return (file._removeLink.innerHTML = this.options.dictCancelUpload);
      }
    }
    return undefined;
  },

  processingmultiple() {},

  // Called whenever the upload progress gets updated.
  // Receives `file`, `progress` (percentage 0-100) and `bytesSent`.
  // To get the total number of bytes of the file, use `file.size`
  uploadprogress(file: DropzoneFile, progress: number, bytesSent: number) {
    if (file.previewElement) {
      for (let node of file.previewElement.querySelectorAll<HTMLProgressElement>(
        "[data-dz-uploadprogress]",
      )) {
        if (node.nodeName === "PROGRESS") {
          node.value = progress;
        } else {
          node.style.width = `${progress}%`;
        }
      }
    }
  },

  // Called whenever the total upload progress gets updated.
  // Called with totalUploadProgress (0-100), totalBytes and totalBytesSent
  totaluploadprogress() {},

  // Called just before the file is sent. Gets the `xhr` object as second
  // parameter, so you can modify it (for example to add a CSRF token) and a
  // `formData` object to add additional information.
  sending() {},

  sendingmultiple() {},

  // When the complete upload is finished and successful
  // Receives `file`
  success(file: DropzoneFile) {
    if (file.previewElement) {
      return file.previewElement.classList.add("dz-success");
    }
  },

  successmultiple() {},

  // When the upload is canceled.
  canceled(this: Dropzone, file: DropzoneFile) {
    return this.emit("error", file, this.options.dictUploadCanceled);
  },

  canceledmultiple() {},

  // When the upload is finished, either with success or an error.
  // Receives `file`
  complete(this: Dropzone, file: DropzoneFile) {
    if (file._removeLink) {
      file._removeLink.innerHTML = this.options.dictRemoveFile;
    }
    if (file.previewElement) {
      return file.previewElement.classList.add("dz-complete");
    }
  },

  completemultiple() {},

  maxfilesexceeded() {},

  maxfilesreached() {},

  queuecomplete() {},

  addedfiles() {},

  /**
   * Called when a dropped folder turns out to have nothing in it at all.
   * Receives the folder's path.
   */
  emptyfolder() {},
};

// Derived from the defaults rather than hand-written, so the options and their
// types stay in step with the source by construction.
//
// No index signature, deliberately: adding one would accept any key at all,
// and `maxFileSize` -- the wrong capitalisation of `maxFilesize` -- would pass
// silently, which is exactly what an option type is for. Custom keys are still
// merged onto the instance at runtime and readable through this.options, which
// does carry one.
export type DropzoneOptions = Partial<typeof defaultOptions>;

// What a Dropzone instance holds: the user's options merged over the defaults,
// so every one of them is present. Reading this.options through the Partial
// above would make each access `| undefined` for a value that is always there.
//
// No index signature here either. One would let the library read an option
// that does not exist without complaint, which is exactly what it was doing
// with this.options.fixOrientation.
export type ResolvedDropzoneOptions = typeof defaultOptions;

export default defaultOptions;
