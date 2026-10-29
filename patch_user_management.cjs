const fs = require('fs');
let code = fs.readFileSync('src/pages/UserManagement.tsx', 'utf8');

code = code.replace(
  "import { Users, UserPlus, Search, Edit2, Trash2, ShieldAlert } from 'lucide-react';",
  "import { Users, UserPlus, Search, Edit2, Trash2, ShieldAlert, Key } from 'lucide-react';"
);

code = code.replace(
  "const [isEditing, setIsEditing] = useState(false);",
  "const [isEditing, setIsEditing] = useState(false);\n  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);\n  const [newPassword, setNewPassword] = useState('');"
);

const submitReset = `
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    try {
      const response = await fetch(\`/api/users/\${resetPasswordUser.uid}/password\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      await logActivity({
        action: 'UPDATE',
        entityType: 'USER',
        entityId: resetPasswordUser.uid,
        details: \`Reset password for user \${resetPasswordUser.email}\`
      });
      setResetPasswordUser(null);
      setNewPassword('');
      alert('Password reset successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to reset password: ' + err.message);
    }
  };
`;

code = code.replace(
  "const handleDelete = async (uid: string) => {",
  submitReset + "\n  const handleDelete = async (uid: string) => {"
);

code = code.replace(
  /<button onClick=\{\(\) => openEditModal\(u\)\}/,
  `{(profile?.role === 'Super Admin' || profile?.role === 'Admin') && (
                          <button onClick={() => setResetPasswordUser(u)} title="Reset Password" className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                            <Key size={16} />
                          </button>
                        )}
                        <button onClick={() => openEditModal(u)}`
);

const resetModal = `
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={\`w-full max-w-sm rounded-3xl \${theme.bgClass} border border-white/10 shadow-2xl p-6\`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100">Reset Password</h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Enter a new password for <strong className="text-slate-200">{resetPasswordUser.email}</strong>
            </p>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  required
                  placeholder="New Password"
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" 
                />
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setResetPasswordUser(null)} className="px-4 py-2 text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white rounded-full bg-blue-600 hover:bg-blue-500 transition-colors">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

code = code.replace(
  /\{isModalOpen && \(/,
  resetModal + "\n      {isModalOpen && ("
);

fs.writeFileSync('src/pages/UserManagement.tsx', code);
