/**
 * AI Crew Management Interface
 * Deep gameplay immersion with tactical AI recommendations,
 * duty shift assignments, morale/fatigue tracking, and emergency dilemma events.
 */

import React, { useState } from 'react';
import {
  Users,
  Shield,
  Wrench,
  Compass,
  HeartPulse,
  Coins,
  Bed,
  CheckCircle,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { CrewMember } from '../types/game';
import { CREW_DILEMMA_EVENTS, CrewDilemmaEvent } from '../sim/crew';

interface CrewPanelProps {
  crew: CrewMember[];
  onAssignCrew: (crewId: string, assignment: CrewMember['assignment']) => void;
  onResolveDilemma: (dilemma: CrewDilemmaEvent, optionIndex: number) => void;
  activeDilemma: CrewDilemmaEvent | null;
}

export const CrewPanel: React.FC<CrewPanelProps> = ({
  crew,
  onAssignCrew,
  onResolveDilemma,
  activeDilemma,
}) => {
  const [selectedCrewId, setSelectedCrewId] = useState<string>(crew[0]?.id || '');
  const activeMember = crew.find((c) => c.id === selectedCrewId) || crew[0];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Commander':
        return <Shield className="w-4 h-4 text-red-400" />;
      case 'Chief Engineer':
        return <Wrench className="w-4 h-4 text-amber-400" />;
      case 'Navigator':
        return <Compass className="w-4 h-4 text-cyan-400" />;
      case 'Life Support Officer':
        return <HeartPulse className="w-4 h-4 text-emerald-400" />;
      case 'Trade Specialist':
        return <Coins className="w-4 h-4 text-yellow-400" />;
      default:
        return <Users className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Active Dilemma Banner if present */}
      {activeDilemma && (
        <div className="p-3 bg-red-950/80 border border-red-700/80 rounded-lg text-slate-100 space-y-2">
          <div className="flex items-center space-x-2 text-red-400 font-bold">
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            <span className="uppercase text-sm">{activeDilemma.title}</span>
          </div>
          <p className="text-slate-300 text-xs">{activeDilemma.description}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {activeDilemma.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onResolveDilemma(activeDilemma, idx)}
                className="px-3 py-1.5 bg-red-900/70 hover:bg-red-800 border border-red-600 rounded text-xs text-white font-semibold transition-colors cursor-pointer"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Crew List on Left, Active Officer Details on Right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Left Column: Crew Roster */}
        <div className="md:col-span-1 space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {crew.map((member) => (
            <div
              key={member.id}
              onClick={() => setSelectedCrewId(member.id)}
              className={`p-2 rounded border cursor-pointer transition-all flex items-center justify-between ${
                member.id === selectedCrewId
                  ? 'bg-slate-800 border-red-500/80 shadow-md'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded bg-slate-950 border border-slate-700">
                  {getRoleIcon(member.role)}
                </div>
                <div>
                  <div className="font-bold text-slate-200">{member.name}</div>
                  <div className="text-[10px] text-slate-400">{member.role}</div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                    member.assignment === 'OffDuty'
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                  }`}
                >
                  {member.assignment}
                </span>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Morale: <span className="text-emerald-400 font-bold">{member.morale}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Member Inspector & Duty Assignment */}
        {activeMember && (
          <div className="md:col-span-2 bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-3">
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded bg-slate-950 border border-slate-700">
                  {getRoleIcon(activeMember.role)}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{activeMember.name}</div>
                  <div className="text-xs text-red-400">{activeMember.role}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400">PERSONALITY</div>
                <div className="text-[11px] text-slate-300 italic">{activeMember.personality}</div>
              </div>
            </div>

            {/* AI Tactical Quote */}
            <div className="p-2 rounded bg-slate-950/90 border border-slate-800 flex items-start space-x-2 text-cyan-300">
              <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs italic leading-relaxed">"{activeMember.statusQuote}"</div>
            </div>

            {/* Skills Readout */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">PILOT</div>
                <div className="text-sm font-bold text-slate-200">{activeMember.skills.piloting}/10</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">ENGINEER</div>
                <div className="text-sm font-bold text-amber-400">{activeMember.skills.engineering}/10</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">ASTRO</div>
                <div className="text-sm font-bold text-cyan-400">{activeMember.skills.astrogation}/10</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">TRADE</div>
                <div className="text-sm font-bold text-yellow-400">{activeMember.skills.trading}/10</div>
              </div>
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">SCIENCE</div>
                <div className="text-sm font-bold text-emerald-400">{activeMember.skills.science}/10</div>
              </div>
            </div>

            {/* Duty Assignment Controls */}
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-bold mb-1.5">
                ASSIGN STATION DUTY:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['Bridge', 'Engineering', 'LifeSupport', 'Comms', 'OffDuty'] as const).map((duty) => (
                  <button
                    key={duty}
                    onClick={() => onAssignCrew(activeMember.id, duty)}
                    className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      activeMember.assignment === duty
                        ? 'bg-red-600 text-white shadow'
                        : 'bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {duty === 'LifeSupport' ? 'Life Support' : duty === 'OffDuty' ? 'Off Duty (Rest)' : duty}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
