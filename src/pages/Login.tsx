import React, { useState } from 'react';
import { googleSignIn, guestSignIn, emailSignIn, emailSignUp } from '../lib/AuthContext';
import { Leaf, ShieldCheck, Mail } from 'lucide-react';
import { useBrandingStore } from '../store/useBrandingStore';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { appName, logo, primaryColor } = useBrandingStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError('');
    try {
      await googleSignIn();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/30 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          {logo ? (
            <img src={logo} alt="Logo" className="h-16 w-16 object-contain mb-4" />
          ) : (
            <div 
              className="h-16 w-16 rounded-2xl shadow-lg flex items-center justify-center text-white mb-4"
              style={{ backgroundColor: primaryColor }}
            >
              <Leaf size={32} />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 uppercase">{appName}</h1>
          <p className="text-slate-400 mt-2">Agricultural Operating System</p>
        </div>

        <div className="space-y-4">
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl hover:shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShieldCheck size={22} className="text-emerald-200" />
            <span>Enter with Full Access (No Login)</span>
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase tracking-wider">Or Sign In with Account</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {error && <p className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">{error}</p>}

          <button 
            type="button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors shadow-xl"
          >
            {isLoggingIn ? (
              <span className="animate-pulse">Authenticating...</span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48" className="flex-shrink-0">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              <Mail size={16} />
              <span>Sign in with Email</span>
            </button>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsLoggingIn(true);
              setError('');
              try {
                if (isRegistering) {
                  await emailSignUp(email, password);
                } else {
                  await emailSignIn(email, password);
                }
                navigate('/');
              } catch (err: any) {
                setError(err.message || (isRegistering ? 'Failed to register' : 'Failed to sign in'));
                setIsLoggingIn(false);
              }
            }} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none focus:ring-1 focus:border-white/30"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Password</label>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-slate-200 text-sm outline-none focus:ring-1 focus:border-white/30"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 transition-colors shadow-xl"
              >
                {isLoggingIn ? 'Authenticating...' : (isRegistering ? 'Sign Up' : 'Sign In')}
              </button>
              <div className="text-center text-xs">
                <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-slate-400 hover:text-white transition-colors">
                  {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}