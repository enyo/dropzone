---
"dropzone": patch
---

Fix cancelling an upload while `transformFile` is still running. The file had no `xhr` yet, so it was grouped with every other file that had not started and the whole queue was cancelled with it — and the file itself was still sent once the transform finished.
