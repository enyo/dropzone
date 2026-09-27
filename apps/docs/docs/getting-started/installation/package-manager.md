---
description: This is how I use the library myself
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Package manager

As with most visual JavaScript libraries there are two sides to the story: getting the JavaScript code in your project, and getting the CSS code. Let's start with JS.

Add dropzone as a dependency to your project:

<Tabs>
<TabItem value="npm" label="npm">
```bash
$ npm install --save dropzone
```
</TabItem>

<TabItem value="pnpm" label="pnpm">
```bash
$ pnpm add dropzone
```
</TabItem>
</Tabs>

In your html, make sure you have an element that will act as the dropzone:

```markup
<!-- Example of a form that Dropzone can take over -->
<form action="/target" class="dropzone"></form>
```

## JavaScript

Without going too much into detail, historically, there have been plenty of ways to import libraries in JavaScript. Fortunately, not too long ago a standard was introduced that was implemented in browsers as well. This standard is called [ECMAScript modules](https://nodejs.org/api/esm.html), also commonly referred to as [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). This has caused JavaScript modules to become a defacto standard, which is why I recommend to use this approach.

Before JavaScript modules there were quite a few other standards. The only other module standard that Dropzone now supports is the [CommonJS format](https://en.wikipedia.org/wiki/CommonJS) which is what node is using too (note that [node also has support for JavaScript modules](https://nodejs.medium.com/announcing-core-node-js-support-for-ecmascript-modules-c5d6dc29b663) now).

We also provide a standalone file that you can simply include in your browser. See the corresponding section for this: [Stand-alone file](stand-alone.md).

```javascript
// If you are using JavaScript/ECMAScript modules:
import Dropzone from "dropzone";

// If you are using CommonJS modules:
const { Dropzone } = require("dropzone");

// If you are using an older version than Dropzone 6.0.0,
// then you need to disabled the autoDiscover behaviour here:
Dropzone.autoDiscover = false;

let myDropzone = new Dropzone("#my-form");
myDropzone.on("addedfile", file => {
  console.log(`File added: ${file.name}`);
});
```

:::warning

In order for Dropzone to find the `#my-form` the element must already exist. Either put your `<script>` import at the end of your HTML file, or use some sort of `window.onload` logic.

:::

## TypeScript

Dropzone is written in TypeScript and the types ship with the package, so
there is nothing to install alongside it.

If you have `@types/dropzone`, remove it. It stopped at `5.7.9` and describes
the v5 API, so it will disagree with the library you are using:

```bash
npm uninstall @types/dropzone
```

Everything is typed from the source:

```typescript
import { Dropzone } from "dropzone";
import type { DropzoneOptions } from "dropzone";

const options: DropzoneOptions = { url: "/file/post", maxFilesize: 10 };
const dropzone = new Dropzone("div#myId", options);

// The listener's arguments are inferred from the event name.
dropzone.on("addedfile", (file) => {
  console.log(file.name, file.upload.progress);
});
```

## CSS

Dropzone ships with two files: a `basic.css` and a `dropzone.css`. The `dropzone.css` contains all the styling you can see in the examples and is a ready-to-go solution. If you want to have total control over the styling, you can use the `basic.css` as a base, and build on top of that, or not use any of the provided CSS files at all.

Importing this CSS file greatly depends on the bundler or framework that you are using so I won't go into much detail here.

You can also simply include the CSS file in your html. Refer to the [Stand-alone file](stand-alone.md) section for this.

### Letting Dropzone add the CSS for itself

If you would rather not wire the stylesheet up at all, set `injectStyles` and Dropzone inserts it for you:

```javascript
new Dropzone("#my-form", { url: "/file/post", injectStyles: true });
```

It takes which stylesheet you want:

| value | what it adds |
| --- | --- |
| `false` | nothing. The default |
| `true` or `"full"` | `dropzone.css`, the ready-to-go styling |
| `"basic"` | `basic.css`, layout only, for styling it yourself |

The two are **alternatives, not layers** — `basic.css` is not a subset of `dropzone.css`, and each carries rules the other does not, so picking one excludes the other.

It is added once per page however many dropzones you create, and inserted **first** in `<head>`, so your own stylesheet still wins on equal specificity without needing `!important`. If two dropzones ask for different stylesheets, the first one constructed wins.

:::caution

A `<link>` blocks the first paint; this cannot. The styles arrive when the script does, so on a slow connection the browser may paint before them.

Everything Dropzone builds — the message, the previews — is created *after* the styles go in, so it is never seen unstyled, and an empty `<div class="dropzone">` has nothing to show either way. But markup **you** put inside the dropzone element is visible unstyled until the script runs, and shifts when the styling lands. Link the stylesheet if that matters to you.

:::

It is off by default so that upgrading changes nothing for anyone. That is the only reason — it is **not** the cheaper setting.

The stylesheets travel inside the JavaScript whether or not you switch the option on, because a runtime flag cannot be tree-shaken. So importing the CSS through your bundler as well ships it **twice**: once as a string inside the script, once as a stylesheet. Measured on a minimal app:

| | ships | gzipped |
| --- | --- | --- |
| `import "dropzone/dist/dropzone.css"` | script + stylesheet | 15,518&nbsp;B |
| `injectStyles: true` | script only | **14,279&nbsp;B** |

If you are bundling, turning it on is the smaller choice. The reason to link the stylesheet instead is the timing above, not the size.

:::info

You can check out the [examples repository](https://github.com/dropzone/dropzone-examples) for ways to handle this with different bundlers.

:::
