---
"dropzone": patch
---

Fix the thumbnail queue deadlocking when a file cannot be read.

`createThumbnail` only listened for `FileReader`'s `load` event. A file that had been moved, locked by another process, or was otherwise unreadable since it was dropped fires `error` instead, so the callback was never invoked and `_processThumbnailQueue` kept its lock forever: no file added afterwards got a thumbnail, and with `resizeWidth`/`resizeHeight` or a `transformFile` that uses `createThumbnail`, the upload never started either.

The read error now reaches the callback the same way an undecodable image already did, so the file gets `dictThumbnailError` and the queue moves on.

`DropzoneThumbnailCallback` says what it has always done, too: its first argument is `string | Event`, the error event standing in for the data URL when no thumbnail could be produced. That also fixes `displayExistingFile`, which used to emit that event as a thumbnail when the image URL failed to load, leaving the preview with `img.src` set to `"[object Event]"`.
