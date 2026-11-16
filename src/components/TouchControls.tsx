/**
 * Ergonomic Mobile & Tablet Touch Controls
 * Features:
 * - Dynamic Virtual Analog Joystick on bottom-left (smooth normalized 360-degree vector)
 * - Large touch buttons on bottom-right: "PULAR" (Jump) and "AÇÃO" (Action)
 * - Action button glows and pulses with an animated ring when inside an interactive trigger zone!
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowUp, Zap } from 'lucide-react';

interface TouchControlsProps {
  onMoveChange: (vector: { x: number; y: number }) => void;
  onJumpPress: (isPressed: boolean) => void;
  onActionPress: () => void;
  hasActiveTrigger: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveChange,
  onJumpPress,
  onActionPress,
  hasActiveTrigger,
}) => {
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchIdRef = useRef<number | null>(null);

  const radius = 48; // Joystick radius in pixels

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
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }

      setThumbPos({ x: dx, y: dy });
      onMoveChange({ x: dx / radius, y: dy / radius });
    },
    [onMoveChange, radius]
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
          const dist = Math.sqrt(dx * dx + dy * dy);

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
    [onMoveChange, radius]
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
      {/* 1. Virtual Joystick (Bottom-Left) */}
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
          className="relative w-32 h-32 rounded-full border-2 border-cyan-500/40 bg-slate-950/45 backdrop-blur-none flex items-center justify-center shadow-lg shadow-black/40"
        >
          {/* Subtle directional crosshairs */}
          <div className="absolute w-full h-[1px] bg-cyan-500/20" />
          <div className="absolute h-full w-[1px] bg-cyan-500/20" />

          {/* Draggable thumb knob */}
          <div
            className={`w-14 h-14 rounded-full border-2 border-cyan-400 bg-gradient-to-br from-cyan-500 to-sky-700 shadow-md flex items-center justify-center transition-transform ${
              isDragging ? 'scale-110 shadow-cyan-500/50' : 'scale-100'
            }`}
            style={{
              transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)`,
            }}
          >
            <div className="w-4 h-4 rounded-full bg-white/70" />
          </div>
        </div>
      </div>

      {/* 2. Action Buttons (Bottom-Right) */}
      <div
        className="absolute bottom-8 right-8 pointer-events-auto flex items-end gap-4 touch-none"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
          paddingRight: 'max(env(safe-area-inset-right), 12px)',
        }}
      >
        {/* Jump Button (0.38g Leap) */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onJumpPress(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            onJumpPress(false);
          }}
          className="w-20 h-20 rounded-full bg-slate-900/80 border-2 border-amber-500/60 active:scale-95 active:bg-amber-600/80 flex flex-col items-center justify-center shadow-xl shadow-black/50 transition-all"
          title="Salto Gravitacional"
        >
          <ArrowUp className="w-7 h-7 text-amber-400" />
          <span className="text-[11px] font-black tracking-wider text-amber-200 mt-0.5">PULAR</span>
        </button>

        {/* Action Button (Instant Trigger or Acceleration) */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onActionPress();
          }}
          className={`relative w-22 h-22 rounded-full border-2 active:scale-95 flex flex-col items-center justify-center shadow-2xl transition-all ${
            hasActiveTrigger
              ? 'bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-300 ring-4 ring-emerald-400/50 shadow-emerald-500/50'
              : 'bg-slate-900/80 border-slate-600 text-slate-400'
          }`}
          title="Ação / Construção"
        >
          {hasActiveTrigger && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border border-white" />
          )}
          <Zap className={`w-8 h-8 ${hasActiveTrigger ? 'text-white' : 'text-slate-400'}`} />
          <span className={`text-[12px] font-black tracking-wider mt-0.5 ${hasActiveTrigger ? 'text-white' : 'text-slate-400'}`}>
            AÇÃO
          </span>
        </button>
      </div>
    </div>
  );
};
