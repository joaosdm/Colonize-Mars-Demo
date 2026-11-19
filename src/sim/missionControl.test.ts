import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_OBJECTIVES_COUNT,
  createInitialMissionControlState,
  generateDailyObjectives,
  progressDailyObjectives,
  rerollDailyObjectives,
  syncMissionControlSol,
} from './missionControl';

test('generateDailyObjectives produces 3 unique randomized objectives', () => {
  let seed = 0.13;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const objectives = generateDailyObjectives(1, true, rng);
  assert.equal(objectives.length, DAILY_OBJECTIVES_COUNT);

  const kinds = new Set(objectives.map((o) => o.kind));
  assert.equal(kinds.size, DAILY_OBJECTIVES_COUNT);
  for (const obj of objectives) {
    assert.equal(obj.progress, 0);
    assert.equal(obj.completed, false);
    assert.equal(obj.rewardClaimed, false);
    assert.ok(obj.target >= 1);
    assert.ok(obj.rewardText.length > 0);
  }
});

test('peaceful mode excludes combat objective from daily generation', () => {
  const objectives = generateDailyObjectives(2, false, () => 0.42);
  assert.equal(objectives.length, 3);
  assert.equal(
    objectives.some((o) => o.kind === 'defeat-enemies'),
    false
  );
});

test('progressDailyObjectives completes objectives and returns bonus rewards once', () => {
  let state = createInitialMissionControlState(1, true, () => 0.1);
  // Guarantee a known objective set containing gather-regolith (target 50) & repair-modules (target 3)
  state = {
    ...state,
    objectives: [
      {
        id: 'test-regolith',
        kind: 'gather-regolith',
        title: 'Coletar 50 Regolito',
        description: 'Gather 50 Regolith',
        progress: 0,
        target: 50,
        completed: false,
        rewardClaimed: false,
        reward: { water: 12, biomass: 6, oxygenRefill: true },
        rewardText: '+12 Água · +6 Biomassa · 100% O2',
      },
      {
        id: 'test-repair',
        kind: 'repair-modules',
        title: 'Reparar 3 Módulos',
        description: 'Repair 3 Modules',
        progress: 0,
        target: 3,
        completed: false,
        rewardClaimed: false,
        reward: { regolith: 14, water: 10, repairAllPct: 15 },
        rewardText: '+14 Regolito · +10 Água · +15% Reparo Global',
      },
      {
        id: 'test-build',
        kind: 'complete-build',
        title: 'Concluir 1 Construção ou Plantio',
        description: 'Complete 1 build',
        progress: 0,
        target: 1,
        completed: false,
        rewardClaimed: false,
        reward: { regolith: 10, waterIce: 8, water: 5 },
        rewardText: '+10 Regolito · +8 Gelo · +5 Água',
      },
    ],
  };

  const partial = progressDailyObjectives(state, 'gather-regolith', 30);
  assert.equal(partial.newlyCompleted.length, 0);
  assert.equal(partial.state.objectives[0].progress, 30);
  assert.equal(partial.state.objectives[0].completed, false);

  const done = progressDailyObjectives(partial.state, 'gather-regolith', 25);
  assert.equal(done.newlyCompleted.length, 1);
  assert.equal(done.state.objectives[0].progress, 50);
  assert.equal(done.state.objectives[0].completed, true);
  assert.equal(done.state.objectives[0].rewardClaimed, true);
  assert.equal(done.grantedReward.water, 12);
  assert.equal(done.grantedReward.biomass, 6);
  assert.equal(done.grantedReward.oxygenRefill, true);
  assert.equal(done.state.totalCompletedCount, 1);

  // Subsequent regolith gathers do not double-grant reward
  const extra = progressDailyObjectives(done.state, 'gather-regolith', 10);
  assert.equal(extra.newlyCompleted.length, 0);
  assert.equal(extra.state.totalCompletedCount, 1);

  // Repair 3 modules progression
  const r1 = progressDailyObjectives(extra.state, 'repair-modules', 1);
  const r2 = progressDailyObjectives(r1.state, 'repair-modules', 1);
  const r3 = progressDailyObjectives(r2.state, 'repair-modules', 1);
  assert.equal(r3.newlyCompleted.length, 1);
  assert.equal(r3.grantedReward.regolith, 14);
  assert.equal(r3.grantedReward.repairAllPct, 15);
  assert.equal(r3.state.totalCompletedCount, 2);
});

