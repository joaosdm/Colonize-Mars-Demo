/**
 * Opening Landing Cutscene Overlay
 * Displays cinematic letterboxing and telemetry communications during Mars atmospheric descent.
 */

import React from 'react';
import { Rocket, FastForward } from 'lucide-react';

interface CutsceneOverlayProps {
  onSkip: () => void;
}

export const CutsceneOverlay: React.FC<CutsceneOverlayProps> = ({ onSkip }) => {
  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between font-mono select-none">
      {/* Top Letterbox Bar */}
      <div className="w-full h-16 sm:h-20 bg-black flex items-center justify-between px-6 sm:px-12 border-b border-red-950/40">
        <div className="flex items-center space-x-2.5 text-red-500 font-bold text-xs sm:text-sm tracking-widest uppercase">
          <Rocket className="w-4 h-4 animate-pulse" />
          <span>DESCIDA ATMOSFÉRICA EM MARTE · SEQUÊNCIA DE POUSO</span>
        </div>

        <button
          onClick={onSkip}
          className="pointer-events-auto px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>PULAR [ESPAÇO]</span>
        </button>
      </div>

      {/* Middle Subtitle Banner */}
      <div className="mx-auto my-auto text-center space-y-1 bg-black/60 px-6 py-3 rounded-xl border border-red-900/30">
        <div className="text-red-400 text-xs font-bold tracking-wider uppercase animate-pulse">
          • TELEMETRIA DE BORDO: ENTRADA FINAL
        </div>
        <div className="text-white text-sm sm:text-base font-bold">
          "Propulsores de retrofoguete acionados. Gravidade marciana detectada: 0.38g."
        </div>
      </div>

      {/* Bottom Letterbox Bar */}
      <div className="w-full h-16 sm:h-20 bg-black flex items-center justify-center px-6 border-t border-red-950/40">
        <div className="text-slate-400 text-xs tracking-wider">
          DESTINO: CRATERA GALE · SOL 1 · PREPARE-SE PARA O PRIMEIRO PASSO EM MARTE
        </div>
      </div>
    </div>
  );
};
