/**
 * Minimalist Navigation HUD for Colonize Mars
 * Ultra-clean, low-occlusion design with 95%+ unobstructed space view.
 * Consolidates flight telemetry and vital pips into a sleek top status bar.
 */

import React from 'react';
import {
  Compass,
  Fuel,
  HeartPulse,
  Coins,
  FastForward,
  Pause,
  Eye,
  Volume2,
  VolumeX,
  Target,
  ChevronRight,
} from 'lucide-react';
import { FlightTelemetry, ShipResources, CelestialBodyData } from '../types/game';

interface NavigationHUDProps {
  telemetry: FlightTelemetry;
  resources: ShipResources;
  bodies: CelestialBodyData[];
  targetBodyId: string;
  onSelectTarget: (id: string) => void;
  timeWarp: number;
  onSetTimeWarp: (warp: number) => void;
  cameraMode: 'chase' | 'orbit' | 'system';
  onCycleCamera: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenPause: () => void;
  onBurnManeuver?: (type: 'prograde' | 'retrograde' | 'full') => void;
  onHohmannAssist?: () => void;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  telemetry,
  resources,
  bodies,
  targetBodyId,
  onSelectTarget,
  timeWarp,
  onSetTimeWarp,
  cameraMode,
  onCycleCamera,
  isMuted,
  onToggleMute,
  onOpenPause,
}) => {
  const currentTarget = bodies.find((b) => b.id === targetBodyId) || bodies[0];

  // Quick cycle to next celestial target
  const handleNextTarget = () => {
    const validBodies = bodies.filter((b) => b.type !== 'star');
    const currentIndex = validBodies.findIndex((b) => b.id === targetBodyId);
    const nextIndex = (currentIndex + 1) % validBodies.length;
    onSelectTarget(validBodies[nextIndex].id);
  };

  // Quick cycle time warp (1x -> 10x -> 100x -> 1x)
  const handleCycleWarp = () => {
    if (timeWarp === 1) onSetTimeWarp(10);
    else if (timeWarp === 10) onSetTimeWarp(100);
    else onSetTimeWarp(1);
  };

  const fuelPct = Math.round((resources.fuel / resources.maxFuel) * 100);

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-4 z-20 select-none font-mono">
      {/* TOP BAR: Consolidated Single Clean Telemetry Bar */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Clean Combined Flight & Target Strip */}
        <div className="flex items-center space-x-2 bg-slate-950/85 border border-slate-800/80 rounded-full px-3 py-1.5 shadow-xl text-xs text-slate-200 pointer-events-auto">
          {/* Target Chip (Click to cycle target) */}
          <button
            onClick={handleNextTarget}
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/40 text-red-300 hover:bg-red-600/50 transition-colors cursor-pointer"
            title="Clique para alternar alvo de navegação"
          >
            <Target className="w-3 h-3 text-red-400" />
            <span className="font-bold uppercase tracking-wider">{currentTarget.name}</span>
            <ChevronRight className="w-3 h-3 text-red-400 opacity-60" />
          </button>

          {/* Speed & Altitude */}
          <span className="text-slate-500">|</span>
          <div className="flex items-center space-x-1">
            <span className="text-slate-400 text-[10px]">VEL:</span>
            <span className="font-bold text-white tabular-nums">{telemetry.speedKmS.toFixed(1)} km/s</span>
          </div>

          <span className="text-slate-500">|</span>
          <div className="flex items-center space-x-1">
            <span className="text-slate-400 text-[10px]">ALT:</span>
            <span className="font-bold text-slate-200 tabular-nums">{Math.round(telemetry.altitudeKm)} km</span>
          </div>

          <span className="text-slate-500">|</span>
          <div className="flex items-center space-x-1 text-cyan-400">
            <span className="text-slate-400 text-[10px]">ΔV:</span>
            <span className="font-bold tabular-nums">{Math.round(telemetry.deltaVRemaining)} m/s</span>
          </div>

          {/* Fuel & Oxygen pips */}
          <span className="text-slate-500">|</span>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-cyan-300" title={`Combustível: ${fuelPct}%`}>
              <Fuel className="w-3 h-3 text-cyan-400" />
              <span className="font-bold tabular-nums">{fuelPct}%</span>
            </div>
            <div className="flex items-center space-x-1 text-emerald-300" title={`Oxigênio: ${Math.round(resources.oxygen)}%`}>
              <HeartPulse className="w-3 h-3 text-emerald-400" />
              <span className="font-bold tabular-nums">{Math.round(resources.oxygen)}%</span>
            </div>
          </div>

          <span className="text-slate-500">|</span>
          <div className="flex items-center space-x-1 text-amber-400 font-bold" title="Créditos">
            <Coins className="w-3 h-3" />
            <span className="tabular-nums">{resources.credits.toLocaleString()} ¢</span>
          </div>
        </div>

        {/* Right: Minimal Utility Controls (Warp, Cam, Sound, Pause) */}
        <div className="flex items-center space-x-1.5 pointer-events-auto">
          {/* Time Warp Cycle Button */}
          <button
            onClick={handleCycleWarp}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer shadow-lg ${
              timeWarp > 1
                ? 'bg-cyan-600/90 border-cyan-400 text-white'
                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
            title="Aceleração de Tempo (1x / 10x / 100x)"
          >
            <FastForward className="w-3 h-3 text-cyan-300" />
            <span>{timeWarp}x</span>
          </button>

          {/* Camera View Switcher */}
          <button
            onClick={onCycleCamera}
            className="p-1.5 rounded-full bg-slate-950/80 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            title="Alternar Câmera [V]"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-full bg-slate-950/80 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            aria-label={isMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* Pause */}
          <button
            onClick={onOpenPause}
            className="p-1.5 rounded-full bg-slate-950/80 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            title="Pausar [Esc]"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CENTER: Subtle, Non-Intrusive Flight Crosshair Dot */}
      <div className="mx-auto flex flex-col items-center pointer-events-none">
        <div className="w-5 h-5 rounded-full border border-cyan-400/25 flex items-center justify-center">
          <div className="w-1 h-1 bg-cyan-400 rounded-full" />
        </div>
      </div>

      {/* BOTTOM SAFE AREA */}
      <div className="h-2" />
    </div>
  );
};
