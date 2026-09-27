import { Dropzone } from "../../src/dropzone";

describe("injectStyles", function () {
  let element = null;
  let dropzone = null;

  let injected = () => document.querySelectorAll("style[data-dropzone]");

  beforeEach(function () {
    for (let style of injected()) style.remove();
    element = Dropzone.createElement('<div class="dropzone"></div>');
    document.body.appendChild(element);
  });

  afterEach(function () {
    if (dropzone != null && typeof dropzone.destroy === "function") dropzone.destroy();
    element.remove();
    for (let style of injected()) style.remove();
    dropzone = null;
  });

  let create = (options = {}) =>
    (dropzone = new Dropzone(element, { url: "/upload", autoProcessQueue: false, ...options }));

  it("should add nothing by default", function () {
    create();

    expect(injected()).toHaveLength(0);
  });

  it("should add a style element when asked", function () {
    create({ injectStyles: true });

    expect(injected()).toHaveLength(1);
  });

  it("should treat true as the full stylesheet", function () {
    create({ injectStyles: true });

    expect(injected()[0].getAttribute("data-dropzone")).toBe("full");
  });

  it("should add the full stylesheet when asked for it by name", function () {
    create({ injectStyles: "full" });

    expect(injected()[0].getAttribute("data-dropzone")).toBe("full");
  });

  it("should add the basic stylesheet instead when asked", function () {
    create({ injectStyles: "basic" });

    expect(injected()[0].getAttribute("data-dropzone")).toBe("basic");
  });

  // The two are alternatives, not layers: basic carries rules the full sheet
  // does not, and vice versa.
  it("should add a different stylesheet for basic than for full", function () {
    create({ injectStyles: "basic" });
    let basic = injected()[0].textContent;
    dropzone.destroy();
    for (let style of injected()) style.remove();

    create({ injectStyles: "full" });
    let full = injected()[0].textContent;

    expect(basic).not.toBe(full);
    // The text is minified in a build and not in dev, so match on a rule
    // rather than on exact spacing.
    expect(basic.replace(/\s+/g, "")).toContain("position:relative");
    // the drag-hover styling is in the full sheet only
    expect(full).toContain("dz-drag-hover");
    expect(basic).not.toContain("dz-drag-hover");
  });

  it("should apply the basic layout rules", function () {
    create({ injectStyles: "basic" });

    // basic.css sets .dropzone { position: relative }, which the full sheet
    // does not -- it positions against .dz-preview instead.
    expect(getComputedStyle(element).position).toBe("relative");
  });

  it("should inject the actual stylesheet", function () {
    create({ injectStyles: true });

    let css = injected()[0].textContent;
    expect(css).toContain(".dz-preview");
    expect(css).toContain(".dz-drag-hover");
    expect(css).toContain("@keyframes");
  });

  it("should produce styles that actually apply", function () {
    create({ injectStyles: true });

    // dropzone.css sets min-height on .dropzone, so a plain div that would
    // otherwise compute to 0px proves the rules are live, not merely present.
    expect(getComputedStyle(element).minHeight).toBe("150px");
  });

  it("should only inject once across several dropzones", function () {
    create({ injectStyles: true });

    let second = Dropzone.createElement('<div class="dropzone"></div>');
    document.body.appendChild(second);
    let secondDropzone = new Dropzone(second, { url: "/upload", injectStyles: true });

    expect(injected()).toHaveLength(1);

    secondDropzone.destroy();
    second.remove();
  });

  // Appending would silently win over a stylesheet the page already links, so
  // anyone turning this on would find their own styling stopped applying.
  it("should go first in the head so page styles still win", function () {
    let existing = document.createElement("style");
    existing.setAttribute("data-test-sheet", "");
    document.head.appendChild(existing);

    try {
      create({ injectStyles: true });

      let all = [...document.head.children];
      expect(all.indexOf(injected()[0])).toBeLessThan(all.indexOf(existing));
    } finally {
      existing.remove();
    }
  });

  it("should still inject when the browser falls back", function () {
    element = Dropzone.createElement('<div class="dropzone"></div>');
    document.body.appendChild(element);
    new Dropzone(element, { url: "/upload", injectStyles: true, forceFallback: true });

    expect(injected()).toHaveLength(1);
  });
});
