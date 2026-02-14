import React from 'react';
import { Sparkles, RefreshCw, MessageSquareQuote, AlertTriangle } from 'lucide-react';

interface AiAdvisorProps {
  analysis: string | null;
  isLoading: boolean;
  onAnalyze: () => void;
  lastUpdated: number | null;
  isConnected: boolean;
}

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ analysis, isLoading, onAnalyze, lastUpdated, isConnected }) => {
  return (
    <div className="bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-700 mb-8 relative overflow-hidden transition-all duration-300">
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-900/30 text-blue-400 rounded-xl border border-blue-800/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 leading-tight">Assistant IA VitalGuard</h3>
              <p className="text-slate-400 text-xs font-medium">Analyse médicale intelligente</p>
            </div>
          </div>
          
          <button 
            onClick={onAnalyze}
            disabled={isLoading}
            className={`p-2 rounded-full transition-all border ${
              isLoading 
                ? 'bg-slate-700 border-slate-600 text-slate-500' 
                : 'bg-slate-700 border-slate-600 text-blue-400 hover:bg-slate-600 hover:border-blue-700 shadow-sm'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700 min-h-[80px] flex flex-col justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 text-blue-400 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm font-semibold text-slate-400">Analyse en cours...</span>
            </div>
          ) : analysis ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex gap-3 items-start">
                 <MessageSquareQuote className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                 <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line font-medium">
                   {analysis}
                 </p>
              </div>
              {lastUpdated && (
                <div className="flex justify-end border-t border-slate-700 pt-2 mt-2">
                  <p className="text-[10px] text-slate-500 font-medium">
                    Mis à jour à {new Date(lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-2">
              {!isConnected ? (
                <div className="flex flex-col items-center text-rose-400 gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  <p className="text-sm font-medium">Capteur déconnecté</p>
                  <p className="text-xs text-rose-400/70">Veuillez connecter le bracelet pour lancer l'analyse.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500 font-medium">
                  Cliquez sur le bouton pour obtenir une analyse IA des données actuelles.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};