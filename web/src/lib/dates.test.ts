import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { formatOf } from '@/i18n/format';

import { daysBetween, shiftCalendarDayByMonths } from './dates';

const {
  formatCalendarDay,
  formatCalendarMonth,
  formatLongCalendarMonth,
  formatLongWeekdayCalendarDay,
  formatNarrowCalendarMonth,
  formatSeriesDay,
  formatShortCalendarMonth,
  formatWeekdayCalendarDay,
  weekdayNames
} = formatOf('pt-BR');

const english = formatOf('en-US');

const FIXTURE = fileURLToPath(
  new URL('../test/fixtures/calendar-days.ts', import.meta.url)
);

const ZONES = [
  'UTC',
  'America/Sao_Paulo',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
  'America/New_York'
];

const datesIn = (zone: string) =>
  JSON.parse(
    execFileSync(process.execPath, ['--import', 'tsx', FIXTURE], {
      env: { ...process.env, TZ: zone },
      encoding: 'utf8'
    })
  ) as Record<string, unknown>;

describe('date formats', () => {
  it('writes a day as day, month and year', () => {
    assert.equal(formatCalendarDay('2026-10-28'), '28/10/2026');
    assert.equal(formatCalendarDay('2026-01-05'), '05/01/2026');
    assert.equal(formatSeriesDay('2026-10-28T00:00:00.000Z'), '28/10/2026');
  });

  it('names months and weekdays in Portuguese', () => {
    assert.equal(formatCalendarMonth('2026-10'), 'out. de 2026');
    assert.equal(formatLongCalendarMonth('2026-10'), 'outubro de 2026');
    assert.equal(formatShortCalendarMonth('2026-10'), 'out.');
    assert.equal(formatNarrowCalendarMonth('2026-10'), 'O');
    assert.equal(formatWeekdayCalendarDay('2026-10-28'), 'qua., 28 de out.');
    assert.equal(
      formatLongWeekdayCalendarDay('2026-10-28'),
      'quarta-feira, 28 de outubro de 2026'
    );
  });

  it('lists the weekdays from Sunday', () => {
    assert.deepEqual(weekdayNames('short'), [
      'dom.',
      'seg.',
      'ter.',
      'qua.',
      'qui.',
      'sex.',
      'sáb.'
    ]);
    assert.deepEqual(weekdayNames('long'), [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado'
    ]);
    assert.deepEqual(weekdayNames('narrow'), [
      'D',
      'S',
      'T',
      'Q',
      'Q',
      'S',
      'S'
    ]);
  });

  it('writes days, months and weekdays in English', () => {
    assert.equal(english.formatCalendarDay('2026-10-28'), '10/28/2026');
    assert.equal(
      english.formatSeriesDay('2026-10-28T00:00:00.000Z'),
      '10/28/2026'
    );
    assert.equal(english.formatCalendarMonth('2026-10'), 'Oct 2026');
    assert.equal(english.formatLongCalendarMonth('2026-10'), 'October 2026');
    assert.equal(english.formatWeekdayCalendarDay('2026-10-28'), 'Wed, Oct 28');
    assert.equal(
      english.formatLongWeekdayCalendarDay('2026-10-28'),
      'Wednesday, October 28, 2026'
    );
    assert.deepEqual(english.weekdayNames('short'), [
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat'
    ]);
  });

  it('writes nothing for a day that does not exist', () => {
    assert.equal(formatCalendarDay('2026-02-30'), null);
    assert.equal(formatCalendarDay('28/10/2026'), null);
    assert.equal(formatCalendarMonth('2026-13'), null);
  });

  it('counts days by the calendar, not by the formats', () => {
    assert.equal(daysBetween('2026-10-28', '2026-11-04'), 7);
    assert.equal(daysBetween('2026-11-04', '2026-10-28'), -7);
    assert.equal(shiftCalendarDayByMonths('2026-01-31', 1), '2026-02-28');
  });
});

describe('time zones', () => {
  const reference = datesIn('UTC');

  it('writes the reference day in Portuguese', () => {
    assert.deepEqual(reference, {
      day: '28/10/2026',
      newYear: '01/01/2026',
      month: 'out. de 2026',
      longMonth: 'outubro de 2026',
      weekday: 'quarta-feira, 28 de outubro de 2026',
      seriesDay: '28/10/2026',
      weekdays: ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'],
      roundTrip: '2026-10-28',
      pickedDay: '2026-10-28',
      pickedUtcDay: '2026-10-28',
      acrossDst: 7,
      nextDay: '2026-11-01',
      firstWeekday: 0
    });
  });

  for (const zone of ZONES.slice(1))
    it(`shows and records the same days in ${zone}`, () => {
      assert.deepEqual(datesIn(zone), reference);
    });
});
