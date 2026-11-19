/**
 * Title & 3-Player Cooperative Lobby Overlay
 * Renders over the live 3D Martian crater flyby scene.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket,
  Users,
  Plus,
  LogIn,
  RefreshCw,
  Volume2,
  VolumeX,
  Sprout,
  Droplets,
  Cpu,
  Globe,
  Crosshair,
  Shield,
  Wrench,
  FlaskConical,
  Compass,
  Check,
  Zap,
  Wifi,
  WifiOff,
  Globe2,
} from 'lucide-react';
import { RoomSummary } from '../net/coopProtocol';
import type { PlaygamaMultiplayerStatus } from '../net/playgamaMultiplayerClient';
import { formatPlaygamaRegionLabel } from '../net/playgamaSync';
import { soundManager } from '../audio/soundManager';
import {
  ASTRONAUT_ROLE_LIST,
  AstronautRoleId,
  getAstronautRole,
} from '../sim/astronautRoles';

interface TitleLobbyOverlayProps {
  isMuted: boolean;
  threatsEnabled: boolean;
  selectedRole: AstronautRoleId;
  isMobileDetected?: boolean;
  playgamaStatus: PlaygamaMultiplayerStatus;
  onSelectRole: (roleId: AstronautRoleId) => void;
  onToggleThreatsPref: () => void;
  onToggleMute: () => void;
  onStartSolo: () => void;
  onQuickMatchCoop: (playerName: string, roleId: AstronautRoleId) => Promise<void>;
  onCreateCoopRoom: (
    playerName: string,
    roleId: AstronautRoleId,
    isVisible: boolean
  ) => Promise<void>;
  onJoinCoopRoom: (roomCode: string, playerName: string, roleId: AstronautRoleId) => Promise<void>;
  onFetchOpenRooms: () => Promise<RoomSummary[]>;
  onSelectRegion: (regionId: string) => void;
  lobbyError: string | null;
  isConnecting: boolean;
}

const ROLE_ICON: Record<AstronautRoleId, React.ReactNode> = {
  engineer: <Wrench className="w-4 h-4 text-orange-400 shrink-0" />,
  scientist: <FlaskConical className="w-4 h-4 text-cyan-400 shrink-0" />,
  explorer: <Compass className="w-4 h-4 text-emerald-400 shrink-0" />,
};

export const TitleLobbyOverlay: React.FC<TitleLobbyOverlayProps> = ({
  isMuted,
  threatsEnabled,
  selectedRole,
  isMobileDetected = false,
  playgamaStatus,
  onSelectRole,
  onToggleThreatsPref,
  onToggleMute,
  onStartSolo,
  onQuickMatchCoop,
  onCreateCoopRoom,
  onJoinCoopRoom,
  onFetchOpenRooms,
  onSelectRegion,
  lobbyError,
  isConnecting,
}) => {
  const [playerName, setPlayerName] = useState<string>('Comandante');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadRooms = useCallback(async () => {
    if (!playgamaStatus.isSupported) {
      setOpenRooms([]);
      return;
    }
    setIsRefreshing(true);
    const list = await onFetchOpenRooms();
    setOpenRooms(list);
    setIsRefreshing(false);
  }, [onFetchOpenRooms, playgamaStatus.isSupported]);

  useEffect(() => {
    if (!playgamaStatus.isSupported) return;
    loadRooms();
    const timer = window.setInterval(loadRooms, 6000);
    return () => clearInterval(timer);
  }, [loadRooms, playgamaStatus.isSupported, playgamaStatus.region]);

  const activeRoleDef = getAstronautRole(selectedRole);

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-8 pointer-events-none select-none overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
      }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 w-full pointer-events-auto">
        <div className="flex items-center gap-2.5 sm:gap-3 bg-slate-950/90 border border-slate-800 rounded-xl px-3 sm:px-4 py-2 shadow-lg min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shrink-0">
            <Rocket className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 font-bold truncate">
              PROJETO GALE · 0.38G {isMobileDetected ? '· MODO MOBILE' : '· 12 MISSÕES'}
            </div>
            <div className="text-xs text-slate-300 font-semibold truncate">
              {isMobileDetected
                ? 'Controles de Toque & Desempenho Otimizado'
                : 'Simulador Evolutivo de Colonização & Defesa'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
          className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer shrink-0"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="my-auto py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch max-w-6xl w-full mx-auto">
        {/* Left: Hero Branding, Threats Mode & Role Preview */}
        <div className="lg:col-span-7 pointer-events-auto flex flex-col justify-between space-y-4 bg-slate-950/88 border border-slate-800/90 rounded-2xl p-5 sm:p-7 shadow-2xl">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-none">
              COLONIZE <span className="text-orange-500">MARS</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              Evolua sua base em <strong className="text-white">6 Eras / 12 Missões</strong> com obras por complexidade,{' '}
              <strong className="text-purple-300">8 tecnologias</strong> e defesa contra invasores de sílica.
              Escolha sua classe de astronauta e jogue solo ou cooperativo de até{' '}
              <strong className="text-cyan-300">3 jogadores</strong>.
            </p>

            {/* Mobile Above-the-Fold Quick-Start CTA */}
            <div className="lg:hidden pt-1">
              <button
                type="button"
                data-testid="mobile-quick-start-btn"
                onClick={() => {
                  soundManager.playClick();
                  onStartSolo();
                }}
                className="w-full py-3 px-4 bg-orange-600 active:bg-orange-500 text-white font-black tracking-wide rounded-xl shadow-lg cursor-pointer transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Rocket className="w-4 h-4 shrink-0" />
                <span>JOGAR SOLO ({activeRoleDef.shortLabel})</span>
              </button>
            </div>
          </div>

          {/* 3-Class Cooperative Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Classe do Astronauta (Papéis Cooperativos)</span>
              <span className="font-semibold" style={{ color: activeRoleDef.accentHex }}>
                Selecionada: {activeRoleDef.name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ASTRONAUT_ROLE_LIST.map((role) => {
                const isSelected = role.id === selectedRole;
                return (
                  <button
                    key={role.id}
                    type="button"
                    data-role-option={role.id}
                    aria-pressed={isSelected}
                    onClick={() => {
                      soundManager.playClick();
                      onSelectRole(role.id);
                    }}
                    className={`text-left rounded-xl p-3 border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-slate-900 shadow-lg'
                        : 'bg-slate-900/65 border-slate-800 hover:border-slate-600'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: role.accentHex,
                            boxShadow: `0 0 0 1px ${role.accentHex}55`,
                          }
                        : undefined
                    }
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {ROLE_ICON[role.id]}
                          <span className="text-xs font-black text-white truncate">
                            {role.name}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 shrink-0" style={{ color: role.accentHex }} />
                        )}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">{role.tagline}</div>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-slate-800/80 text-[10px] tabular-nums">
                      {role.highlights.map((h) => (
                        <div key={h.label} className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 truncate">{h.label}</span>
                          <span className="font-bold text-slate-100 whitespace-nowrap">{h.value}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4-Phase Evolution Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="text-slate-200 font-semibold">Obras &amp; Tempo</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center gap-2">
              <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-slate-200 font-semibold">Água &amp; Mineração</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-slate-200 font-semibold">8 Tecnologias</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-2 flex items-center gap-2">
              <Sprout className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-200 font-semibold">Defesa &amp; Mundo</span>
            </div>
          </div>

          {/* Threats Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2.5 text-xs">
              {threatsEnabled ? (
                <Crosshair className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div>
                <div className="font-bold text-white">
                  {threatsEnabled
                    ? 'Ameaças Marcianas Ativas (Combate & Torres)'
                    : 'Modo Pacífico (Apenas Construção & Exploração)'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {threatsEnabled
                    ? 'Rastejadores, Drones e Colossos atacam módulos e rendem recursos.'
                    : 'Sem ondas de ataque à colônia. Pode alternar a qualquer momento no HUD.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onToggleThreatsPref();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase cursor-pointer border transition-colors ${
                threatsEnabled
                  ? 'bg-red-950/90 border-red-500/70 text-red-200 hover:bg-red-900'
                  : 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200 hover:bg-emerald-900'
              }`}
            >
              {threatsEnabled ? 'Ativo' : 'Pacífico'}
            </button>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={() => {
                soundManager.playClick();
                onStartSolo();
              }}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-black tracking-wide rounded-xl shadow-lg cursor-pointer transition-colors flex items-center gap-2.5 text-sm sm:text-base whitespace-nowrap"
            >
              <Rocket className="w-5 h-5" />
              <span>JOGAR SOLO ({activeRoleDef.shortLabel})</span>
              <span className="text-[11px] bg-orange-800/80 px-2 py-0.5 rounded font-mono">
                [ENTER]
              </span>
            </button>

            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Física 0.38g · Papéis Co-op · Contratos Orbitais</span>
            </div>
          </div>
        </div>

        {/* Right: 3-Player Cooperative Multiplayer Lobby (Playgama Bridge) */}
        <div
          data-testid="playgama-multiplayer-panel"
          className="lg:col-span-5 pointer-events-auto bg-slate-950/90 border border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                    Cooperativo Online (Até 3)
                  </h2>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    {!playgamaStatus.isInitialized ? (
                      <span className="text-slate-400">Inicializando Playgama...</span>
                    ) : playgamaStatus.isSupported ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        Playgama Multiplayer Ativo
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <WifiOff className="w-3 h-3" />
                        Playgama Offline / Indisponível
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {playgamaStatus.isSupported && (
                <button
                  type="button"
                  onClick={loadRooms}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer shrink-0"
                  title="Atualizar salas Playgama"
                  aria-label="Atualizar salas abertas"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {!playgamaStatus.isInitialized ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-900/70 border border-slate-800 rounded-xl">
                Conectando ao serviço Playgama Bridge...
              </div>
            ) : !playgamaStatus.isSupported ? (
              <div
                data-testid="playgama-unsupported-notice"
                className="space-y-3 bg-slate-900/80 border border-amber-500/40 rounded-xl p-4 text-xs text-slate-300"
              >
                <div className="font-bold text-amber-300">
                  Modo Online indisponível neste ambiente
                </div>
                <p className="text-slate-400 leading-relaxed">
                  O multiplayer cooperativo usa o sistema <strong className="text-white">Playgama Bridge</strong>.
                  Verifique a conexão de rede ou abra o jogo no portal Playgama. Você pode jogar normalmente no modo <strong className="text-orange-300">Solo</strong>.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={
                    playgamaStatus.regions.length > 0
                      ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
                      : 'block'
                  }
                >
                  <div>
                    <label
                      htmlFor="coop-player-name"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                    >
                      Nome do Astronauta
                    </label>
                    <input
                      id="coop-player-name"
                      type="text"
                      maxLength={16}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Ex: Comandante Silva"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-medium focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {playgamaStatus.regions.length > 0 && (
                    <div>
                      <label
                        htmlFor="playgama-region-select"
                        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                      >
                        <Globe2 className="w-3 h-3 text-cyan-400" />
                        Região do Servidor
                      </label>
                      <select
                        id="playgama-region-select"
                        data-testid="playgama-region-select"
                        value={playgamaStatus.region || playgamaStatus.regions[0] || ''}
                        onChange={(e) => onSelectRegion(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        {playgamaStatus.regions.map((reg) => (
                          <option key={reg} value={reg}>
                            {formatPlaygamaRegionLabel(reg)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {ROLE_ICON[selectedRole]}
                    <div className="truncate">
                      <span className="text-slate-400">Classe: </span>
                      <strong className="text-white">{activeRoleDef.name}</strong>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {activeRoleDef.shortLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="playgama-quick-match-btn"
                    disabled={isConnecting}
                    onClick={() => {
                      soundManager.playClick();
                      onQuickMatchCoop(playerName, selectedRole);
                    }}
                    className="py-2.5 px-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                  >
                    <Zap className="w-4 h-4 shrink-0" />
                    <span>{isConnecting ? 'Conectando...' : 'Partida Rápida'}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="playgama-create-room-btn"
                    disabled={isConnecting}
                    onClick={() => {
                      soundManager.playClick();
                      onCreateCoopRoom(playerName, selectedRole, false);
                    }}
                    className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 disabled:opacity-60 text-cyan-100 font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 text-sm whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Criar Sala Privada</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={40}
                    data-testid="playgama-room-code-input"
                    value={roomCodeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRoomCodeInput(val.includes('-') ? val : val.toUpperCase());
                    }}
                    placeholder="CÓDIGO PLAYGAMA (EX: K7M4X9TR)"
                    aria-label="Código da sala Playgama"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    data-testid="playgama-join-code-btn"
                    disabled={isConnecting || !roomCodeInput.trim()}
                    onClick={() => {
                      soundManager.playClick();
                      onJoinCoopRoom(roomCodeInput.trim(), playerName, selectedRole);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 text-sm whitespace-nowrap"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Entrar</span>
                  </button>
                </div>

                {lobbyError && (
                  <div className="px-3 py-2 rounded-lg bg-red-950/90 border border-red-500/70 text-red-200 text-xs font-semibold">
                    {lobbyError}
                  </div>
                )}
              </>
            )}
          </div>

          {playgamaStatus.isSupported && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Salas Públicas na Região ({openRooms.length})
              </div>
              {openRooms.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-900/70 border border-slate-800 rounded-lg p-3 text-center">
                  Nenhuma sala pública ativa nesta região. Use <strong>Partida Rápida</strong> para iniciar!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {openRooms.map((room) => (
                    <div
                      key={room.code}
                      className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white flex items-center gap-2 min-w-0">
                          <span
                            className="font-mono text-cyan-400 shrink-0"
                            title={room.code}
                          >
                            {room.code.length > 10
                              ? `${room.code.slice(0, 8).toUpperCase()}`
                              : room.code}
                          </span>
                          <span className="text-slate-300 truncate">· {room.hostName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 tabular-nums">
                          <span>Habitabilidade: {Math.round(room.habitability)}%</span>
                          {room.roles && room.roles.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-slate-300">
                                {room.roles.map((r) => getAstronautRole(r).shortLabel).join(' / ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isConnecting || room.playerCount >= room.maxPlayers}
                        onClick={() => {
                          soundManager.playClick();
                          onJoinCoopRoom(room.code, playerName, selectedRole);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {room.playerCount}/{room.maxPlayers} Entrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Legend */}
      <div className="w-full text-center text-xs text-slate-300 bg-slate-950/85 border border-slate-800/80 rounded-xl px-4 py-2 max-w-5xl mx-auto pointer-events-none">
        {isMobileDetected
          ? 'Joystick Mover · Arraste Tela Girar Câmera · Pinça Zoom · Botões Toque: Atirar, Escavar, Jetpack e Ação'
          : 'WASD Mover · Espaço Pular · Shift Correr / Jetpack · [F] ou Clique Pulso Plasma · [E] Construir/Acelerar/Reparar · [T] Tech · Q/R Câmera'}
      </div>
    </div>
  );
};
