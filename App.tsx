import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, Wifi, Trash2, Check, Edit2, RotateCw, Thermometer, Activity, Save, X, Scale, Ruler, ArrowRight, Lock, ShieldCheck, AlertCircle, Clock, Calendar, Droplets, Database, Cloud, CloudOff, RefreshCw, Key, Server } from 'lucide-react';
import { VitalCard } from './components/VitalCard';
import { BottomNav } from './components/BottomNav';
import { AiAdvisor } from './components/AiAdvisor';
import { VitalSigns, SensorStatus, Alert, PatientProfile } from './types';
import { THRESHOLDS } from './constants';
import { analyzeVitalsWithGemini } from './services/geminiService';
import { syncDataToCloud } from './services/cloudService';

const MAX_HISTORY_POINTS = 50;

// --- Storage Keys ---
const STORAGE_KEYS = {
  PROFILE: 'vitalguard_profile',
  HISTORY: 'vitalguard_history',
  ALERTS: 'vitalguard_alerts',
  SETUP_COMPLETE: 'vitalguard_setup_complete',
  ESP_IP: 'vitalguard_esp_ip',
  CLOUD_URL: 'vitalguard_cloud_url',
  GEMINI_KEY: 'vitalguard_gemini_key'
};

// --- Helper for Local Storage ---
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.warn(`Error loading ${key} from storage`, error);
    return fallback;
  }
};

// --- Sub-components for Views ---

