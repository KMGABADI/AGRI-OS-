const fs = require('fs');

let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

// We'll add an inline update function.
const inlineUpdate = `
  const handleInlineUpdate = async (uid: string, field: 'role' | 'accessLevel', value: any) => {
    try {
      const user = users.find(u => u.uid === uid);
      if (!user) return;
      
      const docRef = doc(db, 'users', uid);
      const updates = { [field]: value };
      
      // Opt-in UI optimistic update (optional, but good UX)
      
      await updateDoc(docRef, updates);
      
      await logActivity({
        action: 'UPDATE',
        entityType: 'USER',
        entityId: uid,
        details: \`Updated \${user.email} \${field} to \${value}\`,
        changes: [{ field, oldValue: user[field as keyof UserProfile], newValue: value }]
      });
      
      // Update role via API as well if needed? No, firebase triggers auth but role is only in doc for claims sync?
      // Wait, our API PUT /api/users/:uid/role handles this for us (and updates custom claims).
      // So we should call the API instead of updating doc directly!
      
      const response = await fetch(\`/api/users/\${uid}/role\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: field === 'role' ? value : user.role, 
          accessLevel: field === 'accessLevel' ? value : user.accessLevel,
          permissions: user.permissions || []
        })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
    } catch (err: any) {
      console.error('Failed to update user', err);
      alert('Failed to update user: ' + err.message);
    }
  };
`;

code = code.replace(
  "const openCreateModal = () => {",
  inlineUpdate + "\n  const openCreateModal = () => {"
);

// Add Access Level column header
code = code.replace(
  /<th className="px-6 py-4 text-\[11px\] font-bold uppercase tracking-widest text-slate-400">Permissions<\/th>/,
  `<th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Permissions</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Access Level</th>`
);

// Add Access Level cell and update Role cell to have a dropdown
code = code.replace(
  /<span className="px-3 py-1 bg-blue-500\/10 text-blue-400 border border-blue-500\/20 rounded-full text-xs font-bold tracking-wide">\s*\{u.role \|\| 'Field Agent'\}\s*<\/span>/,
  `<select 
                          value={u.role || 'Field Agent'}
                          onChange={(e) => handleInlineUpdate(u.uid, 'role', e.target.value)}
                          className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold tracking-wide px-3 py-1 outline-none cursor-pointer appearance-none text-center"
                        >
                          {roles.map(r => <option key={r} value={r} className="bg-slate-800 text-slate-200">{r}</option>)}
                        </select>`
);

const newCell = `
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 w-32">
                        <span className="text-xs text-slate-400 w-4">{u.accessLevel || 1}</span>
                        <input 
                          type="range" 
                          min="1" 
                          max="5" 
                          step="1"
                          value={u.accessLevel || 1}
                          onChange={(e) => handleInlineUpdate(u.uid, 'accessLevel', parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </td>`;

code = code.replace(
  /<td className="px-6 py-4">\s*<div className="flex flex-wrap gap-1 max-w-\[250px\]">[\s\S]*?<\/div>\s*<\/td>/,
  `$&${newCell}`
);

// Adjust colSpans
code = code.replace(/colSpan=\{4\}/g, "colSpan={5}");

fs.writeFileSync('src/pages/UserManagement.tsx', code);
