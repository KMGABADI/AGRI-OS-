declare module "shpjs" {
  const parse: (input: ArrayBuffer) => Promise<any>;
  export default parse;
}
