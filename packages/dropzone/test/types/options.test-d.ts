// Assertions about the option types, checked by `pnpm typecheck` and never
// emitted -- see tsconfig.typecheck.json.
//
// `DropzoneOptions` is derived from the default values, so an option is typed
// by whatever its default happens to be. Where a default is narrower than what
// the option accepts, the widening in options.ts is the only thing keeping the
// declaration honest, and nothing else would notice it being dropped. Hence
// these. A `@ts-expect-error` is itself an assertion: it fails the build if the
// line it marks stops being an error, so it also pins the type against being
// widened all the way to `any`.
import type { DropzoneOptions } from "../../src/options";

let element: HTMLElement = document.createElement("div");

// clickable: true for the dropzone element, false for nothing, or an element,
// a CSS selector, or an array of those. See #2373.
export const clickableTrue: DropzoneOptions = { clickable: true };
export const clickableFalse: DropzoneOptions = { clickable: false };
export const clickableElement: DropzoneOptions = { clickable: element };
export const clickableSelector: DropzoneOptions = { clickable: ".pick-files" };
export const clickableList: DropzoneOptions = { clickable: [element, ".pick-files"] };

// @ts-expect-error clickable is not a number
export const clickableNumber: DropzoneOptions = { clickable: 42 };

// hiddenInputContainer: a selector string or an element.
export const hiddenInputSelector: DropzoneOptions = { hiddenInputContainer: "body" };
export const hiddenInputElement: DropzoneOptions = { hiddenInputContainer: element };

// @ts-expect-error hiddenInputContainer is not a number
export const hiddenInputNumber: DropzoneOptions = { hiddenInputContainer: 42 };

// previewsContainer: a selector, an element, or false to opt out.
export const previewsSelector: DropzoneOptions = { previewsContainer: ".previews" };
export const previewsElement: DropzoneOptions = { previewsContainer: element };
export const previewsFalse: DropzoneOptions = { previewsContainer: false };

// @ts-expect-error previewsContainer is not a number
export const previewsNumber: DropzoneOptions = { previewsContainer: 42 };

// The lack of an index signature is deliberate: a misspelled option has to be
// an error rather than an unused custom key. See the note on DropzoneOptions.
// @ts-expect-error maxFileSize is the wrong capitalisation of maxFilesize
export const misspelled: DropzoneOptions = { maxFileSize: 4 };
