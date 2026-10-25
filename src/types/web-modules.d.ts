// sql.js's browser build has the same API as the package entry point.
declare module "sql.js/dist/sql-wasm-browser.js" {
  export { default } from "sql.js";
}

// Metro bundles .wasm files as assets: importing one gives an asset id.
declare module "*.wasm" {
  const assetId: number;
  export default assetId;
}
