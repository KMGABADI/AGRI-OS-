const fs = require('fs');
let code = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

// Replace usages of isSuperAdminUser
code = code.replace(/if \(isSuperAdminUser && existingProfile.role !== 'Super Admin'\) {[\s\S]*?}/, '');
code = code.replace(/role: isSuperAdminUser \? 'Super Admin' : 'Viewer'/g, "role: 'Viewer'");

fs.writeFileSync('src/lib/AuthContext.tsx', code);
