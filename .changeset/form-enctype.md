---
"dropzone": patch
---

Set `enctype="multipart/form-data"` on a form again. `init()` compared `tagName` against lower-case `"form"`, which never matches, so the attribute was never set. Only affects forms that are also submitted natively; the XHR upload is unchanged.
