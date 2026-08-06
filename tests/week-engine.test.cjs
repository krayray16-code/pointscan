/**
 * Unit tests for WeekEngine — weekly Points accounting.
 * Run: node tests/week-engine.test.cjs
 */
'use strict';
const W = require('../week-engine.js');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else { fail++; failures.push(label); console.error('  ✗ FAIL: ' + label); }
}

const TODAY = '2026-08-06'; // a Thursday
const week = W.weekDates(TODAY);

// ── week boundaries ──
ok(week.length === 7, 'a week has 7 days');
ok(week[0] === '2026-08-03', 'week starts Monday (got ' + week[0] + ')');
ok(week[6] === '2026-08-09', 'week ends Sunday (got ' + week[6] + ')');
ok(week.includes(TODAY), 'the week contains today');
ok(W.weekStart('2026-08-09') === '2026-08-03', 'Sunday belongs to the week that started Monday');
ok(W.weekStart('2026-08-10') === '2026-08-10', 'the next Monday starts a new week');

function build(pointsByDate, budget = 23) {
  return week.map(d => ({ date: d, points: pointsByDate[d] || 0, budget }));
}
function run(pointsByDate, extra = {}) {
  return W.computeWeek(Object.assign(
    { days: build(pointsByDate, extra.budget), weeklyBudget: 28, todayKey: TODAY }, extra));
}

// ── deductions: going over the daily budget spends weeklies ──
{
  const r = run({ '2026-08-03': 30 }); // Monday, 7 over
  ok(r.weekliesUsed === 7, 'going 7 over on one day uses 7 weeklies (got ' + r.weekliesUsed + ')');
  ok(r.weekliesLeft === 28 - 7 + 0, 'weeklies left reflects the deduction (got ' + r.weekliesLeft + ')');
}
{
  const r = run({ '2026-08-03': 30, '2026-08-04': 26 }); // 7 over + 3 over
  ok(r.weekliesUsed === 10, 'deductions accumulate across days (got ' + r.weekliesUsed + ')');
}
{
  const r = run({ '2026-08-03': 20 });
  ok(r.weekliesUsed === 0, 'staying under budget uses no weeklies');
}
{
  const r = run({ [TODAY]: 40 }); // today, live
  ok(r.weekliesUsed === 17, 'going over TODAY deducts immediately (got ' + r.weekliesUsed + ')');
}

// ── rollovers: unused points on completed tracked days ──
{
  const r = run({ '2026-08-03': 20 }); // 3 unused, past, tracked
  ok(r.weekliesEarned === 3, 'unused points roll over (got ' + r.weekliesEarned + ')');
  ok(r.weekliesLeft === 31, 'rollover increases the weekly balance (got ' + r.weekliesLeft + ')');
}
{
  const r = run({ '2026-08-03': 10 }); // 13 unused, capped at 4
  ok(r.weekliesEarned === 4, 'rollover is capped at 4/day (got ' + r.weekliesEarned + ')');
}
{
  const r = run({ '2026-08-03': 20, '2026-08-04': 21, '2026-08-05': 22 });
  ok(r.weekliesEarned === 3 + 2 + 1, 'rollovers accumulate across days (got ' + r.weekliesEarned + ')');
}
{
  // Today is not finished — crediting its unused points would inflate the
  // balance and then claw it back as the user logs.
  const r = run({ [TODAY]: 5 });
  ok(r.weekliesEarned === 0, 'today earns no rollover while still in progress');
}
{
  const r = run({ '2026-08-07': 5 }); // Friday, in the future
  ok(r.weekliesEarned === 0, 'future days earn no rollover');
}
{
  // An untracked day must not hand out free rollover.
  const r = run({});
  ok(r.weekliesEarned === 0, 'days with nothing logged earn no rollover');
  ok(r.weekliesLeft === 28, 'an empty week leaves the weekly budget untouched');
}
{
  const r = run({ '2026-08-03': 20 }, { rolloverEnabled: false });
  ok(r.weekliesEarned === 0, 'rollovers can be turned off');
  ok(r.weekliesLeft === 28, 'with rollovers off the balance is unchanged');
}
{
  const r = run({ '2026-08-03': 10 }, { rolloverCap: 10 });
  ok(r.weekliesEarned === 10, 'rollover cap is configurable (got ' + r.weekliesEarned + ')');
}

