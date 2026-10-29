const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

// The duplicate imports
const dupImport = "import { useActivityLogStore } from '../store/useActivityLogStore';\\nimport { useActivityLogStore } from '../store/useActivityLogStore';";
code = code.replace(new RegExp(dupImport, 'g'), "import { useActivityLogStore } from '../store/useActivityLogStore';");

// Use simple replacement instead of Regex because of special chars
code = code.replace(
  "import { useActivityLogStore } from '../store/useActivityLogStore';\nimport { useActivityLogStore } from '../store/useActivityLogStore';",
  "import { useActivityLogStore } from '../store/useActivityLogStore';"
);

code = code.replace(
  "const logActivity = useActivityLogStore(s => s.logActivity);\n  const logActivity = useActivityLogStore(s => s.logActivity);",
  "const logActivity = useActivityLogStore(s => s.logActivity);"
);

fs.writeFileSync('src/pages/UserManagement.tsx', code);
