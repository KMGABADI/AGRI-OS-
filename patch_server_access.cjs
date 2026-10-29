const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const \{ email, password, displayName, role, permissions \} = req\.body;/,
  "const { email, password, displayName, role, permissions, accessLevel } = req.body;"
);

code = code.replace(
  /permissions: permissions \|\| \[\],/,
  "permissions: permissions || [],\n        accessLevel: accessLevel || 1,"
);

code = code.replace(
  /const \{ role, permissions \} = req\.body;/,
  "const { role, permissions, accessLevel } = req.body;"
);

code = code.replace(
  /update\(\{ role, permissions: permissions \|\| \[\] \}\);/,
  "update({ role, permissions: permissions || [], accessLevel: accessLevel ?? 1 });"
);

fs.writeFileSync('server.ts', code);
