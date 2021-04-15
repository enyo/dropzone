import Dropzone from "../src/dropzone.js";

describe("Dropzone", function () {
  let getMockFile = (
    type = "text/html",
    filename = "test file name",
    contents = ["file contents"]
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
  beforeEach(() => (xhr = sinon.useFakeXMLHttpRequest()));

  describe("Emitter", function () {
    let emitter = null;
    beforeEach(() => (emitter = new Dropzone.prototype.Emitter()));

    it(".on() should return the object itself", () =>
      emitter.on("test", function () {}).should.equal(emitter));

    it(".on() should properly register listeners", function () {
      (emitter._callbacks === undefined).should.be.true;
      let callback = function () {};
      let callback2 = function () {};
      emitter.on("test", callback);
      emitter.on("test", callback2);
      emitter.on("test2", callback);
      emitter._callbacks.test.length.should.equal(2);
      emitter._callbacks.test[0].should.equal(callback);
      emitter._callbacks.test[1].should.equal(callback2);
      emitter._callbacks.test2.length.should.equal(1);
      return emitter._callbacks.test2[0].should.equal(callback);
    });

    it(".emit() should return the object itself", () =>
      emitter.emit("test").should.equal(emitter));

    it(".emit() should properly invoke all registered callbacks with arguments", function () {
      let callCount1 = 0;
      let callCount12 = 0;
      let callCount2 = 0;
      let callback1 = function (var1, var2) {
        callCount1++;
        var1.should.equal("callback1 var1");
        return var2.should.equal("callback1 var2");
      };
      let callback12 = function (var1, var2) {
        callCount12++;
        var1.should.equal("callback1 var1");
        return var2.should.equal("callback1 var2");
      };
      let callback2 = function (var1, var2) {
        callCount2++;
        var1.should.equal("callback2 var1");
        return var2.should.equal("callback2 var2");
      };

      emitter.on("test1", callback1);
      emitter.on("test1", callback12);
      emitter.on("test2", callback2);

      callCount1.should.equal(0);
      callCount12.should.equal(0);
      callCount2.should.equal(0);

      emitter.emit("test1", "callback1 var1", "callback1 var2");

      callCount1.should.equal(1);
      callCount12.should.equal(1);
      callCount2.should.equal(0);

      emitter.emit("test2", "callback2 var1", "callback2 var2");

      callCount1.should.equal(1);
      callCount12.should.equal(1);
      callCount2.should.equal(1);

      emitter.emit("test1", "callback1 var1", "callback1 var2");

      callCount1.should.equal(2);
      callCount12.should.equal(2);
      return callCount2.should.equal(1);
    });

    return describe(".off()", function () {
      let callback1 = function () {};
      let callback2 = function () {};
      let callback3 = function () {};
      let callback4 = function () {};

      beforeEach(
        () =>
          (emitter._callbacks = {
            test1: [callback1, callback2],
            test2: [callback3],
            test3: [callback1, callback4],
            test4: [],
          })
      );

      it("should work without any listeners", function () {
        emitter._callbacks = undefined;
        let emt = emitter.off();
        emitter._callbacks.should.eql({});
        return emt.should.equal(emitter);
      });

      it("should properly remove all event listeners", function () {
        let emt = emitter.off();
        emitter._callbacks.should.eql({});
        return emt.should.equal(emitter);
      });

      it("should properly remove all event listeners for specific event", function () {
        emitter.off("test1");
        (emitter._callbacks["test1"] === undefined).should.be.true;
        emitter._callbacks["test2"].length.should.equal(1);
        emitter._callbacks["test3"].length.should.equal(2);
        let emt = emitter.off("test2");
        (emitter._callbacks["test2"] === undefined).should.be.true;
        return emt.should.equal(emitter);
      });

      it("should properly remove specific event listener", function () {
        emitter.off("test1", callback1);
        emitter._callbacks["test1"].length.should.equal(1);
        emitter._callbacks["test1"][0].should.equal(callback2);
        emitter._callbacks["test3"].length.should.equal(2);
        let emt = emitter.off("test3", callback4);
        emitter._callbacks["test3"].length.should.equal(1);
        emitter._callbacks["test3"][0].should.equal(callback1);
        return emt.should.equal(emitter);
      });
    });
  });

  describe("static functions", function () {
    describe("Dropzone.isBrowserSupported()", function () {
      let initialValue;
      beforeEach(() => {
        initialValue = Dropzone.blockedBrowsers;
      });
      afterEach(() => {
        Dropzone.blockedBrowsers = initialValue;
        Dropzone.blacklistedBrowsers = undefined;
      });
      it("should use blockedBrowsers usually", () => {
        let initialValue = Dropzone.blockedBrowsers;
        Dropzone.isBrowserSupported().should.be.true;
        initialValue.should.equal(Dropzone.blockedBrowsers);

        Dropzone.blockedBrowsers = [/HeadlessChrome/];
        Dropzone.isBrowserSupported().should.be.false;
      });
      it("should user blacklistedBrowsers if its set", () => {
        let initialValue = Dropzone.blockedBrowsers;

        Dropzone.isBrowserSupported().should.be.true;

        Dropzone.blacklistedBrowsers = [/HeadlessChrome/];
        Dropzone.isBrowserSupported().should.be.false;
        initialValue.should.not.equal(Dropzone.blockedBrowsers);
        Dropzone.blockedBrowsers.should.equal(Dropzone.blacklistedBrowsers);
      });
    });

    describe("Dropzone.createElement()", function () {
      let element = Dropzone.createElement(
        '<div class="test"><span>Hallo</span></div>'
      );

      it("should properly create an element from a string", () =>
        element.tagName.should.equal("DIV"));
      it("should properly add the correct class", () =>
        element.classList.contains("test").should.be.ok);
      it("should properly create child elements", () =>
        element.querySelector("span").tagName.should.equal("SPAN"));
      it("should always return only one element", function () {
        element = Dropzone.createElement("<div></div><span></span>");
        return element.tagName.should.equal("DIV");
      });
    });

    describe("Dropzone.elementInside()", function () {
      let element = Dropzone.createElement(
        '<div id="test"><div class="child1"><div class="child2"></div></div></div>'
      );
      document.body.appendChild(element);

      let child1 = element.querySelector(".child1");
      let child2 = element.querySelector(".child2");

      after(() => document.body.removeChild(element));

      it("should return yes if elements are the same", () =>
        Dropzone.elementInside(element, element).should.be.ok);
      it("should return yes if element is direct child", () =>
        Dropzone.elementInside(child1, element).should.be.ok);
      it("should return yes if element is some child", function () {
        Dropzone.elementInside(child2, element).should.be.ok;
        return Dropzone.elementInside(child2, document.body).should.be.ok;
      });
      it("should return no unless element is some child", function () {
        Dropzone.elementInside(element, child1).should.not.be.ok;
        return Dropzone.elementInside(document.body, child1).should.not.be.ok;
      });
    });

    describe("Dropzone.optionsForElement()", function () {
      let testOptions = {
        url: "/some/url",
        method: "put",
      };

      before(() => (Dropzone.options.testElement = testOptions));
      after(() => delete Dropzone.options.testElement);

      let element = document.createElement("div");

      it("should take options set in Dropzone.options from camelized id", function () {
        element.id = "test-element";
        return Dropzone.optionsForElement(element).should.equal(testOptions);
      });

      it("should return undefined if no options set", function () {
        element.id = "test-element2";
        return expect(Dropzone.optionsForElement(element)).to.equal(undefined);
      });

      it("should return undefined and not throw if it's a form with an input element of the name 'id'", function () {
        element = Dropzone.createElement('<form><input name="id" /</form>');
        return expect(Dropzone.optionsForElement(element)).to.equal(undefined);
      });

      it("should ignore input fields with the name='id'", function () {
        element = Dropzone.createElement(
          '<form id="test-element"><input type="hidden" name="id" value="fooo" /></form>'
        );
        return Dropzone.optionsForElement(element).should.equal(testOptions);
      });
    });

    describe("Dropzone.forElement()", function () {
      let element = document.createElement("div");
      element.id = "some-test-element";
      let dropzone = null;
      before(function () {
        document.body.appendChild(element);
        return (dropzone = new Dropzone(element, { url: "/test" }));
      });
      after(function () {
        dropzone.disable();
        return document.body.removeChild(element);
      });

      it("should throw an exception if no dropzone attached", () =>
        expect(() =>
          Dropzone.forElement(document.createElement("div"))
        ).to.throw(
          "No Dropzone found for given element. This is probably because you're trying to access it before Dropzone had the time to initialize. Use the `init` option to setup any additional observers on your Dropzone."
        ));

      it("should accept css selectors", () =>
        expect(Dropzone.forElement("#some-test-element")).to.equal(dropzone));

      it("should accept native elements", () =>
        expect(Dropzone.forElement(element)).to.equal(dropzone));
    });

    describe("Dropzone.discover()", function () {
      let element1 = document.createElement("div");
      element1.className = "dropzone";
      let element2 = element1.cloneNode();
      let element3 = element1.cloneNode();

      element1.id = "test-element-1";
      element2.id = "test-element-2";
      element3.id = "test-element-3";

      describe("specific options", function () {
        before(function () {
          Dropzone.options.testElement1 = { url: "test-url" };
          Dropzone.options.testElement2 = false; // Disabled
          document.body.appendChild(element1);
          document.body.appendChild(element2);
          return Dropzone.discover();
        });
        after(function () {
          document.body.removeChild(element1);
          return document.body.removeChild(element2);
        });

        it("should find elements with a .dropzone class", () =>
          element1.dropzone.should.be.ok);

        it("should not create dropzones with disabled options", () =>
          expect(element2.dropzone).to.not.be.ok);
      });

      return describe("Dropzone.autoDiscover", function () {
        before(function () {
          Dropzone.options.testElement3 = { url: "test-url" };
          return document.body.appendChild(element3);
        });
        after(() => document.body.removeChild(element3));

        it("should create dropzones even if Dropzone.autoDiscover == false", function () {
          // Because the check is in the actual contentLoaded function.
          Dropzone.autoDiscover = false;
          Dropzone.discover();
          return expect(element3.dropzone).to.be.ok;
        });

        it("should not automatically be called if Dropzone.autoDiscover == false", function () {
          Dropzone.autoDiscover = false;
          Dropzone.discover = () => expect(false).to.be.ok;
          return Dropzone._autoDiscoverFunction();
        });
      });
    });

    describe("Dropzone.isValidFile()", function () {
      it("should return true if called without acceptedFiles", () =>
        Dropzone.isValidFile({ type: "some/type" }, null).should.be.ok);

      it("should properly validate if called with concrete mime types", function () {
        let acceptedMimeTypes = "text/html,image/jpeg,application/json";

        Dropzone.isValidFile({ type: "text/html" }, acceptedMimeTypes).should.be
          .ok;
        Dropzone.isValidFile({ type: "image/jpeg" }, acceptedMimeTypes).should
          .be.ok;
        Dropzone.isValidFile({ type: "application/json" }, acceptedMimeTypes)
          .should.be.ok;
        return Dropzone.isValidFile({ type: "image/bmp" }, acceptedMimeTypes)
          .should.not.be.ok;
      });

      it("should properly validate if called with base mime types", function () {
        let acceptedMimeTypes = "text/*,image/*,application/*";

        Dropzone.isValidFile({ type: "text/html" }, acceptedMimeTypes).should.be
          .ok;
        Dropzone.isValidFile({ type: "image/jpeg" }, acceptedMimeTypes).should
          .be.ok;
        Dropzone.isValidFile({ type: "application/json" }, acceptedMimeTypes)
          .should.be.ok;
        Dropzone.isValidFile({ type: "image/bmp" }, acceptedMimeTypes).should.be
          .ok;
        return Dropzone.isValidFile({ type: "some/type" }, acceptedMimeTypes)
          .should.not.be.ok;
      });

      it("should properly validate if called with mixed mime types", function () {
        let acceptedMimeTypes = "text/*,image/jpeg,application/*";

        Dropzone.isValidFile({ type: "text/html" }, acceptedMimeTypes).should.be
          .ok;
        Dropzone.isValidFile({ type: "image/jpeg" }, acceptedMimeTypes).should
          .be.ok;
        Dropzone.isValidFile({ type: "image/bmp" }, acceptedMimeTypes).should
          .not.be.ok;
        Dropzone.isValidFile({ type: "application/json" }, acceptedMimeTypes)
          .should.be.ok;
        return Dropzone.isValidFile({ type: "some/type" }, acceptedMimeTypes)
          .should.not.be.ok;
      });

      it("should properly validate even with spaces in between", function () {
        let acceptedMimeTypes = "text/html ,   image/jpeg, application/json";

        Dropzone.isValidFile({ type: "text/html" }, acceptedMimeTypes).should.be
          .ok;
        return Dropzone.isValidFile({ type: "image/jpeg" }, acceptedMimeTypes)
          .should.be.ok;
      });

      it("should properly validate extensions", function () {
        let acceptedMimeTypes = "text/html ,    image/jpeg, .pdf  ,.png";

        Dropzone.isValidFile(
          { name: "somxsfsd", type: "text/html" },
          acceptedMimeTypes
        ).should.be.ok;
        Dropzone.isValidFile(
          { name: "somesdfsdf", type: "image/jpeg" },
          acceptedMimeTypes
        ).should.be.ok;
        Dropzone.isValidFile(
          { name: "somesdfadfadf", type: "application/json" },
          acceptedMimeTypes
        ).should.not.be.ok;
        Dropzone.isValidFile(
          { name: "some-file file.pdf", type: "random/type" },
          acceptedMimeTypes
        ).should.be.ok;
        // .pdf has to be in the end
        Dropzone.isValidFile(
          { name: "some-file.pdf file.gif", type: "random/type" },
          acceptedMimeTypes
        ).should.not.be.ok;
        return Dropzone.isValidFile(
          { name: "some-file file.png", type: "random/type" },
          acceptedMimeTypes
        ).should.be.ok;
      });
    });

    return describe("Dropzone.confirm", function () {
      beforeEach(() => sinon.stub(window, "confirm"));
      afterEach(() => window.confirm.restore());
      it("should forward to window.confirm and call the callbacks accordingly", function () {
        let rejected;
        let accepted = (rejected = false);
        window.confirm.returns(true);
        Dropzone.confirm(
          "test question",
          () => (accepted = true),
          () => (rejected = true)
        );
        window.confirm.args[0][0].should.equal("test question");
        accepted.should.equal(true);
        rejected.should.equal(false);

        accepted = rejected = false;
        window.confirm.returns(false);
        Dropzone.confirm(
          "test question 2",
          () => (accepted = true),
          () => (rejected = true)
        );
        window.confirm.args[1][0].should.equal("test question 2");
        accepted.should.equal(false);
        return rejected.should.equal(true);
      });

      it("should not error if rejected is not provided", function () {
        let rejected;
        let accepted = (rejected = false);
        window.confirm.returns(false);
        Dropzone.confirm("test question", () => (accepted = true));
        window.confirm.args[0][0].should.equal("test question");
        // Nothing should have changed since there is no rejected function.
        accepted.should.equal(false);
        return rejected.should.equal(false);
      });
    });
  });

  describe("Dropzone.getElement() / getElements()", function () {
    let tmpElements = [];

    beforeEach(function () {
      tmpElements = [];
      tmpElements.push(Dropzone.createElement('<div class="tmptest"></div>'));
      tmpElements.push(
        Dropzone.createElement('<div id="tmptest1" class="random"></div>')
      );
      tmpElements.push(
        Dropzone.createElement('<div class="random div"></div>')
      );
      return tmpElements.forEach((el) => document.body.appendChild(el));
    });

    afterEach(() => tmpElements.forEach((el) => document.body.removeChild(el)));

    describe(".getElement()", function () {
      it("should accept a string", function () {
        let el = Dropzone.getElement(".tmptest");
        el.should.equal(tmpElements[0]);
        el = Dropzone.getElement("#tmptest1");
        return el.should.equal(tmpElements[1]);
      });
      it("should accept a node", function () {
        let el = Dropzone.getElement(tmpElements[2]);
        return el.should.equal(tmpElements[2]);
      });
      it("should fail if invalid selector", function () {
        let errorMessage =
          "Invalid `clickable` option provided. Please provide a CSS selector or a plain HTML element.";
        expect(() => Dropzone.getElement("lblasdlfsfl", "clickable")).to.throw(
          errorMessage
        );
        expect(() =>
          Dropzone.getElement({ lblasdlfsfl: "lblasdlfsfl" }, "clickable")
        ).to.throw(errorMessage);
        return expect(() =>
          Dropzone.getElement(["lblasdlfsfl"], "clickable")
        ).to.throw(errorMessage);
      });
    });

    return describe(".getElements()", function () {
      it("should accept a list of strings", function () {
        let els = Dropzone.getElements([".tmptest", "#tmptest1"]);
        return els.should.eql([tmpElements[0], tmpElements[1]]);
      });
      it("should accept a list of nodes", function () {
        let els = Dropzone.getElements([tmpElements[0], tmpElements[2]]);
        return els.should.eql([tmpElements[0], tmpElements[2]]);
      });
      it("should accept a mixed list", function () {
        let els = Dropzone.getElements(["#tmptest1", tmpElements[2]]);
        return els.should.eql([tmpElements[1], tmpElements[2]]);
      });
      it("should accept a string selector", function () {
        let els = Dropzone.getElements(".random");
        return els.should.eql([tmpElements[1], tmpElements[2]]);
      });
      it("should accept a single node", function () {
        let els = Dropzone.getElements(tmpElements[1]);
        return els.should.eql([tmpElements[1]]);
      });
      it("should fail if invalid selector", function () {
        let errorMessage =
          "Invalid `clickable` option provided. Please provide a CSS selector, a plain HTML element or a list of those.";
        expect(() => Dropzone.getElements("lblasdlfsfl", "clickable")).to.throw(
          errorMessage
        );
        return expect(() =>
          Dropzone.getElements(["lblasdlfsfl"], "clickable")
        ).to.throw(errorMessage);
      });
    });
  });

  describe("constructor()", function () {
    let dropzone = null;

    afterEach(function () {
      if (dropzone != null) {
        return dropzone.destroy();
      }
    });

    it("should throw an exception if the element is invalid", () =>
      expect(() => (dropzone = new Dropzone("#invalid-element"))).to.throw(
        "Invalid dropzone element."
      ));

    it("should throw an exception if assigned twice to the same element", function () {
      let element = document.createElement("div");
      dropzone = new Dropzone(element, { url: "url" });
      return expect(() => new Dropzone(element, { url: "url" })).to.throw(
        "Dropzone already attached."
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
          }))
      ).to.throw(
        "You can't provide both 'acceptedFiles' and 'acceptedMimeTypes'. 'acceptedMimeTypes' is deprecated."
      );
    });

    it("should set itself as element.dropzone", function () {
      let element = document.createElement("div");
      dropzone = new Dropzone(element, { url: "url" });
      return element.dropzone.should.equal(dropzone);
    });

    it("should add itself to Dropzone.instances", function () {
      let element = document.createElement("div");
      dropzone = new Dropzone(element, { url: "url" });
      return Dropzone.instances[Dropzone.instances.length - 1].should.equal(
        dropzone
      );
    });

    it("should use the action attribute not the element with the name action", function () {
      let element = Dropzone.createElement(
        '<form action="real-action"><input type="hidden" name="action" value="wrong-action" /></form>'
      );
      dropzone = new Dropzone(element);
      return dropzone.options.url.should.equal("real-action");
    });

    return describe("options", function () {
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
        dropzone.options.url.should.equal("/some/url");
        return dropzone.options.parallelUploads.should.equal(10);
      });

      it("should prefer passed options over Dropzone.options", function () {
        dropzone = new Dropzone(element, { url: "/some/other/url" });
        return dropzone.options.url.should.equal("/some/other/url");
      });

      it("should take the default options if nothing set in Dropzone.options", function () {
        dropzone = new Dropzone(element2, { url: "/some/url" });
        return dropzone.options.parallelUploads.should.equal(2);
      });

      it("should call the fallback function if forceFallback == true", (done) =>
        (dropzone = new Dropzone(element, {
          url: "/some/other/url",
          forceFallback: true,
          fallback() {
            return done();
          },
        })));

      it("should set acceptedFiles if deprecated acceptedMimetypes option has been passed", function () {
        dropzone = new Dropzone(element, {
          url: "/some/other/url",
          acceptedMimeTypes: "my/type",
        });
        return dropzone.options.acceptedFiles.should.equal("my/type");
      });

      return describe("options.clickable", function () {
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
          return dropzone.clickableElements.should.eql([dropzone.element]);
        });
        it("should lookup the element if clickable is a CSS selector", function () {
          dropzone = new Dropzone(element, { clickable: ".some-clickable" });
          return dropzone.clickableElements.should.eql([clickableElement]);
        });
        it("should simply use the provided element", function () {
          dropzone = new Dropzone(element, { clickable: clickableElement });
          return dropzone.clickableElements.should.eql([clickableElement]);
        });
        it("should accept multiple clickable elements", function () {
          dropzone = new Dropzone(element, {
            clickable: [document.body, ".some-clickable"],
          });
          return dropzone.clickableElements.should.eql([
            document.body,
            clickableElement,
          ]);
        });
        it("should throw an exception if the element is invalid", () =>
          expect(
            () =>
              (dropzone = new Dropzone(element, {
                clickable: ".some-invalid-clickable",
              }))
          ).to.throw(
            "Invalid `clickable` option provided. Please provide a CSS selector, a plain HTML element or a list of those."
          ));
      });
    });
  });

  describe("init()", function () {
    describe("clickable", function () {
      let dropzones = {
        "using acceptedFiles": new Dropzone(
          Dropzone.createElement('<form action="/"></form>'),
          { clickable: true, acceptedFiles: "audio/*,video/*" }
        ),
        "using acceptedMimeTypes": new Dropzone(
          Dropzone.createElement('<form action="/"></form>'),
          { clickable: true, acceptedMimeTypes: "audio/*,video/*" }
        ),
      };

      it("should not add an accept attribute if no acceptParameter", function () {
        let dropzone = new Dropzone(
          Dropzone.createElement('<form action="/"></form>'),
          { clickable: true, acceptParameter: null, acceptedMimeTypes: null }
        );
        return dropzone.hiddenFileInput.hasAttribute("accept").should.be.false;
      });

      return (() => {
        let result = [];
        for (let name in dropzones) {
          var dropzone = dropzones[name];
          result.push(
            describe(name, () =>
              (function (dropzone) {
                it("should create a hidden file input if clickable", function () {
                  dropzone.hiddenFileInput.should.be.ok;
                  dropzone.hiddenFileInput.tagName.should.equal("INPUT");
                });

                it("should have a tabindex of -1", function () {
                  dropzone.hiddenFileInput.tabIndex.should.equal(-1);
                });

                it("should use the acceptParameter", () =>
                  dropzone.hiddenFileInput
                    .getAttribute("accept")
                    .should.equal("audio/*,video/*"));

                it("should create a new input element when something is selected to reset the input field", () =>
                  (() => {
                    let result1 = [];
                    for (let i = 0; i <= 3; i++) {
                      let { hiddenFileInput } = dropzone;
                      let event = document.createEvent("HTMLEvents");
                      event.initEvent("change", true, true);
                      hiddenFileInput.dispatchEvent(event);
                      dropzone.hiddenFileInput.should.not.equal(
                        hiddenFileInput
                      );
                      result1.push(
                        Dropzone.elementInside(hiddenFileInput, document).should
                          .not.be.ok
                      );
                    }
                    return result1;
                  })());
              })(dropzone)
            )
          );
        }
        return result;
      })();
    });

    it("should create a .dz-message element", function () {
      let element = Dropzone.createElement(
        '<form class="dropzone" action="/"></form>'
      );
      let dropzone = new Dropzone(element, {
        clickable: true,
        acceptParameter: null,
        acceptedMimeTypes: null,
      });
      return element.querySelector(".dz-message").should.be.instanceof(Element);
    });

    it("should not create a .dz-message element if there already is one", function () {
      let element = Dropzone.createElement(
        '<form class="dropzone" action="/"></form>'
      );
      let msg = Dropzone.createElement('<div class="dz-message">TEST</div>');
      element.appendChild(msg);

      let dropzone = new Dropzone(element, {
        clickable: true,
        acceptParameter: null,
        acceptedMimeTypes: null,
      });
      element.querySelector(".dz-message").should.equal(msg);

      return element.querySelectorAll(".dz-message").length.should.equal(1);
    });
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

    return describe("file specific", function () {
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
          file.previewElement.should.be.instanceof(Element);

          file.previewElement
            .querySelector("[data-dz-name]")
            .innerHTML.should.eql("test name");
          return file.previewElement
            .querySelector("[data-dz-size]")
            .innerHTML.should.eql("<strong>2.1</strong> MB");
        }));

      describe(".error()", function () {
        it("should properly insert the error", function () {
          dropzone.options.error.call(dropzone, file, "test message");

          return file.previewElement
            .querySelector("[data-dz-errormessage]")
            .innerHTML.should.eql("test message");
        });

        it("should properly insert the error when provided with an object containing the error", function () {
          dropzone.options.error.call(dropzone, file, {
            error: "test message",
          });

          return file.previewElement
            .querySelector("[data-dz-errormessage]")
            .innerHTML.should.eql("test message");
        });
      });

      describe(".thumbnail()", () =>
        it("should properly insert the error", function () {
          let transparentGif =
            "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
          dropzone.options.thumbnail.call(dropzone, file, transparentGif);
          let thumbnail = file.previewElement.querySelector(
            "[data-dz-thumbnail]"
          );
          thumbnail.src.should.eql(transparentGif);
          return thumbnail.alt.should.eql("test name");
        }));

      describe(".uploadprogress()", () =>
        it("should properly set the width", function () {
          dropzone.options.uploadprogress.call(dropzone, file, 0);
          file.previewElement
            .querySelector("[data-dz-uploadprogress]")
            .style.width.should.eql("0%");
          dropzone.options.uploadprogress.call(dropzone, file, 80);
          file.previewElement
            .querySelector("[data-dz-uploadprogress]")
            .style.width.should.eql("80%");
          dropzone.options.uploadprogress.call(dropzone, file, 90);
          file.previewElement
            .querySelector("[data-dz-uploadprogress]")
            .style.width.should.eql("90%");
          dropzone.options.uploadprogress.call(dropzone, file, 100);
          return file.previewElement
            .querySelector("[data-dz-uploadprogress]")
            .style.width.should.eql("100%");
        }));

      return describe(".resize()", function () {
        describe("with default thumbnail settings", function () {
          it("should properly return target dimensions for 'contain'", function () {
            let info = dropzone.options.resize.call(
              dropzone,
              file,
              120,
              120,
              "crop"
            );
            info.trgWidth.should.eql(120);
            info.trgHeight.should.eql(100);
            info = dropzone.options.resize.call(
              dropzone,
              file,
              100,
              100,
              "crop"
            );
            info.trgWidth.should.eql(100);
            return info.trgHeight.should.eql(100);
          });

          it("should properly return target dimensions for 'contain'", function () {
            let info = dropzone.options.resize.call(
              dropzone,
              file,
              120,
              120,
              "contain"
            );
            info.trgWidth.should.eql(120);
            info.trgHeight.should.eql(60);
            info = dropzone.options.resize.call(
              dropzone,
              file,
              100,
              100,
              "contain"
            );
            info.trgWidth.should.eql(100);
            return info.trgHeight.should.eql(50);
          });
        });

        return describe("with null thumbnail settings", function () {
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
                  "crop"
                );

                if (i === 0) {
                  info.trgWidth.should.eql(200);
                  info.trgHeight.should.eql(100);
                }

                if (i === 1) {
                  info.trgWidth.should.eql(160);
                  info.trgHeight.should.eql(80);
                }

                if (i === 2) {
                  info.trgWidth.should.eql(150);
                  result.push(info.trgHeight.should.eql(75));
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
                  "contain"
                );

                if (i === 0) {
                  info.trgWidth.should.eql(160);
                  info.trgHeight.should.eql(80);
                }

                if (i === 1) {
                  info.trgWidth.should.eql(150);
                  result.push(info.trgHeight.should.eql(75));
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
        dropzone.accept(
          { size: 2 * 1024 * 1024, type: "audio/mp3" },
          (err) => expect(err).to.be.undefined
        ));

      it("shouldn't pass if the filesize is too big", () =>
        dropzone.accept({ size: 10 * 1024 * 1024, type: "audio/mp3" }, (err) =>
          err.should.eql("File is too big (10MiB). Max filesize: 4MiB.")
        ));

      it("should properly accept files which mime types are listed in acceptedFiles", function () {
        dropzone.accept(
          { type: "audio/mp3" },
          (err) => expect(err).to.be.undefined
        );
        dropzone.accept(
          { type: "image/png" },
          (err) => expect(err).to.be.undefined
        );
        return dropzone.accept(
          { type: "audio/wav" },
          (err) => expect(err).to.be.undefined
        );
      });

      it("should properly reject files when the mime type isn't listed in acceptedFiles", () =>
        dropzone.accept({ type: "image/jpeg" }, (err) =>
          err.should.eql("You can't upload files of this type.")
        ));

      it("should fail if maxFiles has been exceeded and call the event maxfilesexceeded", function () {
        sinon.stub(dropzone, "getAcceptedFiles");
        let file = { type: "audio/mp3" };

        dropzone.getAcceptedFiles.returns({ length: 99 });

        dropzone.options.dictMaxFilesExceeded =
          "You can only upload {{maxFiles}} files.";

        let called = false;
        dropzone.on("maxfilesexceeded", function (lfile) {
          lfile.should.equal(file);
          return (called = true);
        });

        dropzone.accept(file, (err) => expect(err).to.be.undefined);
        called.should.not.be.ok;

        dropzone.getAcceptedFiles.returns({ length: 100 });
        dropzone.accept(file, (err) =>
          expect(err).to.equal("You can only upload 100 files.")
        );
        called.should.be.ok;

        return dropzone.getAcceptedFiles.restore();
      });

      it("should properly handle if maxFiles is 0", function () {
        let file = { type: "audio/mp3" };

        dropzone.options.maxFiles = 0;

        let called = false;
        dropzone.on("maxfilesexceeded", function (lfile) {
          lfile.should.equal(file);
          return (called = true);
        });

        dropzone.accept(file, (err) =>
          expect(err).to.equal("You can not upload any more files.")
        );
        return called.should.be.ok;
      });
    });

    describe(".removeFile()", () =>
      it("should abort uploading if file is currently being uploaded", function (done) {
        let mockFile = getMockFile();
        dropzone.uploadFile = function (file) {};
        dropzone.accept = (file, done) => done();

        sinon.stub(dropzone, "cancelUpload");

        dropzone.addFile(mockFile);
        return setTimeout(function () {
          mockFile.status.should.equal(Dropzone.UPLOADING);
          dropzone.getUploadingFiles()[0].should.equal(mockFile);

          dropzone.cancelUpload.callCount.should.equal(0);
          dropzone.removeFile(mockFile);
          dropzone.cancelUpload.callCount.should.equal(1);
          return done();
        }, 10);
      }));

    describe(".cancelUpload()", function () {
      it("should properly cancel upload if file currently uploading", function (done) {
        let mockFile = getMockFile();

        dropzone.accept = (file, done) => done();

        dropzone.addFile(mockFile);

        return setTimeout(function () {
          mockFile.status.should.equal(Dropzone.UPLOADING);
          dropzone.getUploadingFiles()[0].should.equal(mockFile);
          dropzone.cancelUpload(mockFile);
          mockFile.status.should.equal(Dropzone.CANCELED);
          dropzone.getUploadingFiles().length.should.equal(0);
          dropzone.getQueuedFiles().length.should.equal(0);
          return done();
        }, 10);
      });

      it("should properly cancel the upload if file is not yet uploading", function () {
        let mockFile = getMockFile();

        dropzone.accept = (file, done) => done();

        // Making sure the file stays in the queue.
        dropzone.options.parallelUploads = 0;

        dropzone.addFile(mockFile);
        mockFile.status.should.equal(Dropzone.QUEUED);
        dropzone.getQueuedFiles()[0].should.equal(mockFile);

        dropzone.cancelUpload(mockFile);
        mockFile.status.should.equal(Dropzone.CANCELED);
        dropzone.getQueuedFiles().length.should.equal(0);
        return dropzone.getUploadingFiles().length.should.equal(0);
      });

      it("should call processQueue()", function (done) {
        let mockFile = getMockFile();

        dropzone.accept = (file, done) => done();

        // Making sure the file stays in the queue.
        dropzone.options.parallelUploads = 0;

        sinon.spy(dropzone, "processQueue");

        dropzone.addFile(mockFile);
        return setTimeout(function () {
          dropzone.processQueue.callCount.should.equal(1);

          dropzone.cancelUpload(mockFile);

          dropzone.processQueue.callCount.should.equal(2);
          return done();
        }, 10);
      });

      it("should properly cancel all files with the same XHR if uploadMultiple is true", function (done) {
        let mock1 = getMockFile();
        let mock2 = getMockFile();
        let mock3 = getMockFile();

        dropzone.accept = (file, done) => done();

        // Making sure the file stays in the queue.
        dropzone.options.uploadMultiple = true;
        dropzone.options.parallelUploads = 3;

        sinon.spy(dropzone, "processFiles");

        dropzone.addFile(mock1);
        dropzone.addFile(mock2);
        dropzone.addFile(mock3);

        return setTimeout(function () {
          dropzone.processFiles.callCount.should.equal(1);

          sinon.spy(mock1.xhr, "abort");

          dropzone.cancelUpload(mock1);

          expect(mock1.xhr === mock2.xhr && mock2.xhr === mock3.xhr).to.be.ok;

          mock1.status.should.equal(Dropzone.CANCELED);
          mock2.status.should.equal(Dropzone.CANCELED);
          mock3.status.should.equal(Dropzone.CANCELED);

          // The XHR should only be aborted once!
          mock1.xhr.abort.callCount.should.equal(1);

          return done();
        }, 10);
      });
    });

    describe(".disable()", () =>
      it("should properly cancel all pending uploads", function (done) {
        dropzone.accept = (file, done) => done();

        dropzone.options.parallelUploads = 1;

        dropzone.addFile(getMockFile());
        dropzone.addFile(getMockFile());

        return setTimeout(function () {
          dropzone.getUploadingFiles().length.should.equal(1);
          dropzone.getQueuedFiles().length.should.equal(1);
          dropzone.files.length.should.equal(2);

          sinon.spy(requests[0], "abort");

          requests[0].abort.callCount.should.equal(0);

          dropzone.disable();

          requests[0].abort.callCount.should.equal(1);

          dropzone.getUploadingFiles().length.should.equal(0);
          dropzone.getQueuedFiles().length.should.equal(0);
          dropzone.files.length.should.equal(2);

          dropzone.files[0].status.should.equal(Dropzone.CANCELED);
          dropzone.files[1].status.should.equal(Dropzone.CANCELED);
          return done();
        }, 10);
      }));

    describe(".destroy()", function () {
      it("should properly cancel all pending uploads and remove all file references", function (done) {
        dropzone.accept = (file, done) => done();

        dropzone.options.parallelUploads = 1;

        dropzone.addFile(getMockFile());
        dropzone.addFile(getMockFile());

        return setTimeout(function () {
          dropzone.getUploadingFiles().length.should.equal(1);
          dropzone.getQueuedFiles().length.should.equal(1);
          dropzone.files.length.should.equal(2);

          sinon.spy(dropzone, "disable");

          dropzone.destroy();

          dropzone.disable.callCount.should.equal(1);
          element.should.not.have.property("dropzone");
          return done();
        }, 10);
      });

      it("should be able to create instance of dropzone on the same element after destroy", function () {
        dropzone.destroy();
        return (() =>
          new Dropzone(element, {
            maxFilesize: 4,
            url: "url",
            acceptedMimeTypes: "audio/*,image/png",
            uploadprogress() {},
          })).should.not.throw(Error);
      });

      it("should remove itself from Dropzone.instances", function () {
        (Dropzone.instances.indexOf(dropzone) !== -1).should.be.ok;
        dropzone.destroy();
        return (Dropzone.instances.indexOf(dropzone) === -1).should.be.ok;
      });
    });

    describe(".filesize()", function () {
      it("should handle files with 0 size properly", () =>
        dropzone.filesize(0).should.eql("<strong>0</strong> b"));

      it("should convert to KiloBytes, etc..", function () {
        dropzone.options.filesizeBase.should.eql(1000); // Just making sure the default config is correct

        dropzone.filesize(2 * 1000 * 1000).should.eql("<strong>2</strong> MB");
        dropzone
          .filesize(2 * 1024 * 1024)
          .should.eql("<strong>2.1</strong> MB");

        dropzone
          .filesize(2 * 1000 * 1000 * 1000)
          .should.eql("<strong>2</strong> GB");
        dropzone
          .filesize(2 * 1024 * 1024 * 1024)
          .should.eql("<strong>2.1</strong> GB");

        dropzone
          .filesize(2.5111 * 1000 * 1000 * 1000)
          .should.eql("<strong>2.5</strong> GB");
        dropzone.filesize(1.1 * 1000).should.eql("<strong>1.1</strong> KB");
        return dropzone
          .filesize(999 * 1000)
          .should.eql("<strong>1</strong> MB");
      });

      it("should convert to KibiBytes, etc.. when the filesizeBase is changed to 1024", function () {
        dropzone.options.filesizeBase = 1024;

        dropzone.filesize(2 * 1024 * 1024).should.eql("<strong>2</strong> MB");
        return dropzone
          .filesize(2 * 1000 * 1000)
          .should.eql("<strong>1.9</strong> MB");
      });
    });

    describe("._updateMaxFilesReachedClass()", function () {
      it("should properly add the dz-max-files-reached class", function () {
        dropzone.getAcceptedFiles = () => ({ length: 10 });
        dropzone.options.maxFiles = 10;
        dropzone.element.classList.contains("dz-max-files-reached").should.not
          .be.ok;
        dropzone._updateMaxFilesReachedClass();
        return dropzone.element.classList.contains("dz-max-files-reached")
          .should.be.ok;
      });
      it("should fire the 'maxfilesreached' event when appropriate", function () {
        let spy = sinon.spy();
        dropzone.on("maxfilesreached", () => spy());
        dropzone.getAcceptedFiles = () => ({ length: 9 });
        dropzone.options.maxFiles = 10;
        dropzone._updateMaxFilesReachedClass();
        spy.notCalled.should.be.true;
        dropzone.getAcceptedFiles = () => ({ length: 10 });
        dropzone._updateMaxFilesReachedClass();
        spy.called.should.be.true;
        dropzone.getAcceptedFiles = () => ({ length: 11 });
        dropzone._updateMaxFilesReachedClass();
        spy.calledOnce.should.be.true;
      }); //ie, it has not been called again

      it("should properly remove the dz-max-files-reached class", function () {
        dropzone.getAcceptedFiles = () => ({ length: 10 });
        dropzone.options.maxFiles = 10;
        dropzone.element.classList.contains("dz-max-files-reached").should.not
          .be.ok;
        dropzone._updateMaxFilesReachedClass();
        dropzone.element.classList.contains("dz-max-files-reached").should.be
          .ok;
        dropzone.getAcceptedFiles = () => ({ length: 9 });
        dropzone._updateMaxFilesReachedClass();
        return dropzone.element.classList.contains("dz-max-files-reached")
          .should.not.be.ok;
      });
    });

    return describe("events", () => {
      describe("progress updates", () =>
        it("should properly emit a totaluploadprogress event", function (done) {
          dropzone.files = [
            {
              size: 2000,
              accepted: true,
              status: Dropzone.UPLOADING,
              upload: {
                progress: 20,
                total: 2010, // The bytes to upload are higher than the file size
                bytesSent: 400,
              },
            },
            {
              size: 2000,
              accepted: true,
              status: Dropzone.UPLOADING,
              upload: {
                progress: 10,
                total: 2010, // The bytes to upload are higher than the file size
                bytesSent: 200,
              },
            },
          ];

          let _called = 0;

          dropzone.on("totaluploadprogress", function (progress) {
            if (_called <= 3)
            {
              progress.should.equal(totalProgressExpectation);
            }
            else {
              // Value is reset to 0 when the dropzone is destroyed
              progress.should.equal(0);
            }

            if (++_called === 3) {
              return done();
            }
          });

          var totalProgressExpectation = 15;
          dropzone.emit("uploadprogress", {});

          totalProgressExpectation = 98;
          dropzone.files[0].upload.bytesSent = 2010;
          dropzone.files[1].upload.bytesSent = 1910;
          // It shouldn't matter that progress is not properly updated since the total size
          // should be calculated from the bytes
          dropzone.emit("uploadprogress", {});

          totalProgressExpectation = 100;
          dropzone.files[0].upload.bytesSent = 2010;
          dropzone.files[1].upload.bytesSent = 2010;
          // It shouldn't matter that progress is not properly updated since the total size
          // should be calculated from the bytes
          dropzone.emit("uploadprogress", {});

          // Just so the afterEach hook doesn't try to cancel them.
          dropzone.files[0].status = Dropzone.CANCELED;
          return (dropzone.files[1].status = Dropzone.CANCELED);
        }));

      it("should emit DOM events", function (done) {
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
          expect(domEventTriggered).to.equal(true);
          done();
        }, 10);
      });
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
        expect(dropzone.getExistingFallback()).to.equal(undefined));

      it("should only return the fallback element if it contains exactly fallback", function () {
        element.appendChild(
          Dropzone.createElement('<form class="fallbacks"></form>')
        );
        element.appendChild(
          Dropzone.createElement('<form class="sfallback"></form>')
        );
        return expect(dropzone.getExistingFallback()).to.equal(undefined);
      });

      it("should return divs as fallback", function () {
        let fallback = Dropzone.createElement(
          '<form class=" abc fallback test "></form>'
        );
        element.appendChild(fallback);
        return fallback.should.equal(dropzone.getExistingFallback());
      });
      it("should return forms as fallback", function () {
        let fallback = Dropzone.createElement(
          '<div class=" abc fallback test "></div>'
        );
        element.appendChild(fallback);
        return fallback.should.equal(dropzone.getExistingFallback());
      });
    });

    describe("getFallbackForm()", function () {
      it("should use the paramName without [0] if uploadMultiple is false", function () {
        dropzone.options.uploadMultiple = false;
        dropzone.options.paramName = "myFile";
        let fallback = dropzone.getFallbackForm();
        let fileInput = fallback.querySelector("input[type=file]");
        return fileInput.name.should.equal("myFile");
      });
      it("should properly add [0] to the file name if uploadMultiple is true", function () {
        dropzone.options.uploadMultiple = true;
        dropzone.options.paramName = "myFile";
        let fallback = dropzone.getFallbackForm();
        let fileInput = fallback.querySelector("input[type=file]");
        return fileInput.name.should.equal("myFile[0]");
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
        dropzone.getAcceptedFiles().should.eql([mock1, mock3]));
      it("getRejectedFiles() should only return rejected files", () =>
        dropzone.getRejectedFiles().should.eql([mock2, mock4]));
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

        dropzone.getQueuedFiles().should.eql([]);

        mock1.done();
        mock3.done();

        dropzone.getQueuedFiles().should.eql([mock1, mock3]);
        mock1.status.should.equal(Dropzone.QUEUED);
        mock3.status.should.equal(Dropzone.QUEUED);
        mock2.status.should.equal(Dropzone.ADDED);
        return mock4.status.should.equal(Dropzone.ADDED);
      }));

    describe("getUploadingFiles()", () =>
      it("should return all files with the status Dropzone.UPLOADING", function (done) {
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

        dropzone.getUploadingFiles().should.eql([]);

        mock1.done();
        mock3.done();

        return setTimeout(function () {
          dropzone.getUploadingFiles().should.eql([mock1, mock3]);
          mock1.status.should.equal(Dropzone.UPLOADING);
          mock3.status.should.equal(Dropzone.UPLOADING);
          mock2.status.should.equal(Dropzone.ADDED);
          mock4.status.should.equal(Dropzone.ADDED);
          return done();
        }, 10);
      }));

    describe("getActiveFiles()", () =>
      it("should return all files with the status Dropzone.UPLOADING or Dropzone.QUEUED", function (done) {
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

        dropzone.getActiveFiles().should.eql([]);

        mock1.done();
        mock3.done();
        mock4.done();

        return setTimeout(function () {
          dropzone.getActiveFiles().should.eql([mock1, mock3, mock4]);
          mock1.status.should.equal(Dropzone.UPLOADING);
          mock3.status.should.equal(Dropzone.UPLOADING);
          mock2.status.should.equal(Dropzone.ADDED);
          mock4.status.should.equal(Dropzone.QUEUED);
          return done();
        }, 10);
      }));

    return describe("getFilesWithStatus()", () =>
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

        dropzone
          .getFilesWithStatus(Dropzone.ADDED)
          .should.eql([mock1, mock2, mock3, mock4]);

        mock1.status = Dropzone.UPLOADING;
        mock3.status = Dropzone.QUEUED;
        mock4.status = Dropzone.QUEUED;

        dropzone.getFilesWithStatus(Dropzone.ADDED).should.eql([mock2]);
        dropzone.getFilesWithStatus(Dropzone.UPLOADING).should.eql([mock1]);
        return dropzone
          .getFilesWithStatus(Dropzone.QUEUED)
          .should.eql([mock3, mock4]);
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

        mockFile.status.should.eql(Dropzone.ADDED);
        doneFunction();
        mockFile.status.should.eql(Dropzone.QUEUED);

        mockFile = getMockFile();
        dropzone.addFile(mockFile);

        mockFile.status.should.eql(Dropzone.ADDED);
        doneFunction("error");
        return mockFile.status.should.eql(Dropzone.ERROR);
      });

      it("should properly set the status of the file if autoProcessQueue is false and not call processQueue", function (done) {
        let doneFunction = null;
        dropzone.options.autoProcessQueue = false;
        dropzone.accept = (file, done) => (doneFunction = done);
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        dropzone.addFile(mockFile);
        sinon.stub(dropzone, "processQueue");

        mockFile.status.should.eql(Dropzone.ADDED);
        doneFunction();
        mockFile.status.should.eql(Dropzone.QUEUED);
        dropzone.processQueue.callCount.should.equal(0);
        return setTimeout(function () {
          dropzone.processQueue.callCount.should.equal(0);
          return done();
        }, 10);
      });

      it("should not add the file to the queue if autoQueue is false", function () {
        let doneFunction = null;
        dropzone.options.autoQueue = false;
        dropzone.accept = (file, done) => (doneFunction = done);
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        dropzone.addFile(mockFile);

        mockFile.status.should.eql(Dropzone.ADDED);
        doneFunction();
        return mockFile.status.should.eql(Dropzone.ADDED);
      });

      it("should create a remove link if configured to do so", function () {
        dropzone.options.addRemoveLinks = true;
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        sinon.stub(dropzone, "processQueue");
        dropzone.addFile(mockFile);

        return dropzone.files[0].previewElement.querySelector(
          "a[data-dz-remove].dz-remove"
        ).should.be.ok;
      });

      it("should create a remove link with HTML if configured to do so", function () {
        dropzone.options.addRemoveLinks = true;
        dropzone.options.dictRemoveFile =
          '<i class="icon icon-class"></i> Remove';
        dropzone.processFile = function () {};
        dropzone.uploadFile = function () {};

        sinon.stub(dropzone, "processQueue");
        dropzone.addFile(mockFile);

        return (
          dropzone.files[0].previewElement.querySelector(
            "a[data-dz-remove].dz-remove"
          ).should.be.ok &&
          dropzone.files[0].previewElement
            .querySelector("a[data-dz-remove].dz-remove")
            .innerHTML.should.equal('<i class="icon icon-class"></i> Remove')
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

        sinon.stub(dropzone, "processQueue");

        dropzone.addFile(mockFile);

        let file = dropzone.files[0];
        let removeLink1 = file.previewElement.querySelector(
          "a[data-dz-remove].link1"
        );
        let removeLink2 = file.previewElement.querySelector(
          "a[data-dz-remove].link2"
        );

        sinon.stub(dropzone, "removeFile");

        let event = document.createEvent("HTMLEvents");
        event.initEvent("click", true, true);
        removeLink1.dispatchEvent(event);

        dropzone.removeFile.callCount.should.eql(1);

        event = document.createEvent("HTMLEvents");
        event.initEvent("click", true, true);
        removeLink2.dispatchEvent(event);

        return dropzone.removeFile.callCount.should.eql(2);
      });

      return describe("thumbnails", function () {
        it("should properly queue the thumbnail creation", function (done) {
          let ct_callback;
          let doneFunction;

          dropzone.accept = (file, done) => (doneFunction = done);
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
            callback
          ) {
            ct_file = file;
            ct_callback = callback;
          };

          sinon.spy(dropzone, "createThumbnail");

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);
          dropzone.addFile(mock3);

          dropzone.files.length.should.eql(3);
          return setTimeout(function () {
            dropzone.createThumbnail.callCount.should.eql(1);
            mock1.should.equal(ct_file);
            ct_callback();
            dropzone.createThumbnail.callCount.should.eql(2);
            mock2.should.equal(ct_file);
            ct_callback();
            dropzone.createThumbnail.callCount.should.eql(3);
            mock3.should.equal(ct_file);

            return done();
          }, 10);
        });

        return describe("when file is SVG", () =>
          it("should use the SVG image itself", function (done) {
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
                  fileReader.result.should.equal(dataURI);
                  return done();
                };
                return fileReader.readAsDataURL(blob);
              }
            );
          }));
      });
    });

    describe("enqueueFile()", function () {
      it("should be wrapped by enqueueFiles()", function () {
        sinon.stub(dropzone, "enqueueFile");

        let mock1 = getMockFile();
        let mock2 = getMockFile();
        let mock3 = getMockFile();

        dropzone.enqueueFiles([mock1, mock2, mock3]);

        dropzone.enqueueFile.callCount.should.equal(3);
        dropzone.enqueueFile.args[0][0].should.equal(mock1);
        dropzone.enqueueFile.args[1][0].should.equal(mock2);
        return dropzone.enqueueFile.args[2][0].should.equal(mock3);
      });

      it("should fail if the file has already been processed", function () {
        mockFile.status = Dropzone.ERROR;
        expect(() => dropzone.enqueueFile(mockFile)).to.throw(
          "This file can't be queued because it has already been processed or was rejected."
        );
        mockFile.status = Dropzone.COMPLETE;
        expect(() => dropzone.enqueueFile(mockFile)).to.throw(
          "This file can't be queued because it has already been processed or was rejected."
        );
        mockFile.status = Dropzone.UPLOADING;
        return expect(() => dropzone.enqueueFile(mockFile)).to.throw(
          "This file can't be queued because it has already been processed or was rejected."
        );
      });

      it("should set the status to QUEUED and call processQueue asynchronously if everything's ok", function (done) {
        mockFile.status = Dropzone.ADDED;
        sinon.stub(dropzone, "processQueue");
        dropzone.processQueue.callCount.should.equal(0);
        dropzone.enqueueFile(mockFile);
        mockFile.status.should.equal(Dropzone.QUEUED);
        dropzone.processQueue.callCount.should.equal(0);
        return setTimeout(function () {
          dropzone.processQueue.callCount.should.equal(1);
          return done();
        }, 10);
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
        sinon.stub(dropzone, "uploadFiles");

        dropzone.uploadFile(mockFile);

        dropzone.uploadFiles.callCount.should.equal(1);
        return dropzone.uploadFiles.calledWith([mockFile]).should.be.ok;
      });

      it("should use url options if strings", function (done) {
        dropzone.addFile(mockFile);

        return setTimeout(function () {
          expect(requests.length).to.equal(1);
          expect(requests[0].url).to.equal(dropzone.options.url);
          expect(requests[0].method).to.equal(dropzone.options.method);
          return done();
        }, 10);
      });

      it("should call url options if functions", function (done) {
        let method = "PUT";
        let url = "/custom/upload/url";

        dropzone.options.method = sinon.stub().returns(method);
        dropzone.options.url = sinon.stub().returns(url);

        dropzone.addFile(mockFile);

        return setTimeout(function () {
          dropzone.options.method.callCount.should.equal(1);
          dropzone.options.url.callCount.should.equal(1);
          sinon.assert.calledWith(dropzone.options.method, [mockFile]);
          sinon.assert.calledWith(dropzone.options.url, [mockFile]);
          expect(requests.length).to.equal(1);
          expect(requests[0].url).to.equal(url);
          expect(requests[0].method).to.equal(method);
          return done();
        }, 10);
      });

      it("should use the timeout option", function (done) {
        dropzone.options.timeout = 10000;
        dropzone.addFile(mockFile);

        return setTimeout(function () {
          expect(requests[0].timeout).to.equal(10000);
          return done();
        }, 10);
      });

      it("should properly handle if timeout is null", function (done) {
        dropzone.options.timeout = null;
        dropzone.addFile(mockFile);

        return setTimeout(function () {
          expect(requests[0].timeout).to.equal(0);
          return done();
        }, 10);
      });

      it("should ignore the onreadystate callback if readyState != 4", function (done) {
        dropzone.addFile(mockFile);
        return setTimeout(function () {
          mockFile.status.should.eql(Dropzone.UPLOADING);

          requests[0].status = 200;
          requests[0].readyState = 3;
          requests[0].responseHeaders = { "content-type": "text/plain" };
          requests[0].onload();

          mockFile.status.should.eql(Dropzone.UPLOADING);

          requests[0].readyState = 4;
          requests[0].onload();

          mockFile.status.should.eql(Dropzone.SUCCESS);
          return done();
        }, 10);
      });

      it("should emit error and errormultiple when response was not OK", function (done) {
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
          mockFile.status.should.eql(Dropzone.UPLOADING);

          requests[0].status = 400;
          requests[0].readyState = 4;
          requests[0].responseHeaders = { "content-type": "text/plain" };
          requests[0].onload();

          expect(
            true === error &&
              error === errormultiple &&
              errormultiple === complete &&
              complete === completemultiple
          ).to.be.ok;

          return done();
        }, 10);
      });

      it("should include hidden files in the form and unchecked checkboxes and radiobuttons should be excluded", function (done) {
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
          return sinon.spy(tformData, "append");
        });

        let mock1 = getMockFile();

        dropzone.addFile(mock1);

        return setTimeout(function () {
          formData.append.callCount.should.equal(5);

          formData.append.args[0][0].should.eql("test");
          formData.append.args[0][1].should.eql("hidden");

          formData.append.args[1][0].should.eql("checked");
          formData.append.args[1][1].should.eql("value1");

          formData.append.args[2][0].should.eql("radio1");
          formData.append.args[2][1].should.eql("radiovalue2");

          formData.append.args[3][0].should.eql("select");
          formData.append.args[3][1].should.eql("2");

          formData.append.args[4][0].should.eql("file");
          formData.append.args[4][1].should.equal(mock1);

          // formData.append.args[1][0].should.eql "myName[]"
          return done();
        }, 10);
      });

      it("should all values of a select that has the multiple attribute", function (done) {
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
          return sinon.spy(tformData, "append");
        });

        let mock1 = getMockFile();

        dropzone.addFile(mock1);

        return setTimeout(function () {
          formData.append.callCount.should.equal(3);

          formData.append.args[0][0].should.eql("select");
          formData.append.args[0][1].should.eql("value2");

          formData.append.args[1][0].should.eql("select");
          formData.append.args[1][1].should.eql("value4");

          formData.append.args[2][0].should.eql("file");
          formData.append.args[2][1].should.equal(mock1);

          // formData.append.args[1][0].should.eql "myName[]"
          return done();
        }, 10);
      });

      describe("settings()", function () {
        it("should correctly set `withCredentials` on the xhr object", function () {
          dropzone.uploadFile(mockFile);
          requests.length.should.eql(1);
          requests[0].withCredentials.should.eql(false);
          dropzone.options.withCredentials = true;
          dropzone.uploadFile(mockFile);
          requests.length.should.eql(2);
          return requests[1].withCredentials.should.eql(true);
        });

        it("should correctly override headers on the xhr object", function () {
          dropzone.options.headers = { "Foo-Header": "foobar" };
          dropzone.uploadFile(mockFile);
          return requests[0].requestHeaders["Foo-Header"].should.eql("foobar");
        });

        it("should not set headers on the xhr object that are empty", function () {
          dropzone.options.headers = { "X-Requested-With": null };
          dropzone.uploadFile(mockFile);
          return Object.keys(requests[0].requestHeaders).should.not.contain(
            "X-Requested-With"
          );
        });

        it("should properly use the paramName without [n] as file upload if uploadMultiple is false", function (done) {
          dropzone.options.uploadMultiple = false;
          dropzone.options.paramName = "myName";

          let formData = [];
          let sendingCount = 0;
          dropzone.on("sending", function (files, xhr, tformData) {
            sendingCount++;

            formData.push(tformData);
            return sinon.spy(tformData, "append");
          });

          let mock1 = getMockFile();
          let mock2 = getMockFile();

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);

          return setTimeout(function () {
            sendingCount.should.equal(2);

            formData.length.should.equal(2);
            formData[0].append.callCount.should.equal(1);
            formData[1].append.callCount.should.equal(1);
            formData[0].append.args[0][0].should.eql("myName");
            formData[0].append.args[0][0].should.eql("myName");

            return done();
          }, 10);
        });

        it("should properly use the paramName with [n] as file upload if uploadMultiple is true", function (done) {
          dropzone.options.uploadMultiple = true;
          dropzone.options.paramName = "myName";

          let formData = null;
          let sendingMultipleCount = 0;
          let sendingCount = 0;
          dropzone.on("sending", (file, xhr, tformData) => sendingCount++);
          dropzone.on("sendingmultiple", function (files, xhr, tformData) {
            sendingMultipleCount++;
            formData = tformData;
            return sinon.spy(tformData, "append");
          });

          let mock1 = getMockFile();
          let mock2 = getMockFile();

          dropzone.addFile(mock1);
          dropzone.addFile(mock2);

          return setTimeout(function () {
            sendingCount.should.equal(2);
            sendingMultipleCount.should.equal(1);
            dropzone.uploadFiles([mock1, mock2]);
            formData.append.callCount.should.equal(2);
            formData.append.args[0][0].should.eql("myName[0]");
            formData.append.args[1][0].should.eql("myName[1]");
            return done();
          }, 10);
        });

        it("should use resizeImage if dimensions are provided", function (done) {
          sinon.stub(dropzone, "resizeImage");
          sinon.stub(dropzone, "createThumbnail");

          dropzone.options.resizeWidth = 400;

          let mock1 = getMockFile("image/jpeg");

          dropzone.addFile(mock1);

          return setTimeout(function () {
            dropzone.resizeImage.callCount.should.eql(1);
            return done();
          }, 10);
        });

        it("should not use resizeImage for SVG if dimensions are provided", function (done) {
          sinon.stub(dropzone, "uploadFiles");

          dropzone.createThumbnail = function (
            file,
            width,
            height,
            resizeMethod,
            fixOrientation,
            callback
          ) {
            callback(null, null);
          };

          dropzone.options.resizeWidth = 400;

          let mock1 = getMockFile("image/svg+xml");

          dropzone.addFile(mock1);

          setTimeout(function () {
            dropzone.uploadFiles.callCount.should.eql(1);
            let uploadedFiles = dropzone.uploadFiles.getCall(0).args[0];
            uploadedFiles.should.eql([mock1]);
            done();
          }, 10);
        });

        it("should not use resizeImage if dimensions are not provided", function (done) {
          sinon.stub(dropzone, "resizeImage");
          sinon.stub(dropzone, "createThumbnail");

          let mock1 = getMockFile("image/jpeg");

          dropzone.addFile(mock1);

          return setTimeout(function () {
            dropzone.resizeImage.callCount.should.eql(0);
            return done();
          }, 10);
        });

        it("should not use resizeImage if file is not an image", function (done) {
          sinon.stub(dropzone, "resizeImage");
          sinon.stub(dropzone, "createThumbnail");

          dropzone.options.resizeWidth = 400;

          let mock1 = getMockFile("text/plain");

          dropzone.addFile(mock1);

          return setTimeout(function () {
            dropzone.resizeImage.callCount.should.eql(0);
            return done();
          }, 10);
        });
      });

      it("should not change the file name if the options.renameFile is not set", function (done) {
        let mockFilename = "T3sT ;:_-.,!¨@&%&";
        mockFile = getMockFile("text/html", mockFilename);

        let renamedFilename = dropzone._renameFile(mockFile);

        renamedFilename.should.equal(mockFilename);
        return done();
      });

      it("should rename the file name if options.renamedFilename is set", function (done) {
        dropzone.options.renameFile = (file) =>
          file.name.toLowerCase().replace(/[^\w]/gi, "");

        mockFile = getMockFile("text/html", "T3sT ;:_-.,!¨@&%&");

        let renamedFilename = dropzone._renameFile(mockFile);

        renamedFilename.should.equal("t3st_");
        return done();
      });

      return describe("should properly set status of file", () =>
        it("should correctly set `withCredentials` on the xhr object", function (done) {
          dropzone.addFile(mockFile);

          setTimeout(function () {
            mockFile.status.should.eql(Dropzone.UPLOADING);

            requests.length.should.equal(1);
            requests[0].status = 400;
            requests[0].readyState = 4;
            requests[0].responseHeaders = { "content-type": "text/plain" };

            requests[0].onload();

            mockFile.status.should.eql(Dropzone.ERROR);

            mockFile = getMockFile();
            dropzone.addFile(mockFile);

            setTimeout(function () {
              mockFile.status.should.eql(Dropzone.UPLOADING);

              requests.length.should.equal(2);
              requests[1].status = 200;
              requests[1].readyState = 4;
              requests[1].responseHeaders = { "content-type": "text/plain" };

              requests[1].onload();

              mockFile.status.should.eql(Dropzone.SUCCESS);
              return done();
            }, 10);
          }, 10);
        }));
    });

    describe("transformFile()", function () {
      it("should be invoked and the result should be uploaded if configured", (done) => {
        sinon.stub(dropzone, "_uploadData");

        let mock1 = getMockFile("text/html", "original-file");
        let mock2 = getMockFile("text/html", "transformed-file");

        dropzone.options.transformFile = (file, done) => {
          file.should.eql(mock1);
          done(mock2);
        };

        dropzone.addFile(mock1);

        setTimeout(function () {
          dropzone._uploadData.callCount.should.equal(1);
          let uploadedFiles = dropzone._uploadData.args[0][0];
          let uploadedDataBlocks = dropzone._uploadData.args[0][1];
          uploadedFiles[0].should.equal(mock1);
          uploadedDataBlocks[0].data.should.equal(mock2);
          done();
        }, 10);
      });
      it("should be used as a basis for chunked uploads", (done) => {
        sinon.stub(dropzone, "_uploadData");

        dropzone.options.chunking = true;
        dropzone.options.chunkSize = 1;
        dropzone.options.parallelChunkUploads = true;

        let mock1 = getMockFile("text/html", "original-file", [
          "Veeeeery long file",
        ]); // 18 bytes
        let mock2 = getMockFile("text/html", "transformed-file", ["2b"]); // only 2 bytes

        dropzone.options.transformFile = (file, done) => {
          file.should.eql(mock1);
          done(mock2);
        };

        dropzone.addFile(mock1);

        setTimeout(async function () {
          dropzone._uploadData.callCount.should.equal(2);

          // the same file should be passed on each call.
          dropzone._uploadData.args[0][0][0].should.eql(mock1);
          dropzone._uploadData.args[1][0][0].should.eql(mock1);

          // Since we only allow chunks of 1 byte, there should be 2 chunks,
          // because the transformed file only has 2 bytes.
          // If this would equal to 18 bytes, then the wrong file would have
          // been chunked.
          mock1.upload.totalChunkCount.should.eql(2);

          let uploadedDataBlocks1 = dropzone._uploadData.args[0][1][0];
          let uploadedDataBlocks2 = dropzone._uploadData.args[1][1][0];

          let block1Text = await uploadedDataBlocks1.data.text();
          let block2Text = await uploadedDataBlocks2.data.text();
          block1Text.should.equal("2");
          block2Text.should.equal("b");
          done();
        }, 10);
      });
    });

    return describe("complete file", () =>
      it("should properly emit the queuecomplete event when the complete queue is finished", function (done) {
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
          completedFiles.should.equal(3);
          return done();
        });

        dropzone.addFile(mock1);
        dropzone.addFile(mock2);
        return dropzone.addFile(mock3);
      }));
  });
});
