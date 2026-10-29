const fs = require('fs');
let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

code = code.replace(
  /<div className="p-4 sm:p-6 border-b border-white\/10 flex flex-col sm:flex-row gap-4 items-center justify-between">/,
  `<div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200">System Users & Share Access</h3>
            <p className="text-xs text-slate-400 mt-1">Adjust individual access levels using the sliders below.</p>
          </div>`
);

fs.writeFileSync('src/pages/UserManagement.tsx', code);