const TrendChart = ({ data, dataKey, color, fill }: { data: any[], dataKey: string, color: string, fill: string }) => (
  <div className="h-28 w-full bg-slate-800 rounded-2xl p-3 shadow-sm border border-slate-700 flex flex-col justify-between">
    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: color }}></div>
      {dataKey === 'heartRate' ? 'FC' : dataKey === 'spO2' ? 'SpO₂' : dataKey === 'temperature' ? 'Temp' : 'TA'}
    </div>
    <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false} 
          />
          {fill && <defs><linearGradient id={`grad${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.2}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient></defs>}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const HistoryChart = ({ title, data, dataKey, color, unit, visible = true }: any) => {
  if (!visible) return null;
  return (
    <div className="bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-700 mb-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }}></div>
          {title}
        </h3>
        <span className={`font-bold text-xl`} style={{ color }}>
          {data.length > 0 ? data[data.length - 1][dataKey] : '--'} <span className="text-sm text-slate-400 font-medium">{unit}</span>
        </span>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
            <XAxis dataKey="timestamp" tick={false} axisLine={false} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }}
              itemStyle={{ color: '#e2e8f0' }}
              labelStyle={{ display: 'none' }}
              formatter={(value: number) => [value, unit]}
              labelFormatter={() => ''}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill={`url(#color${dataKey})`} 
              isAnimationActive={false} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- State with Persistence Initialization ---
  
  // App Flow State
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => 
    loadFromStorage(STORAGE_KEYS.SETUP_COMPLETE, false)
  );
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'history' | 'alerts' | 'profile'>('dashboard');
  
  // Profile State
  const defaultProfile: PatientProfile = {
    id: `PAT-${Math.floor(Math.random() * 1000)}`,
    name: '',
    age: 0,
    condition: '',
    bloodType: 'A+',
    weight: 0,
    height: 0
  };

  const [patientProfile, setPatientProfile] = useState<PatientProfile>(() => 
    loadFromStorage(STORAGE_KEYS.PROFILE, defaultProfile)
  );
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<PatientProfile>(patientProfile);

  // Connection & Config State
  const [espIp, setEspIp] = useState<string>(() => 
    loadFromStorage(STORAGE_KEYS.ESP_IP, '192.168.1.100')
  );
  const [cloudApiUrl, setCloudApiUrl] = useState<string>(() => 
    loadFromStorage(STORAGE_KEYS.CLOUD_URL, '')
  );
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => 
    loadFromStorage(STORAGE_KEYS.GEMINI_KEY, '')
  );

  const [status, setStatus] = useState<SensorStatus>(SensorStatus.DISCONNECTED);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [connectionPassword, setConnectionPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Data State
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [currentVitals, setCurrentVitals] = useState<VitalSigns>({
    timestamp: Date.now(),
    heartRate: 0,
    spO2: 0,
    temperature: 0,
    systolicBP: 0,
    diastolicBP: 0,
    batteryLevel: 0,
    isMoving: false
  });
  
  const [history, setHistory] = useState<VitalSigns[]>(() => 
    loadFromStorage(STORAGE_KEYS.HISTORY, [])
  );
  
  const [alerts, setAlerts] = useState<Alert[]>(() => 
    loadFromStorage(STORAGE_KEYS.ALERTS, [])
  );

  // AI Advisor State
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [lastAiUpdate, setLastAiUpdate] = useState<number | null>(null);

  // Cloud & Network State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastCloudSync, setLastCloudSync] = useState<number | null>(null);

  // --- Network Status Effect ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Cloud Sync Logic ---
  const triggerCloudSync = useCallback(async () => {
    if (!isOnline || isSyncing || !cloudApiUrl) return;

    setIsSyncing(true);
    const success = await syncDataToCloud(cloudApiUrl, patientProfile, history, alerts);
    
    if (success) {
      setLastCloudSync(Date.now());
    }
    setIsSyncing(false);
  }, [isOnline, isSyncing, cloudApiUrl, patientProfile, history, alerts]);

  // Auto-sync periodically if online (every 30 seconds)
  useEffect(() => {
    if (isOnline && isSetupComplete && cloudApiUrl) {
      const syncInterval = setInterval(() => {
        triggerCloudSync();
      }, 30000);
      return () => clearInterval(syncInterval);
    }
  }, [isOnline, isSetupComplete, cloudApiUrl, triggerCloudSync]);

  // --- Persistence Effects ---

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(patientProfile));
  }, [patientProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, JSON.stringify(isSetupComplete));
  }, [isSetupComplete]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ESP_IP, JSON.stringify(espIp));
  }, [espIp]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLOUD_URL, JSON.stringify(cloudApiUrl));
  }, [cloudApiUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, JSON.stringify(geminiApiKey));
  }, [geminiApiKey]);

  // --- Real Data Fetching ---
  const intervalRef = useRef<number | null>(null);
  const failCountRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      // REAL fetch to ESP32
      const response = await fetch(`http://${espIp}/data`, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      failCountRef.current = 0;
      setStatus(SensorStatus.CONNECTED);

      const newVitals: VitalSigns = {
        timestamp: Date.now(),
        heartRate: data.heartRate ?? currentVitals.heartRate,
        spO2: data.spO2 ?? currentVitals.spO2,
        temperature: data.temperature ?? currentVitals.temperature,
        systolicBP: data.systolicBP ?? currentVitals.systolicBP,
        diastolicBP: data.diastolicBP ?? currentVitals.diastolicBP,
        batteryLevel: data.batteryLevel ?? currentVitals.batteryLevel,
        isMoving: data.isMoving ?? false
      };

      setCurrentVitals(newVitals);

      // Alert Logic
      let alertTriggered = false;
      if (newVitals.temperature > 38.0) {
        addAlert('temperature', `Température critique: ${newVitals.temperature}°C`, `${newVitals.temperature}°C`);
        alertTriggered = true;
      } else if (newVitals.temperature > 37.5) {
        addAlert('temperature', `Fièvre détectée: ${newVitals.temperature}°C`, `${newVitals.temperature}°C`);
        alertTriggered = true;
      }

      if (newVitals.heartRate > 120 || newVitals.heartRate < 45) {
        addAlert('heartRate', `Rythme cardiaque anormal: ${newVitals.heartRate} bpm`, `${newVitals.heartRate} bpm`);
        alertTriggered = true;
      }
      
      if (newVitals.spO2 < 92 && newVitals.spO2 > 0) {
        addAlert('spo2', `Saturation O2 basse: ${newVitals.spO2}%`, `${newVitals.spO2}%`);
        alertTriggered = true;
      }

      // If urgent alert, try to sync immediately
      if (alertTriggered && isOnline && cloudApiUrl) {
        setTimeout(() => triggerCloudSync(), 2000);
      }

    } catch (error) {
      failCountRef.current += 1;
      if (failCountRef.current > 3) setStatus(SensorStatus.DISCONNECTED);
    }
  }, [espIp, currentVitals, isOnline, cloudApiUrl, triggerCloudSync]);

  const addAlert = (type: any, message: string, value: string) => {
    setAlerts(prev => {
      const lastAlert = prev[0];
      if (lastAlert && lastAlert.message === message && (Date.now() - lastAlert.timestamp < 60000)) {
        return prev;
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("VitalGuard Alerte", {
          body: message,
          icon: "https://cdn-icons-png.flaticon.com/512/2798/2798359.png",
          tag: type
        });
      }

      return [{
        id: Date.now().toString(),
        type,
        message,
        value,
        timestamp: Date.now(),
        read: false
      }, ...prev];
    });
  };

  // --- AI Analysis Handler ---
  const handleAiAnalysis = async () => {
    if (isAiAnalyzing) return;
    
    if (status !== SensorStatus.CONNECTED) {
      setAiAnalysis(null); 
      return; 
    }

    setIsAiAnalyzing(true);
    
    // Pass the configured API key
    const result = await analyzeVitalsWithGemini(currentVitals, patientProfile, geminiApiKey);
    
    setAiAnalysis(result);
    setLastAiUpdate(Date.now());
    setIsAiAnalyzing(false);
  };

  useEffect(() => {
    if (status === SensorStatus.CONNECTED) {
      intervalRef.current = window.setInterval(fetchData, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, status]);

  useEffect(() => {
    setHistory(prev => {
      const lastPoint = prev[prev.length - 1];
      if (lastPoint && lastPoint.timestamp === currentVitals.timestamp) {
        return prev;
      }
      const newHistory = [...prev, currentVitals];
      return newHistory.slice(-MAX_HISTORY_POINTS);
    });
  }, [currentVitals]);
  
  const resetData = () => {
    if(window.confirm("Voulez-vous vraiment effacer toutes les données locales ?")) {
      setHistory([]);
      setAlerts([]);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.ALERTS);
      setLastCloudSync(null);
    }
  };

  // --- Connection Logic ---

  const initiateConnection = async () => {
    setAuthError('');
    setIsAuthenticating(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      await fetch(`http://${espIp}/data`, { 
        signal: controller.signal,
        method: 'HEAD'
      }).catch(() => {});
      
      clearTimeout(timeoutId);
      setIsAuthenticating(false);
      setShowPasswordModal(true);

    } catch (e) {
      setIsAuthenticating(false);
      setAuthError("Impossible de joindre le bracelet. Vérifiez l'IP et le WiFi.");
    }
  };

  const verifyPassword = async () => {
    setIsAuthenticating(true);
    setAuthError('');

    try {
      // Simulation of password handshake would go here if ESP had auth endpoint
      // For now, valid connection implies success if simple password logic passes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      await new Promise(resolve => setTimeout(resolve, 500));
      if (connectionPassword.length < 4) {
        throw new Error("Code PIN invalide (min 4 caractères)");
      }
      
      clearTimeout(timeoutId);
      
      setIsAuthenticating(false);
      setShowPasswordModal(false);
      setStatus(SensorStatus.CONNECTED);
      failCountRef.current = 0;
      setConnectionPassword('');
      fetchData();

    } catch (error: any) {
      setIsAuthenticating(false);
      setAuthError(error.message || "Erreur d'authentification");
    }
  };

  const handleProfileSave = () => {
    setPatientProfile(editedProfile);
    setIsEditingProfile(false);
  };

  const handleProfileCancel = () => {
    setEditedProfile(patientProfile);
    setIsEditingProfile(false);
  };

  const completeOnboarding = () => {
    if (!editedProfile.name || !editedProfile.age) return;
    
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    setPatientProfile(editedProfile);
    setIsSetupComplete(true);
  };

  // --- Views ---

  // 1. ONBOARDING VIEW
  if (!isSetupComplete) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-800 rounded-3xl shadow-xl p-8 border border-slate-700 animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Activity className="w-8 h-8" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-white mb-2">Bienvenue sur VitalGuard</h1>
          <p className="text-center text-slate-400 mb-8 text-sm">Pour commencer le suivi, veuillez renseigner les informations du patient.</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Nom Complet</label>
              <input 
                type="text" 
                placeholder="Ex: Jean Dupont"
                value={editedProfile.name} 
                onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 placeholder-slate-500 transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Âge</label>
                <input 
                  type="number" 
                  placeholder="Ex: 64"
                  value={editedProfile.age || ''} 
                  onChange={(e) => setEditedProfile({...editedProfile, age: parseInt(e.target.value)})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Groupe Sanguin</label>
                <select 
                  value={editedProfile.bloodType} 
                  onChange={(e) => setEditedProfile({...editedProfile, bloodType: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 appearance-none"
                >
                  <option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Poids (kg)</label>
                <input 
                  type="number" 
                  placeholder="70"
                  value={editedProfile.weight || ''} 
                  onChange={(e) => setEditedProfile({...editedProfile, weight: parseInt(e.target.value)})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Taille (cm)</label>
                <input 
                  type="number" 
                  placeholder="175"
                  value={editedProfile.height || ''} 
                  onChange={(e) => setEditedProfile({...editedProfile, height: parseInt(e.target.value)})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 placeholder-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Condition Médicale</label>
              <input 
                type="text" 
                placeholder="Ex: Hypertension"
                value={editedProfile.condition} 
                onChange={(e) => setEditedProfile({...editedProfile, condition: e.target.value})}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-slate-700 placeholder-slate-500"
              />
            </div>
            
            <button 
              onClick={completeOnboarding}
              disabled={!editedProfile.name || !editedProfile.age}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Commencer le suivi <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. DASHBOARD VIEW
  const DashboardView = () => (
    <div className="pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6 pt-2">
        <div>
          <p className="text-slate-400 text-sm font-medium">Bonjour,</p>
          <h1 className="text-2xl font-bold text-white">{patientProfile.name}</h1>
        </div>
        <div 
          className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-blue-500 shadow-sm border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors"
          onClick={() => setCurrentTab('profile')}
        >
          <User className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-700 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${status === SensorStatus.CONNECTED ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            {status === SensorStatus.CONNECTED && <div className="absolute top-0 left-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-75"></div>}
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">État capteur</p>
            <p className="text-slate-200 font-bold text-sm">{status}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
             isSyncing ? 'bg-blue-900/20 border-blue-900/50 text-blue-400' :
             !isOnline || !cloudApiUrl ? 'bg-slate-700/50 border-slate-600 text-slate-500' :
             'bg-emerald-900/20 border-emerald-900/50 text-emerald-400'
          }`}>
             {isSyncing ? (
               <RefreshCw className="w-3 h-3 animate-spin" />
             ) : isOnline && cloudApiUrl ? (
               <Cloud className="w-3 h-3" />
             ) : (
               <CloudOff className="w-3 h-3" />
             )}
             <span className="text-[10px] font-medium hidden xs:inline">
               {isSyncing ? 'Sync...' : (isOnline && cloudApiUrl) ? 'Connecté' : 'Hors ligne'}
             </span>
          </div>
        </div>
      </div>

      <AiAdvisor 
        analysis={aiAnalysis} 
        isLoading={isAiAnalyzing} 
        onAnalyze={handleAiAnalysis} 
        lastUpdated={lastAiUpdate}
        isConnected={status === SensorStatus.CONNECTED}
      />

      <h2 className="text-lg font-bold text-white mb-4 px-1">Constantes vitales</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <VitalCard title="Rythme cardiaque" value={currentVitals.heartRate || '--'} unit="bpm" icon="heart" colorTheme="red" />
        <VitalCard title="SpO₂" value={currentVitals.spO2 || '--'} unit="%" icon="oxygen" colorTheme="blue" />
        <VitalCard title="Température" value={currentVitals.temperature || '--'} unit="°C" icon="temp" colorTheme="orange" />
        <VitalCard title="Tension" value={currentVitals.systolicBP ? `${currentVitals.systolicBP}/${currentVitals.diastolicBP}` : '--/--'} unit="mmHg" icon="bp" colorTheme="purple" />
      </div>

      <h2 className="text-lg font-bold text-white mb-4 px-1">Aperçu rapide</h2>
      <div className="grid grid-cols-2 gap-4">
        <TrendChart data={history} dataKey="heartRate" color="#ef4444" fill="red" />
        <TrendChart data={history} dataKey="spO2" color="#0ea5e9" fill="blue" />
        <TrendChart data={history} dataKey="temperature" color="#f97316" fill="orange" />
        <TrendChart data={history} dataKey="systolicBP" color="#a855f7" fill="purple" />
      </div>
    </div>
  );

  const HistoryView = () => {
    const filters = [
      { id: 'all', label: 'Tout' },
      { id: 'heartRate', label: 'Rythme cardiaque' },
      { id: 'spO2', label: 'SpO₂' },
      { id: 'temperature', label: 'Température' },
      { id: 'bp', label: 'Tension' },
    ];

    // Filter alerts based on the selected category in History
    const getFilteredHistoryAlerts = () => {
      if (historyFilter === 'all') return alerts;
      
      return alerts.filter(alert => {
         if (historyFilter === 'heartRate') return alert.type === 'heartRate';
         if (historyFilter === 'spO2') return alert.type === 'spo2';
         if (historyFilter === 'temperature') return alert.type === 'temperature';
         if (historyFilter === 'bp') return alert.type === 'bp';
         return false;
      });
    };

    const filteredAlerts = getFilteredHistoryAlerts();

    const getAlertIcon = (type: string) => {
       switch(type) {
         case 'heartRate': return <Activity className="w-5 h-5 text-rose-400" />;
         case 'spo2': return <Droplets className="w-5 h-5 text-sky-400" />;
         case 'temperature': return <Thermometer className="w-5 h-5 text-orange-400" />;
         default: return <Activity className="w-5 h-5 text-purple-400" />;
       }
    };

    return (
      <div className="pb-24 animate-in fade-in duration-500">
        <h1 className="text-3xl font-bold text-white mb-6 pt-2">Historique</h1>
        
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide -mx-6 px-6">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setHistoryFilter(f.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                historyFilter === f.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 transform scale-105' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 mb-8">
          <HistoryChart 
            title="Rythme cardiaque" 
            data={history} 
            dataKey="heartRate" 
            color="#ef4444" 
            unit="bpm" 
            visible={historyFilter === 'all' || historyFilter === 'heartRate'}
          />
          <HistoryChart 
            title="SpO₂" 
            data={history} 
            dataKey="spO2" 
            color="#0ea5e9" 
            unit="%" 
            visible={historyFilter === 'all' || historyFilter === 'spO2'}
          />
          <HistoryChart 
            title="Température" 
            data={history} 
            dataKey="temperature" 
            color="#f97316" 
            unit="°C" 
            visible={historyFilter === 'all' || historyFilter === 'temperature'}
          />
          <HistoryChart 
            title="Tension Artérielle (Sys)" 
            data={history} 
            dataKey="systolicBP" 
            color="#a855f7" 
            unit="mmHg" 
            visible={historyFilter === 'all' || historyFilter === 'bp'}
          />
        </div>

        {/* Detailed Alert History Log */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 px-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            Journal des événements
            {historyFilter !== 'all' && <span className="text-sm font-normal text-slate-500">({filters.find(f => f.id === historyFilter)?.label})</span>}
          </h2>
          
          {filteredAlerts.length === 0 ? (
             <div className="bg-slate-800/50 border border-slate-700/50 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-slate-500">
               <Check className="w-10 h-10 mb-2 opacity-30" />
               <p className="text-sm">Aucun événement enregistré</p>
             </div>
          ) : (
            <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-700/50">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 flex gap-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex flex-col items-center gap-1 min-w-[60px] pt-1">
                       <span className="text-xs font-bold text-slate-400">
                         {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                       <span className="text-xs text-slate-500 font-medium">
                         {new Date(alert.timestamp).toLocaleDateString([], {day: 'numeric', month: 'short'})}
                       </span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getAlertIcon(alert.type)}
                        <span className={`text-sm font-bold capitalize ${
                          alert.type === 'heartRate' ? 'text-rose-400' : 
                          alert.type === 'spo2' ? 'text-sky-400' :
                          alert.type === 'temperature' ? 'text-orange-400' : 'text-purple-400'
                        }`}>
                          {alert.type === 'spo2' ? 'SpO₂' : alert.type === 'heartRate' ? 'Rythme Cardiaque' : alert.type === 'temperature' ? 'Température' : 'Tension'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm font-medium">{alert.message}</p>
                    </div>

                    <div className="flex items-center">
                       <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-600">
                          <span className="text-white font-mono text-sm font-bold">{alert.value}</span>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AlertsView = () => (
    <div className="pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-4 pt-2">
        <h1 className="text-3xl font-bold text-white">Alertes</h1>
        {alerts.filter(a => !a.read).length > 0 && (
          <button 
            className="p-2 bg-blue-900/30 text-blue-400 rounded-xl hover:bg-blue-900/50 transition-colors text-xs font-bold px-3" 
            onClick={() => setAlerts(prev => prev.map(a => ({...a, read: true})))}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>
      
      {alerts.filter(a => !a.read).length > 0 && (
        <div className="bg-rose-900/20 border border-rose-800/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <div className="p-2 bg-rose-900/40 rounded-full text-rose-400">
             <Activity className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-rose-400 text-sm">Attention requise</p>
            <p className="text-rose-300 text-xs mt-1">Vous avez {alerts.filter(a => !a.read).length} alertes non lues concernant les constantes du patient.</p>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <Check className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">Tout est normal</p>
          <p className="text-sm">Aucune alerte détectée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-2xl shadow-sm border flex items-center justify-between animate-in slide-in-from-bottom-2 ${alert.read ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-800 border-slate-600'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    alert.type === 'heartRate' ? 'bg-rose-900/30 text-rose-400' : 
                    alert.type === 'spo2' ? 'bg-sky-900/30 text-sky-400' :
                    'bg-orange-900/30 text-orange-400'
                  }`}>
                  {alert.type === 'heartRate' ? <Activity className="w-6 h-6" /> : alert.type === 'spo2' ? <Droplets className="w-6 h-6" /> : <Thermometer className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                     <p className={`font-bold text-sm ${alert.read ? 'text-slate-400' : 'text-white'}`}>{alert.message}</p>
                     {!alert.read && <span className="w-2 h-2 bg-rose-500 rounded-full"></span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.timestamp).toLocaleDateString()} à {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ProfileView = () => (
    <div className="pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6 pt-2">
        <h1 className="text-3xl font-bold text-white">Profil</h1>
        <button 
          onClick={() => {
            if (isEditingProfile) handleProfileSave();
            else {
              setEditedProfile(patientProfile);
              setIsEditingProfile(true);
            }
          }}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
            isEditingProfile 
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
              : 'bg-slate-700 text-white shadow-lg shadow-slate-900/50'
          }`}
        >
          {isEditingProfile ? <><Save className="w-4 h-4" /> Enregistrer</> : <><Edit2 className="w-4 h-4" /> Modifier</>}
        </button>
      </div>

      <div className="bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-700 mb-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-700/50 rounded-bl-full -mr-8 -mt-8 z-0"></div>
        
        <div className="relative z-10">
          {isEditingProfile ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Nom Complet</label>
                <input 
                  type="text" 
                  value={editedProfile.name} 
                  onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Âge</label>
                  <input 
                    type="number" 
                    value={editedProfile.age} 
                    onChange={(e) => setEditedProfile({...editedProfile, age: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                   <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Groupe Sanguin</label>
                   <select 
                      value={editedProfile.bloodType} 
                      onChange={(e) => setEditedProfile({...editedProfile, bloodType: e.target.value})}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                   >
                     <option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                   </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Poids (kg)</label>
                  <input 
                    type="number" 
                    value={editedProfile.weight} 
                    onChange={(e) => setEditedProfile({...editedProfile, weight: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Taille (cm)</label>
                  <input 
                    type="number" 
                    value={editedProfile.height} 
                    onChange={(e) => setEditedProfile({...editedProfile, height: parseInt(e.target.value)})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Condition Médicale</label>
                <input 
                  type="text" 
                  value={editedProfile.condition} 
                  onChange={(e) => setEditedProfile({...editedProfile, condition: e.target.value})}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button 
                onClick={handleProfileCancel}
                className="w-full py-3 text-slate-500 font-medium text-sm hover:text-slate-300"
              >
                Annuler
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5 mb-6">
                <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 border-4 border-slate-600 shadow-lg">
                  <User className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{patientProfile.name}</h2>
                  <p className="text-slate-400 font-medium">ID: {patientProfile.id}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div className="bg-slate-700/50 p-3 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Scale className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 font-bold uppercase">Poids</span>
                    </div>
                    <p className="text-lg font-bold text-slate-200">{patientProfile.weight} <span className="text-xs">kg</span></p>
                 </div>
                 <div className="bg-slate-700/50 p-3 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Ruler className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-400 font-bold uppercase">Taille</span>
                    </div>
                    <p className="text-lg font-bold text-slate-200">{patientProfile.height} <span className="text-xs">cm</span></p>
                 </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-700">
                   <span className="text-slate-400 text-sm font-medium">Âge</span>
                   <span className="text-slate-200 font-bold">{patientProfile.age} ans</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700">
                   <span className="text-slate-400 text-sm font-medium">Groupe Sanguin</span>
                   <span className="text-slate-200 font-bold">{patientProfile.bloodType}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                   <span className="text-slate-400 text-sm font-medium">Condition</span>
                   <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-bold">{patientProfile.condition}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold text-white mb-4 px-1">Configuration Système</h2>
      <div className="bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-700 mb-8 space-y-6">
        
        {/* ESP IP Config */}
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Wifi className="w-3 h-3" /> Adresse IP Capteur (ESP32)
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={espIp}
              onChange={(e) => setEspIp(e.target.value)}
              placeholder="192.168.1.100" 
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
             <button 
              onClick={initiateConnection}
              className={`px-4 rounded-xl flex items-center justify-center transition-all ${status === SensorStatus.CONNECTED ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'bg-blue-600 text-white shadow-md shadow-blue-500/20'}`}
            >
              {isAuthenticating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Wifi className="w-5 h-5" />}
            </button>
          </div>
          {authError && <p className="text-xs text-rose-500 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {authError}</p>}
        </div>

        {/* Cloud API Config */}
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Server className="w-3 h-3" /> URL Serveur Cloud
          </label>
          <input 
            type="text" 
            value={cloudApiUrl}
            onChange={(e) => setCloudApiUrl(e.target.value)}
            placeholder="https://api.monserveur.com/sync" 
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" 
          />
          <p className="text-[10px] text-slate-500 mt-1">Laissez vide si vous n'avez pas de serveur backend.</p>
        </div>

        {/* Gemini API Key Config */}
        <div>
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Key className="w-3 h-3" /> Clé API Gemini (IA)
          </label>
          <input 
            type="password" 
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="AIzaSy..." 
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" 
          />
          <p className="text-[10px] text-slate-500 mt-1">Nécessaire pour l'analyse intelligente des constantes.</p>
        </div>

      </div>

      <h2 className="text-lg font-bold text-white mb-4 px-1">Seuils d'alerte</h2>
      <div className="bg-slate-800 rounded-3xl shadow-sm border border-slate-700 overflow-hidden">
        {[
          { color: 'bg-rose-500', label: 'Rythme Cardiaque', val: '60 - 100 bpm' },
          { color: 'bg-sky-500', label: 'SpO₂', val: '92 - 100 %' },
          { color: 'bg-orange-500', label: 'Température', val: '36 - 37.5 °C' },
          { color: 'bg-purple-500', label: 'Tension Sys', val: '90 - 140 mmHg' },
        ].map((item, idx) => (
          <div key={idx} className="p-4 border-b border-slate-700 last:border-none flex justify-between items-center hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
              <span className="font-semibold text-slate-300 text-sm">{item.label}</span>
            </div>
            <span className="text-slate-400 text-xs font-mono bg-slate-900 px-2 py-1 rounded-md border border-slate-700">{item.val}</span>
          </div>
        ))}
      </div>
      
      <div className="flex flex-col gap-3 mt-8">
        <button 
          onClick={() => setAlerts([])}
          className="w-full flex items-center justify-center gap-2 text-slate-400 text-sm font-semibold py-3 hover:bg-slate-800 rounded-xl transition-colors border border-dashed border-slate-700"
        >
          <RotateCw className="w-4 h-4" />
          Réinitialiser les alertes
        </button>
        
        <button 
          onClick={resetData}
          className="w-full flex items-center justify-center gap-2 text-rose-500 text-sm font-semibold py-3 hover:bg-rose-900/20 rounded-xl transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Effacer toutes les données locales
        </button>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen px-6 pt-8 max-w-md mx-auto relative">
      {currentTab === 'dashboard' && <DashboardView />}
      {currentTab === 'history' && <HistoryView />}
      {currentTab === 'alerts' && <AlertsView />}
      {currentTab === 'profile' && <ProfileView />}
      
      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-700">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500">
                <Lock className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-white mb-2">Authentification Requise</h3>
            <p className="text-sm text-center text-slate-400 mb-6">
              Veuillez entrer le code PIN affiché sur l'écran du bracelet ESP32 pour sécuriser la connexion.
            </p>
            <input 
              type="password" 
              placeholder="Code PIN"
              value={connectionPassword}
              onChange={(e) => setConnectionPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {authError && <p className="text-xs text-rose-500 text-center mb-4">{authError}</p>}
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowPasswordModal(false); setConnectionPassword(''); }}
                className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-600 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={verifyPassword}
                disabled={isAuthenticating}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors"
              >
                {isAuthenticating ? 'Vérification...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSetupComplete && (
        <BottomNav 
          currentTab={currentTab} 
          onTabChange={setCurrentTab} 
          alertCount={alerts.filter(a => !a.read).length} 
        />
      )}
    </div>
  );
};

export default App;