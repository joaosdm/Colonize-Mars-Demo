/**
 * Colonize Mars - Main Application
 * Multiplatform 3D Arcade Idle & Base Building Experience
 * Supports:
 * - Desktop (Keyboard / Mouse)
 * - Mobile / Tablet (Virtual Touch Joystick & Ergonomic Buttons)
 * - Smart TV & Console (Gamepad API & Remote Control D-Pad / Enter)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MarsSurfaceScene, InteractiveTriggerZone } from './graphics/MarsSurfaceScene';
import { MarsColonyHUD } from './components/MarsColonyHUD';
import { TouchControls } from './components/TouchControls';
import { FloatingBillboards, ResourcePopupItem } from './components/FloatingBillboards';
import { CutsceneOverlay } from './components/CutsceneOverlay';
import { PauseModal, VictoryModal, GameOverModal } from './components/StatusModals';
import { soundManager } from './audio/soundManager';
import {
  ColonyState,
  ColonyObjective,
  INITIAL_OBJECTIVES,
  createInitialColonyState,
  updateColonyTick,
} from './sim/marsColonyLogic';

type GameState = 'cutscene' | 'playing' | 'paused' | 'gameover';
type InputDeviceType = 'keyboard' | 'touch' | 'gamepad';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MarsSurfaceScene | null>(null);

  // Game States
  const [gameState, setGameState] = useState<GameState>('cutscene');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [gameOverReason, setGameOverReason] = useState<string>('');
  const [activeInputDevice, setActiveInputDevice] = useState<InputDeviceType>('keyboard');
  const [isTouchSupported, setIsTouchSupported] = useState<boolean>(false);

  // Colonization Objectives & State
  const [colonyState, setColonyState] = useState<ColonyState>(createInitialColonyState());
  const [objectives, setObjectives] = useState<ColonyObjective[]>(INITIAL_OBJECTIVES);
  const [activeTrigger, setActiveTrigger] = useState<InteractiveTriggerZone | null>(null);
  const [resourcePopups, setResourcePopups] = useState<ResourcePopupItem[]>([]);

  // Input tracking
  const keyboardMovement = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMovement = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isJumpPressed = useRef<boolean>(false);
  const wasJumpPressedLastFrame = useRef<boolean>(false);
  const wasActionPressedLastFrame = useRef<boolean>(false);

  // Active current objective
  const currentObjective = objectives.find((o) => !o.isCompleted) || null;

  // Detect Touchscreen device
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchSupported(isTouch);
      if (isTouch) {
        setActiveInputDevice('touch');
      }
    }
  }, []);

  // Cleanup old resource popups
  useEffect(() => {
    if (resourcePopups.length === 0) return;
    const timer = setInterval(() => {
      const now = performance.now();
      setResourcePopups((prev) => prev.filter((p) => now - p.timestamp < 1200));
    }, 200);
    return () => clearInterval(timer);
  }, [resourcePopups.length]);

  // Handle Resource Pickup (Magnet Effect)
  const handleResourceCollected = useCallback(
    (type: 'regolith' | 'ice', worldPos: THREE.Vector3) => {
      const scene = sceneRef.current;
      soundManager.playResourcePickup(type);

      // Project worldPos to screen for popup
      let screenX = window.innerWidth / 2;
      let screenY = window.innerHeight / 2;
      if (scene && scene.camera) {
        const proj = worldPos.clone().project(scene.camera);
        screenX = (proj.x * 0.5 + 0.5) * window.innerWidth;
        screenY = (-(proj.y * 0.5) + 0.5) * window.innerHeight;
      }

      const isReg = type === 'regolith';
      setResourcePopups((prev) => [
        ...prev,
        {
          id: `pop-${performance.now()}-${Math.random()}`,
          text: isReg ? '+1 Regolito' : '+1 Gelo',
          color: isReg ? '#f59e0b' : '#38bdf8',
          screenX,
          screenY,
          timestamp: performance.now(),
        },
      ]);

      setColonyState((prev) => {
        const nextRegolith = isReg ? prev.regolith + 1 : prev.regolith;
        const nextIce = !isReg ? prev.waterIce + 1 : prev.waterIce;

        // Auto-complete Mission 2 if player collects 5 regolith
        if (isReg && nextRegolith >= 5 && prev.stage === 1) {
          soundManager.playBuildComplete();
          setObjectives((objs) =>
            objs.map((o) => (o.id === 'obj-2-regolith' ? { ...o, isCompleted: true } : o))
          );
          return {
            ...prev,
            regolith: nextRegolith,
            stage: 2,
          };
        }

        return {
          ...prev,
          regolith: nextRegolith,
          waterIce: nextIce,
        };
      });
    },
    []
  );

  // Handle Trigger Completion (Auto-fill or Instant Action)
  const handleTriggerCompleted = useCallback((triggerId: string) => {
    if (triggerId === 'trigger-moxie') {
      // Mission 1: Ativar MOXIE
      soundManager.playBuildComplete();
      setColonyState((prev) => ({
        ...prev,
        stage: 1,
        habitability: 15,
        oxygen: 100,
        buildings: { ...prev.buildings, moxie: true },
      }));
      setObjectives((objs) =>
        objs.map((o) => (o.id === 'obj-1-moxie' ? { ...o, isCompleted: true } : o))
      );
    } else if (triggerId === 'trigger-solar') {
      // Mission 3: Construir Matriz Solar
      soundManager.playBuildComplete();
      setColonyState((prev) => ({
        ...prev,
        stage: 3,
        regolith: Math.max(0, prev.regolith - 5),
        energy: prev.energy + 20,
        habitability: 35,
        buildings: { ...prev.buildings, solarPanels: true },
      }));
      setObjectives((objs) =>
        objs.map((o) => (o.id === 'obj-3-solar' ? { ...o, isCompleted: true } : o))
      );
    } else if (triggerId === 'trigger-biodome') {
      // Mission 4: Construir Biodomo
      soundManager.playBuildComplete();
      setColonyState((prev) => ({
        ...prev,
        stage: 4,
        waterIce: Math.max(0, prev.waterIce - 5),
        habitability: 65,
        oxygen: 100,
        buildings: { ...prev.buildings, bioDome: true },
      }));
      setObjectives((objs) =>
        objs.map((o) => (o.id === 'obj-4-biodome' ? { ...o, isCompleted: true } : o))
      );
    } else if (triggerId === 'trigger-habitat') {
      // Mission 5: Construir Habitat Pressurizado -> Vitória!
      soundManager.playMissionComplete();
      setColonyState((prev) => ({
        ...prev,
        stage: 5,
        habitability: 100,
        buildings: { ...prev.buildings, habitat: true },
      }));
      setObjectives((objs) =>
        objs.map((o) => (o.id === 'obj-5-habitat' ? { ...o, isCompleted: true } : o))
      );
      setIsVictory(true);
      setGameState('gameover');
    }
  }, []);

  // Instant Trigger Action Button (E key / Enter / Touch Action button / Gamepad X)
  const handleInstantAction = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.currentTrigger) return;
    const trigger = scene.currentTrigger;
    if (trigger.hasRequirements) {
      handleTriggerCompleted(trigger.id);
    }
  }, [handleTriggerCompleted]);

  // Callback refs to ensure scene is mounted ONCE and never torn down on state updates
  const handleResourceCollectedRef = useRef(handleResourceCollected);
  handleResourceCollectedRef.current = handleResourceCollected;

  const handleTriggerCompletedRef = useRef(handleTriggerCompleted);
  handleTriggerCompletedRef.current = handleTriggerCompleted;

  // Mount 3D Three.js Scene ONCE (empty deps [])
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new MarsSurfaceScene({
      container: mountRef.current,
      onCutsceneEnd: () => {
        setGameState('playing');
        soundManager.playMissionComplete();
      },
      onResourceCollected: (type, pos) => {
        handleResourceCollectedRef.current(type, pos);
      },
      onTriggerCompleted: (triggerId) => {
        handleTriggerCompletedRef.current(triggerId);
      },
    });

    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Audio Mute Toggle
  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  }, [isMuted]);

  // Skip Cutscene
  const handleSkipCutscene = () => {
    if (sceneRef.current) {
      sceneRef.current.skipCutscene();
    }
    setGameState('playing');
    soundManager.playMissionComplete();
  };

  // Persistent keyboard key tracking
  const activeKeys = useRef<Set<string>>(new Set());

  // Keyboard & TV Remote Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setActiveInputDevice('keyboard');
      activeKeys.current.add(e.code);

      // Pause toggle
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'playing') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
        return;
      }

      // Cutscene skip
      if (gameState === 'cutscene' && (e.code === 'Space' || e.code === 'Enter')) {
        handleSkipCutscene();
        return;
      }

      // Jump
      if (e.code === 'Space') {
        isJumpPressed.current = true;
        soundManager.playJumpThruster();
      }

      // Action / Instant Trigger
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        handleInstantAction();
      }

      updateKeyboardVector();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.current.delete(e.code);
      if (e.code === 'Space') {
        isJumpPressed.current = false;
      }
      updateKeyboardVector();
    };

    const handleBlur = () => {
      activeKeys.current.clear();
      updateKeyboardVector();
    };

    const updateKeyboardVector = () => {
      let x = 0;
      let y = 0;
      const keys = activeKeys.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

      // Normalize diagonal
      const mag = Math.sqrt(x * x + y * y);
      if (mag > 0) {
        x /= mag;
        y /= mag;
      }
      keyboardMovement.current = { x, y };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState, handleInstantAction]);

  // Main 60FPS Simulation Loop
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let totalTime = 0;

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      totalTime += dt;

      const scene = sceneRef.current;
      if (!scene) {
        animId = requestAnimationFrame(tick);
        return;
      }

      // 1. OPENING CUTSCENE MODE
      if (gameState === 'cutscene') {
        scene.updateCutscene(dt);
        scene.render();
        animId = scene.scheduleNextFrame(tick);
        return;
      }

      // 2. PAUSED OR GAMEOVER MODE
      if (gameState === 'paused' || gameState === 'gameover') {
        scene.render();
        animId = scene.scheduleNextFrame(tick);
        return;
      }

      // 3. GAMEPAD API & TV REMOTE D-PAD POLLING
      let gpX = 0;
      let gpY = 0;
      let gpJump = false;
      let gpAction = false;

      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
          const gp = gamepads[i];
          if (gp && gp.connected) {
            // Analog stick deadzone 0.15
            const ax = gp.axes[0] || 0;
            const ay = gp.axes[1] || 0;
            if (Math.abs(ax) > 0.15) gpX = ax;
            if (Math.abs(ay) > 0.15) gpY = ay;

            // D-Pad buttons
            if (gp.buttons[14]?.pressed) gpX = -1; // Left
            if (gp.buttons[15]?.pressed) gpX = 1; // Right
            if (gp.buttons[12]?.pressed) gpY = -1; // Up
            if (gp.buttons[13]?.pressed) gpY = 1; // Down

            // Button South (A / Cross) for Jump
            if (gp.buttons[0]?.pressed) gpJump = true;

            // Button West (X / Square) or Button East (B / Circle) for Action
            if (gp.buttons[2]?.pressed || gp.buttons[1]?.pressed) gpAction = true;

            if (Math.abs(gpX) > 0.1 || Math.abs(gpY) > 0.1 || gpJump || gpAction) {
              setActiveInputDevice('gamepad');
            }
            break;
          }
        }
      }

      // Handle Gamepad Jump edge trigger
      if (gpJump && !wasJumpPressedLastFrame.current) {
        soundManager.playJumpThruster();
      }
      wasJumpPressedLastFrame.current = gpJump;

      // Handle Gamepad Action edge trigger
      if (gpAction && !wasActionPressedLastFrame.current) {
        handleInstantAction();
      }
      wasActionPressedLastFrame.current = gpAction;

      // Combine input vector (Gamepad > Touch > Keyboard)
      const inputVector = {
        x: gpX || touchMovement.current.x || keyboardMovement.current.x,
        y: gpY || touchMovement.current.y || keyboardMovement.current.y,
      };

      const jumpActive = gpJump || isJumpPressed.current;

      // Update Astronaut movement & low-gravity jump
      scene.updatePlayerPhysics(inputVector, jumpActive, dt, totalTime);

      // Update Magnet Pickups & Trigger Zones
      scene.updateInteractiveSystems(colonyState, dt, totalTime);

      // Sync active trigger with React state for floating billboard
      setActiveTrigger(scene.currentTrigger);

      // Sync Colony 3D structures (MOXIE beam & aura, build rings)
      scene.syncColonyStructures(colonyState, totalTime);

      // Check proximity to safe O2 source (Lander or MOXIE active aura)
      const dLander = Math.sqrt(Math.pow(scene.playerPos.x, 2) + Math.pow(scene.playerPos.z, 2));
      const isNearO2 = dLander < 9.0 || (colonyState.buildings.moxie && dLander < 14.0) || colonyState.buildings.bioDome;

      // Update Colony Tick (Oxygen consumption / recharge)
      setColonyState((prev) => {
        const next = updateColonyTick(prev, dt, isNearO2);

        // Low-O2 audio warning
        if (next.oxygen < 25 && next.oxygen > 0) {
          soundManager.playLowO2Warning();
        }

        // Oxygen Depletion Game Over
        if (next.oxygen <= 0 && gameState === 'playing' && !prev.isSandboxMode) {
          soundManager.playLowO2Warning();
          setGameOverReason('Asfixia: O suprimento de oxigênio do seu traje esgotou.');
          setGameState('gameover');
        }

        return next;
      });

      scene.render();
      animId = scene.scheduleNextFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(animId);
    };
  }, [gameState, colonyState, handleInstantAction]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 1. Three.js Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

      {/* 2. Floating 3D Billboards & +1 Resource Popups */}
      {gameState === 'playing' && (
        <FloatingBillboards
          camera={sceneRef.current?.camera || null}
          activeTrigger={activeTrigger}
          popups={resourcePopups}
        />
      )}

      {/* 3. Opening Cinematic Descent Cutscene Overlay */}
      {gameState === 'cutscene' && <CutsceneOverlay onSkip={handleSkipCutscene} />}

      {/* 4. Minimalist HUD */}
      {gameState === 'playing' && (
        <MarsColonyHUD
          colonyState={colonyState}
          currentObjective={currentObjective}
          isMuted={isMuted}
          activeInputDevice={activeInputDevice}
          onToggleMute={handleToggleMute}
          onPause={() => setGameState('paused')}
        />
      )}

      {/* 5. Mobile & Tablet Touch Controls */}
      {gameState === 'playing' && isTouchSupported && (
        <TouchControls
          onMoveChange={(vec) => {
            touchMovement.current = vec;
            if (vec.x !== 0 || vec.y !== 0) {
              setActiveInputDevice('touch');
            }
          }}
          onJumpPress={(pressed) => {
            isJumpPressed.current = pressed;
            if (pressed) {
              setActiveInputDevice('touch');
              soundManager.playJumpThruster();
            }
          }}
          onActionPress={() => {
            setActiveInputDevice('touch');
            handleInstantAction();
          }}
          hasActiveTrigger={!!activeTrigger?.hasRequirements}
        />
      )}

      {/* 6. Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={() => setGameState('playing')}
          onRestart={() => {
            setColonyState(createInitialColonyState());
            setObjectives(INITIAL_OBJECTIVES);
            setGameState('playing');
            if (sceneRef.current) sceneRef.current.skipCutscene();
          }}
        />
      )}

      {/* 7. Victory Modal (All 5 Missions Complete) */}
      {gameState === 'gameover' && isVictory && (
        <VictoryModal
          colonyState={colonyState}
          onContinueSandbox={() => {
            setColonyState((prev) => ({ ...prev, isSandboxMode: true }));
            setIsVictory(false);
            setGameState('playing');
          }}
          onRestart={() => {
            setColonyState(createInitialColonyState());
            setObjectives(INITIAL_OBJECTIVES);
            setIsVictory(false);
            setGameState('cutscene');
            window.location.reload();
          }}
        />
      )}

      {/* 8. Game Over Modal (Oxygen Depletion) */}
      {gameState === 'gameover' && !isVictory && (
        <GameOverModal
          reason={gameOverReason}
          onRestart={() => {
            setColonyState(createInitialColonyState());
            setObjectives(INITIAL_OBJECTIVES);
            setGameState('playing');
            if (sceneRef.current) sceneRef.current.skipCutscene();
          }}
        />
      )}
    </div>
  );
}
