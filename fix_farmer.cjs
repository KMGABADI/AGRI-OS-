const fs = require('fs');

// Fix useFarmerStore.ts
let code = fs.readFileSync('src/types.ts', 'utf8');
if (!code.includes('interventions?:')) {
  code = code.replace(
    /experience\?: number;/,
    "experience?: number;\n  interventions?: any[];"
  );
  fs.writeFileSync('src/types.ts', code);
}
