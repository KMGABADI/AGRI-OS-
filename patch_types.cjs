const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(
  /permissions\?: string\[\];/,
  "permissions?: string[];\n  accessLevel?: number;"
);
fs.writeFileSync('src/types.ts', code);
