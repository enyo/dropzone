---
"dropzone": minor
---

Add `injectStyles`, which makes Dropzone add its own stylesheet to the document so you no longer have to include the CSS yourself.

- `false` — add nothing. The default.
- `true` or `"full"` — `dropzone.css`, the ready-to-go styling.
- `"basic"` — `basic.css`, layout only, for styling it yourself.

The two stylesheets are alternatives rather than layers: `basic.css` is not a subset of `dropzone.css` and each carries rules the other does not, so picking one excludes the other.

The CSS is inserted once per page however many dropzones exist, and first in `<head>`, so your own rules still win on equal specificity without `!important`. If two dropzones ask for different stylesheets, the first one constructed wins.

It defaults to `false` so that upgrading changes nothing. That is the only reason it is off: the stylesheets travel inside the JavaScript whether or not the option is used, because a runtime flag cannot be tree-shaken, so importing the CSS through a bundler as well ships it twice. If you bundle, switching this on is about 1.2 kB gzipped smaller than importing the stylesheet.
