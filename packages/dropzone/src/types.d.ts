// Vite serves ?raw imports as a string; TypeScript needs telling.
declare module "*.html?raw" {
  const content: string;
  export default content;
}

// An optional global, not a dependency: Dropzone registers a jQuery plugin
// only when jQuery is present.
declare const jQuery: any;
