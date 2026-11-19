/**
 * Device Detection, Mobile Layout Adaptation & Adaptive Performance Engine
 * Designed for smooth 60FPS playback across mobile phones, tablets, and online web game portals.
 */

export type QualityPreset = 'auto' | 'low' | 'medium' | 'high';
export type ResolvedQualityTier = 'low' | 'medium' | 'high';
export type TouchControlsMode = 'auto' | 'always' | 'hidden';

export interface DeviceSignals {
  userAgent: string;
  maxTouchPoints: number;
  hasTouchEvent: boolean;
  coarsePointer: boolean;
  hoverNone: boolean;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  queryForceMobile?: boolean;
}

export interface DeviceProfile {
  isMobile: boolean;
  isTablet: boolean;
  isTouchPrimary: boolean;
  isCompactScreen: boolean;
  isPortrait: boolean;
  isLowEndDevice: boolean;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
}

export interface QualityConfig {
  tier: ResolvedQualityTier;
  pixelRatioCap: number;
  minDynamicPixelRatio: number;
  antialias: boolean;
  terrainSegments: number;
  terrainTextureSize: number;
  rockCount: number;
  floraCount: number;
  maxDustParticles: number;
  farClip: number;
  maxAnisotropy: number;
  hudSyncIntervalMs: number;
  enableBumpMap: boolean;
  enableEnvMap: boolean;
  enableStarfieldCount: number;
}

const MOBILE_UA_RE = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const TABLET_UA_RE = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i;

export function detectDeviceProfile(signals: DeviceSignals): DeviceProfile {
  const width = Math.max(1, signals.viewportWidth);
  const height = Math.max(1, signals.viewportHeight);
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const hasTouch = signals.maxTouchPoints > 0 || signals.hasTouchEvent || Boolean(signals.queryForceMobile);

  const uaTablet = TABLET_UA_RE.test(signals.userAgent);
  const uaMobile = !uaTablet && MOBILE_UA_RE.test(signals.userAgent);

  // Compact viewport or coarse-pointer touch phone
  const isCompactScreen = shortSide <= 540 || width <= 820;
  const isMobile =
    Boolean(signals.queryForceMobile) ||
    uaMobile ||
    (hasTouch && (signals.coarsePointer || signals.hoverNone) && shortSide <= 560) ||
    (shortSide <= 520 && longSide <= 960 && hasTouch);

  const isTablet =
    !isMobile &&
    (uaTablet ||
      (hasTouch && (signals.coarsePointer || signals.hoverNone) && shortSide > 560 && shortSide <= 1024));

  const isTouchPrimary = Boolean(signals.queryForceMobile) || isMobile || isTablet || (hasTouch && signals.coarsePointer);
  const isPortrait = height > width;

  const cores = Math.max(1, signals.hardwareConcurrency ?? 4);
  const memory = Math.max(1, signals.deviceMemoryGb ?? (isMobile ? 4 : 8));
  const isLowEndDevice = cores <= 4 || memory <= 3 || (isMobile && (cores <= 6 || memory <= 4));

  return {
    isMobile,
    isTablet,
    isTouchPrimary,
    isCompactScreen: isCompactScreen || isMobile,
    isPortrait,
    isLowEndDevice,
    viewportWidth: width,
    viewportHeight: height,
    devicePixelRatio: Math.max(1, signals.devicePixelRatio || 1),
    hardwareConcurrency: cores,
    deviceMemoryGb: memory,
  };
}

export function readBrowserDeviceProfile(): DeviceProfile {
  if (typeof window === 'undefined') {
    return detectDeviceProfile({
      userAgent: '',
      maxTouchPoints: 0,
      hasTouchEvent: false,
      coarsePointer: false,
      hoverNone: false,
      viewportWidth: 1440,
      viewportHeight: 900,
      devicePixelRatio: 1,
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
    });
  }

  const params = new URLSearchParams(window.location.search);
  const queryForceMobile = params.get('mobile') === '1' || params.get('touch') === '1';
  const nav = navigator as Navigator & { deviceMemory?: number };

  return detectDeviceProfile({
    userAgent: navigator.userAgent || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasTouchEvent: 'ontouchstart' in window,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    hoverNone: window.matchMedia?.('(hover: none)').matches ?? false,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGb: nav.deviceMemory,
    queryForceMobile,
  });
}

