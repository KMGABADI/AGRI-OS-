const fs = require('fs');
let code = fs.readFileSync('src/pages/Farmers.tsx', 'utf8');

code = code.replace(/const matchesOrg = orgFilter \? f\.organizationId === orgFilter \|\| f\.anchor === orgFilter \|\| \(false \/\*f\.interventions\?\.some\*\/\(i => i\.name === orgFilter\)\) : true;/, "const matchesOrg = orgFilter ? f.organizationId === orgFilter || f.anchor === orgFilter : true;");
code = code.replace(/const matchesProgram = programFilter \? f\.programId === programFilter\(i => i\.name === programFilter\) : true;/, "const matchesProgram = programFilter ? f.programId === programFilter : true;");

fs.writeFileSync('src/pages/Farmers.tsx', code);
