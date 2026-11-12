import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  boxWithin,
  nextPlacement,
  settledPlacement,
  type GroupMetrics,
  type IndicatorBox,
  type IndicatorPlacement
} from './segmented-indicator';

const GROUP: GroupMetrics = {
  left: 100,
  top: 400,
  width: 300,
  height: 36,
  layoutWidth: 300,
  layoutHeight: 36,
  clientLeft: 1,
  clientTop: 1,
  scrollLeft: 0,
  scrollTop: 0
};

const LEFT_BOX: IndicatorBox = { x: 2, y: 2, width: 98, height: 32 };
const RIGHT_BOX: IndicatorBox = { x: 200, y: 2, width: 98, height: 32 };

const placed = (
  value: string,
  box: IndicatorBox,
  isSliding = false
): IndicatorPlacement => ({ value, box, isSliding });

describe('the box of the checked option', () => {
  it('is measured within the group, wherever the page has put the group', () => {
    const option = { left: 103, top: 403, width: 98, height: 32 };

    assert.deepEqual(boxWithin(GROUP, option), LEFT_BOX);
    assert.deepEqual(
      boxWithin(
        { ...GROUP, left: 900, top: -2000 },
        { ...option, left: 903, top: -1997 }
      ),
      LEFT_BOX
    );
  });

  it('divides out a transform on an ancestor, such as a dialog scaling in', () => {
    const scaled = { ...GROUP, left: 110, top: 410, width: 285, height: 34.2 };
    const box = boxWithin(scaled, {
      left: 112.85,
      top: 412.85,
      width: 93.1,
      height: 30.4
    });

    assert.ok(box !== null);
    for (const key of ['x', 'y', 'width', 'height'] as const)
      assert.ok(
        Math.abs(box[key] - LEFT_BOX[key]) < 1e-9,
        `${key}: ${box[key]} is not ${LEFT_BOX[key]}`
      );
  });

  it('divides out each axis on its own, for a group stretched one way only', () => {
    assert.deepEqual(
      boxWithin(
        { ...GROUP, top: 400, height: 72 },
        { left: 103, top: 406, width: 98, height: 64 }
      ),
      LEFT_BOX
    );
  });

  it('follows the options of a group that scrolls them', () => {
    assert.deepEqual(
      boxWithin(
        { ...GROUP, scrollLeft: 150 },
        { left: 151, top: 403, width: 98, height: 32 }
      ),
      { ...LEFT_BOX, x: 200 }
    );
  });

  it('is none while the group or the option is not laid out', () => {
    const option = { left: 103, top: 403, width: 98, height: 32 };

    assert.equal(
      boxWithin({ ...GROUP, width: 0, layoutWidth: 0 }, option),
      null
    );
    assert.equal(boxWithin(GROUP, { ...option, width: 0 }), null);
    assert.equal(
      boxWithin({ ...GROUP, layoutWidth: Number.NaN }, option),
      null,
      'the computed width of a group not rendered is `auto`'
    );
  });
});

describe('placing the indicator', () => {
  it('appears in place, without sliding, under the option checked first', () => {
    assert.deepEqual(
      nextPlacement(null, 'week', LEFT_BOX, 'selection'),
      placed('week', LEFT_BOX)
    );
  });

  it('slides to a newly checked option, within the group', () => {
    assert.deepEqual(
      nextPlacement(placed('week', LEFT_BOX), 'month', RIGHT_BOX, 'selection'),
      placed('month', RIGHT_BOX, true)
    );
  });

  it('moves at once when a layout change, not a choice, moves its option', () => {
    const rearranged = { ...LEFT_BOX, y: 40 };

    assert.deepEqual(
      nextPlacement(placed('week', LEFT_BOX), 'week', rearranged, 'resize'),
      placed('week', rearranged)
    );
  });

  it('keeps sliding when a resize moves its target mid-slide, and stops after the slide ends', () => {
    const sliding = placed('month', RIGHT_BOX, true);
    const wider = { ...RIGHT_BOX, width: 120 };
    const retargeted = nextPlacement(sliding, 'month', wider, 'resize');

    assert.deepEqual(retargeted, placed('month', wider, true));
    assert.deepEqual(settledPlacement(retargeted), placed('month', wider));
    assert.deepEqual(
      nextPlacement(settledPlacement(retargeted), 'month', RIGHT_BOX, 'resize'),
      placed('month', RIGHT_BOX)
    );
  });

  it('turns from a slide still running to the option chosen after it', () => {
    assert.deepEqual(
      nextPlacement(
        placed('month', RIGHT_BOX, true),
        'week',
        LEFT_BOX,
        'selection'
      ),
      placed('week', LEFT_BOX, true)
    );
  });

  it('stays as it is when a measurement finds it where it stands', () => {
    const current = placed('week', LEFT_BOX);

    assert.equal(
      nextPlacement(
        current,
        'week',
        { ...LEFT_BOX, x: LEFT_BOX.x + 0.001 },
        'resize'
      ),
      current
    );
    assert.equal(
      nextPlacement(current, 'week', LEFT_BOX, 'selection'),
      current
    );
  });

  it('leaves the group while nothing is checked or the group is hidden', () => {
    assert.equal(
      nextPlacement(placed('week', LEFT_BOX), null, LEFT_BOX, 'selection'),
      null
    );
    assert.equal(
      nextPlacement(placed('week', LEFT_BOX), 'week', null, 'resize'),
      null
    );
  });

  it('appears in place again, without sliding, once a hidden group is shown', () => {
    assert.deepEqual(
      nextPlacement(null, 'month', RIGHT_BOX, 'resize'),
      placed('month', RIGHT_BOX)
    );
  });
});