// ── combined, and going past the weekly allowance ──
{
  const r = run({ '2026-08-03': 20, '2026-08-04': 33 }); // +3 rollover, -10 overflow
  ok(r.weekliesEarned === 3 && r.weekliesUsed === 10, 'earn and spend in the same week');
  ok(r.weekliesLeft === 28 + 3 - 10, 'balance = budget + earned - used (got ' + r.weekliesLeft + ')');
}
{
  const r = run({ '2026-08-03': 60, '2026-08-04': 60 }); // 37 + 37 = 74 over
  ok(r.weekliesUsed === 74, 'large deductions are tracked (got ' + r.weekliesUsed + ')');
  ok(r.weekliesLeft === 28 - 74, 'weeklies left goes NEGATIVE rather than clamping (got ' + r.weekliesLeft + ')');
  ok(r.overspent === 46, 'overspent reports how far past the allowance (got ' + r.overspent + ')');
}

// ── per-day budget snapshots ──
{
  // Monday was logged under a 30-point budget; the user later dropped to 18.
  // Monday must still be judged against 30.
  const days = week.map(d => ({
    date: d,
    points: d === '2026-08-03' ? 28 : 0,
    budget: d === '2026-08-03' ? 30 : 18
  }));
  const r = W.computeWeek({ days, weeklyBudget: 28, todayKey: TODAY });
  ok(r.weekliesUsed === 0, 'a past day is judged against the budget in effect THAT day, not today\'s');
  ok(r.weekliesEarned === 2, 'rollover also uses that day\'s budget (got ' + r.weekliesEarned + ')');

  // The old implementation used today's budget everywhere, which would have
  // wrongly charged 10 weeklies for that same Monday.
  const naive = Math.max(0, 28 - 18);
  ok(naive === 10, 'sanity: the old shared-budget approach would have charged 10');
}

// ── robustness ──
{
  const r = W.computeWeek({
    days: [{ date: '2026-08-03', points: undefined, budget: 23 },
           { date: '2026-08-04', points: NaN, budget: 23 },
           { date: TODAY, points: '12', budget: '23' }],
    weeklyBudget: 28, todayKey: TODAY
  });
  ok(Number.isFinite(r.weekliesUsed) && Number.isFinite(r.weekliesLeft), 'missing/NaN/string values never produce NaN totals');
  ok(r.totalPoints === 12, 'numeric strings are coerced (got ' + r.totalPoints + ')');
}
{
  const r = W.computeWeek({ days: [], weeklyBudget: 28, todayKey: TODAY });
  ok(r.weekliesLeft === 28 && r.totalPoints === 0, 'an empty week is handled');
}

// ── reporting fields used by the UI ──
{
  const r = run({ '2026-08-03': 20, '2026-08-04': 30, [TODAY]: 12 });
  ok(r.totalPoints === 62, 'totalPoints sums the week (got ' + r.totalPoints + ')');
  ok(r.daysTracked === 3, 'daysTracked counts days with anything logged (got ' + r.daysTracked + ')');
  ok(r.perDay.length === 7, 'per-day detail is returned for the whole week');
  const mon = r.perDay.find(d => d.date === '2026-08-03');
  ok(mon.rollover === 3 && mon.overflow === 0, 'per-day detail carries rollover/overflow');
  const today = r.perDay.find(d => d.isToday);
  ok(today && today.date === TODAY, 'today is flagged in the per-day detail');
  ok(r.weekliesAvailable === 28 + r.weekliesEarned, 'weekliesAvailable = budget + earned');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? ':\n  - ' + failures.join('\n  - ') : ' ✓'));
process.exit(fail ? 1 : 0);
