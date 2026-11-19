/**
 * Ergonomic Mobile & Tablet Multi-Touch Controls
 * Uses Pointer Events with pointer capture so simultaneous movement (left thumb),
 * camera orbit (canvas drag), and Jump/Jetpack/Fire/Excavate/Action (right thumb)
 * work seamlessly on smartphones and tablets (both portrait and landscape).
 */

import React, { useRef, useState, useCallback } from 'react';
import { ArrowUp, Zap, Crosshair, Pickaxe, RefreshCw } from 'lucide-react';

interface TouchControlsProps {
  onMoveChange: (vector: { x: number; y: number }) => void;
  onJumpPress: (isPressed: boolean) => void;
  onActionPress: () => void;
  onShootPress: () => void;
  onExcavatePress: () => void;
  onCycleWeapon: () => void;
  hasActiveTrigger: boolean;
  equippedWeaponName: string;
  craftedWeaponCount: number;
  isPortrait?: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveChange,
  onJumpPress,
  onActionPress,
  onShootPress,
  onExcavatePress,
  onCycleWeapon,
  hasActiveTrigger,
  equippedWeaponName,
  craftedWeaponCount,
  isPortrait = true,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const pointerIdRef = useRef<number | null>(null);

  const radius = isPortrait ? 44 : 38;

