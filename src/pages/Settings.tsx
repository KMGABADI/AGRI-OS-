import React, { useRef, useState } from 'react';
import DashboardEditor from '../components/DashboardEditor';

import { useSystemConfigStore } from '../store/useSystemConfigStore';
import { THEMES } from '../store/useSettingsStore';
import { Image as ImageIcon, Check, LayoutDashboard, Users } from 'lucide-react';
import UserManagement from './UserManagement';
import { useAuth } from '../lib/AuthContext';

export default function Settings() {

  const [activeTab, setActiveTab] = useState<'general' | 'dashboard' | 'users'>('general');

  
  
  const { profile } = useAuth();

  const configState = useSystemConfigStore();
  const config = configState.config;
  const updateDashboard = configState.updateDashboard;
  const setTheme = configState.setTheme;
  const updateFeatures = configState.updateFeatures;
  const updateBranding = configState.updateBranding;

  const dashboard = config?.dashboard || { showStats: true, showCropChart: true, showScoreChart: true, showRecentInterventions: true };
  const theme = config?.theme || THEMES.frosted;
  const features = config?.features || { enableFoodBank: true, enableMonitoring: true, enableActivityLog: true, enableMap: true, enableFarmerTemplate: true };
  const appName = config?.branding?.appName || 'Agri-OS';
  const logo = config?.branding?.logo || '';
  const primaryColor = config?.branding?.primaryColor || '#16a34a';

  const isSuperAdminUser = profile?.email === 'kmgabadi@gmail.com' || profile?.displayName?.toLowerCase() === 'kumuri gabadi';
  const isAdmin = isSuperAdminUser || profile?.role === 'Super Admin' || profile?.role === 'Admin';
  
  const safeUpdate = (updateFn) => (val) => {
    if (!isAdmin) return;
    updateFn(val);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const colors = [
    '#16a34a', // Green
    '#2563eb', // Blue
    '#ea580c', // Orange
    '#db2777', // Pink
    '#7c3aed', // Purple
    '#475569', // Slate
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        safeUpdate(updateBranding)({ logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">System Settings</h2>
          <p className="text-slate-400">Manage application configuration and dashboard layouts.</p>
        </div>
      </div>

      <div className="flex border-b border-white/10 mb-6">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'general' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          General & Branding
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Dashboard Editor
          </button>
        )}
      </div>

      {activeTab === 'general' && (
        <div className="space-y-8 max-w-3xl">


      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h3 className="text-lg font-bold text-slate-100">Application Details</h3>
          <p className="text-sm text-slate-400 mt-1">Update your company name and logo.</p>
        </div>
        <div className="p-6 space-y-6">
          
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Application Name</label>
            <input disabled={!isAdmin} 
              type="text" 
              value={appName}
              onChange={(e) => safeUpdate(updateBranding)({ appName: e.target.value })}
              className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-opacity-50 text-slate-100 focus:border-transparent transition-colors"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Company Logo</label>
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5 overflow-hidden relative">
                {logo ? (
                  <img src={logo} alt="Logo preview" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="text-slate-500" size={24} />
                )}
              </div>
              <div>
                <input disabled={!isAdmin} 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleLogoUpload} 
                  accept="image/*"
                  className="hidden" 
                />
                <button disabled={!isAdmin} 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 shadow-sm transition-colors"
                >
                  Upload new image
                </button>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">PNG, JPG, or SVG. Max 2MB.</p>
              </div>
              {logo && (
                <button disabled={!isAdmin} 
                  onClick={() => safeUpdate(updateBranding)({ logo: '' })}
                  className="text-sm text-red-400 hover:text-red-300 font-semibold transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h3 className="text-lg font-bold text-slate-100">Application Theme</h3>
          <p className="text-sm text-slate-400 mt-1">Choose the overall visual style of the application.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(THEMES).map((t) => (
            <button
              key={t.id}
              onClick={() => safeUpdate(setTheme)(t)}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme.id === t.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-white/30 bg-white/5'}`}
            >
              <div className={`w-full h-16 rounded-lg ${t.bgClass} ${t.gradient1} border border-white/10`} />
              <span className="text-sm font-semibold text-slate-200">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl overflow-hidden relative">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h3 className="text-lg font-bold text-slate-100">Accent Colors</h3>
          <p className="text-sm text-slate-400 mt-1">Choose a primary color for the interface.</p>
        </div>
        <div className="p-6">
          <div className="flex gap-4">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => safeUpdate(updateBranding)({ primaryColor: color })}
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-slate-900 transition-transform hover:scale-110 border border-white/10"
                style={{ backgroundColor: color, '--tw-ring-color': color } as React.CSSProperties}
              >
                {primaryColor === color && <Check size={20} className="text-white drop-shadow-md" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(profile?.role === 'Admin' || profile?.role === 'Super Admin' || profile?.email === 'kmgabadi@gmail.com') && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl overflow-hidden relative">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <h3 className="text-lg font-bold text-slate-100">System Features</h3>
            <p className="text-sm text-slate-400 mt-1">Enable or disable modules for all users. (Admin Only)</p>
          </div>
          <div className="p-6 space-y-6">
            
            {/* Feature Toggle Item */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-slate-200 font-semibold text-sm">Food Bank Module</h4>
                <p className="text-xs text-slate-400 mt-1">Enable warehouse and commodity tracking across regions.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input disabled={!isAdmin} type="checkbox" className="sr-only peer" checked={features?.enableFoodBank ?? true} onChange={(e) => safeUpdate(updateFeatures)({ enableFoodBank: e.target.checked })} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-slate-200 font-semibold text-sm">GIS Map</h4>
                <p className="text-xs text-slate-400 mt-1">Enable the geographic distribution map.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input disabled={!isAdmin} type="checkbox" className="sr-only peer" checked={features?.enableMap ?? true} onChange={(e) => safeUpdate(updateFeatures)({ enableMap: e.target.checked })} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-slate-200 font-semibold text-sm">Monitoring</h4>
                <p className="text-xs text-slate-400 mt-1">Enable intervention and program monitoring dashboards.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input disabled={!isAdmin} type="checkbox" className="sr-only peer" checked={features?.enableMonitoring ?? true} onChange={(e) => safeUpdate(updateFeatures)({ enableMonitoring: e.target.checked })} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>


            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-slate-200 font-semibold text-sm">Farmer Info Template</h4>
                <p className="text-xs text-slate-400 mt-1">Enable farmer info template update via upload or creation.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input disabled={!isAdmin} type="checkbox" className="sr-only peer" checked={features?.enableFarmerTemplate ?? true} onChange={(e) => safeUpdate(updateFeatures)({ enableFarmerTemplate: e.target.checked })} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-slate-200 font-semibold text-sm">Activity Log</h4>
                <p className="text-xs text-slate-400 mt-1">Enable the system-wide activity audit logs.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input disabled={!isAdmin} type="checkbox" className="sr-only peer" checked={features?.enableActivityLog ?? true} onChange={(e) => safeUpdate(updateFeatures)({ enableActivityLog: e.target.checked })} />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

          </div>
        </div>
      )}

      {(profile?.role === 'Super Admin' || profile?.email === 'kmgabadi@gmail.com') && (
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-xl overflow-hidden relative mt-8">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <h3 className="text-lg font-bold text-slate-100">Database Administration</h3>
            <p className="text-sm text-slate-400 mt-1">Direct links to backend infrastructure. (Super Admin Only)</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
              <div>
                <h4 className="text-slate-200 font-semibold text-sm">Firebase Firestore Database</h4>
                <p className="text-xs text-slate-400 mt-1">View and manage raw application data, collections, and security rules.</p>
              </div>
              <a 
                href="https://console.firebase.google.com/project/utilitarian-habitat-q4dh4/firestore/data" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                Open Firebase Console
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>
        </div>
      )}
      </div>
      )}

      {activeTab === 'dashboard' && isAdmin && (
        <DashboardEditor />
      )}
      {activeTab === 'users' && isAdmin && (
        <UserManagement />
      )}
    </div>
  );
}