export function resolveQualityConfig(
  preset: QualityPreset,
  profile: DeviceProfile,
  isSoftwareGl: boolean
): QualityConfig {
  let tier: ResolvedQualityTier;
  if (preset !== 'auto') {
    tier = preset;
  } else if (isSoftwareGl) {
    tier = 'low';
  } else if (profile.isMobile) {
    tier = profile.isLowEndDevice ? 'low' : 'medium';
  } else if (profile.isTablet) {
    tier = 'medium';
  } else {
    tier = profile.hardwareConcurrency <= 2 ? 'medium' : 'high';
  }

  if (tier === 'low') {
    return {
      tier: 'low',
      pixelRatioCap: isSoftwareGl ? 0.75 : 1.0,
      minDynamicPixelRatio: 0.7,
      antialias: false,
      terrainSegments: 72,
      terrainTextureSize: 256,
      rockCount: 72,
      floraCount: 42,
      maxDustParticles: 96,
      farClip: 240,
      maxAnisotropy: 1,
      hudSyncIntervalMs: 180,
      enableBumpMap: false,
      enableEnvMap: false,
      enableStarfieldCount: 280,
    };
  }

  if (tier === 'medium') {
    return {
      tier: 'medium',
      pixelRatioCap: profile.isMobile ? 1.3 : 1.5,
      minDynamicPixelRatio: 0.8,
      antialias: !profile.isMobile && !isSoftwareGl,
      terrainSegments: 96,
      terrainTextureSize: 384,
      rockCount: 104,
      floraCount: 68,
      maxDustParticles: 168,
      farClip: 340,
      maxAnisotropy: 2,
      hudSyncIntervalMs: 145,
      enableBumpMap: true,
      enableEnvMap: true,
      enableStarfieldCount: 480,
    };
  }

  return {
    tier: 'high',
    pixelRatioCap: Math.min(1.75, profile.devicePixelRatio),
    minDynamicPixelRatio: 0.9,
    antialias: !isSoftwareGl,
    terrainSegments: 128,
    terrainTextureSize: 512,
    rockCount: 140,
    floraCount: 95,
    maxDustParticles: 260,
    farClip: 480,
    maxAnisotropy: 4,
    hudSyncIntervalMs: 115,
    enableBumpMap: true,
    enableEnvMap: true,
    enableStarfieldCount: 680,
  };
}

export function shouldShowTouchControls(
  mode: TouchControlsMode,
  profile: DeviceProfile
): boolean {
  if (mode === 'always') return true;
  if (mode === 'hidden') return false;
  return profile.isTouchPrimary;
}

/**
 * Zero-allocation rolling FPS monitor that smoothly adjusts WebGL pixelRatio
 * during gameplay on mobile & online game platforms to prevent frame drops.
 */
export class AdaptivePerformanceMonitor {
  private readonly samples = new Float32Array(30);
  private sampleIndex = 0;
  private sampleCount = 0;
  private lowFpsDurationSec = 0;
  private highFpsDurationSec = 0;
  private currentPixelRatio: number;
  private minPixelRatio: number;
  private maxPixelRatio: number;
  private enabled: boolean;

  constructor(
    initialPixelRatio: number,
    minPixelRatio: number,
    maxPixelRatio: number,
    enabled: boolean
  ) {
    this.currentPixelRatio = initialPixelRatio;
    this.minPixelRatio = minPixelRatio;
    this.maxPixelRatio = maxPixelRatio;
    this.enabled = enabled;
  }

  public reconfigure(
    targetPixelRatio: number,
    minPixelRatio: number,
    maxPixelRatio: number,
    enabled: boolean
  ) {
    this.currentPixelRatio = Math.max(minPixelRatio, Math.min(maxPixelRatio, targetPixelRatio));
    this.minPixelRatio = minPixelRatio;
    this.maxPixelRatio = maxPixelRatio;
    this.enabled = enabled;
    this.lowFpsDurationSec = 0;
    this.highFpsDurationSec = 0;
    this.sampleCount = 0;
    this.sampleIndex = 0;
  }

  public getPixelRatio(): number {
    return this.currentPixelRatio;
  }

  public getAverageFps(): number {
    if (this.sampleCount === 0) return 60;
    let totalDt = 0;
    for (let i = 0; i < this.sampleCount; i++) {
      totalDt += this.samples[i];
    }
    const avgDt = totalDt / this.sampleCount;
    return avgDt > 0.0001 ? Math.min(120, 1 / avgDt) : 60;
  }

  /**
   * Records a frame delta (seconds) and returns a new pixelRatio if dynamic scaling stepped up/down,
   * or null if no change is required.
   */
  public recordFrame(dtSec: number): number | null {
    if (!this.enabled) return null;
    // Ignore tab-switch spikes or zero frames
    if (dtSec <= 0.002 || dtSec > 0.25) return null;

    this.samples[this.sampleIndex] = dtSec;
    this.sampleIndex = (this.sampleIndex + 1) % this.samples.length;
    if (this.sampleCount < this.samples.length) this.sampleCount++;

    if (this.sampleCount < 20) return null;

    const avgFps = this.getAverageFps();

    if (avgFps < 40) {
      this.lowFpsDurationSec += dtSec;
      this.highFpsDurationSec = 0;
      if (this.lowFpsDurationSec >= 2.0 && this.currentPixelRatio > this.minPixelRatio + 0.02) {
        this.lowFpsDurationSec = 0;
        this.currentPixelRatio = Math.max(
          this.minPixelRatio,
          Math.round((this.currentPixelRatio - 0.15) * 100) / 100
        );
        return this.currentPixelRatio;
      }
    } else if (avgFps >= 55) {
      this.highFpsDurationSec += dtSec;
      this.lowFpsDurationSec = 0;
      if (this.highFpsDurationSec >= 5.0 && this.currentPixelRatio < this.maxPixelRatio - 0.02) {
        this.highFpsDurationSec = 0;
        this.currentPixelRatio = Math.min(
          this.maxPixelRatio,
          Math.round((this.currentPixelRatio + 0.1) * 100) / 100
        );
        return this.currentPixelRatio;
      }
    } else {
      this.lowFpsDurationSec = Math.max(0, this.lowFpsDurationSec - dtSec * 0.5);
      this.highFpsDurationSec = Math.max(0, this.highFpsDurationSec - dtSec * 0.5);
    }

    return null;
  }
}

export const QUALITY_PRESET_LABELS: Record<QualityPreset, string> = {
  auto: 'Auto',
  low: 'Desempenho',
  medium: 'Equilibrado',
  high: 'Alto',
};
