const fs = require('fs');
let code = fs.readFileSync('src/lib/AuthContext.tsx', 'utf8');

code = code.replace(`            // Auto-promote kmgabadi@gmail.com to Super Admin
            );
            }`, `            // Removed Super Admin bootstrap`);

fs.writeFileSync('src/lib/AuthContext.tsx', code);
