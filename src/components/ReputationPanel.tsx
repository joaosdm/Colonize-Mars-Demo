/**
 * Faction Reputation & Social Influence Metrics Interface
 * Tracks diplomatic standing across planetary factions,
 * trade success influence scores, and unlocked governance privileges.
 */

import React from 'react';
import { Award, Shield, Star, Users, Building, CheckCircle2 } from 'lucide-react';
import { FactionReputation } from '../types/game';

interface ReputationPanelProps {
  factions: FactionReputation[];
  socialInfluence: number; // 0 - 1000
  tradeSuccessCount: number;
}

export const ReputationPanel: React.FC<ReputationPanelProps> = ({
  factions,
  socialInfluence,
  tradeSuccessCount,
}) => {
  const getInfluenceRank = (score: number) => {
    if (score >= 850) return { title: 'Planetary Sovereign Pioneer', tier: 5 };
    if (score >= 600) return { title: 'Colonial Ambassador', tier: 4 };
    if (score >= 350) return { title: 'High-Value Trade Envoy', tier: 3 };
    if (score >= 150) return { title: 'Interplanetary Courier', tier: 2 };
    return { title: 'Independent Prospector', tier: 1 };
  };

  const rank = getInfluenceRank(socialInfluence);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Social Influence Hero Score */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Award className="w-5 h-5" />
            <span className="text-sm">SOCIAL INFLUENCE & TRADE REPUTATION</span>
          </div>
          <div className="text-slate-300">
            Diplomatic Rank: <span className="text-white font-bold">{rank.title}</span> (Tier {rank.tier})
          </div>
          <div className="text-[11px] text-slate-400">
            Based on {tradeSuccessCount} successful planetary commerce transactions & colonial contracts.
          </div>
        </div>

        <div className="text-right sm:border-l sm:border-slate-800 sm:pl-4">
          <div className="text-2xl font-black text-amber-400 tabular-nums">
            {socialInfluence} <span className="text-xs text-slate-400 font-normal">/ 1000</span>
          </div>
          <div className="w-36 h-2 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (socialInfluence / 1000) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Factions Standing Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {factions.map((f) => (
          <div
            key={f.id}
            className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: f.color }}
                />
                <span className="font-bold text-slate-200">{f.name}</span>
                <span className="text-[10px] text-slate-400">({f.fullName})</span>
              </div>

              <span
                className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${
                  f.standing > 20
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : f.standing >= 0
                    ? 'bg-slate-900 text-slate-300 border-slate-700'
                    : 'bg-red-950 text-red-400 border-red-800'
                }`}
              >
                {f.tier}
              </span>
            </div>

            {/* Standing Progress */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>FACTION STANDING</span>
                <span className="font-bold text-slate-200 tabular-nums">
                  {f.standing > 0 ? `+${f.standing}` : f.standing} / 100
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    backgroundColor: f.color,
                    width: `${Math.max(5, Math.min(100, f.standing + 50))}%`,
                  }}
                />
              </div>
            </div>

            {/* Unlocked Perks */}
            <div className="flex items-start space-x-1.5 text-[10px] text-slate-300 pt-1 border-t border-slate-900">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
              <span>{f.perks}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
