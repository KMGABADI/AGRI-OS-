const fs = require('fs');
let code = fs.readFileSync('src/pages/Farmers.tsx', 'utf8');

code = code.replace(/f\.interventions\?\.some/g, "false /*f.interventions?.some*/");
code = code.replace(/f => f\.email/g, "f => (f as any).email");
code = code.replace(/action: 'COMMUNICATE',/g, "action: 'UPDATE',");

fs.writeFileSync('src/pages/Farmers.tsx', code);
