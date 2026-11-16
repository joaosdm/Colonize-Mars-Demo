/**
 * Ergonomic Mobile & Tablet Touch Controls
 * Virtual analog joystick on bottom-left + Jump/Jetpack, Plasma Pulse & Action buttons on bottom-right.
 */

import React, { useRef, useState, useCallback } from 'react';
import { ArrowUp, Zap, Crosshair } from 'lucide-react';

interface TouchControlsProps {
  onMoveChange: (vector: { x: number; y: number }) => void;
  onJumpPress: (isPressed: boolean) => void;
  onActionPress: () => void;
  onShootPress: () => void;
  hasActiveTrigger: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveChange,
  onJumpPress,
  onActionPress,
  onShootPress,
  hasActiveTrigger,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchIdRef = useRef<number | null>(null);

  const radius = 48;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return;
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      setIsDragging(true);

      const base = joystickBaseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }

      setThumbPos({ x: dx, y: dy });
      onMoveChange({ x: dx / radius, y: dy / radius });
    },
    [onMoveChange]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (touchIdRef.current === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          const base = joystickBaseRef.current;
          if (!base) return;
          const rect = base.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          let dx = touch.clientX - centerX;
          let dy = touch.clientY - centerY;
          const dist = Math.hypot(dx, dy);

          if (dist > radius) {
            dx = (dx / dist) * radius;
            dy = (dy / dist) * radius;
          }

          setThumbPos({ x: dx, y: dy });
          onMoveChange({ x: dx / radius, y: dy / radius });
          break;
        }
      }
    },
    [onMoveChange]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          setIsDragging(false);
          setThumbPos({ x: 0, y: 0 });
          onMoveChange({ x: 0, y: 0 });
          break;
        }
      }
    },
    [onMoveChange]
  );

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 overflow-hidden">
      {/* Virtual Joystick */}
      <div
        className="absolute bottom-8 left-8 pointer-events-auto touch-none"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          paddingLeft: 'max(env(safe-area-inset-left), 12px)',
        }}
      >
        <div
          ref={joystickBaseRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="relative w-32 h-32 rounded-full border-2 border-cyan-500/50 bg-slate-950/60 flex items-center justify-center shadow-lg"
        >
          <div className="absolute w-full h-[1px] bg-cyan-500/20" />
          <div className="absolute h-full w-[1px] bg-cyan-500/20" />

          <div
            className={`w-14 h-14 rounded-full border-2 border-cyan-400 bg-cyan-600 shadow-md flex items-center justify-center ${
              isDragging ? 'scale-110' : 'scale-100'
            }`}
            style={{ transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)` }}
          >
            <div className="w-4 h-4 rounded-full bg-white/80" />
          </div>
        </div>
      </div>

      {/* Action Buttons: Pulse, Jump/Jet, Action */}
      <div
        className="absolute bottom-8 right-8 pointer-events-auto flex items-end gap-3 touch-none"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          paddingRight: 'max(env(safe-area-inset-right), 12px)',
        }}
      >
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onShootPress();
          }}
          className="w-16 h-16 rounded-full bg-slate-900/90 border-2 border-sky-500/75 active:scale-95 flex flex-col items-center justify-center shadow-xl"
          title="Disparar Pulso de Plasma"
        >
          <Crosshair className="w-6 h-6 text-sky-400" />
          <span className="text-[9px] font-black tracking-wider text-sky-200 mt-0.5">PULSO</span>
        </button>

        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onJumpPress(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onJumpPress(false);
          }}
          className="w-18 h-18 rounded-full bg-slate-900/90 border-2 border-amber-500/70 active:scale-95 flex flex-col items-center justify-center shadow-xl"
          title="Salto / Jetpack"
        >
          <ArrowUp className="w-6 h-6 text-amber-400" />
          <span className="text-[9px] font-black tracking-wider text-amber-200 mt-0.5">
            PULAR/JET
          </span>
        </button>

        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onActionPress();
          }}
          className={`w-20 h-20 rounded-full border-2 active:scale-95 flex flex-col items-center justify-center shadow-2xl ${
            hasActiveTrigger
              ? 'bg-emerald-700 border-emerald-300 ring-4 ring-emerald-400/40'
              : 'bg-slate-900/90 border-slate-600 text-slate-400'
          }`}
          title="Construir / Acelerar / Reparar"
        >
          <Zap className={`w-7 h-7 ${hasActiveTrigger ? 'text-white' : 'text-slate-400'}`} />
          <span
            className={`text-[11px] font-black tracking-wider mt-0.5 ${
              hasActiveTrigger ? 'text-white' : 'text-slate-400'
            }`}
          >
            AÇÃO
          </span>
        </button>
      </div>
    </div>
  );
};
