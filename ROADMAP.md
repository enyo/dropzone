# Roadmap to 7.0

Working notes for the next major. Nothing here is committed to a date, and the
line references are hints rather than anchors — they will drift.

The 6.x line stays maintainable throughout: bug fixes and additive options keep
shipping as patches and minors while this is in progress.

---

## Breaking changes

### Rewrite in TypeScript

The library is written in JavaScript that was mechanically converted from
CoffeeScript years ago, and it still reads like it — `__guard__`, `__guardMethod__`,
`var` in the middle of blocks, `return` on statements whose value nobody uses.

Ship the types from the package itself. `@types/dropzone` is stuck at `5.7.9` and
describes the v5 API, so today every v6 TypeScript user is either untyped or
wrongly typed. The changelog entry needs to tell people to uninstall
`@types/dropzone`.

### Raise the browser floor and delete the compatibility code

The build targets `es2017` and 6.x already dropped IE, but the source still
carries workarounds for browsers well below that floor. Pick a floor, write it
down in the README, and then remove:

| what                                                              | where                           |
| ----------------------------------------------------------------- | ------------------------------- |
| `CustomEvent` polyfill, marked "IE 11 support"                    | `src/emitter.js:39`             |
| `window.URL !== null ? window.URL : window.webkitURL`             | `src/dropzone.js:280`           |
| `classList` feature gate (rejects IE9 and below)                  | `src/dropzone.js:1784`          |
| Opera 12 on macOS / Windows Phone blocklist                       | `src/dropzone.js:1767`          |
| `Dropzone.blacklistedBrowsers` back-compat alias                  | `src/dropzone.js:1790`          |
| `transformedFile.webkitSlice` fallback                            | `src/dropzone.js:1220`          |
| `detectVerticalSquash` / `drawImageIOSFix`, an iOS 6/7 canvas bug | `src/dropzone.js:1985`, `:2020` |
| "Setting the timeout after open because of IE11 issue"            | `src/dropzone.js:1331`          |
| `item.kind == null` and `item.getAsFile != null` in the drop path | `src/dropzone.js:654`           |

The `window.URL` line is a latent bug rather than dead weight:
`undefined !== null` is `true`, so the `webkitURL` fallback can never fire. It
has been unreachable for as long as it has existed.

Two of these are load-bearing and must **not** go, despite looking similar. In
`_addFilesFromItems`, the check that `webkitGetAsEntry()` returned something is
not a legacy guard: a `DataTransfer` built programmatically returns `null` from
it even for a genuine `File`, which was verified against Chromium. And
`items && items.length` guards the case where `files` is populated but `items`
is not.

`forceFallback`, `fallback()`, `getFallbackForm()`, `Dropzone.blockedBrowsers`
and `Dropzone.isBrowserSupported()` are **public API**. Decide deliberately
whether the fallback form survives 7.0; removing it is a breaking change in its
own right, separate from deleting the browser sniffing behind it.

### Replace callbacks with async/await

`accept`, `transformFile`, `chunksUploaded` and the send path are all
callback-based. This is the single change that unblocks the most requests:

- **#2274** tried to make `accept` promise-based and was closed as unmergeable.
- **#2033** wanted an awaitable hook between "about to send" and the send, for
  things like S3 presigning. Closed pointing here, because adding one async hook
  in 6.x would mean shipping an API that 7.0 immediately changes.

Promises themselves are already safe — the target is `es2017`, nothing is
polyfilled, and `drop()` uses them as of 6.2.

### Make `maxFilesize` unambiguous

Dropzone currently has two bases that disagree:

|                                    | base                             | result         |
| ---------------------------------- | -------------------------------- | -------------- |
| `filesize()`, used for the preview | `filesizeBase`, default **1000** | shows "9.5 MB" |
| `maxFilesize` check                | hardcoded **1024 × 1024**        | enforces MiB   |
| `dictFileTooBig`                   | —                                | says "MiB"     |
| `dictFileSizeUnits`                | —                                | says "MB"      |

So a preview reads `MB` while the rejection message for the same file talks in
`MiB`. **#1979** proposed a `maxFilesizeBase` option; it was closed because a
third base makes the disagreement worse rather than better.

