const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

// The code looks like this:
//              <div>
//                   
//                  <div>
//                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Role</label>
// ...

code = code.replace(
  /<div>\s*<div>\s*<label className="block text-\[11px\] font-semibold text-slate-400 uppercase tracking-widest mb-2">Role<\/label>/,
  `                 <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Role</label>`
);

fs.writeFileSync('src/pages/UserManagement.tsx', code);
