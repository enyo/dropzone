import { Dropzone } from "../../src/dropzone";
import { useFakeXMLHttpRequest } from "../fake-xhr.js";

describe("Dropzone", function () {
  let getMockFile = (
    type = "text/html",
    filename = "test file name",
    contents = ["file contents"],
  ) => {
    let file = new File(contents, filename, { type: type });
    file.status = Dropzone.ADDED;
    file.accepted = true;
    file.upload = {
      filename: filename,
    };
    return file;
  };

  let xhr = null;
  beforeEach(() => (xhr = useFakeXMLHttpRequest()));

  describe("constructor()", function () {
    let dropzone = null;

    afterEach(function () {
      if (dropzone != null) {
        return dropzone.destroy();
      }
    });

    it("should throw an exception if the element is invalid", () =>
      expect(() => (dropzone = new Dropzone("#invalid-element"))).toThrow(
        "Invalid dropzone element.",
      ));

    it("should throw an exception if assigned twice to the same element", function () {
      let element = document.createElement("div");
      dropzone = new Dropzone(element, { url: "url" });
      return expect(() => new Dropzone(element, { url: "url" })).toThrow(
        "Dropzone already attached.",
      );
    });

    it("should throw an exception if both acceptedFiles and acceptedMimeTypes are specified", function () {
      let element = document.createElement("div");
      return expect(
        () =>
          (dropzone = new Dropzone(element, {
            url: "test",
            acceptedFiles: "param",
            acceptedMimeTypes: "types",
          })),
      ).toThrow(
        "You can't provide both 'acceptedFiles' and 'acceptedMimeTypes'. 'acceptedMimeTypes' is deprecated.",
      );
    });

    it("should set itself as element.dropzone", function () {
      let element = document.createElement("div");
      dropzone = new Dropzone(element, { url: "url" });
      return expect(element.dropzone).toBe(dropzone);
    });

    it("should add itself to Dropzone.instances", function () {
      let element = document.createElement("div");
      dropzone = new Dropzone(element, { url: "url" });
      return expect(Dropzone.instances[Dropzone.instances.length - 1]).toBe(dropzone);
    });

    it("should use the action attribute not the element with the name action", function () {
      let element = Dropzone.createElement(
        '<form action="real-action"><input type="hidden" name="action" value="wrong-action" /></form>',
      );
      dropzone = new Dropzone(element);
      return expect(dropzone.options.url).toBe("real-action");
    });

    describe("options", function () {
      let element = null;
      let element2 = null;
      beforeEach(function () {
        element = document.createElement("div");
        element.id = "test-element";
        element2 = document.createElement("div");
        element2.id = "test-element2";
        return (Dropzone.options.testElement = {
          url: "/some/url",
          parallelUploads: 10,
        });
      });
      afterEach(() => delete Dropzone.options.testElement);

      it("should take the options set in Dropzone.options", function () {
        dropzone = new Dropzone(element);
        expect(dropzone.options.url).toBe("/some/url");
        return expect(dropzone.options.parallelUploads).toBe(10);
      });

      it("should prefer passed options over Dropzone.options", function () {
        dropzone = new Dropzone(element, { url: "/some/other/url" });
        return expect(dropzone.options.url).toBe("/some/other/url");
      });

      it("should take the default options if nothing set in Dropzone.options", function () {
        dropzone = new Dropzone(element2, { url: "/some/url" });
        return expect(dropzone.options.parallelUploads).toBe(2);
      });

      it("should call the fallback function if forceFallback == true", () =>
        new Promise((done) => {
          dropzone = new Dropzone(element, {
            url: "/some/other/url",
            forceFallback: true,
            fallback() {
              return done();
            },
          });
        }));

      it("should set acceptedFiles if deprecated acceptedMimetypes option has been passed", function () {
        dropzone = new Dropzone(element, {
          url: "/some/other/url",
          acceptedMimeTypes: "my/type",
        });
        return expect(dropzone.options.acceptedFiles).toBe("my/type");
      });

      describe("options.clickable", function () {
        let clickableElement = null;
        dropzone = null;
        beforeEach(function () {
          clickableElement = document.createElement("div");
          clickableElement.className = "some-clickable";
          return document.body.appendChild(clickableElement);
        });
        afterEach(function () {
          document.body.removeChild(clickableElement);
          if (dropzone != null) {
            return dropzone.destroy;
          }
        });

        it("should use the default element if clickable == true", function () {
          dropzone = new Dropzone(element, { clickable: true });
          return expect(dropzone.clickableElements).toEqual([dropzone.element]);
        });
        it("should lookup the element if clickable is a CSS selector", function () {
          dropzone = new Dropzone(element, { clickable: ".some-clickable" });
          return expect(dropzone.clickableElements).toEqual([clickableElement]);
        });
        it("should simply use the provided element", function () {
          dropzone = new Dropzone(element, { clickable: clickableElement });
          return expect(dropzone.clickableElements).toEqual([clickableElement]);
        });
        it("should accept multiple clickable elements", function () {
          dropzone = new Dropzone(element, {
            clickable: [document.body, ".some-clickable"],
          });
          return expect(dropzone.clickableElements).toEqual([document.body, clickableElement]);
        });
        it("should throw an exception if the element is invalid", () =>
          expect(
            () =>
              (dropzone = new Dropzone(element, {
                clickable: ".some-invalid-clickable",
              })),
          ).toThrow(
            "Invalid `clickable` option provided. Please provide a CSS selector, a plain HTML element or a list of those.",
          ));
      });
    });
  });

  describe("init()", function () {
    describe("clickable", function () {
      let dropzones = {
        "using acceptedFiles": new Dropzone(Dropzone.createElement('<form action="/"></form>'), {
          clickable: true,
          acceptedFiles: "audio/*,video/*",
        }),
        "using acceptedMimeTypes": new Dropzone(
          Dropzone.createElement('<form action="/"></form>'),
          { clickable: true, acceptedMimeTypes: "audio/*,video/*" },
        ),
      };

      it("should not add an accept attribute if no acceptParameter", function () {
        let dropzone = new Dropzone(Dropzone.createElement('<form action="/"></form>'), {
          clickable: true,
          acceptParameter: null,
          acceptedMimeTypes: null,
        });
        return expect(dropzone.hiddenFileInput.hasAttribute("accept")).toBe(false);
      });

      return (() => {
        let result = [];
        for (let name in dropzones) {
          var dropzone = dropzones[name];
          result.push(
            describe(name, () =>
              (function (dropzone) {
                it("should create a hidden file input if clickable", function () {
                  expect(dropzone.hiddenFileInput).toBeTruthy();
                  expect(dropzone.hiddenFileInput.tagName).toBe("INPUT");
                });

                it("should have a tabindex of -1", function () {
                  expect(dropzone.hiddenFileInput.tabIndex).toBe(-1);
                });

                it("should carry an aria-label for automated auditors", function () {
                  expect(dropzone.hiddenFileInput.getAttribute("aria-label")).toBe(
                    "hidden file upload",
                  );
                });

                it("should use the acceptParameter", () =>
                  expect(dropzone.hiddenFileInput.getAttribute("accept")).toBe("audio/*,video/*"));

                it("should create a new input element when something is selected to reset the input field", () =>
                  (() => {
                    let result1 = [];
                    for (let i = 0; i <= 3; i++) {
                      let { hiddenFileInput } = dropzone;
                      let event = document.createEvent("HTMLEvents");
                      event.initEvent("change", true, true);
                      hiddenFileInput.dispatchEvent(event);
                      expect(dropzone.hiddenFileInput).not.toBe(hiddenFileInput);
                      result1.push(
                        expect(Dropzone.elementInside(hiddenFileInput, document)).toBeFalsy(),
                      );
                    }
                    return result1;
                  })());
              })(dropzone),
            ),
          );
        }
        return result;
      })();
    });

    it("should create a .dz-message element", function () {
      let element = Dropzone.createElement('<form class="dropzone" action="/"></form>');
      new Dropzone(element, {
        clickable: true,
        acceptParameter: null,
        acceptedMimeTypes: null,
      });
      return expect(element.querySelector(".dz-message")).toBeInstanceOf(Element);
    });

    it("should not create a .dz-message element if there already is one", function () {
      let element = Dropzone.createElement('<form class="dropzone" action="/"></form>');
      let msg = Dropzone.createElement('<div class="dz-message">TEST</div>');
      element.appendChild(msg);

      new Dropzone(element, {
        clickable: true,
        acceptParameter: null,
        acceptedMimeTypes: null,
      });
      expect(element.querySelector(".dz-message")).toBe(msg);

      return expect(element.querySelectorAll(".dz-message").length).toBe(1);
    });
  });

  describe("hidden input form association", function () {
    let dropzones = [];
    let elements = [];

    let attach = (html, selector) => {
      let element = Dropzone.createElement(html);
      document.body.appendChild(element);
      elements.push(element);

      let dropzone = new Dropzone(selector ? element.querySelector(selector) : element, {
        url: "/url",
      });
      dropzones.push(dropzone);
      return dropzone;
    };

    afterEach(function () {
      for (let dropzone of dropzones) dropzone.destroy();
      for (let element of elements) element.parentNode.removeChild(element);
      dropzones = [];
      elements = [];
    });

    it("should point at the form when the dropzone is one", function () {
      let dropzone = attach('<form id="upload-form" class="dropzone"></form>');
      expect(dropzone.hiddenFileInput.getAttribute("form")).toBe("upload-form");
    });

    it("should point at an ancestor form", function () {
      // The input is appended to the body, so it is outside this form.
      let dropzone = attach('<form id="outer-form"><div class="inner"></div></form>', ".inner");
      expect(dropzone.hiddenFileInput.getAttribute("form")).toBe("outer-form");
    });

    it("should not set the attribute when there is no form", function () {
      let dropzone = attach('<div id="plain-dropzone"></div>');
      expect(dropzone.hiddenFileInput.hasAttribute("form")).toBe(false);
    });

    it("should not point at an element that is not a form", function () {
      // The element has an id, but `form` must reference a <form>; pointing it
      // at a div would leave the input owned by no form at all.
      let dropzone = attach('<div id="not-a-form"></div>');
      expect(dropzone.hiddenFileInput.getAttribute("form")).toBe(null);
    });

    it("should not set the attribute when the form has no id", function () {
      let dropzone = attach('<form class="dropzone"></form>');
      expect(dropzone.hiddenFileInput.hasAttribute("form")).toBe(false);
    });

    it("should keep the association when the input is recreated", () =>
      new Promise((done) => {
        let dropzone = attach('<form id="recreated-form" class="dropzone"></form>');
        let first = dropzone.hiddenFileInput;

        // Selecting a file swaps the input out for a fresh one.
        first.dispatchEvent(new Event("change"));

        setTimeout(function () {
          expect(dropzone.hiddenFileInput).not.toBe(first);
          expect(dropzone.hiddenFileInput.getAttribute("form")).toBe("recreated-form");
          done();
        }, 10);
      }));
  });

  describe("options", function () {
    let element = null;
    let dropzone = null;

    beforeEach(function () {
      element = Dropzone.createElement("<div></div>");
      return (dropzone = new Dropzone(element, {
        maxFilesize: 4,
        url: "url",
        acceptedMimeTypes: "audio/*,image/png",
        maxFiles: 3,
      }));
    });

    describe("file specific", function () {
      let file = null;
      beforeEach(function () {
        file = {
          name: "test name",
          size: 2 * 1024 * 1024,
          width: 200,
          height: 100,
          upload: {
            filename: "test name",
          },
        };
        return dropzone.options.addedfile.call(dropzone, file);
      });

      describe(".addedFile()", () =>
        it("should properly create the previewElement", function () {
          expect(file.previewElement).toBeInstanceOf(Element);

          expect(file.previewElement.querySelector("[data-dz-name]").innerHTML).toEqual(
            "test name",
          );
          return expect(file.previewElement.querySelector("[data-dz-size]").innerHTML).toEqual(
            "<strong>2.1</strong> MB",
          );
        }));

      describe(".error()", function () {
        it("should properly insert the error", function () {
          dropzone.options.error.call(dropzone, file, "test message");

          return expect(
            file.previewElement.querySelector("[data-dz-errormessage]").innerHTML,
          ).toEqual("test message");
        });

        it("should properly insert the error when provided with an object containing the error", function () {
          dropzone.options.error.call(dropzone, file, {
            error: "test message",
          });

          return expect(
            file.previewElement.querySelector("[data-dz-errormessage]").innerHTML,
          ).toEqual("test message");
        });
      });

      describe(".thumbnail()", () =>
        it("should properly insert the error", function () {
          let transparentGif =
            "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
          dropzone.options.thumbnail.call(dropzone, file, transparentGif);
          let thumbnail = file.previewElement.querySelector("[data-dz-thumbnail]");
          expect(thumbnail.src).toEqual(transparentGif);
          return expect(thumbnail.alt).toEqual("test name");
        }));

      describe(".uploadprogress()", () =>
        it("should properly set the width", function () {
          dropzone.options.uploadprogress.call(dropzone, file, 0);
          expect(file.previewElement.querySelector("[data-dz-uploadprogress]").style.width).toEqual(
            "0%",
          );
          dropzone.options.uploadprogress.call(dropzone, file, 80);
          expect(file.previewElement.querySelector("[data-dz-uploadprogress]").style.width).toEqual(
            "80%",
          );
          dropzone.options.uploadprogress.call(dropzone, file, 90);
          expect(file.previewElement.querySelector("[data-dz-uploadprogress]").style.width).toEqual(
            "90%",
          );
          dropzone.options.uploadprogress.call(dropzone, file, 100);
          return expect(
            file.previewElement.querySelector("[data-dz-uploadprogress]").style.width,
          ).toEqual("100%");
        }));

      describe(".resize()", function () {
        describe("with default thumbnail settings", function () {
          it("should properly return target dimensions for 'contain'", function () {
            let info = dropzone.options.resize.call(dropzone, file, 120, 120, "crop");
            expect(info.trgWidth).toEqual(120);
            expect(info.trgHeight).toEqual(100);
            info = dropzone.options.resize.call(dropzone, file, 100, 100, "crop");
            expect(info.trgWidth).toEqual(100);
            return expect(info.trgHeight).toEqual(100);
          });

          it("should properly return target dimensions for 'contain'", function () {
            let info = dropzone.options.resize.call(dropzone, file, 120, 120, "contain");
            expect(info.trgWidth).toEqual(120);
            expect(info.trgHeight).toEqual(60);
            info = dropzone.options.resize.call(dropzone, file, 100, 100, "contain");
            expect(info.trgWidth).toEqual(100);
            return expect(info.trgHeight).toEqual(50);
          });
        });

        describe("with null thumbnail settings", function () {
          it("should properly return target dimensions for crop", function () {
            let testSettings = [
              [null, null],
              [null, 80],
              [150, null],
            ];

            return (() => {
              let result = [];
              for (let i = 0; i < testSettings.length; i++) {
                let setting = testSettings[i];
                let info = dropzone.options.resize.call(
                  dropzone,
                  file,
                  setting[0],
                  setting[1],
                  "crop",
                );

                if (i === 0) {
                  expect(info.trgWidth).toEqual(200);
                  expect(info.trgHeight).toEqual(100);
                }

                if (i === 1) {
                  expect(info.trgWidth).toEqual(160);
                  expect(info.trgHeight).toEqual(80);
                }

                if (i === 2) {
                  expect(info.trgWidth).toEqual(150);
                  result.push(expect(info.trgHeight).toEqual(75));
                } else {
                  result.push(undefined);
                }
              }
              return result;
            })();
          });

          it("should properly return target dimensions for contain", function () {
            let testSettings = [
              [null, 80],
              [150, null],
            ];

            return (() => {
              let result = [];
              for (let i = 0; i < testSettings.length; i++) {
                let setting = testSettings[i];
                let info = dropzone.options.resize.call(
                  dropzone,
                  file,
                  setting[0],
                  setting[1],
                  "contain",
                );

                if (i === 0) {
                  expect(info.trgWidth).toEqual(160);
                  expect(info.trgHeight).toEqual(80);
                }

                if (i === 1) {
                  expect(info.trgWidth).toEqual(150);
                  result.push(expect(info.trgHeight).toEqual(75));
                } else {
                  result.push(undefined);
                }
              }
              return result;
            })();
          });
        });
      });
    });
  });

  describe("instance", function () {
    let element = null;
    let dropzone = null;
    let requests = null;
    beforeEach(function () {
      requests = [];
      xhr.onCreate = (xhr) => requests.push(xhr);

      element = Dropzone.createElement("<div></div>");
      document.body.appendChild(element);
      return (dropzone = new Dropzone(element, {
        maxFilesize: 4,
        maxFiles: 100,
        url: "url",
        acceptedMimeTypes: "audio/*,image/png",
        uploadprogress() {},
      }));
    });
    afterEach(function () {
      document.body.removeChild(element);
      dropzone.destroy();
      return xhr.restore();
    });

    describe(".accept()", function () {
      it("should pass if the filesize is OK", () =>
        dropzone.accept({ size: 2 * 1024 * 1024, type: "audio/mp3" }, (err) =>
          expect(err).toBeUndefined(),
        ));

      it("shouldn't pass if the filesize is too big", () =>
        dropzone.accept({ size: 10 * 1024 * 1024, type: "audio/mp3" }, (err) =>
          expect(err).toEqual("File is too big (10MiB). Max filesize: 4MiB."),
        ));

      it("should properly accept files which mime types are listed in acceptedFiles", function () {
        dropzone.accept({ type: "audio/mp3" }, (err) => expect(err).toBeUndefined());
        dropzone.accept({ type: "image/png" }, (err) => expect(err).toBeUndefined());
        return dropzone.accept({ type: "audio/wav" }, (err) => expect(err).toBeUndefined());
      });

      it("should properly reject files when the mime type isn't listed in acceptedFiles", () =>
        dropzone.accept({ type: "image/jpeg" }, (err) =>
          expect(err).toEqual("You can't upload files of this type."),
        ));

      it("should fail if maxFiles has been exceeded and call the event maxfilesexceeded", function () {
        vi.spyOn(dropzone, "getAcceptedFiles").mockImplementation(() => {});
        let file = { type: "audio/mp3" };

        dropzone.getAcceptedFiles.mockReturnValue({ length: 99 });

        dropzone.options.dictMaxFilesExceeded = "You can only upload {{maxFiles}} files.";

        let called = false;
        dropzone.on("maxfilesexceeded", function (lfile) {
          expect(lfile).toBe(file);
          return (called = true);
        });

        dropzone.accept(file, (err) => expect(err).toBeUndefined());
        expect(called).toBeFalsy();

        dropzone.getAcceptedFiles.mockReturnValue({ length: 100 });
        dropzone.accept(file, (err) => expect(err).toBe("You can only upload 100 files."));
        expect(called).toBeTruthy();

        return dropzone.getAcceptedFiles.mockRestore();
      });

      it("should properly handle if maxFiles is 0", function () {
        let file = { type: "audio/mp3" };

        dropzone.options.maxFiles = 0;

        let called = false;
        dropzone.on("maxfilesexceeded", function (lfile) {
          expect(lfile).toBe(file);
          return (called = true);
        });

        dropzone.accept(file, (err) => expect(err).toBe("You cannot upload any more files."));
        return expect(called).toBeTruthy();
      });
    });

    describe(".removeFile()", () =>
      it("should abort uploading if file is currently being uploaded", () =>
        new Promise((done) => {
          let mockFile = getMockFile();
          dropzone.uploadFile = function (file) {};
          dropzone.accept = (file, done) => done();

          vi.spyOn(dropzone, "cancelUpload").mockImplementation(() => {});

          dropzone.addFile(mockFile);
          return setTimeout(function () {
            expect(mockFile.status).toBe(Dropzone.UPLOADING);
            expect(dropzone.getUploadingFiles()[0]).toBe(mockFile);

            expect(dropzone.cancelUpload).toHaveBeenCalledTimes(0);
            dropzone.removeFile(mockFile);
            expect(dropzone.cancelUpload).toHaveBeenCalledTimes(1);
            return done();
          }, 100);
        })));

    describe(".cancelUpload()", function () {
      it("should properly cancel upload if file currently uploading", () =>
        new Promise((done) => {
          let mockFile = getMockFile();

          dropzone.accept = (file, done) => done();

          dropzone.addFile(mockFile);

          return setTimeout(function () {
            expect(mockFile.status).toBe(Dropzone.UPLOADING);
            expect(dropzone.getUploadingFiles()[0]).toBe(mockFile);
            dropzone.cancelUpload(mockFile);
            expect(mockFile.status).toBe(Dropzone.CANCELED);
            expect(dropzone.getUploadingFiles().length).toBe(0);
            expect(dropzone.getQueuedFiles().length).toBe(0);
            return done();
          }, 10);
        }));

      it("should properly cancel the upload if file is not yet uploading", function () {
        let mockFile = getMockFile();

        dropzone.accept = (file, done) => done();

        // Making sure the file stays in the queue.
        dropzone.options.parallelUploads = 0;

        dropzone.addFile(mockFile);
        expect(mockFile.status).toBe(Dropzone.QUEUED);
        expect(dropzone.getQueuedFiles()[0]).toBe(mockFile);

        dropzone.cancelUpload(mockFile);
        expect(mockFile.status).toBe(Dropzone.CANCELED);
        expect(dropzone.getQueuedFiles().length).toBe(0);
        return expect(dropzone.getUploadingFiles().length).toBe(0);
      });

      it("should call processQueue()", () =>
        new Promise((done) => {
          let mockFile = getMockFile();

          dropzone.accept = (file, done) => done();

          // Making sure the file stays in the queue.
          dropzone.options.parallelUploads = 0;

          vi.spyOn(dropzone, "processQueue");

          dropzone.addFile(mockFile);
          return setTimeout(function () {
            expect(dropzone.processQueue).toHaveBeenCalledTimes(1);

            dropzone.cancelUpload(mockFile);

            expect(dropzone.processQueue).toHaveBeenCalledTimes(2);
            return done();
          }, 10);
        }));

      it("should properly cancel all files with the same XHR if uploadMultiple is true", () =>
        new Promise((done) => {
          let mock1 = getMockFile();
          let mock2 = getMockFile();
          let mock3 = getMockFile();

          dropzone.accept = (file, done) => done();

          // Making sure the file stays in the queue.
          dropzone.options.uploadMultiple = true;
          dropzone.options.parallelUploads = 3;

          vi.spyOn(dropzone, "processFiles");

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);
          dropzone.addFile(mock3);

          return setTimeout(function () {
            expect(dropzone.processFiles).toHaveBeenCalledTimes(1);

            vi.spyOn(mock1.xhr, "abort");

            dropzone.cancelUpload(mock1);

            expect(mock1.xhr === mock2.xhr && mock2.xhr === mock3.xhr).toBeTruthy();

            expect(mock1.status).toBe(Dropzone.CANCELED);
            expect(mock2.status).toBe(Dropzone.CANCELED);
            expect(mock3.status).toBe(Dropzone.CANCELED);

            // The XHR should only be aborted once!
            expect(mock1.xhr.abort).toHaveBeenCalledTimes(1);

            return done();
          }, 10);
        }));
    });

    describe(".disable()", () =>
      it("should properly cancel all pending uploads", () =>
        new Promise((done) => {
          dropzone.accept = (file, done) => done();

          dropzone.options.parallelUploads = 1;

          dropzone.addFile(getMockFile());
          dropzone.addFile(getMockFile());

          return setTimeout(function () {
            expect(dropzone.getUploadingFiles().length).toBe(1);
            expect(dropzone.getQueuedFiles().length).toBe(1);
            expect(dropzone.files.length).toBe(2);

            vi.spyOn(requests[0], "abort");

            expect(requests[0].abort).toHaveBeenCalledTimes(0);

            dropzone.disable();

            expect(requests[0].abort).toHaveBeenCalledTimes(1);

            expect(dropzone.getUploadingFiles().length).toBe(0);
            expect(dropzone.getQueuedFiles().length).toBe(0);
            expect(dropzone.files.length).toBe(2);

            expect(dropzone.files[0].status).toBe(Dropzone.CANCELED);
            expect(dropzone.files[1].status).toBe(Dropzone.CANCELED);
            return done();
          }, 10);
        })));

    describe(".destroy()", function () {
      it("should properly cancel all pending uploads and remove all file references", () =>
        new Promise((done) => {
          dropzone.accept = (file, done) => done();

          dropzone.options.parallelUploads = 1;

          dropzone.addFile(getMockFile());
          dropzone.addFile(getMockFile());

          return setTimeout(function () {
            expect(dropzone.getUploadingFiles().length).toBe(1);
            expect(dropzone.getQueuedFiles().length).toBe(1);
            expect(dropzone.files.length).toBe(2);

            vi.spyOn(dropzone, "disable");

            dropzone.destroy();

            expect(dropzone.disable).toHaveBeenCalledTimes(1);
            expect(element).not.toHaveProperty("dropzone");
            return done();
          }, 10);
        }));

      it("should be able to create instance of dropzone on the same element after destroy", function () {
        dropzone.destroy();
        return expect(
          () =>
            new Dropzone(element, {
              maxFilesize: 4,
              url: "url",
              acceptedMimeTypes: "audio/*,image/png",
              uploadprogress() {},
            }),
        ).not.toThrow(Error);
      });

      it("should remove itself from Dropzone.instances", function () {
        expect(Dropzone.instances.indexOf(dropzone) !== -1).toBeTruthy();
        dropzone.destroy();
        return expect(Dropzone.instances.indexOf(dropzone) === -1).toBeTruthy();
      });
    });

    describe(".filesize()", function () {
      it("should handle files with 0 size properly", () =>
        expect(dropzone.filesize(0)).toEqual("<strong>0</strong> b"));

      it("should convert to KiloBytes, etc..", function () {
        expect(dropzone.options.filesizeBase).toEqual(1000); // Just making sure the default config is correct

        expect(dropzone.filesize(2 * 1000 * 1000)).toEqual("<strong>2</strong> MB");
        expect(dropzone.filesize(2 * 1024 * 1024)).toEqual("<strong>2.1</strong> MB");

        expect(dropzone.filesize(2 * 1000 * 1000 * 1000)).toEqual("<strong>2</strong> GB");
        expect(dropzone.filesize(2 * 1024 * 1024 * 1024)).toEqual("<strong>2.1</strong> GB");

        expect(dropzone.filesize(2.5111 * 1000 * 1000 * 1000)).toEqual("<strong>2.5</strong> GB");
        expect(dropzone.filesize(1.1 * 1000)).toEqual("<strong>1.1</strong> KB");
        return expect(dropzone.filesize(999 * 1000)).toEqual("<strong>1</strong> MB");
      });

      it("should convert to KibiBytes, etc.. when the filesizeBase is changed to 1024", function () {
        dropzone.options.filesizeBase = 1024;

        expect(dropzone.filesize(2 * 1024 * 1024)).toEqual("<strong>2</strong> MB");
        return expect(dropzone.filesize(2 * 1000 * 1000)).toEqual("<strong>1.9</strong> MB");
      });
    });

    describe("._updateMaxFilesReachedClass()", function () {
      it("should properly add the dz-max-files-reached class", function () {
        dropzone.getAcceptedFiles = () => ({ length: 10 });
        dropzone.options.maxFiles = 10;
        expect(dropzone.element.classList.contains("dz-max-files-reached")).toBeFalsy();
        dropzone._updateMaxFilesReachedClass();
        return expect(dropzone.element.classList.contains("dz-max-files-reached")).toBeTruthy();
      });
      it("should fire the 'maxfilesreached' event when appropriate", function () {
        let spy = vi.fn();
        dropzone.on("maxfilesreached", () => spy());
        dropzone.getAcceptedFiles = () => ({ length: 9 });
        dropzone.options.maxFiles = 10;
        dropzone._updateMaxFilesReachedClass();
        expect(spy).not.toHaveBeenCalled();
        dropzone.getAcceptedFiles = () => ({ length: 10 });
        dropzone._updateMaxFilesReachedClass();
        expect(spy).toHaveBeenCalled();
        dropzone.getAcceptedFiles = () => ({ length: 11 });
        dropzone._updateMaxFilesReachedClass();
        expect(spy).toHaveBeenCalledTimes(1);
      }); //ie, it has not been called again

      it("should properly remove the dz-max-files-reached class", function () {
        dropzone.getAcceptedFiles = () => ({ length: 10 });
        dropzone.options.maxFiles = 10;
        expect(dropzone.element.classList.contains("dz-max-files-reached")).toBeFalsy();
        dropzone._updateMaxFilesReachedClass();
        expect(dropzone.element.classList.contains("dz-max-files-reached")).toBeTruthy();
        dropzone.getAcceptedFiles = () => ({ length: 9 });
        dropzone._updateMaxFilesReachedClass();
        return expect(dropzone.element.classList.contains("dz-max-files-reached")).toBeFalsy();
      });
    });

    describe("events", () => {
      describe("progress updates", () =>
        it("should properly emit a totaluploadprogress event", () =>
          new Promise((done) => {
            dropzone.files = [
              {
                size: 1990,
                accepted: true,
                status: Dropzone.UPLOADING,
                upload: {
                  progress: 20,
                  total: 2000, // The bytes to upload are higher than the file size
                  bytesSent: 400,
                },
              },
              {
                size: 1990,
                accepted: true,
                status: Dropzone.UPLOADING,
                upload: {
                  progress: 10,
                  total: 2000, // The bytes to upload are higher than the file size
                  bytesSent: 200,
                },
              },
            ];

            let _called = 0;

            dropzone.on("totaluploadprogress", function (progress) {
              expect(progress).toBe(totalProgressExpectation);
              if (++_called === 3) {
                return done();
              }
            });

            var totalProgressExpectation = 15;
            dropzone.emit("uploadprogress", {});

            totalProgressExpectation = 97.5;
            dropzone.files[0].upload.bytesSent = 2000;
            dropzone.files[1].upload.bytesSent = 1900;
            // It shouldn't matter that progress is not properly updated since the total size
            // should be calculated from the bytes
            dropzone.emit("uploadprogress", {});

            totalProgressExpectation = 100;
            dropzone.files[0].upload.bytesSent = 2000;
            dropzone.files[1].upload.bytesSent = 2000;
            // It shouldn't matter that progress is not properly updated since the total size
            // should be calculated from the bytes
            dropzone.emit("uploadprogress", {});

            // Just so the afterEach hook doesn't try to cancel them.
            dropzone.files[0].status = Dropzone.CANCELED;
            return (dropzone.files[1].status = Dropzone.CANCELED);
          })));

      it("should emit DOM events", () =>
        new Promise((done) => {
          let element = Dropzone.createElement(`<form action="/the/url">
  <input type="hidden" name="test" value="hidden" />
  <input type="checkbox" name="unchecked" value="1" />
  <input type="checkbox" name="checked" value="value1" checked="checked" />
  <input type="radio" value="radiovalue1" name="radio1" />
  <input type="radio" value="radiovalue2" name="radio1" checked="checked" />
  <select name="select"><option value="1">1</option><option value="2" selected>2</option></select>
</form>`);
          dropzone = new Dropzone(element, { url: "/the/url" });

          var domEventTriggered = false;
          element.addEventListener("dropzone:sending", function (evt) {
            domEventTriggered = true;
          });

          let mock1 = getMockFile();

          dropzone.addFile(mock1);

          return setTimeout(function () {
            expect(domEventTriggered).toBe(true);
            done();
          }, 10);
        }));
    });
  });

  describe("helper function", function () {
    let element = null;
    let dropzone = null;
    beforeEach(function () {
      element = Dropzone.createElement("<div></div>");
      return (dropzone = new Dropzone(element, { url: "url" }));
    });

    describe("getExistingFallback()", function () {
      it("should return undefined if no fallback", () =>
        expect(dropzone.getExistingFallback()).toBe(undefined));

      it("should only return the fallback element if it contains exactly fallback", function () {
        element.appendChild(Dropzone.createElement('<form class="fallbacks"></form>'));
        element.appendChild(Dropzone.createElement('<form class="sfallback"></form>'));
        return expect(dropzone.getExistingFallback()).toBe(undefined);
      });

      it("should return divs as fallback", function () {
        let fallback = Dropzone.createElement('<form class=" abc fallback test "></form>');
        element.appendChild(fallback);
        return expect(fallback).toBe(dropzone.getExistingFallback());
      });
      it("should return forms as fallback", function () {
        let fallback = Dropzone.createElement('<div class=" abc fallback test "></div>');
        element.appendChild(fallback);
        return expect(fallback).toBe(dropzone.getExistingFallback());
      });
    });

    describe("getFallbackForm()", function () {
      it("should use the paramName without [0] if uploadMultiple is false", function () {
        dropzone.options.uploadMultiple = false;
        dropzone.options.paramName = "myFile";
        let fallback = dropzone.getFallbackForm();
        let fileInput = fallback.querySelector("input[type=file]");
        return expect(fileInput.name).toBe("myFile");
      });
      it("should properly add [0] to the file name if uploadMultiple is true", function () {
        dropzone.options.uploadMultiple = true;
        dropzone.options.paramName = "myFile";
        let fallback = dropzone.getFallbackForm();
        let fileInput = fallback.querySelector("input[type=file]");
        return expect(fileInput.name).toBe("myFile[0]");
      });
    });

    describe("getAcceptedFiles() / getRejectedFiles()", function () {
      let mock2, mock3, mock4;
      let mock1 = (mock2 = mock3 = mock4 = null);
      beforeEach(function () {
        mock1 = getMockFile();
        mock2 = getMockFile();
        mock3 = getMockFile();
        mock4 = getMockFile();
        dropzone.options.accept = function (file, done) {
          if (file === mock1 || file === mock3) {
            return done();
          } else {
            return done("error");
          }
        };
        dropzone.addFile(mock1);
        dropzone.addFile(mock2);
        dropzone.addFile(mock3);
        return dropzone.addFile(mock4);
      });

      it("getAcceptedFiles() should only return accepted files", () =>
        expect(dropzone.getAcceptedFiles()).toEqual([mock1, mock3]));
      it("getRejectedFiles() should only return rejected files", () =>
        expect(dropzone.getRejectedFiles()).toEqual([mock2, mock4]));
    });

    describe("getQueuedFiles()", () =>
      it("should return all files with the status Dropzone.QUEUED", function () {
        let mock1 = getMockFile();
        let mock2 = getMockFile();
        let mock3 = getMockFile();
        let mock4 = getMockFile();

        dropzone.options.accept = (file, done) => (file.done = done);

        dropzone.addFile(mock1);
        dropzone.addFile(mock2);
        dropzone.addFile(mock3);
        dropzone.addFile(mock4);

        expect(dropzone.getQueuedFiles()).toEqual([]);

        mock1.done();
        mock3.done();

        expect(dropzone.getQueuedFiles()).toEqual([mock1, mock3]);
        expect(mock1.status).toBe(Dropzone.QUEUED);
        expect(mock3.status).toBe(Dropzone.QUEUED);
        expect(mock2.status).toBe(Dropzone.ADDED);
        return expect(mock4.status).toBe(Dropzone.ADDED);
      }));

    describe("getUploadingFiles()", () =>
      it("should return all files with the status Dropzone.UPLOADING", () =>
        new Promise((done) => {
          let mock1 = getMockFile();
          let mock2 = getMockFile();
          let mock3 = getMockFile();
          let mock4 = getMockFile();

          dropzone.options.accept = (file, _done) => (file.done = _done);
          dropzone.uploadFile = function () {};

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);
          dropzone.addFile(mock3);
          dropzone.addFile(mock4);

          expect(dropzone.getUploadingFiles()).toEqual([]);

          mock1.done();
          mock3.done();

          return setTimeout(function () {
            expect(dropzone.getUploadingFiles()).toEqual([mock1, mock3]);
            expect(mock1.status).toBe(Dropzone.UPLOADING);
            expect(mock3.status).toBe(Dropzone.UPLOADING);
            expect(mock2.status).toBe(Dropzone.ADDED);
            expect(mock4.status).toBe(Dropzone.ADDED);
            return done();
          }, 10);
        })));

    describe("getActiveFiles()", () =>
      it("should return all files with the status Dropzone.UPLOADING or Dropzone.QUEUED", () =>
        new Promise((done) => {
          let mock1 = getMockFile();
          let mock2 = getMockFile();
          let mock3 = getMockFile();
          let mock4 = getMockFile();

          dropzone.options.accept = (file, _done) => (file.done = _done);
          dropzone.uploadFile = function () {};
          dropzone.options.parallelUploads = 2;

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);
          dropzone.addFile(mock3);
          dropzone.addFile(mock4);

          expect(dropzone.getActiveFiles()).toEqual([]);

          mock1.done();
          mock3.done();
          mock4.done();

          return setTimeout(function () {
            expect(dropzone.getActiveFiles()).toEqual([mock1, mock3, mock4]);
            expect(mock1.status).toBe(Dropzone.UPLOADING);
            expect(mock3.status).toBe(Dropzone.UPLOADING);
            expect(mock2.status).toBe(Dropzone.ADDED);
            expect(mock4.status).toBe(Dropzone.QUEUED);
            return done();
          }, 10);
        })));

    describe("getFilesWithStatus()", () =>
      it("should return all files with provided status", function () {
        let mock1 = getMockFile();
        let mock2 = getMockFile();
        let mock3 = getMockFile();
        let mock4 = getMockFile();

        dropzone.options.accept = (file, _done) => (file.done = _done);
        dropzone.uploadFile = function () {};

        dropzone.addFile(mock1);
        dropzone.addFile(mock2);
        dropzone.addFile(mock3);
        dropzone.addFile(mock4);

        expect(dropzone.getFilesWithStatus(Dropzone.ADDED)).toEqual([mock1, mock2, mock3, mock4]);

        mock1.status = Dropzone.UPLOADING;
        mock3.status = Dropzone.QUEUED;
        mock4.status = Dropzone.QUEUED;

        expect(dropzone.getFilesWithStatus(Dropzone.ADDED)).toEqual([mock2]);
        expect(dropzone.getFilesWithStatus(Dropzone.UPLOADING)).toEqual([mock1]);
        return expect(dropzone.getFilesWithStatus(Dropzone.QUEUED)).toEqual([mock3, mock4]);
      }));
  });

  describe("file handling", function () {
    let mockFile = null;
    let dropzone = null;

    beforeEach(function () {
      mockFile = getMockFile();

      let element = Dropzone.createElement("<div></div>");
      dropzone = new Dropzone(element, { url: "/the/url" });
    });

    afterEach(() => dropzone.destroy());

    describe("addFile()", function () {
      it("should properly set the status of the file", function () {
        let doneFunction = null;

        dropzone.accept = (file, done) => (doneFunction = done);
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        dropzone.addFile(mockFile);

        expect(mockFile.status).toEqual(Dropzone.ADDED);
        doneFunction();
        expect(mockFile.status).toEqual(Dropzone.QUEUED);

        mockFile = getMockFile();
        dropzone.addFile(mockFile);

        expect(mockFile.status).toEqual(Dropzone.ADDED);
        doneFunction("error");
        return expect(mockFile.status).toEqual(Dropzone.ERROR);
      });

      it("should properly set the status of the file if autoProcessQueue is false and not call processQueue", () =>
        new Promise((done) => {
          let doneFunction = null;
          dropzone.options.autoProcessQueue = false;
          dropzone.accept = (file, done) => (doneFunction = done);
          dropzone.processFile = function () {};
          dropzone.uploadFile = function () {};

          dropzone.addFile(mockFile);
          vi.spyOn(dropzone, "processQueue").mockImplementation(() => {});

          expect(mockFile.status).toEqual(Dropzone.ADDED);
          doneFunction();
          expect(mockFile.status).toEqual(Dropzone.QUEUED);
          expect(dropzone.processQueue).toHaveBeenCalledTimes(0);
          return setTimeout(function () {
            expect(dropzone.processQueue).toHaveBeenCalledTimes(0);
            return done();
          }, 10);
        }));

      it("should not add the file to the queue if autoQueue is false", function () {
        let doneFunction = null;
        dropzone.options.autoQueue = false;
        dropzone.accept = (file, done) => (doneFunction = done);
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        dropzone.addFile(mockFile);

        expect(mockFile.status).toEqual(Dropzone.ADDED);
        doneFunction();
        return expect(mockFile.status).toEqual(Dropzone.ADDED);
      });

      it("should create a remove link if configured to do so", function () {
        dropzone.options.addRemoveLinks = true;
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        vi.spyOn(dropzone, "processQueue").mockImplementation(() => {});
        dropzone.addFile(mockFile);

        return expect(
          dropzone.files[0].previewElement.querySelector("a[data-dz-remove].dz-remove"),
        ).toBeTruthy();
      });

      it("should create a remove link with HTML if configured to do so", function () {
        dropzone.options.addRemoveLinks = true;
        dropzone.options.dictRemoveFile = '<i class="icon icon-class"></i> Remove';
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        vi.spyOn(dropzone, "processQueue").mockImplementation(() => {});
        dropzone.addFile(mockFile);

        return (
          expect(
            dropzone.files[0].previewElement.querySelector("a[data-dz-remove].dz-remove"),
          ).toBeTruthy() &&
          expect(
            dropzone.files[0].previewElement.querySelector("a[data-dz-remove].dz-remove").innerHTML,
          ).toBe('<i class="icon icon-class"></i> Remove')
        );
      });

      it("should attach an event handler to data-dz-remove links", function () {
        dropzone.options.previewTemplate = `\
<div class="dz-preview dz-file-preview">
  <div class="dz-details">
    <div class="dz-filename"><span data-dz-name></span></div>
    <div class="dz-size" data-dz-size></div>
    <img data-dz-thumbnail />
  </div>
  <div class="dz-progress"><span class="dz-upload" data-dz-uploadprogress></span></div>
  <div class="dz-success-mark"><span>✔</span></div>
  <div class="dz-error-mark"><span>✘</span></div>
  <div class="dz-error-message"><span data-dz-errormessage></span></div>
  <a class="link1" data-dz-remove></a>
  <a class="link2" data-dz-remove></a>
</div>\
`;

        vi.spyOn(dropzone, "processQueue").mockImplementation(() => {});

        dropzone.addFile(mockFile);

        let file = dropzone.files[0];
        let removeLink1 = file.previewElement.querySelector("a[data-dz-remove].link1");
        let removeLink2 = file.previewElement.querySelector("a[data-dz-remove].link2");

        vi.spyOn(dropzone, "removeFile").mockImplementation(() => {});

        let event = document.createEvent("HTMLEvents");
        event.initEvent("click", true, true);
        removeLink1.dispatchEvent(event);

        expect(dropzone.removeFile.mock.calls.length).toEqual(1);

        event = document.createEvent("HTMLEvents");
        event.initEvent("click", true, true);
        removeLink2.dispatchEvent(event);

        return expect(dropzone.removeFile.mock.calls.length).toEqual(2);
      });

      describe("thumbnails", function () {
        it("should properly queue the thumbnail creation", () =>
          new Promise((done) => {
            let ct_callback;

            dropzone.accept = (file, done) => {};
            dropzone.processFile = function () {};
            dropzone.uploadFile = function () {};

            let mock1 = getMockFile("image/jpg");
            let mock2 = getMockFile("image/jpg");
            let mock3 = getMockFile("image/jpg");

            let ct_file;
            dropzone.createThumbnail = function (
              file,
              thumbnailWidth,
              thumbnailHeight,
              resizeMethod,
              fixOrientation,
              callback,
            ) {
              ct_file = file;
              ct_callback = callback;
            };

            vi.spyOn(dropzone, "createThumbnail");

            dropzone.addFile(mock1);
            dropzone.addFile(mock2);
            dropzone.addFile(mock3);

            expect(dropzone.files.length).toEqual(3);
            return setTimeout(function () {
              expect(dropzone.createThumbnail.mock.calls.length).toEqual(1);
              expect(mock1).toBe(ct_file);
              ct_callback();
              expect(dropzone.createThumbnail.mock.calls.length).toEqual(2);
              expect(mock2).toBe(ct_file);
              ct_callback();
              expect(dropzone.createThumbnail.mock.calls.length).toEqual(3);
              expect(mock3).toBe(ct_file);

              return done();
            }, 10);
          }));

        it("should emit an error instead of a broken thumbnail if the image can't be decoded", () =>
          new Promise((done, fail) => {
            dropzone.processFile = function () {};
            dropzone.uploadFile = function () {};

            // Claims to be a PNG, but the bytes are not decodable -- a text
            // file renamed to .png, for instance.
            let corrupt = getMockFile("image/png", "corrupt.png", ["not a png"]);

            dropzone.on("thumbnail", () =>
              fail(new Error("a thumbnail was emitted for an undecodable image")),
            );
            let reported = false;
            dropzone.on("error", function (file, message) {
              // destroy() emits "error" again when it cancels the upload.
              if (reported) return;
              reported = true;

              expect(file).toBe(corrupt);
              expect(message).toBe(dropzone.options.dictThumbnailError);
              done();
            });

            dropzone.addFile(corrupt);
          }));

        it("should emit an error and keep the queue moving if a file can't be read", async function () {
          dropzone.processFile = function () {};
          dropzone.uploadFile = function () {};

          // A file that has gone away since it was dropped, or is locked by
          // another process, makes FileReader fire `error` and never `load`.
          // See #2365.
          let readAsDataURL = vi
            .spyOn(FileReader.prototype, "readAsDataURL")
            .mockImplementation(function () {
              setTimeout(() => this.dispatchEvent(new ProgressEvent("error")), 0);
            });

          let unreadable = getMockFile("image/png", "unreadable.png");

          let message = await new Promise(function (resolve) {
            dropzone.on("error", function (file, message) {
              if (file === unreadable) resolve(message);
            });
            dropzone.addFile(unreadable);
          });

          expect(message).toBe(dropzone.options.dictThumbnailError);
          // The lock has to be released, or nothing queued behind the failed
          // file is ever processed again.
          expect(dropzone._processingThumbnail).toBe(false);

          readAsDataURL.mockRestore();

          let readable = await new Promise(function (resolve) {
            let canvas = document.createElement("canvas");
            canvas.width = canvas.height = 10;
            canvas.toBlob(
              (blob) => resolve(new File([blob], "readable.png", { type: "image/png" })),
              "image/png",
            );
          });

          let thumbnailed = await new Promise(function (resolve) {
            dropzone.on("thumbnail", (file) => resolve(file));
            dropzone.addFile(readable);
          });

          expect(thumbnailed).toBe(readable);
        });

        it("should not let the thumbnail itself be dragged", function () {
          dropzone.processFile = function () {};
          dropzone.uploadFile = function () {};

          let mock = getMockFile("image/png", "image.png");
          dropzone.addFile(mock);

          // Dragging the thumbnail out and dropping it back on the dropzone
          // hands the drop handler a fresh File built from the data URL, which
          // shows up as a second copy under a generated name. See #2265.
          let thumbnail = mock.previewElement.querySelector("[data-dz-thumbnail]");
          expect(thumbnail.draggable).toBe(false);
        });

        describe("when file is SVG", () =>
          it("should use the SVG image itself", () =>
            new Promise((done) => {
              let createBlob = function (data, type) {
                try {
                  return new Blob([data], { type });
                } catch (e) {
                  let BlobBuilder =
                    window.BlobBuilder ||
                    window.WebKitBlobBuilder ||
                    window.MozBlobBuilder ||
                    window.MSBlobBuilder;
                  let builder = new BlobBuilder();
                  builder.append(data.buffer || data);
                  return builder.getBlob(type);
                }
              };

              let blob = createBlob("foo", "image/svg+xml");

              return dropzone.createThumbnail(
                blob,
                dropzone.options.thumbnailWidth,
                dropzone.options.thumbnailHeight,
                "crop",
                false,
                function (dataURI, canvas) {
                  let fileReader = new FileReader();
                  fileReader.onload = function () {
                    expect(fileReader.result).toBe(dataURI);
                    return done();
                  };
                  return fileReader.readAsDataURL(blob);
                },
              );
            })));
      });
    });

    describe("enqueueFile()", function () {
      it("should be wrapped by enqueueFiles()", function () {
        vi.spyOn(dropzone, "enqueueFile").mockImplementation(() => {});

        let mock1 = getMockFile();
        let mock2 = getMockFile();
        let mock3 = getMockFile();

        dropzone.enqueueFiles([mock1, mock2, mock3]);

        expect(dropzone.enqueueFile).toHaveBeenCalledTimes(3);
        expect(dropzone.enqueueFile.mock.calls[0][0]).toBe(mock1);
        expect(dropzone.enqueueFile.mock.calls[1][0]).toBe(mock2);
        return expect(dropzone.enqueueFile.mock.calls[2][0]).toBe(mock3);
      });

      it("should fail if the file has already been processed", function () {
        mockFile.status = Dropzone.ERROR;
        expect(() => dropzone.enqueueFile(mockFile)).toThrow(
          "This file can't be queued because it has already been processed or was rejected.",
        );
        mockFile.status = Dropzone.COMPLETE;
        expect(() => dropzone.enqueueFile(mockFile)).toThrow(
          "This file can't be queued because it has already been processed or was rejected.",
        );
        mockFile.status = Dropzone.UPLOADING;
        return expect(() => dropzone.enqueueFile(mockFile)).toThrow(
          "This file can't be queued because it has already been processed or was rejected.",
        );
      });

      it("should set the status to QUEUED and call processQueue asynchronously if everything's ok", () =>
        new Promise((done) => {
          mockFile.status = Dropzone.ADDED;
          vi.spyOn(dropzone, "processQueue").mockImplementation(() => {});
          expect(dropzone.processQueue).toHaveBeenCalledTimes(0);
          dropzone.enqueueFile(mockFile);
          expect(mockFile.status).toBe(Dropzone.QUEUED);
          expect(dropzone.processQueue).toHaveBeenCalledTimes(0);
          return setTimeout(function () {
            expect(dropzone.processQueue).toHaveBeenCalledTimes(1);
            return done();
          }, 10);
        }));
    });

    describe("dropping directories", function () {
      // Stand-ins for the FileSystem entries a real drop hands over. Both
      // callbacks fire asynchronously, as the browser's do.
      let fileEntry = (name) => ({
        isFile: true,
        isDirectory: false,
        name,
        file: (onSuccess) =>
          Promise.resolve().then(() => onSuccess(new File(["x"], name, { type: "text/plain" }))),
      });

      let dirEntry = (name, children = []) => ({
        isFile: false,
        isDirectory: true,
        name,
        createReader() {
          let handed = false;
          return {
            // A browser returns a batch, then an empty array to signal the end.
            readEntries(onSuccess) {
              let batch = handed ? [] : children;
              handed = true;
              Promise.resolve().then(() => onSuccess(batch));
            },
          };
        },
      });

      // dataTransfer.files holds one entry per dropped item, folders included,
      // which is exactly why it cannot say what was added.
      let dropOf = (...entries) => ({
        dataTransfer: {
          files: entries.map((e) => new File(["x"], e.name)),
          items: entries.map((e) => ({
            kind: "file",
            webkitGetAsEntry: () => e,
            getAsFile: () => new File(["x"], e.name),
          })),
        },
      });

      beforeEach(function () {
        dropzone.options.autoProcessQueue = false;
      });

      it("should report the files inside a dropped folder, not the folder", () =>
        new Promise((done) => {
          dropzone.on("addedfiles", function (files) {
            expect(files.map((f) => f.name)).toEqual(["a.txt", "b.txt"]);
            done();
          });

          dropzone.drop(dropOf(dirEntry("photos", [fileEntry("a.txt"), fileEntry("b.txt")])));
        }));

      it("should emit addedfiles after each addedfile", () =>
        new Promise((done) => {
          let order = [];
          dropzone.on("addedfile", (file) => order.push(`one:${file.name}`));
          dropzone.on("addedfiles", function () {
            order.push("all");
            expect(order).toEqual(["one:a.txt", "one:b.txt", "all"]);
            done();
          });

          dropzone.drop(dropOf(dirEntry("photos", [fileEntry("a.txt"), fileEntry("b.txt")])));
        }));

      it("should walk nested folders and record the full path", () =>
        new Promise((done) => {
          dropzone.on("addedfiles", function (files) {
            expect(files.map((f) => f.fullPath)).toEqual(["outer/a.txt", "outer/inner/b.txt"]);
            done();
          });

          dropzone.drop(
            dropOf(
              dirEntry("outer", [fileEntry("a.txt"), dirEntry("inner", [fileEntry("b.txt")])]),
            ),
          );
        }));

      it("should still skip hidden files", () =>
        new Promise((done) => {
          dropzone.on("addedfiles", function (files) {
            expect(files.map((f) => f.name)).toEqual(["visible.txt"]);
            done();
          });

          dropzone.drop(
            dropOf(dirEntry("photos", [fileEntry(".hidden"), fileEntry("visible.txt")])),
          );
        }));

      it("should emit emptyfolder for a folder with nothing in it", () =>
        new Promise((done) => {
          dropzone.on("emptyfolder", function (path) {
            expect(path).toBe("nothing-here");
            done();
          });

          dropzone.drop(dropOf(dirEntry("nothing-here", [])));
        }));

      it("should not call a folder empty when it only holds other folders", () =>
        new Promise((done) => {
          let reported = [];
          dropzone.on("emptyfolder", (path) => reported.push(path));
          dropzone.on("addedfiles", function () {
            // Only the leaf is genuinely empty. Counting files alone would
            // have reported "outer" as well.
            expect(reported).toEqual(["outer/inner"]);
            done();
          });

          dropzone.drop(dropOf(dirEntry("outer", [dirEntry("inner", [])])));
        }));
    });

    describe("resizeImage()", function () {
      // Opaque blue across the top-left quarter, transparent everywhere else.
      let transparentPng = () =>
        new Promise((resolve) => {
          let canvas = document.createElement("canvas");
          canvas.width = canvas.height = 20;
          let ctx = canvas.getContext("2d");
          ctx.fillStyle = "#0000ff";
          ctx.fillRect(0, 0, 10, 10);
          canvas.toBlob(
            (blob) => resolve(new File([blob], "transparent.png", { type: "image/png" })),
            "image/png",
          );
        });

      // Decode a blob or data URL and read one pixel back, positioned as a
      // fraction so it does not matter what the resize produced.
      let pixelAt = (source, fx, fy) =>
        new Promise((resolve) => {
          let img = document.createElement("img");
          img.onload = function () {
            let canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            let ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            let x = Math.floor(img.width * fx);
            let y = Math.floor(img.height * fy);
            resolve(Array.from(ctx.getImageData(x, y, 1, 1).data));
          };
          img.src = typeof source === "string" ? source : URL.createObjectURL(source);
        });

      let resize = (file) =>
        new Promise((done) => dropzone.resizeImage(file, 20, 20, "contain", done));

      it("should show the fill through transparent areas when resizing to jpeg", async function () {
        let file = await transparentPng();
        dropzone.options.resizeMimeType = "image/jpeg";
        dropzone.options.resizeTransparencyFill = "#ff0000";

        let [r, g, b] = await pixelAt(await resize(file), 0.75, 0.75);
        expect(r).toBeGreaterThan(200);
        expect(g).toBeLessThan(60);
        expect(b).toBeLessThan(60);
      });

      it("should leave transparency to turn black by default", async function () {
        let file = await transparentPng();
        dropzone.options.resizeMimeType = "image/jpeg";

        // This is the behaviour being fixed, and it stays the default.
        let [r, g, b] = await pixelAt(await resize(file), 0.75, 0.75);
        expect(r).toBeLessThan(60);
        expect(g).toBeLessThan(60);
        expect(b).toBeLessThan(60);
      });

      it("should not paint over the image itself", async function () {
        let file = await transparentPng();
        dropzone.options.resizeMimeType = "image/jpeg";
        dropzone.options.resizeTransparencyFill = "#ff0000";

        // The opaque corner must survive: the fill goes underneath.
        let [r, g, b] = await pixelAt(await resize(file), 0.25, 0.25);
        expect(b).toBeGreaterThan(200);
        expect(r).toBeLessThan(60);
        expect(g).toBeLessThan(60);
      });

      it("should leave preview thumbnails transparent", async function () {
        let file = await transparentPng();
        dropzone.options.resizeTransparencyFill = "#ff0000";

        // Thumbnails are always encoded as PNG, so they keep their alpha and
        // the fill must not reach them.
        let dataUrl = await new Promise((done) =>
          dropzone.createThumbnail(file, 20, 20, "contain", true, (url) => done(url)),
        );

        let alpha = (await pixelAt(dataUrl, 0.75, 0.75))[3];
        expect(alpha).toBe(0);
      });
    });

    describe("uploadFiles()", function () {
      let requests;

      beforeEach(function () {
        requests = [];

        return (xhr.onCreate = (xhr) => requests.push(xhr));
      });

      afterEach(() => xhr.restore());

      // Removed this test because multiple filenames can be transmitted now
      // it "should properly urlencode the filename for the headers"

      it("should be wrapped by uploadFile()", function () {
        vi.spyOn(dropzone, "uploadFiles").mockImplementation(() => {});

        dropzone.uploadFile(mockFile);

        expect(dropzone.uploadFiles).toHaveBeenCalledTimes(1);
        return expect(dropzone.uploadFiles).toHaveBeenCalledWith([mockFile]);
      });

      it("should use url options if strings", () =>
        new Promise((done) => {
          dropzone.addFile(mockFile);

          return setTimeout(function () {
            expect(requests.length).toBe(1);
            expect(requests[0].url).toBe(dropzone.options.url);
            expect(requests[0].method).toBe(dropzone.options.method);
            return done();
          }, 10);
        }));

      it("should call url options if functions", () =>
        new Promise((done) => {
          let method = "PUT";
          let url = "/custom/upload/url";

          dropzone.options.method = vi.fn(() => method);
          dropzone.options.url = vi.fn(() => url);

          dropzone.addFile(mockFile);

          return setTimeout(function () {
            expect(dropzone.options.method).toHaveBeenCalledTimes(1);
            expect(dropzone.options.url).toHaveBeenCalledTimes(1);
            // resolveOption() applies (files, dataBlocks), so assert on the
            // first argument only -- sinon's calledWith was a partial match.
            expect(dropzone.options.method.mock.calls[0][0]).toEqual([mockFile]);
            expect(dropzone.options.url.mock.calls[0][0]).toEqual([mockFile]);
            expect(requests.length).toBe(1);
            expect(requests[0].url).toBe(url);
            expect(requests[0].method).toBe(method);
            return done();
          }, 10);
        }));

      it("should use the timeout option", () =>
        new Promise((done) => {
          dropzone.options.timeout = 10000;
          dropzone.addFile(mockFile);

          return setTimeout(function () {
            expect(requests[0].timeout).toBe(10000);
            return done();
          }, 10);
        }));

      it("should properly handle if timeout is null", () =>
        new Promise((done) => {
          dropzone.options.timeout = null;
          dropzone.addFile(mockFile);

          return setTimeout(function () {
            expect(requests[0].timeout).toBe(0);
            return done();
          }, 10);
        }));

      it("should ignore the onreadystate callback if readyState != 4", () =>
        new Promise((done) => {
          dropzone.addFile(mockFile);
          return setTimeout(function () {
            expect(mockFile.status).toEqual(Dropzone.UPLOADING);

            requests[0].status = 200;
            requests[0].readyState = 3;
            requests[0].responseHeaders = { "content-type": "text/plain" };
            requests[0].onload();

            expect(mockFile.status).toEqual(Dropzone.UPLOADING);

            requests[0].readyState = 4;
            requests[0].onload();

            expect(mockFile.status).toEqual(Dropzone.SUCCESS);
            return done();
          }, 10);
        }));

      it("should emit error and errormultiple when response was not OK", () =>
        new Promise((done) => {
          dropzone.options.uploadMultiple = true;

          let error = false;
          let errormultiple = false;
          let complete = false;
          let completemultiple = false;
          dropzone.on("error", () => (error = true));
          dropzone.on("errormultiple", () => (errormultiple = true));
          dropzone.on("complete", () => (complete = true));
          dropzone.on("completemultiple", () => (completemultiple = true));

          dropzone.addFile(mockFile);

          return setTimeout(function () {
            expect(mockFile.status).toEqual(Dropzone.UPLOADING);

            requests[0].status = 400;
            requests[0].readyState = 4;
            requests[0].responseHeaders = { "content-type": "text/plain" };
            requests[0].onload();

            expect(
              true === error &&
                error === errormultiple &&
                errormultiple === complete &&
                complete === completemultiple,
            ).toBeTruthy();

            return done();
          }, 10);
        }));

      it("should include hidden files in the form and unchecked checkboxes and radiobuttons should be excluded", () =>
        new Promise((done) => {
          let element = Dropzone.createElement(`<form action="/the/url">
  <input type="hidden" name="test" value="hidden" />
  <input type="checkbox" name="unchecked" value="1" />
  <input type="checkbox" name="checked" value="value1" checked="checked" />
  <input type="radio" value="radiovalue1" name="radio1" />
  <input type="radio" value="radiovalue2" name="radio1" checked="checked" />
  <select name="select"><option value="1">1</option><option value="2" selected>2</option></select>
</form>`);
          dropzone = new Dropzone(element, { url: "/the/url" });

          let formData = null;
          dropzone.on("sending", function (file, xhr, tformData) {
            formData = tformData;
            return vi.spyOn(tformData, "append");
          });

          let mock1 = getMockFile();

          dropzone.addFile(mock1);

          return setTimeout(function () {
            expect(formData.append).toHaveBeenCalledTimes(5);

            expect(formData.append.mock.calls[0][0]).toEqual("test");
            expect(formData.append.mock.calls[0][1]).toEqual("hidden");

            expect(formData.append.mock.calls[1][0]).toEqual("checked");
            expect(formData.append.mock.calls[1][1]).toEqual("value1");

            expect(formData.append.mock.calls[2][0]).toEqual("radio1");
            expect(formData.append.mock.calls[2][1]).toEqual("radiovalue2");

            expect(formData.append.mock.calls[3][0]).toEqual("select");
            expect(formData.append.mock.calls[3][1]).toEqual("2");

            expect(formData.append.mock.calls[4][0]).toEqual("file");
            expect(formData.append.mock.calls[4][1]).toBe(mock1);

            // formData.append.args[1][0].should.eql "myName[]"
            return done();
          }, 10);
        }));

      it("should all values of a select that has the multiple attribute", () =>
        new Promise((done) => {
          let element = Dropzone.createElement(`<form action="/the/url">
  <select name="select" multiple>
    <option value="value1">1</option>
    <option value="value2" selected>2</option>
    <option value="value3">3</option>
    <option value="value4" selected>4</option>
  </select>
</form>`);
          dropzone = new Dropzone(element, { url: "/the/url" });

          let formData = null;
          dropzone.on("sending", function (file, xhr, tformData) {
            formData = tformData;
            return vi.spyOn(tformData, "append");
          });

          let mock1 = getMockFile();

          dropzone.addFile(mock1);

          return setTimeout(function () {
            expect(formData.append).toHaveBeenCalledTimes(3);

            expect(formData.append.mock.calls[0][0]).toEqual("select");
            expect(formData.append.mock.calls[0][1]).toEqual("value2");

            expect(formData.append.mock.calls[1][0]).toEqual("select");
            expect(formData.append.mock.calls[1][1]).toEqual("value4");

            expect(formData.append.mock.calls[2][0]).toEqual("file");
            expect(formData.append.mock.calls[2][1]).toBe(mock1);

            // formData.append.args[1][0].should.eql "myName[]"
            return done();
          }, 10);
        }));

      describe("settings()", function () {
        it("should correctly set `withCredentials` on the xhr object", function () {
          dropzone.uploadFile(mockFile);
          expect(requests.length).toEqual(1);
          expect(requests[0].withCredentials).toEqual(false);
          dropzone.options.withCredentials = true;
          dropzone.uploadFile(mockFile);
          expect(requests.length).toEqual(2);
          return expect(requests[1].withCredentials).toEqual(true);
        });

        it("should correctly override headers on the xhr object", function () {
          dropzone.options.headers = { "Foo-Header": "foobar" };
          dropzone.uploadFile(mockFile);
          return expect(requests[0].requestHeaders["Foo-Header"]).toEqual("foobar");
        });

        it("should not set headers on the xhr object that are empty", function () {
          dropzone.options.headers = { "X-Requested-With": null };
          dropzone.uploadFile(mockFile);
          return expect(Object.keys(requests[0].requestHeaders)).not.toContain("X-Requested-With");
        });

        it("should properly use the paramName without [n] as file upload if uploadMultiple is false", () =>
          new Promise((done) => {
            dropzone.options.uploadMultiple = false;
            dropzone.options.paramName = "myName";

            let formData = [];
            let sendingCount = 0;
            dropzone.on("sending", function (files, xhr, tformData) {
              sendingCount++;

              formData.push(tformData);
              return vi.spyOn(tformData, "append");
            });

            let mock1 = getMockFile();
            let mock2 = getMockFile();

            dropzone.addFile(mock1);
            dropzone.addFile(mock2);

            return setTimeout(function () {
              expect(sendingCount).toBe(2);

              expect(formData.length).toBe(2);
              expect(formData[0].append).toHaveBeenCalledTimes(1);
              expect(formData[1].append).toHaveBeenCalledTimes(1);
              expect(formData[0].append.mock.calls[0][0]).toEqual("myName");
              expect(formData[0].append.mock.calls[0][0]).toEqual("myName");

              return done();
            }, 10);
          }));

        it("should properly use the paramName with [n] as file upload if uploadMultiple is true", () =>
          new Promise((done) => {
            dropzone.options.uploadMultiple = true;
            dropzone.options.paramName = "myName";

            let formData = null;
            let sendingMultipleCount = 0;
            let sendingCount = 0;
            dropzone.on("sending", (file, xhr, tformData) => sendingCount++);
            dropzone.on("sendingmultiple", function (files, xhr, tformData) {
              sendingMultipleCount++;
              formData = tformData;
              return vi.spyOn(tformData, "append");
            });

            let mock1 = getMockFile();
            let mock2 = getMockFile();

            dropzone.addFile(mock1);
            dropzone.addFile(mock2);

            return setTimeout(function () {
              expect(sendingCount).toBe(2);
              expect(sendingMultipleCount).toBe(1);
              dropzone.uploadFiles([mock1, mock2]);
              expect(formData.append).toHaveBeenCalledTimes(2);
              expect(formData.append.mock.calls[0][0]).toEqual("myName[0]");
              expect(formData.append.mock.calls[1][0]).toEqual("myName[1]");
              return done();
            }, 10);
          }));

        it("should use resizeImage if dimensions are provided", () =>
          new Promise((done) => {
            vi.spyOn(dropzone, "resizeImage").mockImplementation(() => {});
            vi.spyOn(dropzone, "createThumbnail").mockImplementation(() => {});

            dropzone.options.resizeWidth = 400;

            let mock1 = getMockFile("image/jpeg");

            dropzone.addFile(mock1);

            return setTimeout(function () {
              expect(dropzone.resizeImage.mock.calls.length).toEqual(1);
              return done();
            }, 10);
          }));

        it("should not use resizeImage for SVG if dimensions are provided", () =>
          new Promise((done) => {
            vi.spyOn(dropzone, "uploadFiles").mockImplementation(() => {});

            dropzone.createThumbnail = function (
              file,
              width,
              height,
              resizeMethod,
              fixOrientation,
              callback,
            ) {
              callback(null, null);
            };

            dropzone.options.resizeWidth = 400;

            let mock1 = getMockFile("image/svg+xml");

            dropzone.addFile(mock1);

            setTimeout(function () {
              expect(dropzone.uploadFiles.mock.calls.length).toEqual(1);
              let uploadedFiles = dropzone.uploadFiles.mock.calls[0][0];
              expect(uploadedFiles).toEqual([mock1]);
              done();
            }, 10);
          }));

        it("should not use resizeImage if dimensions are not provided", () =>
          new Promise((done) => {
            vi.spyOn(dropzone, "resizeImage").mockImplementation(() => {});
            vi.spyOn(dropzone, "createThumbnail").mockImplementation(() => {});

            let mock1 = getMockFile("image/jpeg");

            dropzone.addFile(mock1);

            return setTimeout(function () {
              expect(dropzone.resizeImage.mock.calls.length).toEqual(0);
              return done();
            }, 10);
          }));

        it("should not use resizeImage if file is not an image", () =>
          new Promise((done) => {
            vi.spyOn(dropzone, "resizeImage").mockImplementation(() => {});
            vi.spyOn(dropzone, "createThumbnail").mockImplementation(() => {});

            dropzone.options.resizeWidth = 400;

            let mock1 = getMockFile("text/plain");

            dropzone.addFile(mock1);

            return setTimeout(function () {
              expect(dropzone.resizeImage.mock.calls.length).toEqual(0);
              return done();
            }, 10);
          }));
      });

      it("should not change the file name if the options.renameFile is not set", () =>
        new Promise((done) => {
          let mockFilename = "T3sT ;:_-.,!¨@&%&";
          mockFile = getMockFile("text/html", mockFilename);

          let renamedFilename = dropzone._renameFile(mockFile);

          expect(renamedFilename).toBe(mockFilename);
          return done();
        }));

      it("should rename the file name if options.renamedFilename is set", () =>
        new Promise((done) => {
          dropzone.options.renameFile = (file) => file.name.toLowerCase().replace(/[^\w]/gi, "");

          mockFile = getMockFile("text/html", "T3sT ;:_-.,!¨@&%&");

          let renamedFilename = dropzone._renameFile(mockFile);

          expect(renamedFilename).toBe("t3st_");
          return done();
        }));

      describe("chunking", function () {
        // 6 bytes at chunkSize 1 gives 6 chunks; parallelUploads defaults to 2.
        let startChunked = (overrides) => {
          vi.spyOn(dropzone, "_uploadData").mockImplementation(() => {});
          dropzone.options.chunking = true;
          dropzone.options.chunkSize = 1;
          Object.assign(dropzone.options, overrides);

          let file = getMockFile("text/html", "chunked-file", ["abcdef"]);
          dropzone.addFile(file);
          return file;
        };

        let finishChunk = (file, index) => {
          let chunk = file.upload.chunks[index];
          chunk.xhr = { responseText: "ok", getAllResponseHeaders: () => "" };
          file.upload.finishedChunkUpload(chunk, "ok");
        };

        describe("parallelChunkUploads", function () {
          it("should start at most parallelUploads chunks when true", () =>
            new Promise((done) => {
              let file = startChunked({ parallelChunkUploads: true });

              setTimeout(function () {
                expect(file.upload.totalChunkCount).toEqual(6);
                expect(dropzone._uploadData).toHaveBeenCalledTimes(2);
                done();
              }, 10);
            }));

          it("should start the remaining chunks as earlier ones finish", () =>
            new Promise((done) => {
              let file = startChunked({ parallelChunkUploads: true });

              setTimeout(function () {
                expect(dropzone._uploadData).toHaveBeenCalledTimes(2);

                // Each completion should release exactly one more chunk, until
                // there are none left to start.
                finishChunk(file, 0);
                expect(dropzone._uploadData).toHaveBeenCalledTimes(3);
                finishChunk(file, 1);
                expect(dropzone._uploadData).toHaveBeenCalledTimes(4);
                finishChunk(file, 2);
                finishChunk(file, 3);
                expect(dropzone._uploadData).toHaveBeenCalledTimes(6);

                // All six started, so further completions start nothing new.
                finishChunk(file, 4);
                expect(dropzone._uploadData).toHaveBeenCalledTimes(6);
                done();
              }, 10);
            }));

          it("should treat a number as the limit", () =>
            new Promise((done) => {
              let file = startChunked({ parallelChunkUploads: 3 });

              setTimeout(function () {
                expect(file.upload.totalChunkCount).toEqual(6);
                expect(dropzone._uploadData).toHaveBeenCalledTimes(3);
                done();
              }, 10);
            }));

          it("should start every chunk at once when Infinity", () =>
            new Promise((done) => {
              startChunked({ parallelChunkUploads: Infinity });

              setTimeout(function () {
                expect(dropzone._uploadData).toHaveBeenCalledTimes(6);
                done();
              }, 10);
            }));

          it("should start one chunk at a time when false", () =>
            new Promise((done) => {
              startChunked({ parallelChunkUploads: false });

              setTimeout(function () {
                expect(dropzone._uploadData).toHaveBeenCalledTimes(1);
                done();
              }, 10);
            }));

          it("should never start fewer than one chunk", () =>
            new Promise((done) => {
              startChunked({ parallelChunkUploads: 0 });

              setTimeout(function () {
                expect(dropzone._uploadData).toHaveBeenCalledTimes(1);
                done();
              }, 10);
            }));
        });

        it("should slice on numeric boundaries when chunkSize is a string", () =>
          new Promise((done) => {
            vi.spyOn(dropzone, "_uploadData").mockImplementation(() => {});

            dropzone.options.chunking = true;
            // Infinity so all three slices are handed over in one go and can
            // be inspected together; the boundaries are what matter here, not
            // the concurrency.
            dropzone.options.parallelChunkUploads = Infinity;
            // Options read out of markup or JSON arrive as strings.
            dropzone.options.chunkSize = "2";

            let file = getMockFile("text/html", "chunked-file", ["abcdef"]); // 6 bytes

            dropzone.addFile(file);

            setTimeout(async function () {
              expect(file.upload.totalChunkCount).toEqual(3);
              expect(dropzone._uploadData).toHaveBeenCalledTimes(3);

              let texts = await Promise.all(
                dropzone._uploadData.mock.calls.map((call) => call[1][0].data.text()),
              );
              // String concatenation would make the second chunk "cdef".
              expect(texts).toEqual(["ab", "cd", "ef"]);
              done();
            }, 10);
          }));

        it("should send a single chunk for a zero byte file", () =>
          new Promise((done) => {
            vi.spyOn(dropzone, "_uploadData").mockImplementation(() => {});

            dropzone.options.chunking = true;
            dropzone.options.forceChunking = true;

            let emptyFile = getMockFile("text/html", "empty-file", []);
            expect(emptyFile.size).toBe(0);

            dropzone.addFile(emptyFile);

            setTimeout(function () {
              // Without this, `totalChunkCount` would be 0 and nothing would
              // ever be sent.
              expect(emptyFile.upload.totalChunkCount).toEqual(1);
              expect(dropzone._uploadData).toHaveBeenCalledTimes(1);
              done();
            }, 10);
          }));
      });

      describe("should properly set status of file", () =>
        it("should correctly set `withCredentials` on the xhr object", () =>
          new Promise((done) => {
            dropzone.addFile(mockFile);

            setTimeout(function () {
              expect(mockFile.status).toEqual(Dropzone.UPLOADING);

              expect(requests.length).toBe(1);
              requests[0].status = 400;
              requests[0].readyState = 4;
              requests[0].responseHeaders = { "content-type": "text/plain" };

              requests[0].onload();

              expect(mockFile.status).toEqual(Dropzone.ERROR);

              mockFile = getMockFile();
              dropzone.addFile(mockFile);

              setTimeout(function () {
                expect(mockFile.status).toEqual(Dropzone.UPLOADING);

                expect(requests.length).toBe(2);
                requests[1].status = 200;
                requests[1].readyState = 4;
                requests[1].responseHeaders = { "content-type": "text/plain" };

                requests[1].onload();

                expect(mockFile.status).toEqual(Dropzone.SUCCESS);
                return done();
              }, 10);
            }, 10);
          })));
    });

    describe("transformFile()", function () {
      it("should be invoked and the result should be uploaded if configured", () =>
        new Promise((done) => {
          vi.spyOn(dropzone, "_uploadData").mockImplementation(() => {});

          let mock1 = getMockFile("text/html", "original-file");
          let mock2 = getMockFile("text/html", "transformed-file");

          dropzone.options.transformFile = (file, done) => {
            expect(file).toEqual(mock1);
            done(mock2);
          };

          dropzone.addFile(mock1);

          setTimeout(function () {
            expect(dropzone._uploadData).toHaveBeenCalledTimes(1);
            let uploadedFiles = dropzone._uploadData.mock.calls[0][0];
            let uploadedDataBlocks = dropzone._uploadData.mock.calls[0][1];
            expect(uploadedFiles[0]).toBe(mock1);
            expect(uploadedDataBlocks[0].data).toBe(mock2);
            done();
          }, 10);
        }));
      it("should be used as a basis for chunked uploads", () =>
        new Promise((done) => {
          vi.spyOn(dropzone, "_uploadData").mockImplementation(() => {});

          dropzone.options.chunking = true;
          dropzone.options.chunkSize = 1;
          dropzone.options.parallelChunkUploads = true;

          let mock1 = getMockFile("text/html", "original-file", ["Veeeeery long file"]); // 18 bytes
          let mock2 = getMockFile("text/html", "transformed-file", ["2b"]); // only 2 bytes

          dropzone.options.transformFile = (file, done) => {
            expect(file).toEqual(mock1);
            done(mock2);
          };

          dropzone.addFile(mock1);

          setTimeout(async function () {
            expect(dropzone._uploadData).toHaveBeenCalledTimes(2);

            // the same file should be passed on each call.
            expect(dropzone._uploadData.mock.calls[0][0][0]).toEqual(mock1);
            expect(dropzone._uploadData.mock.calls[1][0][0]).toEqual(mock1);

            // Since we only allow chunks of 1 byte, there should be 2 chunks,
            // because the transformed file only has 2 bytes.
            // If this would equal to 18 bytes, then the wrong file would have
            // been chunked.
            expect(mock1.upload.totalChunkCount).toEqual(2);

            let uploadedDataBlocks1 = dropzone._uploadData.mock.calls[0][1][0];
            let uploadedDataBlocks2 = dropzone._uploadData.mock.calls[1][1][0];

            let block1Text = await uploadedDataBlocks1.data.text();
            let block2Text = await uploadedDataBlocks2.data.text();
            expect(block1Text).toBe("2");
            expect(block2Text).toBe("b");
            done();
          }, 10);
        }));
    });

    describe("complete file", () =>
      it("should properly emit the queuecomplete event when the complete queue is finished", () =>
        new Promise((done) => {
          let mock1 = getMockFile("text/html", "mock1");
          let mock2 = getMockFile("text/html", "mock2");
          let mock3 = getMockFile("text/html", "mock3");
          mock1.status = Dropzone.ADDED;
          mock2.status = Dropzone.ADDED;
          mock3.status = Dropzone.ADDED;

          dropzone.uploadFiles = function (files) {
            return setTimeout(() => {
              return this._finished(files, null, null);
            }, 1);
          };

          let completedFiles = 0;
          dropzone.on("complete", (file) => completedFiles++);

          dropzone.on("queuecomplete", function () {
            expect(completedFiles).toBe(3);
            return done();
          });

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);
          return dropzone.addFile(mock3);
        })));
  });
});
