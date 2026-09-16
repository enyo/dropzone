---
"dropzone": patch
---

Fix the declared type of `clickable` and `hiddenInputContainer`.

Both options are derived from their default values, so `clickable: true` was inferred as `boolean` and `hiddenInputContainer: "body"` as `string`. That contradicted what each one documents and what both have always accepted at runtime, and TypeScript rejected the documented forms.

`clickable` is now `boolean | string | HTMLElement | (string | HTMLElement)[]` and `hiddenInputContainer` is `string | HTMLElement`. Nothing changes at runtime.
