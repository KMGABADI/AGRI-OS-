import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';

import { THEMES } from '../store/useSettingsStore';
import { useSystemConfigStore } from '../store/useSystemConfigStore';
import { useAuth, logout } from '../lib/AuthContext';
import UploadProgressWidget from './UploadProgressWidget';
import NavigationWalkthrough from './NavigationWalkthrough';
import AgriculturalAdvisorChat from './AgriculturalAdvisorChat';
import { LayoutDashboard, Users, Settings, Leaf, Upload, Building, Building2, Activity, LogOut, ShieldAlert, Map as MapIcon, UserCircle, Shield, CalendarDays, BellRing, Wifi, WifiOff, Compass, Bot, Sparkles, X } from 'lucide-react';

export default function Layout() {

  const config = useSystemConfigStore(state => state.config);
  const appName = config?.branding?.appName || 'Agri-OS';
  const logo = config?.branding?.logo || '';
  const primaryColor = config?.branding?.primaryColor || '#16a34a';
  const settings = { features: config?.features };
  const theme = config?.theme || THEMES.frosted;
  const setTheme = useSystemConfigStore(state => state.setTheme);

  const { profile } = useAuth();
  const [isWalkthroughOpen, setIsWalkthroughOpen] = React.useState<boolean | undefined>(undefined);
  const [isAdvisorOpen, setIsAdvisorOpen] = React.useState(false);

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isSuperAdminUser = profile?.email === 'kmgabadi@gmail.com' || profile?.displayName?.toLowerCase() === 'kumuri gabadi';
  const role = isSuperAdminUser ? 'Super Admin' : (profile?.role || 'Viewer');
  
  const canViewUsers = ['Admin', 'Super Admin'].includes(role);
  const canViewFoodBank = settings.features?.enableFoodBank && ['Super Admin', 'Admin', 'Manager', 'Viewer'].includes(role);
  const canViewMap = settings.features?.enableMap && ['Super Admin', 'Admin', 'Manager', 'Field Agent', 'Enumerator', 'Viewer'].includes(role);
  const canViewOrgs = ['Super Admin', 'Admin', 'Manager', 'Viewer'].includes(role);
  const canViewWarehouses = settings.features?.enableFoodBank && ['Super Admin', 'Admin', 'Manager', 'Viewer'].includes(role);
  const canUpload = ['Super Admin', 'Admin', 'Manager', 'Data Entry Officer'].includes(role);
  const canViewMonitoring = settings.features?.enableMonitoring && ['Super Admin', 'Admin', 'Manager', 'Viewer'].includes(role);
  const canViewActivity = settings.features?.enableActivityLog && ['Super Admin', 'Admin', 'Manager'].includes(role);
  const canViewSettings = ['Super Admin', 'Admin', 'Manager'].includes(role);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Farm Advisor', icon: Bot, path: '/advisor' },
    { name: 'Profile', icon: UserCircle, path: '/profile' },
    ...(canViewUsers ? [{ name: 'User Management', icon: Shield, path: '/users' }] : []),
    { name: 'Farmers', icon: Users, path: '/farmers' },
    ...(canViewFoodBank ? [{ name: 'Food Bank', icon: Building, path: '/food-bank' }] : []),
    ...(canViewMap ? [{ name: 'GIS Map', icon: MapIcon, path: '/map' }] : []),
    { name: 'Harvest Calendar', icon: CalendarDays, path: '/calendar' },
    { name: 'Alerts', icon: BellRing, path: '/alerts' },
    ...(canViewOrgs ? [{ name: 'Organizations', icon: Building, path: '/orgs' }] : []),
    ...(canViewWarehouses ? [{ name: 'Warehouses', icon: Building2, path: '/warehouses' }] : []),
    ...(canUpload ? [{ name: 'Data Upload', icon: Upload, path: '/upload' }] : []),
    ...(canViewMonitoring ? [{ name: 'Monitoring', icon: Activity, path: '/monitoring' }] : []),
    ...(canViewActivity ? [{ name: 'Activity Log', icon: ShieldAlert, path: '/activity' }] : []),
    ...(canViewSettings ? [{ name: 'Settings', icon: Settings, path: '/settings' }] : []),
  ];

  return (
    <div className={`flex h-screen ${theme.bgClass} theme-${theme.mode || 'dark'} text-slate-100 font-sans relative overflow-hidden transition-colors duration-500`}>
      {/* Background Gradients */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${theme.gradient1} rounded-full blur-[120px] pointer-events-none transition-colors duration-700`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] ${theme.gradient2} rounded-full blur-[120px] pointer-events-none transition-colors duration-700`}></div>
      <div className={`absolute top-[20%] right-[10%] w-[30%] h-[30%] ${theme.gradient3} rounded-full blur-[100px] pointer-events-none transition-colors duration-700`}></div>

      {/* Sidebar */}
      <aside className="w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col z-10">
        <div className="h-16 flex items-center px-6 border-b border-white/10 gap-3">
          {logo ? (
            <img src={logo} alt="Logo" className="h-8 w-8 object-contain" />
          ) : (
            <div 
              className="h-8 w-8 rounded-lg shadow-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              <Leaf size={18} />
            </div>
          )}
          <span className="font-semibold text-slate-100 text-lg truncate uppercase tracking-tight">
            {appName}
          </span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const navId = `nav-link-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
              return (
                <li key={item.name}>
                  <NavLink
                    id={navId}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-white/10 text-slate-100 font-medium border border-white/20'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`
                    }
                  >
                    <item.icon size={20} />
                    {item.name}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden z-10">
        <header className="h-16 bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
             <span className="text-sm opacity-80 font-medium">Theme:</span>
             <select 
                value={theme.id}
                onChange={(e) => setTheme(THEMES[e.target.value])}
                className="bg-white/10 border border-white/10 rounded px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-white/30 text-slate-200 [&>option]:bg-slate-800"
             >
                {Object.values(THEMES).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
             </select>
          </div>
          <div className="flex items-center gap-4">
             {/* Quick Walkthrough / Tour Trigger */}
             <button
               id="btn-header-walkthrough"
               type="button"
               onClick={() => setIsWalkthroughOpen(true)}
               title="Start Platform Walkthrough"
               className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors shadow-sm"
             >
               <Compass size={14} className="text-emerald-400" />
               <span className="hidden sm:inline">Feature Tour</span>
             </button>

             {isOnline ? (
               <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 mr-2">
                 <Wifi size={14} /> 
                 <span className="hidden sm:inline">System Online</span>
               </div>
             ) : (
               <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-400 font-bold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 mr-2 shadow-[0_0_10px_rgba(245,158,11,0.15)] animate-pulse">
                 <WifiOff size={14} /> 
                 <span className="hidden sm:inline">Offline Mode (Local Save)</span>
               </div>
             )}
             
             {profile && (
               <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                 {profile.photoURL ? (
                   <img src={profile.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
                 ) : (
                   <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                     {profile.displayName?.charAt(0) || 'U'}
                   </div>
                 )}
                 <div className="flex flex-col">
                   <span className="text-xs font-semibold leading-none">{profile.displayName || profile.email}</span>
                   <span className="text-[10px] text-slate-400 font-mono leading-none mt-1">{role}</span>
                 </div>
               </div>
             )}

             <button onClick={logout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-red-400 ml-2">
                <LogOut size={18} />
             </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 relative">
          <Outlet />

          {/* Floating Farm Advisor Quick Launcher */}
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {!isAdvisorOpen && (
              <button
                type="button"
                onClick={() => setIsAdvisorOpen(true)}
                title="Open Agricultural Farm Advisor & Extension Chat"
                className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full shadow-2xl hover:shadow-emerald-500/40 font-bold text-sm transition-all transform hover:scale-105 active:scale-95 border border-emerald-400/30"
              >
                <Bot size={20} className="animate-pulse" />
                <span className="hidden sm:inline">Farm Advisor</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
              </button>
            )}

            {/* Floating Advisor Slide-in Card */}
            {isAdvisorOpen && (
              <div className="w-[92vw] sm:w-[480px] h-[620px] bg-slate-900/95 border border-emerald-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-300">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Bot size={18} />
                    </div>
                    <span className="font-bold text-sm text-white">Farm Advisor & Agronomist</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdvisorOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-2">
                  <AgriculturalAdvisorChat isFloating={true} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightweight Walkthrough for New Users */}
      <NavigationWalkthrough 
        userId={profile?.uid}
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
      />
    </div>
  );
}
