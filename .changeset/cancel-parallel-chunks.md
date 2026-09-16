---
"dropzone": patch
---

Fix `cancelUpload` leaving parallel chunks uploading.

`file.xhr` only holds the request that started last, so cancelling a chunked upload running with `parallelChunkUploads` aborted that one request and left every other in-flight chunk streaming to the server — burning the user's bandwidth and writing orphaned chunks for a file the UI already showed as canceled.

Every chunk keeps its own request, so `cancelUpload` now aborts all of the ones still running. Uploads that are not chunked are unaffected.