  const updateVectorFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const base = joystickBaseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }

      setThumbPos({ x: dx, y: dy });
      onMoveChange({ x: dx / radius, y: dy / radius });
    },
    [onMoveChange, radius]
  );

  const handleJoystickDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (pointerIdRef.current !== null) return;
      pointerIdRef.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateVectorFromClient(e.clientX, e.clientY);
    },
    [updateVectorFromClient]
  );

  const handleJoystickMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== pointerIdRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      updateVectorFromClient(e.clientX, e.clientY);
    },
    [updateVectorFromClient]
  );

  const handleJoystickUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== pointerIdRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      pointerIdRef.current = null;
      setIsDragging(false);
      setThumbPos({ x: 0, y: 0 });
      onMoveChange({ x: 0, y: 0 });
    },
    [onMoveChange]
  );

  const bottomOffset = isPortrait ? 'max(env(safe-area-inset-bottom), 18px)' : 'max(env(safe-area-inset-bottom), 10px)';
  const sideOffset = isPortrait ? 'max(env(safe-area-inset-left), 14px)' : 'max(env(safe-area-inset-left), 20px)';
  const rightOffset = isPortrait ? 'max(env(safe-area-inset-right), 14px)' : 'max(env(safe-area-inset-right), 20px)';

  return (
    <div
      data-testid="mobile-touch-controls"
      className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden"
    >
      {/* Left: Virtual Analog Joystick */}
      <div
        className="absolute pointer-events-auto touch-none"
        style={{ bottom: bottomOffset, left: sideOffset }}
      >
        <div
          ref={joystickBaseRef}
          data-testid="touch-joystick"
          role="application"
          aria-label="Joystick Virtual de Movimento"
          onPointerDown={handleJoystickDown}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickUp}
          onPointerCancel={handleJoystickUp}
          className={`relative rounded-full border-2 border-cyan-400/50 bg-slate-950/65 flex items-center justify-center shadow-xl ${
            isPortrait ? 'w-28 h-28' : 'w-24 h-24'
          }`}
        >
          <div className="absolute w-full h-[1px] bg-cyan-400/20 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-cyan-400/20 pointer-events-none" />
          <div className="absolute inset-2.5 rounded-full border border-dashed border-cyan-500/25 pointer-events-none" />

          <div
            className={`rounded-full border-2 border-cyan-300 bg-cyan-600/95 shadow-lg flex items-center justify-center pointer-events-none ${
              isPortrait ? 'w-12 h-12' : 'w-10 h-10'
            } ${isDragging ? 'scale-105 bg-cyan-500' : 'scale-100'}`}
            style={{ transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)` }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white/85" />
          </div>
        </div>
        <div className="text-[9px] font-bold text-center text-slate-300/80 mt-1 tracking-wider uppercase">
          Arraste tela p/ câmera
        </div>
      </div>

      {/* Right: Ergonomic Action Cluster (Excavate, Cycle Weapon, Shoot, Jump/Jet, Primary Action) */}
      <div
        className="absolute pointer-events-auto flex flex-col items-end gap-2 touch-none"
        style={{ bottom: bottomOffset, right: rightOffset }}
      >
        {/* Secondary Row: Excavate Crater + Weapon Switch */}
        <div className="flex items-center gap-2">
          {craftedWeaponCount > 1 && (
            <button
              type="button"
              data-testid="touch-weapon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCycleWeapon();
              }}
              className="h-11 px-3 rounded-full bg-slate-950/88 border border-sky-400/60 active:scale-95 flex items-center gap-1.5 shadow-lg text-sky-200 cursor-pointer"
              aria-label={`Trocar Arma (Atual: ${equippedWeaponName})`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] font-black tracking-wide max-w-[76px] truncate">
                {equippedWeaponName.split(' ')[0]}
              </span>
            </button>
          )}

          <button
            type="button"
            data-testid="touch-excavate-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExcavatePress();
            }}
            className="h-11 px-3.5 rounded-full bg-amber-950/92 border-2 border-amber-400/75 active:scale-95 flex items-center gap-1.5 shadow-lg text-amber-200 cursor-pointer"
            aria-label="Escavar Cratera no Solo"
          >
            <Pickaxe className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-black tracking-wider">ESCAVAR</span>
          </button>
        </div>

        {/* Primary Thumb Arc: Shoot, Jump/Jetpack, Action */}
        <div className="flex items-end gap-2.5">
          <button
            type="button"
            data-testid="touch-shoot-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onShootPress();
            }}
            className={`rounded-full bg-slate-950/90 border-2 border-sky-400/80 active:scale-95 flex flex-col items-center justify-center shadow-xl cursor-pointer ${
              isPortrait ? 'w-14 h-14' : 'w-13 h-13'
            }`}
            aria-label="Disparar Arma"
          >
            <Crosshair className="w-5 h-5 text-sky-400" />
            <span className="text-[8px] font-black tracking-wider text-sky-200 mt-0.5">TIRO</span>
          </button>

          <button
            type="button"
            data-testid="touch-jump-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onJumpPress(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJumpPress(false);
            }}
            onPointerCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJumpPress(false);
            }}
            className={`rounded-full bg-slate-950/90 border-2 border-amber-400/80 active:scale-95 flex flex-col items-center justify-center shadow-xl cursor-pointer ${
              isPortrait ? 'w-16 h-16' : 'w-14 h-14'
            }`}
            aria-label="Pular ou Usar Jetpack"
          >
            <ArrowUp className="w-5 h-5 text-amber-400" />
            <span className="text-[8px] font-black tracking-wider text-amber-200 mt-0.5">
              JETPACK
            </span>
          </button>

          <button
            type="button"
            data-testid="touch-action-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onActionPress();
            }}
            className={`rounded-full border-2 active:scale-95 flex flex-col items-center justify-center shadow-2xl cursor-pointer ${
              isPortrait ? 'w-18 h-18' : 'w-16 h-16'
            } ${
              hasActiveTrigger
                ? 'bg-emerald-600 border-emerald-200 ring-4 ring-emerald-400/40 text-white'
                : 'bg-slate-950/90 border-slate-600 text-slate-300'
            }`}
            aria-label="Ação: Construir, Reparar ou Interagir"
          >
            <Zap className={`w-6 h-6 ${hasActiveTrigger ? 'text-white' : 'text-slate-400'}`} />
            <span className="text-[10px] font-black tracking-wider mt-0.5">AÇÃO</span>
          </button>
        </div>
      </div>
    </div>
  );
};
