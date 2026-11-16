import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialColonyState,
  startConstruction,
  advanceConstructions,
  boostConstruction,
  applyTechResearch,
  updateColonyTick,
  computeStage,
  computeHabitability,
  progressContract,
  TECH_CATALOG,
} from './marsColonyLogic.ts';

test('createInitialColonyState starts at stage 0, 4% habitability, and 100% O2', () => {
  const s = createInitialColonyState();
  assert.equal(s.stage, 0);
  assert.equal(s.habitability, 4);
  assert.equal(s.oxygen, 100);
  assert.equal(s.activeConstructions.length, 0);
});

test('timed construction requires complexity duration and respects worker & robotics boost', () => {
  let s = createInitialColonyState();
  s.regolith = 10;

  // Start MOXIE (4s duration)
  const res1 = startConstruction('trigger-moxie', s, []);
  assert.equal(res1.started, true);
  assert.equal(res1.state.activeConstructions.length, 1);
  assert.equal(res1.state.buildings.moxie, false);

  // Advance 1s with 0 workers -> still under construction (1/4s)
  const step1 = advanceConstructions(res1.state, [], 1.0, {});
  assert.equal(step1.completedIds.length, 0);
  assert.equal(step1.state.buildings.moxie, false);

  // Boost +1.4s + advance 1s with 1 worker (1 + 1.2 = 2.2s) -> finishes 4s project!
  const step2 = boostConstruction(step1.state, 'trigger-moxie', [], 1.4);
  const step3 = advanceConstructions(step2.state, [], 1.0, { 'trigger-moxie': 1 });
  assert.deepEqual(step3.completedIds, ['trigger-moxie']);
  assert.equal(step3.state.buildings.moxie, true);
  assert.equal(step3.state.habitability, 10);
  assert.equal(step3.state.stage, 1);
});

test('full 12-stage evolution & 8-tech catalog reaches 100% habitability', () => {
  assert.equal(TECH_CATALOG.length, 8);
  let s = createInitialColonyState();
  s.regolith = 80;
  s.waterIce = 20;
  s.water = 80;
  s.biomass = 40;
  let plots: number[] = [];

  const finishJob = (id: string) => {
    const started = startConstruction(id, s, plots);
    assert.equal(started.started, true, `Expected ${id} to start`);
    const adv = advanceConstructions(started.state, plots, 40, {});
    assert.ok(adv.completedIds.includes(id), `Expected ${id} to finish`);
    s = adv.state;
    plots = adv.nextPlantedPlots;
  };

  finishJob('trigger-moxie');
  finishJob('trigger-solar');
  finishJob('trigger-water');
  finishJob('trigger-miner');
  finishJob('trigger-lab');
  s = applyTechResearch('tech-robotics', s);
  finishJob('trigger-turret');
  s = applyTechResearch('tech-hydro', s);
  finishJob('trigger-biodome');
  finishJob('trigger-plant-0');
  finishJob('trigger-plant-1');
  finishJob('trigger-plant-2');
  finishJob('trigger-habitat');
  finishJob('trigger-comms');
  s = applyTechResearch('tech-geothermal', s);
  finishJob('trigger-geothermal');
  s = applyTechResearch('tech-terraform', s);
  finishJob('trigger-terraform');

  assert.equal(computeStage(s), 12);
  assert.equal(computeHabitability(s), 100);
  assert.ok(s.activeContract !== null);
});

test('updateColonyTick generates passive water, miner regolith, biomass and contracts advance', () => {
  let s = createInitialColonyState();
  s.buildings.waterExtractor = true;
  s.buildings.autoMiner = true;
  s.buildings.commsArray = true;
  s.cropsPlantedCount = 3;
  s = updateColonyTick(s, 6.0, true);
  assert.ok(s.water >= 2);
  assert.ok(s.regolith >= 1);
  assert.ok(s.biomass >= 2);

  s.activeContract = {
    id: 'c1',
    title: 'Patrulha',
    rewardText: '+4 Reg',
    kind: 'kill-enemies',
    progress: 2,
    target: 3,
  };
  const regBefore = s.regolith;
  const prog = progressContract(s, 'kill-enemies', 1);
  assert.ok(prog.completedContractTitle !== null);
  assert.equal(prog.state.regolith, regBefore + 4);
});
