import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDeviceProfile,
  resolveQualityConfig,
  shouldShowTouchControls,
  AdaptivePerformanceMonitor,
} from './devicePerformance';

test('detectDeviceProfile identifies smartphones, tablets, desktop, and queryForceMobile accurately', () => {
  const iphone = detectDeviceProfile({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    maxTouchPoints: 5,
    hasTouchEvent: true,
    coarsePointer: true,
    hoverNone: true,
    viewportWidth: 390,
    viewportHeight: 844,
    devicePixelRatio: 3,
    hardwareConcurrency: 6,
    deviceMemoryGb: 4,
  });
  assert.equal(iphone.isMobile, true);
  assert.equal(iphone.isTablet, false);
  assert.equal(iphone.isTouchPrimary, true);
  assert.equal(iphone.isPortrait, true);
  assert.equal(iphone.isCompactScreen, true);

  const androidLandscape = detectDeviceProfile({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36',
    maxTouchPoints: 5,
    hasTouchEvent: true,
    coarsePointer: true,
    hoverNone: true,
    viewportWidth: 844,
    viewportHeight: 390,
    devicePixelRatio: 2.6,
    hardwareConcurrency: 8,
    deviceMemoryGb: 8,
  });
  assert.equal(androidLandscape.isMobile, true);
  assert.equal(androidLandscape.isPortrait, false);
  assert.equal(androidLandscape.isLowEndDevice, false);

  const desktop = detectDeviceProfile({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36',
    maxTouchPoints: 0,
    hasTouchEvent: false,
    coarsePointer: false,
    hoverNone: false,
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    hardwareConcurrency: 8,
    deviceMemoryGb: 16,
  });
  assert.equal(desktop.isMobile, false);
  assert.equal(desktop.isTablet, false);
  assert.equal(desktop.isTouchPrimary, false);
  assert.equal(shouldShowTouchControls('auto', desktop), false);
  assert.equal(shouldShowTouchControls('always', desktop), true);

  const forcedMobile = detectDeviceProfile({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/126.0',
    maxTouchPoints: 0,
    hasTouchEvent: false,
    coarsePointer: false,
    hoverNone: false,
    viewportWidth: 390,
    viewportHeight: 844,
    devicePixelRatio: 1,
    queryForceMobile: true,
  });
  assert.equal(forcedMobile.isMobile, true);
  assert.equal(forcedMobile.isTouchPrimary, true);
  assert.equal(shouldShowTouchControls('auto', forcedMobile), true);
  assert.equal(shouldShowTouchControls('hidden', forcedMobile), false);
});

test('resolveQualityConfig selects lighter geometry, textures, and pixel ratio caps for mobile and low-end devices', () => {
  const lowEndPhone = detectDeviceProfile({
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Moto G) Mobile',
    maxTouchPoints: 5,
    hasTouchEvent: true,
    coarsePointer: true,
    hoverNone: true,
    viewportWidth: 360,
    viewportHeight: 780,
    devicePixelRatio: 3,
    hardwareConcurrency: 4,
    deviceMemoryGb: 3,
  });

  const autoMobileCfg = resolveQualityConfig('auto', lowEndPhone, false);
  assert.equal(autoMobileCfg.tier, 'low');
  assert.equal(autoMobileCfg.terrainSegments, 72);
  assert.equal(autoMobileCfg.pixelRatioCap, 1.0);
  assert.equal(autoMobileCfg.antialias, false);

  const desktop = detectDeviceProfile({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15',
    maxTouchPoints: 0,
    hasTouchEvent: false,
    coarsePointer: false,
    hoverNone: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    devicePixelRatio: 2,
    hardwareConcurrency: 10,
    deviceMemoryGb: 16,
  });

  const autoDesktopCfg = resolveQualityConfig('auto', desktop, false);
  assert.equal(autoDesktopCfg.tier, 'high');
  assert.equal(autoDesktopCfg.terrainSegments, 128);
  assert.ok(autoDesktopCfg.pixelRatioCap <= 1.75);

  const manualLowDesktop = resolveQualityConfig('low', desktop, false);
  assert.equal(manualLowDesktop.tier, 'low');
  assert.equal(manualLowDesktop.enableBumpMap, false);
});

test('AdaptivePerformanceMonitor dynamically lowers pixelRatio under sustained low FPS and recovers on high FPS', () => {
  const monitor = new AdaptivePerformanceMonitor(1.4, 0.8, 1.5, true);

  // Feed 90 slow frames (~25fps -> 0.04s each = 3.6s total)
  let steppedDownTo: number | null = null;
  for (let i = 0; i < 90; i++) {
    const next = monitor.recordFrame(0.04);
    if (next !== null) {
      steppedDownTo = next;
      break;
    }
  }
  assert.ok(steppedDownTo !== null && steppedDownTo < 1.4, 'Should step down pixel ratio under sustained 25fps');

  // Now feed sustained 60fps frames (0.016s each for ~7s) to verify recovery
  let recoveredTo: number | null = null;
  for (let i = 0; i < 450; i++) {
    const next = monitor.recordFrame(0.016);
    if (next !== null && next > steppedDownTo!) {
      recoveredTo = next;
      break;
    }
  }
  assert.ok(recoveredTo !== null && recoveredTo > steppedDownTo!, 'Should recover pixel ratio when FPS stabilizes at 60fps');
});
