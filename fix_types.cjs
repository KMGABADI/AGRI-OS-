const fs = require('fs');

let code = fs.readFileSync('src/types.ts', 'utf8');

// First remove any mistakenly added permissions
code = code.replace(/  organizationId\?: string;\n  permissions\?: string\[\];/g, '  organizationId?: string;');
// Now add permissions to UserProfile specifically
code = code.replace(
  /export interface UserProfile \{[\s\S]*?\}/,
  (match) => {
    return match.replace(
      "photoURL?: string;",
      "photoURL?: string;\n  permissions?: string[];"
    );
  }
);

fs.writeFileSync('src/types.ts', code);
