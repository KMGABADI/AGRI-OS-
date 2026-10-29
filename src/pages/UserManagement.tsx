import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { useActivityLogStore } from '../store/useActivityLogStore';
import { Users, UserPlus, Search, Edit2, Trash2, ShieldAlert, Key } from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function UserManagement() {
  const { profile } = useAuth();
  const { primaryColor } = useBrandingStore();
  const settings = useSettingsStore();
  const logActivity = useActivityLogStore(s => s.logActivity);
  const theme = settings.theme || THEMES.frosted;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  const [formData, setFormData] = useState({
    uid: '',
    email: '',
    password: '',
    displayName: '',
    role: 'Field Agent', permissions: [] as string[]
  });

  const roles = ['Super Admin', 'Admin', 'Manager', 'Field Agent', 'Enumerator', 'Data Entry Officer', 'Viewer'];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(fetchedUsers);
      setLoading(false);
    }, (err) => {
      console.error('Failed to fetch users', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        // Update Role
        const docRef = doc(db, 'users', formData.uid);
        await updateDoc(docRef, { role: formData.role, permissions: formData.permissions });
        const oldUser = users.find(u => u.uid === formData.uid);
        await logActivity({
          action: 'UPDATE',
          entityType: 'USER',
          entityId: formData.uid,
          details: `Updated user ${formData.email} role/permissions`,
          changes: oldUser ? [
            { field: 'role', oldValue: oldUser.role, newValue: formData.role },
            { field: 'permissions', oldValue: oldUser.permissions, newValue: formData.permissions }
          ] : []
        });
        setIsModalOpen(false);
      } else {
        // Create Real Auth User via API
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            displayName: formData.displayName,
            role: formData.role, permissions: formData.permissions })
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to create user');
        }
        
        await logActivity({
          action: 'CREATE',
          entityType: 'USER',
          entityId: data.uid,
          details: `Created new user ${formData.email} (${formData.role})`
        });
        
        await logActivity({
          action: 'CREATE',
          entityType: 'USER',
          entityId: data.uid || 'unknown',
          details: `Created new user ${formData.email} (${formData.role})`
        });
        setIsModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      alert('An error occurred: ' + err.message);
    }
  };

  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    try {
      const response = await fetch(`/api/users/${resetPasswordUser.uid}/password`, {
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
        details: `Reset password for user ${resetPasswordUser.email}`
      });
      setResetPasswordUser(null);
      setNewPassword('');
      alert('Password reset successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to reset password: ' + err.message);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetch(`/api/users/${uid}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!data.success) {
          throw new Error(data.error || 'Failed to delete user');
        }
        const deletedUser = users.find(u => u.uid === uid);
        await logActivity({
          action: 'DELETE',
          entityType: 'USER',
          entityId: uid,
          details: `Deleted user ${deletedUser?.email || uid}`
        });
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete user: ' + err.message);
    }
  };

  
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
        details: `Updated ${user.email} ${field} to ${value}`,
        changes: [{ field, oldValue: user[field as keyof UserProfile], newValue: value }]
      });
      
      // Update role via API as well if needed? No, firebase triggers auth but role is only in doc for claims sync?
      // Wait, our API PUT /api/users/:uid/role handles this for us (and updates custom claims).
      // So we should call the API instead of updating doc directly!
      
      const response = await fetch(`/api/users/${uid}/role`, {
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

  const openCreateModal = () => {
    setIsEditing(false);
    setFormData({ uid: '', email: '', password: '', displayName: '', role: 'Field Agent', permissions: [] as string[] });
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    setIsEditing(true);
    setFormData({ uid: user.uid, email: user.email, password: '', displayName: user.displayName, role: user.role, permissions: user.permissions || [] });
    setIsModalOpen(true);
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If not admin, you shouldn't see this or edit this ideally, but for now we'll allow viewing if they navigated here.
  const isSuperAdminUser = profile?.email === 'kmgabadi@gmail.com' || profile?.displayName?.toLowerCase() === 'kumuri gabadi';
  const role = isSuperAdminUser ? 'Super Admin' : profile?.role;
  if (role !== 'Admin' && role !== 'Super Admin') {
    return (
      <div className={`p-8 rounded-3xl ${theme.bgClass} backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col items-center justify-center h-64 text-center`}>
        <ShieldAlert size={48} className="text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-100">Access Denied</h2>
        <p className="text-slate-400 mt-2">You need Administrator privileges to access User Management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">User Management</h2>
          <p className="text-slate-400 mt-1">Manage system users, roles, and access permissions.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: primaryColor }}
        >
          <UserPlus size={18} />
          <span>New User</span>
        </button>
      </div>

      <div className={`rounded-3xl ${theme.bgClass} backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden`}>
        <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-slate-200">System Users & Share Access</h3>
            <p className="text-xs text-slate-400 mt-1">Adjust individual access levels using the sliders below.</p>
          </div>
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-sm text-slate-100 outline-none focus:ring-1 focus:border-white/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">User</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Role</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Permissions</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Access Level</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No users found</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
                          {u.displayName ? u.displayName[0].toUpperCase() : u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">{u.displayName || 'Unnamed'}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                          value={u.role || 'Field Agent'}
                          onChange={(e) => handleInlineUpdate(u.uid, 'role', e.target.value)}
                          className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold tracking-wide px-3 py-1 outline-none cursor-pointer appearance-none text-center"
                        >
                          {roles.map(r => <option key={r} value={r} className="bg-slate-800 text-slate-200">{r}</option>)}
                        </select>
                    </td>
                    
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
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {(profile?.role === 'Super Admin' || profile?.role === 'Admin') && (
                          <button onClick={() => setResetPasswordUser(u)} title="Reset Password" className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                            <Key size={16} />
                          </button>
                        )}
                        <button onClick={() => openEditModal(u)} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(u.uid)} disabled={u.uid === profile.uid} className={`p-2 bg-white/5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${u.uid === profile.uid ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-3xl ${theme.bgClass} border border-white/10 shadow-2xl p-6`}>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl ${theme.bgClass} border border-white/10 shadow-2xl p-6`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100">{isEditing ? 'Edit User Role' : 'Create New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isEditing && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Email</label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                    <input 
                      type="password" 
                      required
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 text-slate-100" 
                    />
                  </div>
                </>
              )}

              {isEditing && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">User</label>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300">
                    {formData.displayName} ({formData.email})
                  </div>
                </div>
              )}

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


              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-sm font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 text-sm font-bold text-white rounded-full transition-transform hover:scale-105 active:scale-95" style={{ backgroundColor: primaryColor }}>
                  {isEditing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