Accept bytes or a unit string instead — `maxFilesize: 10 * 1024 * 1024` or
`maxFilesize: "10MB"` — and use one formatter for both the preview and the error
so they can no longer contradict each other. This is where the ecosystem is:
Uppy, react-dropzone and Fine Uploader take bytes; FilePond and Plupload take
unit strings. Nobody else uses a bare number that silently means MiB.

The docs also claim `maxFilesize` is "in bytes", which is simply wrong.

### Count server-added files against `maxFiles`

**#2003.** `displayExistingFile` never pushes to `this.files`, so `maxFiles`
ignores files loaded from the server. The fix is one line, but the documented
workaround is `dropzone.files.push(mockFile)` and it is on every StackOverflow
answer about this — fixing it internally silently double-counts for everyone who
applied it. There is no safe version in a patch or a minor. Ship it here with a
changelog note telling people to delete their manual push.

---

## Internals

### Restructure `src/dropzone.js`

2,192 lines in one file holding the class, the browser detection and the canvas
helpers. Split along those seams. The EXIF handling has already moved out, to
`src/exif.ts`.

---

## API and options

### Make option defaults reachable

Overriding any option handler currently means reimplementing its default,
because `defaultOptions` is a module-scoped import that is not exposed anywhere
on the public API. There is no way to normalise a value and then delegate.

This is what pushed the author of **#2253** to patch the library instead of
their own code: they wanted to unwrap one backend's error JSON and then let the
default `error` handler render it, which is impossible today. `error` and
`accept` would both be materially nicer to override.

### Improve the options structure

95 top-level options in a flat object, mixing configuration, dictionary strings
and event handlers. At minimum, separate those three kinds. Worth considering
grouping the related families (`thumbnail*`, `resize*`, `chunk*`, `dict*`) while
the door to breaking changes is open.

### Add the `exports` field

`package.json` still uses `main` / `module` / `standalone` only.

---

## Consistency

### `addedfiles` across all three entry points

Three code paths add files and they do not agree:

- `drop()` — emits `addedfiles` after the async directory walk, as of 6.2
- the hidden input's `change` handler — emits it synchronously
- `paste()` — never emits it at all

Pick one contract and apply it everywhere.

---

## Accessibility

The real work, as opposed to the audit-clearing kind. 6.2 added an `aria-label`
to the hidden file input for WAVE's benefit, and it is genuinely inert: dumping
Chromium's accessibility tree for a default dropzone returns eight nodes and the
input is not among them, because browsers drop `visibility: hidden` subtrees
entirely.

What assistive technology actually sees is the `.dz-button` carrying
`dictDefaultMessage`. So the questions worth answering are about the drop area
itself — how added files, upload progress, errors and completion are announced,
and whether removal and retry are reachable without a mouse.

---

## Docs and infrastructure

- **Monorepo.** Move `dropzone-docs` and the website into this repository.
- **Docusaurus**, replacing GitBook. The current setup syncs bidirectionally
  through a webhook plus an OAuth grant tied to a personal GitHub account, it
  rewrites file formats on its own schedule, and the last write from its side
  was September 2022.
- Once the docs live here, the options table can be **checked against
  `src/options.js` in CI** rather than hand-maintained. It has already drifted:
  46 options were undocumented until 6.2, `chunkSize` was listed as `2000000`
  when it is `2097152`, and `maxFilesize` is documented in the wrong unit.

---

## Housekeeping

Not blocking 7.0, but worth clearing.

- Delete the unreferenced `NPM_TOKEN` (created 2020) and `DRONE_PAT` (2021)
  repository secrets.
- Prune the stale `gh-pages-nav`, `new-drop`, `no-dep` and `v6` branches.
  **Not `assets`** — the README logo is served from it.
- Turn on branch protection for `main`: require the `Test` check, and require
  branches to be up to date before merging. A PR from 2023 was merged in 2026
  with no checks at all — GitHub only runs a workflow when a PR is opened or its
  head moves, so an old PR shows an absence of failures rather than a pass. That
  one broke `main`.
