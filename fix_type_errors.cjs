const fs = require('fs');

// Fix server.ts
let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(/valResult\.error\.errors\.map/g, "valResult.error.issues.map");
fs.writeFileSync('server.ts', server);

// Fix ConnectedWorkbooks.tsx
let cw = fs.readFileSync('src/components/ConnectedWorkbooks.tsx', 'utf8');
cw = cw.replace(/let token = getAccessToken\(\);/g, "let token = await getAccessToken();");
fs.writeFileSync('src/components/ConnectedWorkbooks.tsx', cw);
