import { vi } from "vitest";
import { Dropzone } from "../../src/dropzone";
import defaultOptions from "../../src/options";

// Documented, publicly reachable behaviour that nothing exercised: the
// fallback form, files added by the server, the removal confirmations, and
// Dropzone.discover.
describe("public API", function () {
  let element = null;
  let dropzone = null;

  let mockFile = (name = "server.png") => ({ name, size: 123 });

  afterEach(function () {
    if (dropzone != null && typeof dropzone.destroy === "function") dropzone.destroy();
    if (element != null) element.remove();
    dropzone = element = null;
  });

  let create = (options = {}, html = '<div class="dropzone"></div>') => {
    element = Dropzone.createElement(html);
    document.body.appendChild(element);
    dropzone = new Dropzone(element, { url: "/upload", autoProcessQueue: false, ...options });
    return dropzone;
  };

  describe("displayExistingFile()", function () {
    it("should emit addedfile and complete", function () {
      create();
      let events = [];
      dropzone.on("addedfile", () => events.push("addedfile"));
      dropzone.on("complete", () => events.push("complete"));

      dropzone.displayExistingFile(mockFile(), "/thumb.png", null, null, false);

      expect(events).toEqual(["addedfile", "complete"]);
    });

    it("should emit the thumbnail url unchanged when not resizing", function () {
      create();
      let thumbnail = null;
      dropzone.on("thumbnail", (file, url) => (thumbnail = url));

      dropzone.displayExistingFile(mockFile(), "/thumb.png", null, null, false);

      expect(thumbnail).toBe("/thumb.png");
    });

    it("should run the callback when not resizing", function () {
      create();
      let callback = vi.fn();

      dropzone.displayExistingFile(mockFile(), "/thumb.png", callback, null, false);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should keep the url on the file when resizing", function () {
      create();
      vi.spyOn(dropzone, "createThumbnailFromUrl").mockImplementation(() => {});
      let file = mockFile();

      dropzone.displayExistingFile(file, "/thumb.png");

      expect(file.dataURL).toBe("/thumb.png");
      expect(dropzone.createThumbnailFromUrl).toHaveBeenCalledTimes(1);
    });

    it("should not emit a thumbnail when the image url fails to load", async function () {
      create();
      let thumbnail = null;
      dropzone.on("thumbnail", (file, url) => (thumbnail = url));

      // A URL that never resolves to an image: the preview would otherwise be
      // handed the error event and set `img.src` to "[object Event]".
      await new Promise((done) =>
        dropzone.displayExistingFile(mockFile(), "/does-not-exist.png", done),
      );

      expect(thumbnail).toBe(null);
    });

    // #2003 and the 7.0 roadmap: files added this way never reach this.files,
    // so maxFiles cannot see them. The documented workaround is to push them
    // by hand, which is why fixing it is a breaking change rather than a
    // patch. This pins the behaviour so the fix is a deliberate act.
    it("should not count towards maxFiles", function () {
      create({ maxFiles: 1 });

      dropzone.displayExistingFile(mockFile(), "/thumb.png", null, null, false);

      expect(dropzone.files).toHaveLength(0);
    });
  });

  describe("fallback()", function () {
    // Worth pinning: fallback() ends with `return this.element.appendChild(...)`,
    // and a constructor returning an object overrides `this`, so this call
    // hands back the fallback input element rather than a Dropzone.
    let fallbackOn = () => {
      element = Dropzone.createElement('<div class="dropzone"></div>');
      document.body.appendChild(element);
      return new Dropzone(element, { url: "/upload", forceFallback: true });
    };

    it("should return the fallback element, not a Dropzone", function () {
      let returned = fallbackOn();

      expect(returned).toBeInstanceOf(HTMLElement);
      expect(returned).not.toBeInstanceOf(Dropzone);
    });

    it("should mark the element as unsupported", function () {
      fallbackOn();

      expect(element.className).toContain("dz-browser-not-supported");
    });

    it("should show the fallback message", function () {
      fallbackOn();

      expect(element.textContent).toContain(defaultOptions.dictFallbackMessage);
    });

    it("should add a file input that posts to the url", function () {
      fallbackOn();

      expect(element.querySelector("input[type=file]")).not.toBe(null);
      expect(element.querySelector("form").getAttribute("action")).toBe("/upload");
    });
  });

  describe("removal confirmation", function () {
    let removeLink = () => element.querySelector("a[data-dz-remove]");

    let addFile = () => {
      let file = new File(["contents"], "file.txt", { type: "text/plain" });
      dropzone.addFile(file);
      return dropzone.files[0];
    };

    it("should ask before removing when dictRemoveFileConfirmation is set", function () {
      create({ addRemoveLinks: true, dictRemoveFileConfirmation: "Really?" });
      let confirm = vi.spyOn(Dropzone, "confirm").mockImplementation(() => {});
      addFile();

      removeLink().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][0]).toBe("Really?");
      confirm.mockRestore();
    });

    it("should remove the file when the confirmation is accepted", function () {
      create({ addRemoveLinks: true, dictRemoveFileConfirmation: "Really?" });
      vi.spyOn(Dropzone, "confirm").mockImplementation((message, accepted) => accepted());
      let file = addFile();

      removeLink().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(dropzone.files).not.toContain(file);
      Dropzone.confirm.mockRestore();
    });

    it("should not ask when there is no confirmation message", function () {
      create({ addRemoveLinks: true });
      let confirm = vi.spyOn(Dropzone, "confirm").mockImplementation(() => {});
      let file = addFile();

      removeLink().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(confirm).not.toHaveBeenCalled();
      expect(dropzone.files).not.toContain(file);
      confirm.mockRestore();
    });

    it("should ask with the cancel message while the file is uploading", function () {
      create({ addRemoveLinks: true });
      let confirm = vi.spyOn(Dropzone, "confirm").mockImplementation(() => {});
      let file = addFile();
      file.status = Dropzone.UPLOADING;

      removeLink().dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

      expect(confirm.mock.calls[0][0]).toBe(dropzone.options.dictCancelUploadConfirmation);
      confirm.mockRestore();
    });
  });

  describe("renameFilename", function () {
    it("should be wrapped into renameFile for backwards compatibility", function () {
      create({ renameFilename: (name) => `prefix-${name}` });

      expect(dropzone.options.renameFile({ name: "photo.png" })).toBe("prefix-photo.png");
    });

    it("should receive the name and the file", function () {
      let seen = null;
      create({
        renameFilename(name, file) {
          seen = { name, file };
          return name;
        },
      });
      let file = { name: "photo.png" };

      dropzone.options.renameFile(file);

      expect(seen.name).toBe("photo.png");
      expect(seen.file).toBe(file);
    });
  });

  describe("handleFiles()", function () {
    it("should add every file it is given", function () {
      create();

      dropzone.handleFiles([
        new File(["a"], "a.txt", { type: "text/plain" }),
        new File(["b"], "b.txt", { type: "text/plain" }),
      ]);

      expect(dropzone.files.map((f) => f.name)).toEqual(["a.txt", "b.txt"]);
    });
  });

  describe("Dropzone.discover()", function () {
    it("should attach to elements carrying the dropzone class", function () {
      element = Dropzone.createElement('<div class="dropzone"></div>');
      element.setAttribute("action", "/upload");
      document.body.appendChild(element);

      Dropzone.discover();

      expect(element.dropzone).toBeInstanceOf(Dropzone);
      dropzone = element.dropzone;
    });

    // Opting out is done by id, not by a class: Dropzone.optionsForElement
    // looks up Dropzone.options[camelizedId], and discover skips the element
    // when that is exactly false.
    it("should skip an element whose options are false", function () {
      element = Dropzone.createElement('<div class="dropzone" id="opted-out"></div>');
      element.setAttribute("action", "/upload");
      document.body.appendChild(element);
      Dropzone.options.optedOut = false;

      try {
        Dropzone.discover();
        expect(element.dropzone).toBeUndefined();
      } finally {
        delete Dropzone.options.optedOut;
      }
    });
  });
});
