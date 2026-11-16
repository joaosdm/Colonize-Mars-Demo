import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialColonyState,
  updateColonyTick,
  canCompleteObjective,
  INITIAL_OBJECTIVES,
} from './marsColonyLogic';

test('createInitialColonyState initializes full oxygen and stage 0', () => {
  const state = createInitialColonyState();
  assert.equal(state.oxygen, 100);
  assert.equal(state.habitability, 5);
  assert.equal(state.buildings.moxie, false);
  assert.equal(state.buildings.solarPanels, false);
  assert.equal(state.buildings.bioDome, false);
  assert.equal(state.buildings.habitat, false);
});

test('updateColonyTick recharges oxygen near base and consumes when away', () => {
  const state = createInitialColonyState();
  state.oxygen = 80;

  // Near O2 source -> recharges
  const recharged = updateColonyTick(state, 1.0, true);
  assert.ok(recharged.oxygen > 80, `Expected O2 to recharge, got ${recharged.oxygen}`);

  // Away from O2 source -> consumes
  const consumed = updateColonyTick(state, 1.0, false);
  assert.ok(consumed.oxygen < 80, `Expected O2 to deplete, got ${consumed.oxygen}`);
});

test('5-mission progression rules enforce prerequisites', () => {
  const state = createInitialColonyState();

  // Mission 1: MOXIE unlockable
  assert.equal(canCompleteObjective('obj-1-moxie', state), true);
  assert.equal(canCompleteObjective('obj-2-regolith', state), false);

  // Activate MOXIE
  state.buildings.moxie = true;
  state.stage = 1;
  state.regolith = 3;
  // Needs 5 regolith
  assert.equal(canCompleteObjective('obj-2-regolith', state), false);

  state.regolith = 5;
  assert.equal(canCompleteObjective('obj-2-regolith', state), true);
  assert.equal(canCompleteObjective('obj-3-solar', state), true);

  // Build Solar
  state.buildings.solarPanels = true;
  state.stage = 3;
  state.waterIce = 2;
  // Needs 5 ice for biodome
  assert.equal(canCompleteObjective('obj-4-biodome', state), false);

  state.waterIce = 5;
  assert.equal(canCompleteObjective('obj-4-biodome', state), true);

  // Build Biodome
  state.buildings.bioDome = true;
  state.stage = 4;
  assert.equal(canCompleteObjective('obj-5-habitat', state), true);
});

test('initial objectives list has all 5 required missions', () => {
  assert.equal(INITIAL_OBJECTIVES.length, 5);
  assert.equal(INITIAL_OBJECTIVES[0].id, 'obj-1-moxie');
  assert.equal(INITIAL_OBJECTIVES[1].id, 'obj-2-regolith');
  assert.equal(INITIAL_OBJECTIVES[2].id, 'obj-3-solar');
  assert.equal(INITIAL_OBJECTIVES[3].id, 'obj-4-biodome');
  assert.equal(INITIAL_OBJECTIVES[4].id, 'obj-5-habitat');
});
