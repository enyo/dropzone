// Vite serves ?raw imports as a string; TypeScript needs telling.
declare module "*.html?raw" {
  const content: string;
  export default content;
}

// ?inline hands back the processed stylesheet as a string, which is how the
// injectStyles option carries the CSS without importing it for its side effect.
declare module "*.css?inline" {
  const content: string;
  export default content;
}

// Optional globals. Neither is a dependency: Dropzone uses EXIF only when the
// page already loaded exif.js, and registers a jQuery plugin only when jQuery
// is present.
declare const EXIF: any;
declare const jQuery: any;
