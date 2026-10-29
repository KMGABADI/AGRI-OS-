import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useSettingsStore, THEMES } from '../store/useSettingsStore';
import { useBrandingStore } from '../store/useBrandingStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Shield, CheckCircle2, UserCircle } from 'lucide-react';

export default function Profile() {
  const { user, profile } = useAuth();
  const { primaryColor } = useBrandingStore();
  const settings = useSettingsStore();
  const theme = settings.theme || THEMES.frosted;

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!user || !profile) return <div>Loading...</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        displayName
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const isSuperAdminUser = profile?.email === 'kmgabadi@gmail.com' || profile?.displayName?.toLowerCase() === 'kumuri gabadi';
  const role = isSuperAdminUser ? 'Super Admin' : (profile?.role || 'Viewer');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">User Profile</h2>
        <p className="text-slate-400">Manage your personal information and system role.</p>
      </div>

      <div className={`p-8 rounded-3xl ${theme.bgClass} backdrop-blur-2xl border border-white/10 shadow-2xl`}>
        <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-8">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-slate-800 shadow-xl" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 shadow-xl flex items-center justify-center">
              <UserCircle size={48} className="text-slate-500" />
            </div>
          )}
          
          <div>
            <h3 className="text-2xl font-bold text-slate-100">{profile.displayName || 'Unnamed User'}</h3>
            <p className="text-slate-400 font-mono text-sm mt-1">{profile.email}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                <Shield size={14} />
                {role}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
              <input 
                type="text" 
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm outline-none focus:ring-1 focus:border-white/30 text-slate-100 transition-all" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Email Address (Read Only)</label>
              <input 
                type="email" 
                disabled
                value={profile.email}
                className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-slate-500 cursor-not-allowed" 
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-white/10">
            {success ? (
              <span className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 size={18} /> Profile updated
              </span>
            ) : <div />}
            
            <button 
              type="submit" 
              disabled={isSaving}
              className={`px-8 py-3 rounded-full text-white font-bold shadow-lg transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{ backgroundColor: primaryColor }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
