---
"dropzone": patch
---

Fix resized JPEGs coming out rotated: the original EXIF orientation was copied onto pixels that were already upright, so viewers that honour it turned them a second time. It is now written back as `1`, and Dropzone applies the orientation itself in every browser rather than relying on the browser or exif.js. If you were correcting for this on your server, remove that.
