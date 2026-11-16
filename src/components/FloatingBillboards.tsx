/**
 * Floating 3D Proximity Billboard & Resource Pickup Notifications
 * Displays project complexity, timed construction countdown, repair status,
 * and resource pickup popups projected from 3D world space.
 */

import React, { useMemo } from 'react';
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
  projectionKey: number;
}

export const FloatingBillboards: React.FC<FloatingBillboardsProps> = ({
  camera,
  activeTrigger,
  popups,
  projectionKey,
}) => {
  const screenPos = useMemo(() => {
    if (!activeTrigger || !camera) {
      return { x: 0, y: 0, visible: false };
    }
    const pos = activeTrigger.worldPos.clone();
    pos.project(camera);

    if (pos.z < -1 || pos.z > 1) {
      return { x: 0, y: 0, visible: false };
    }

    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
    return { x, y, visible: true };
  }, [activeTrigger, camera, projectionKey]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-15 overflow-hidden">
      {screenPos.visible && activeTrigger && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{
            left: `${screenPos.x}px`,
            top: `${screenPos.y - 12}px`,
          }}
        >
          <div
            className={`flex flex-col items-center bg-slate-950/92 rounded-xl px-4 py-2.5 shadow-2xl max-w-xs text-center border ${
              activeTrigger.isRepair
                ? 'border-orange-500/75'
                : activeTrigger.isConstructionActive
                ? 'border-amber-400/75'
                : 'border-cyan-500/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                {activeTrigger.name}
              </span>
              {activeTrigger.complexity && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  {activeTrigger.complexity}
                </span>
              )}
            </div>

            <span
              className={`text-xs font-bold mt-1 ${
                activeTrigger.isRepair
                  ? 'text-orange-300'
                  : activeTrigger.isConstructionActive
                  ? 'text-amber-300'
                  : activeTrigger.hasRequirements
                  ? 'text-emerald-300'
                  : 'text-amber-400'
              }`}
            >
              {activeTrigger.hasRequirements
                ? activeTrigger.actionText
                : activeTrigger.requirementText}
            </span>

            {activeTrigger.coopAssistLabel && (
              <span className="mt-1 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/60 text-[10px] font-black uppercase tracking-wide text-cyan-200 tabular-nums">
                {activeTrigger.coopAssistLabel}
              </span>
            )}

            {activeTrigger.hasRequirements && !activeTrigger.isInfoOnly && (
              <div className="w-full mt-2 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className={`h-full rounded-full ${
                    activeTrigger.isConstructionActive
                      ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                      : activeTrigger.isRepair
                      ? 'bg-gradient-to-r from-orange-500 to-amber-300'
                      : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                  }`}
                  style={{ width: `${Math.round(activeTrigger.progressRatio * 100)}%` }}
                />
              </div>
            )}

            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              {activeTrigger.isInfoOnly ? (
                <span>{activeTrigger.requirementText}</span>
              ) : activeTrigger.isConstructionActive ? (
                <span>
                  Obra em andamento · Aperte{' '}
                  <b className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-600">
                    E / AÇÃO
                  </b>{' '}
                  para acelerar
                </span>
              ) : activeTrigger.hasRequirements ? (
                <span>
                  Permaneça perto ou aperte{' '}
                  <b className="text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-600">
                    E / AÇÃO
                  </b>
                </span>
              ) : (
                <span className="text-amber-300 font-medium">{activeTrigger.requirementText}</span>
              )}
            </div>

            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-cyan-500/60 mt-1" />
          </div>
        </div>
      )}

      {popups.map((popup) => (
        <div
          key={popup.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 font-black text-sm pointer-events-none animate-float-fade"
          style={{
            left: `${popup.screenX}px`,
            top: `${popup.screenY}px`,
            color: popup.color,
            textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          }}
        >
          {popup.text}
        </div>
      ))}
    </div>
  );
};
