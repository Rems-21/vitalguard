import React from 'react';
import { Wifi, Battery, User } from 'lucide-react';
import { PatientProfile, SensorStatus } from '../types';

interface HeaderProps {
  patient: PatientProfile;
  batteryLevel: number;
  status: SensorStatus;
}

export const Header: React.FC<HeaderProps> = ({ patient, batteryLevel, status }) => {
  return (
    <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{patient.name}</h1>
            <p className="text-xs text-slate-400">ID: {patient.id} • {patient.condition}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === SensorStatus.CONNECTED ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-slate-300">ESP32: {status}</span>
          </div>
          
          <div className="flex items-center gap-2 text-slate-400">
             <Wifi className={`w-5 h-5 ${status === SensorStatus.CONNECTED ? 'text-emerald-500' : 'text-slate-600'}`} />
             <span className="text-xs">WiFi Direct</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
            <Battery className={`w-4 h-4 ${batteryLevel < 20 ? 'text-red-500' : 'text-emerald-500'}`} />
            <span className="text-xs font-mono">{batteryLevel}%</span>
          </div>
        </div>
      </div>
    </header>
  );
};