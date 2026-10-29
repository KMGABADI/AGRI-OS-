const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// The line is: const { email, password, displayName, role } = req.body;
code = code.replace(
  /const \{ email, password, displayName, role \} = req\.body;/,
  "const { email, password, displayName, role, permissions } = req.body;"
);

// The insertion logic is:
// role: role || 'Field Agent',
code = code.replace(
  /role: role \|\| 'Field Agent',/,
  "role: role || 'Field Agent',\n        permissions: permissions || [],"
);

// Also for the update role endpoint:
// app.put("/api/users/:uid/role", async (req, res) => {
//   try {
//     const { role } = req.body;
code = code.replace(
  /const \{ role \} = req\.body;/,
  "const { role, permissions } = req.body;"
);

// await db.collection("users").doc(req.params.uid).update({ role });
code = code.replace(
  /await db\.collection\("users"\)\.doc\(req\.params\.uid\)\.update\(\{ role \}\);/,
  "await db.collection(\"users\").doc(req.params.uid).update({ role, permissions: permissions || [] });"
);

fs.writeFileSync('server.ts', code);
