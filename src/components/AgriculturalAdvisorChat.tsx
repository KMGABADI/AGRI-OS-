import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  MapPin, 
  ExternalLink, 
  RefreshCw, 
  User, 
  Trash2, 
  Compass, 
  Store, 
  HelpCircle,
  Wheat,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, limit } from 'firebase/firestore';

export interface GroundingChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: Array<{ text?: string }>;
    };
  };
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  groundingChunks?: GroundingChunk[];
}

const SUGGESTED_QUERIES = [
  {
    label: "Local Grain Silos",
    text: "Where are the nearest commercial grain storage silos, aggregators, or warehouses to store maize and sorghum?",
    icon: Store
  },
  {
    label: "Agro-Dealers & Seeds",
    text: "Find certified agro-input dealers, seed suppliers, and fertilizer outlets around my area.",
    icon: Wheat
  },
  {
    label: "Pest & Armyworm Control",
    text: "What is the recommended IPM protocol and chemical control for Fall Armyworm on 2-hectare maize?",
    icon: AlertTriangle
  },
  {
    label: "Extension & Research Centers",
    text: "Locate government agricultural extension offices, ADP centers, or research institutes nearby.",
    icon: Compass
  }
];

export default function AgriculturalAdvisorChat({ isFloating = false }: { isFloating?: boolean }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Detecting location...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect location for Google Maps grounding
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationStatus('GPS active (Maps Grounded)');
        },
        (error) => {
          console.warn('Geolocation denied or unavailable:', error.message);
          // Default to central agricultural region (e.g., Nigeria agricultural corridor Abuja/Kaduna)
          setUserLocation({
            latitude: 9.0765,
            longitude: 7.3986
          });
          setLocationStatus('Central Agri Region (Default)');
        },
        { timeout: 10000 }
      );
    } else {
      setUserLocation({
        latitude: 9.0765,
        longitude: 7.3986
      });
      setLocationStatus('Central Agri Region (Default)');
    }
  }, []);

  // Load chat history from Firestore if available
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, 'chatMessages'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'asc'),
          limit(50)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;
        if (!snap.empty) {
          const loaded: ChatMessage[] = snap.docs.map(d => ({
            id: d.id,
            role: d.data().role,
            text: d.data().text,
            timestamp: d.data().timestamp,
            groundingChunks: d.data().groundingChunks || []
          }));
          setMessages(loaded);
        } else {
          // Default welcome message
          setMessages([
            {
              role: 'model',
              text: `**Welcome to the Agri-OS Farm Advisory & Extension Service!**\n\nI am your Agronomist and Agricultural Advisor powered by Gemini 3.8 and live Google Maps data.\n\nAsk me for crop management protocols, fertilizer schedules, pest diagnostics, or ask me to **locate local silos, warehouses, seed dealers, and agricultural centers** near your farms.`,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      } catch (err) {
        console.warn('Could not load past chat messages from Firestore, continuing with local state:', err);
        if (messages.length === 0) {
          setMessages([
            {
              role: 'model',
              text: `**Welcome to the Agri-OS Farm Advisory & Extension Service!**\n\nI am your Agronomist and Agricultural Advisor powered by Gemini 3.8 with real-time Google Maps grounding.\n\nAsk me about agronomy, crop protection, yield improvements, or local silos and agricultural centers!`,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [user?.uid]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    setErrorMessage(null);

    const userMsg: ChatMessage = {
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    // Save user message to Firestore
    if (user?.uid) {
      addDoc(collection(db, 'chatMessages'), {
        userId: user.uid,
        role: 'user',
        text,
        timestamp: userMsg.timestamp
      }).catch(err => console.warn('Failed saving user chat message:', err));
    }

    try {
      // Prepare payload for backend endpoint
      const payloadMessages = newMessages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: payloadMessages,
          location: userLocation
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const modelMsg: ChatMessage = {
        role: 'model',
        text: data.text || 'Advice generated successfully.',
        timestamp: new Date().toISOString(),
        groundingChunks: data.groundingChunks || []
      };

      setMessages([...newMessages, modelMsg]);

      // Save model message to Firestore
      if (user?.uid) {
        addDoc(collection(db, 'chatMessages'), {
          userId: user.uid,
          role: 'model',
          text: modelMsg.text,
          timestamp: modelMsg.timestamp,
          groundingChunks: modelMsg.groundingChunks || []
        }).catch(err => console.warn('Failed saving model chat message:', err));
      }
    } catch (err: any) {
      console.error('Chat advisory error:', err);
      const errStr = err.message || '';
      if (errStr.includes('429') || errStr.toLowerCase().includes('quota')) {
        setErrorMessage('Gemini API request limit reached. You can try again shortly or configure a custom API key under Settings > Secrets.');
      } else if (errStr.includes('403') || errStr.toLowerCase().includes('permission_denied')) {
        setErrorMessage('Access denied by Gemini API. Please verify project API permissions in Settings > Secrets.');
      } else {
        setErrorMessage(errStr || 'An error occurred while contacting the Agronomist service.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your consultation history?')) return;
    setMessages([
      {
        role: 'model',
        text: 'Consultation history cleared. How can I assist your farm operations today?',
        timestamp: new Date().toISOString()
      }
    ]);

    if (user?.uid) {
      try {
        const q = query(collection(db, 'chatMessages'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          deleteDoc(doc(db, 'chatMessages', d.id));
        });
      } catch (err) {
        console.warn('Failed clearing Firestore messages:', err);
      }
    }
  };

  // Helper to render markdown bold, headers, and lists
  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return (
      <div className="space-y-1.5 text-sm leading-relaxed">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={i} className="font-bold text-emerald-300 text-base mt-2 mb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={i} className="font-bold text-emerald-200 text-lg mt-3 mb-1 border-b border-emerald-500/20 pb-0.5">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={i} className="font-extrabold text-white text-xl mt-4 mb-2">
                {trimmed.replace('# ', '')}
              </h2>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.substring(2);
            return (
              <div key={i} className="flex items-start gap-2 ml-2">
                <span className="text-emerald-400 mt-1.5 text-xs">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
              </div>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            const numberMatch = trimmed.match(/^(\d+)\.\s(.*)/);
            if (numberMatch) {
              return (
                <div key={i} className="flex items-start gap-2 ml-2">
                  <span className="font-semibold text-emerald-400 text-xs mt-0.5">{numberMatch[1]}.</span>
                  <span dangerouslySetInnerHTML={{ __html: formatInline(numberMatch[2]) }} />
                </div>
              );
            }
          }
          if (trimmed === '') {
            return <div key={i} className="h-1.5" />;
          }
          return (
            <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
          );
        })}
      </div>
    );
  };

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-emerald-200">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-slate-300">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 text-xs font-mono">$1</code>');
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${isFloating ? 'max-h-[600px]' : 'min-h-[620px]'}`}>
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-900/80 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50">
            <Bot size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base leading-tight">Agri-OS Farm Advisor & Agronomist</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-semibold">
                <Sparkles size={11} /> Gemini 3.8 Flash
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <MapPin size={12} /> {locationStatus}
              </span>
              <span>•</span>
              <span>Google Maps Grounded</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              className={`flex gap-3 max-w-[88%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                isUser 
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' 
                  : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isUser ? (
                  profile?.photoURL ? (
                    <img src={profile.photoURL} alt="Avatar" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <User size={16} />
                  )
                ) : (
                  <Bot size={16} />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`rounded-2xl p-4 shadow-md ${
                isUser 
                  ? 'bg-blue-600/20 text-slate-100 border border-blue-500/30 rounded-tr-none' 
                  : 'bg-white/5 text-slate-200 border border-white/10 rounded-tl-none'
              }`}>
                {isUser ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  renderFormattedText(msg.text)
                )}

                {/* Grounding Places Cards (Google Maps Grounding) */}
                {!isUser && msg.groundingChunks && msg.groundingChunks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      <MapPin size={13} />
                      <span>Verified Google Maps Locations & Centers ({msg.groundingChunks.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {msg.groundingChunks.map((chunk, cIdx) => {
                        const mapsPlace = chunk.maps;
                        const webPlace = chunk.web;
                        const title = mapsPlace?.title || webPlace?.title || 'Agricultural Center / Silo';
                        const uri = mapsPlace?.uri || webPlace?.uri;
                        const snippet = mapsPlace?.placeAnswerSources?.reviewSnippets?.[0]?.text;

                        if (!uri && !title) return null;

                        return (
                          <a
                            key={cIdx}
                            href={uri || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col p-2.5 bg-black/40 hover:bg-emerald-950/40 border border-white/10 hover:border-emerald-500/40 rounded-xl transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-slate-200 group-hover:text-emerald-300 truncate">
                                {title}
                              </span>
                              <ExternalLink size={12} className="text-slate-400 group-hover:text-emerald-400 flex-shrink-0 ml-1" />
                            </div>
                            {snippet && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {snippet}
                              </p>
                            )}
                            <span className="text-[10px] text-emerald-400/80 mt-1 font-mono">
                              View on Google Maps →
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-2 text-[10px] text-slate-500 flex justify-end">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-[80%] mr-auto items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 flex items-center gap-3">
              <RefreshCw size={16} className="text-emerald-400 animate-spin" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-300">Consulting Agricultural Database & Maps Grounding...</span>
                <span className="text-[11px] text-slate-500">Querying gemini-3.8-flash with live facility search</span>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 bg-black/20 border-t border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
          <HelpCircle size={12} /> Prompts:
        </span>
        {SUGGESTED_QUERIES.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(q.text)}
            disabled={isLoading}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/30 rounded-full text-xs text-slate-300 hover:text-emerald-200 transition-colors"
          >
            <q.icon size={12} className="text-emerald-400" />
            <span>{q.label}</span>
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-white/5 border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about crops, fertilizers, pest control, or locate nearby silos and suppliers..."
            disabled={isLoading}
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="flex items-center justify-center p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all shadow-lg hover:shadow-emerald-600/30 active:scale-95"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