test('syncMissionControlSol rotates 3 daily objectives when advancing Sol and reroll respects daily limit', () => {
  const initial = createInitialMissionControlState(1, true, () => 0.25);

  const sameSol = syncMissionControlSol(initial, 1, true, () => 0.75);
  assert.equal(sameSol.rotated, false);

  const reroll1 = rerollDailyObjectives(initial, true, () => 0.8);
  assert.equal(reroll1.rerolled, true);
  assert.equal(reroll1.state.rerollsUsedForSol, 1);

  // Second reroll before completing all 3 is blocked on same Sol
  const reroll2 = rerollDailyObjectives(reroll1.state, true, () => 0.5);
  assert.equal(reroll2.rerolled, false);

  // Advancing to Sol 2 rotates objectives and resets reroll counter
  const nextSol = syncMissionControlSol(reroll1.state, 2, true, () => 0.6);
  assert.equal(nextSol.rotated, true);
  assert.equal(nextSol.state.currentSol, 2);
  assert.equal(nextSol.state.rerollsUsedForSol, 0);
  assert.equal(nextSol.state.objectives.length, 3);
});

test('applyMissionControlProgress and rerollColonyMissionControl gate on Habitat and pay out ColonyState bonuses', async () => {
  const {
    createInitialColonyState,
    applyMissionControlProgress,
    rerollColonyMissionControl,
  } = await import('./marsColonyLogic');

  const preHabitat = createInitialColonyState(true);
  const blockedProg = applyMissionControlProgress(preHabitat, 'gather-regolith', 50);
  assert.equal(blockedProg.completedDailyTitles.length, 0);
  const blockedReroll = rerollColonyMissionControl(preHabitat, () => 0.3);
  assert.equal(blockedReroll.rerolled, false);

  const builtState = {
    ...preHabitat,
    water: 0,
    oxygen: 60,
    oxygenMax: 125,
    buildings: {
      ...preHabitat.buildings,
      moxie: true,
      habitat: true,
    },
    buildingHealth: {
      ...preHabitat.buildingHealth,
      moxie: 70,
    },
    missionControl: {
      ...preHabitat.missionControl,
      objectives: [
        {
          id: 'col-regolith',
          kind: 'gather-regolith' as const,
          title: 'Coletar 50 Regolito',
          description: 'Gather 50 Regolith',
          progress: 0,
          target: 50,
          completed: false,
          rewardClaimed: false,
          reward: { water: 12, biomass: 6, oxygenRefill: true },
          rewardText: '+12 Água · +6 Biomassa · 100% O2',
        },
        {
          id: 'col-repair',
          kind: 'repair-modules' as const,
          title: 'Reparar 3 Módulos',
          description: 'Repair 3 Modules',
          progress: 0,
          target: 3,
          completed: false,
          rewardClaimed: false,
          reward: { regolith: 14, water: 10, repairAllPct: 15 },
          rewardText: '+14 Regolito · +10 Água · +15% Reparo Global',
        },
        {
          id: 'col-build',
          kind: 'complete-build' as const,
          title: 'Concluir 1 Construção ou Plantio',
          description: 'Complete 1 build',
          progress: 0,
          target: 1,
          completed: false,
          rewardClaimed: false,
          reward: { regolith: 10, waterIce: 8, water: 5 },
          rewardText: '+10 Regolito · +8 Gelo · +5 Água',
        },
      ],
    },
  };

  const afterRegolith = applyMissionControlProgress(builtState, 'gather-regolith', 50);
  assert.equal(afterRegolith.completedDailyTitles.length, 1);
  assert.equal(afterRegolith.state.water, 12);
  assert.equal(afterRegolith.state.biomass, 6);
  assert.equal(afterRegolith.state.oxygen, 125);

  const afterRepair = applyMissionControlProgress(afterRegolith.state, 'repair-modules', 3);
  assert.equal(afterRepair.completedDailyTitles.length, 1);
  assert.equal(afterRepair.state.regolith, 14);
  assert.equal(afterRepair.state.water, 22);
  assert.equal(afterRepair.state.buildingHealth.moxie, 85);

  const allowedReroll = rerollColonyMissionControl(afterRepair.state, () => 0.45);
  assert.equal(allowedReroll.rerolled, true);
  assert.equal(allowedReroll.state.missionControl.objectives.length, 3);
});

