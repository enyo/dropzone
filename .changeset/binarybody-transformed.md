---
"dropzone": patch
---

Fix `binaryBody` uploads sending the original file instead of the transformed one. `resizeWidth`, `resizeHeight` and any custom `transformFile` were silently ignored, so an unresized image went to the server. Chunked and form-data uploads were unaffected.
