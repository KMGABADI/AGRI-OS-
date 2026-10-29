const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

code = code.replace(
  /import \{ useActivityLogStore \} from '\.\.\/store\/useActivityLogStore';\nimport \{ useActivityLogStore \} from '\.\.\/store\/useActivityLogStore';/g,
  "import { useActivityLogStore } from '../store/useActivityLogStore';"
);

code = code.replace(
  /const logActivity = useActivityLogStore\(s => s\.logActivity\);\n  const logActivity = useActivityLogStore\(s => s\.logActivity\);/g,
  "const logActivity = useActivityLogStore(s => s.logActivity);"
);

// We need to fix oldUser and deletedUser too. It seems they were duplicated because the replacement was run multiple times. Let's just find and remove the extra ones.
// I'll just check the exact duplicates around line 55 and 125.
