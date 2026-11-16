/**
 * Floating 3D Proximity Billboard & Resource Pickup Notifications
 * Projects 3D world trigger coordinates to screen space with:
 * - Trigger progress bar (1.4s auto-fill)
 * - Clear requirement labels ("Requer: 5 Regolitos (3/5)")
 * - Rising "+1 Regolito" / "+1 Gelo" pickup popups
 */

import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { InteractiveTriggerZone } from '../graphics/MarsSurfaceScene';

export interface ResourcePopupItem {
  id: string;
  text: string;
  color: string;
  screenX: number;
  screenY: number;
  timestamp: number;
}

interface FloatingBillboardsProps {
  camera: THREE.PerspectiveCamera | null;
  activeTrigger: InteractiveTriggerZone | null;
  popups: ResourcePopupItem[];
}

export const FloatingBillboards: React.FC<FloatingBillboardsProps> = ({
  camera,
  activeTrigger,
  popups,
}) => {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Project 3D trigger position to 2D screen space
  useEffect(() => {
    if (!activeTrigger || !camera) {
      setScreenPos((prev) => ({ ...prev, visible: false }));
      return;
    }

    const pos = activeTrigger.worldPos.clone();
    pos.project(camera);

    // Check if behind camera
    if (pos.z > 1) {
      setScreenPos((prev) => ({ ...prev, visible: false }));
      return;
    }

    const screenX = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

    setScreenPos({
      x: screenX,
      y: screenY,
      visible: true,
    });
  }, [activeTrigger, camera]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-15 overflow-hidden">
      {/* 1. Interactive Proximity Trigger Billboard */}
      {screenPos.visible && activeTrigger && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full transition-transform duration-75"
          style={{
            left: `${screenPos.x}px`,
            top: `${screenPos.y - 12}px`,
          }}
        >
          <div className="flex flex-col items-center bg-slate-950/90 border border-cyan-500/50 rounded-xl px-4 py-2.5 shadow-2xl shadow-cyan-950/60 max-w-xs text-center backdrop-blur-none">
            {/* Title */}
            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
              {activeTrigger.name}
            </span>

            {/* Requirement / Status Text */}
            <span
              className={`text-xs font-bold mt-1 ${
                activeTrigger.hasRequirements ? 'text-emerald-300' : 'text-amber-400'
              }`}
            >
              {activeTrigger.hasRequirements ? activeTrigger.actionText : activeTrigger.requirementText}
            </span>

            {/* Auto-Trigger Progress Bar */}
            {activeTrigger.hasRequirements && (
              <div className="w-full mt-2 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-75"
                  style={{ width: `${Math.round(activeTrigger.progressRatio * 100)}%` }}
                />
              </div>
            )}

            {/* Quick Action Hint */}
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              {activeTrigger.hasRequirements ? (
                <span>
                  Permaneça na área ou aperte <b className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-600">E / AÇÃO</b>
                </span>
              ) : (
                <span className="text-amber-300 font-medium">Explore o terreno para coletar</span>
              )}
            </div>

            {/* Pointer arrow pointing down */}
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-cyan-500/60 mt-1" />
          </div>
        </div>
      )}

      {/* 2. Floating +1 Regolito / +1 Gelo Popups */}
      {popups.map((popup) => (
        <div
          key={popup.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 font-black text-sm pointer-events-none animate-float-fade shadow-sm"
          style={{
            left: `${popup.screenX}px`,
            top: `${popup.screenY}px`,
            color: popup.color,
            textShadow: '0 2px 8px rgba(0,0,0,0.85)',
          }}
        >
          {popup.text}
        </div>
      ))}
    </div>
  );
};
