---
"dropzone": patch
---

Stop `destroy()` removing a different instance. `Dropzone.instances.splice(indexOf(this), 1)` dropped the last entry whenever `indexOf` returned -1 — calling `destroy()` twice was enough — evicting an unrelated live Dropzone from the registry.
