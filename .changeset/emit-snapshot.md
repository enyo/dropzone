---
"dropzone": patch
---

Fix `emit` skipping a listener when another one removes itself.

`emit` walked the live callback array, so a listener that called `off` for itself — the usual shape of a one-shot listener, and of teardown code — spliced the array out from under the loop and the listener registered right after it never ran. `emit` now iterates over a snapshot.

One consequence worth knowing about: a listener registered from inside another listener no longer runs during that same `emit`, it runs from the next one. That is what Node's `EventEmitter` does, and it is the only way to keep the removal case correct.
