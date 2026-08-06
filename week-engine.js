/**
 * WeekEngine — weekly Points ("weeklies") accounting.
 *
 * How the WW week works, and what this implements:
 *  - You get a daily Points budget that resets every day, plus a separate
 *    weekly allowance ("weeklies") that resets once a week.
 *  - Go over your daily budget and the excess is DEDUCTED from your weeklies.
 *  - Finish a tracked day under budget and the unused Points ROLL OVER into
 *    your weeklies, capped (WW caps this at 4/day; configurable here).
 *
 * Deliberate decisions, because they are judgment calls:
 *  1. Rollovers are only credited for COMPLETED days. Today is still in
 *     progress — crediting it would inflate your balance and then claw it
 *     back as you log, which reads as a bug to the user.
 *  2. Rollovers are only credited for days you actually TRACKED (something
 *     logged). Otherwise forgetting to track for a week would silently hand
 *     you a full week of rollovers, rewarding not tracking.
 *  3. Each day's overflow is measured against the budget that was in effect
 *     ON THAT DAY, not today's. Changing your budget must not silently
 *     rewrite last Monday's history.
 *  4. weekliesLeft is allowed to go NEGATIVE, and the caller is expected to
 *     surface that. Clamping it at zero hides the fact that you're over.
 *
 * Pure functions, no DOM or storage — usable from the browser and from Node
 * tests alike.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeekEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_ROLLOVER_CAP = 4;

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /** Monday-based week start for a YYYY-MM-DD date string. */
  function weekStart(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var day = d.getDay();                    // 0=Sun
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return toKey(d);
  }

  function toKey(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /** The seven YYYY-MM-DD keys of the week containing dateStr. */
  function weekDates(dateStr) {
    var start = new Date(weekStart(dateStr) + 'T00:00:00');
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(toKey(d));
    }
    return out;
  }

  /**
   * computeWeek({ days, weeklyBudget, todayKey, rolloverEnabled, rolloverCap })
   *
   * days: [{ date, points, budget, tracked }]
   *   points  — Points logged that day
   *   budget  — the daily budget in effect ON that day
   *   tracked — whether anything was logged (defaults to points > 0)
   *
   * Returns per-day detail plus the weekly totals.
   */
  function computeWeek(opts) {
    opts = opts || {};
    var weeklyBudget = num(opts.weeklyBudget);
    var todayKey = opts.todayKey;
    var cap = opts.rolloverCap == null ? DEFAULT_ROLLOVER_CAP : num(opts.rolloverCap);
    var rolloverEnabled = opts.rolloverEnabled !== false;

    var perDay = (opts.days || []).map(function (d) {
      var points = num(d.points);
      var budget = num(d.budget);
      var tracked = d.tracked == null ? points > 0 : !!d.tracked;
      var isToday = d.date === todayKey;
      var isPast = d.date < todayKey;
      var isFuture = d.date > todayKey;

      // Overflow counts immediately, including for today — going over your
      // daily budget spends weeklies the moment it happens.
      var overflow = Math.max(0, points - budget);

      // Rollover: completed, tracked, under-budget days only.
      var rollover = 0;
      if (rolloverEnabled && isPast && tracked && points < budget) {
        rollover = Math.min(cap, budget - points);
      }

      return {
        date: d.date, points: points, budget: budget, tracked: tracked,
        isToday: isToday, isPast: isPast, isFuture: isFuture,
        overflow: overflow, rollover: rollover,
        withinBudget: points <= budget
      };
    });

    var weekliesUsed = perDay.reduce(function (s, d) { return s + d.overflow; }, 0);
    var weekliesEarned = perDay.reduce(function (s, d) { return s + d.rollover; }, 0);
    var totalPoints = perDay.reduce(function (s, d) { return s + d.points; }, 0);
    var available = weeklyBudget + weekliesEarned;
    var left = available - weekliesUsed;   // may be negative — intentionally

    return {
      perDay: perDay,
      weeklyBudget: weeklyBudget,
      weekliesEarned: weekliesEarned,
      weekliesUsed: weekliesUsed,
      weekliesAvailable: available,
      weekliesLeft: left,
      overspent: Math.max(0, -left),
      totalPoints: totalPoints,
      daysTracked: perDay.filter(function (d) { return d.tracked; }).length
    };
  }

  return {
    DEFAULT_ROLLOVER_CAP: DEFAULT_ROLLOVER_CAP,
    weekStart: weekStart,
    weekDates: weekDates,
    computeWeek: computeWeek
  };
});
