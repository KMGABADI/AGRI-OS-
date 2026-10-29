const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

const roleUI = `
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Role</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100"
                    >
                      {roles.map(r => <option key={r} value={r} className="bg-slate-800">{r}</option>)}
                    </select>
                  </div>
`;

const permissionsUI = roleUI + `
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">System Permissions</label>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {[
                        { id: 'view_dashboard', label: 'View Dashboard' },
                        { id: 'manage_farmers', label: 'Manage Farmers' },
                        { id: 'view_map', label: 'View Map' },
                        { id: 'manage_warehouses', label: 'Manage Warehouses' },
                        { id: 'manage_foodbank', label: 'Manage Food Bank' },
                        { id: 'manage_uploads', label: 'Data Upload' },
                        { id: 'manage_organizations', label: 'Organizations' },
                        { id: 'view_activity', label: 'Activity Log' },
                        { id: 'manage_settings', label: 'Settings' }
                      ].map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-black/20 border border-white/5 hover:border-white/20 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({...formData, permissions: [...formData.permissions, perm.id]});
                              } else {
                                setFormData({...formData, permissions: formData.permissions.filter(p => p !== perm.id)});
                              }
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-black/20 text-blue-500 focus:ring-blue-500/20"
                          />
                          <span className="text-xs text-slate-300 font-medium">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
`;

code = code.replace(
  /<label className="block text-\[11px\] font-semibold text-slate-400 uppercase tracking-widest mb-2">Role<\/label>[\s\S]*?<\/select>\s*<\/div>/,
  permissionsUI
);

// Add permissions to formData
code = code.replace(
  /role: 'Field Agent'/g,
  "role: 'Field Agent', permissions: [] as string[]"
);
code = code.replace(
  /role: user.role/g,
  "role: user.role, permissions: user.permissions || []"
);

code = code.replace(
  /await updateDoc\(docRef, \{ role: formData.role \}\);/,
  "await updateDoc(docRef, { role: formData.role, permissions: formData.permissions });"
);

code = code.replace(
  /role: formData.role\s*\}\)/,
  "role: formData.role, permissions: formData.permissions })"
);


const thReplace = `<th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Permissions</th>`;
code = code.replace(
  /<th className="px-6 py-4 text-\[11px\] font-bold uppercase tracking-widest text-slate-400">Actions<\/th>/,
  thReplace + `\n                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Actions</th>`
);

const tdReplace = `
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {(u.permissions || []).slice(0, 3).map(p => (
                          <span key={p} className="px-2 py-0.5 bg-white/5 text-slate-300 text-[10px] rounded border border-white/10">{p.replace('manage_', '').replace('view_', '')}</span>
                        ))}
                        {(u.permissions || []).length > 3 && (
                          <span className="px-2 py-0.5 bg-white/5 text-slate-400 text-[10px] rounded border border-white/10">+{(u.permissions || []).length - 3}</span>
                        )}
                        {(!u.permissions || u.permissions.length === 0) && (
                          <span className="text-slate-500 text-xs italic">Default</span>
                        )}
                      </div>
                    </td>
`;

code = code.replace(
  /<td className="px-6 py-4">\s*<div className="flex items-center gap-2">/,
  tdReplace + `\n                    <td className="px-6 py-4">\n                      <div className="flex items-center gap-2">`
);

code = code.replace(/colSpan=\{3\}/g, "colSpan={4}");

fs.writeFileSync('src/pages/UserManagement.tsx', code);
