const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  "export interface DocumentUpload {",
  "export interface DocumentUpload {\n  status?: string;"
);

code = code.replace(
  "export interface Organization {",
  "export interface Organization {\n  programs?: any[];"
);

code = code.replace(
  "export interface Warehouse {",
  "export interface Warehouse {\n  capacityMT?: number;"
);

fs.writeFileSync('src/types.ts', code);
