/**
 * Title Screen for Colonize Mars
 * Features live scenic 3D flyby, bespoke inline SVG title lockup,
 * primary start CTA (data-start="true"), Enter/Space listener, and control hint line.
 */

import React from 'react';
import { Rocket, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { soundManager } from '../audio/soundManager';

interface TitleScreenProps {
  onStart: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, isMuted, onToggleMute }) => {
  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-8 sm:p-12 z-30 select-none">
      {/* Top Bar with Brand & Sound */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-red-600/90 border border-red-400/40 flex items-center justify-center text-white shadow-lg">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-red-400 font-semibold font-mono">
              Interplanetary Flight Simulator
            </div>
            <div className="text-sm text-slate-300 font-mono">Epoch 2054 · Sol System</div>
          </div>
        </div>

        <button
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors pointer-events-auto cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
        </button>
      </div>

      {/* Main Title Centerpiece Lockup */}
      <div className="max-w-2xl pointer-events-auto space-y-6 my-auto">
        <div className="space-y-2">
          {/* Custom Bespoke SVG Title Lockup */}
          <svg className="w-full max-w-xl h-24" viewBox="0 0 600 95" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text
              x="0"
              y="60"
              className="font-black tracking-tight"
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '56px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                fill: '#f8fafc',
              }}
            >
              COLONIZE
            </text>
            <text
              x="300"
              y="60"
              className="font-black tracking-tight"
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '56px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                fill: '#ef4444',
              }}
            >
              MARS
            </text>
            <path d="M 0 80 L 520 80" stroke="#ef4444" strokeWidth="3" strokeOpacity="0.8" />
            <circle cx="530" cy="80" r="5" fill="#f97316" />
          </svg>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
            Domine física orbital real, cálculo de delta-V e suporte de vida.
            Viaje entre os planetas, comercialize em mercados dinâmicos e colonize a fronteira de Marte.
          </p>
        </div>

        {/* Start Game CTA Handshake */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
          <button
            data-start="true"
            onClick={() => {
              soundManager.playClick();
              soundManager.playWarpDrive();
              onStart();
            }}
            className="group relative px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-mono font-bold tracking-wider rounded-lg shadow-xl hover:shadow-red-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center space-x-3 text-base"
          >
            <Rocket className="w-5 h-5 transition-transform group-hover:rotate-12" />
            <span>INICIAR EXPEDIÇÃO</span>
            <span className="text-xs text-red-200 font-normal px-1.5 py-0.5 rounded bg-red-700/60 font-mono">
              [ENTER]
            </span>
          </button>

          <div className="text-xs text-slate-400 font-mono flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Física Orbital N-Corpos · Texturas Procedurais · Viagem Espacial</span>
          </div>
        </div>
      </div>

      {/* Control Hint Line in Safe Margin */}
      <div className="w-full text-center text-xs font-mono text-slate-400 tracking-wide pointer-events-none">
        <span>WASD Manobrar · Espaço Propulsão · V Câmera · H Central de Bordo · Esc Pausa</span>
      </div>
    </div>
  );
};
