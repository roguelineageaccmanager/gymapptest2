# Calendar-day streaks and compact years

Streaks count calendar days. A logged workout or explicit bypass starts a run;
planned rest days then add to it. Missing a scheduled workout breaks the run
after that day ends. An unfinished training day today keeps yesterday's run but
does not earn today's credit until logged/bypassed. Rest before the first
qualifying date never starts a streak. Workouts on unscheduled days still count.
Without any assigned weekly workout, gaps are not assumed to be planned rest.

For a Monday/Wednesday/Friday plan, logging Monday and Wednesday gives a
four-day streak on Thursday. It stays four while Friday is pending. If Friday
ends without a log or bypass, Saturday's current streak is zero. Multiple
sessions on one date still count as one gym day.

The current weekly schedule is used to infer rest; no historical schedule is
invented or written into workout logs. Existing saved best-streak records remain
a lower bound. Current/best, start date and gym/rest/bypass breakdowns derive
from the same model. Local date changes and app resumption refresh the UI and
queue the existing score sync. Date distances use calendar components rather
than elapsed 24-hour periods, including DST boundaries. Gaps need at most seven
weekday checks rather than a scan through every historical date.

All main-page streak badges are buttons opening a themed detail sheet. It updates
for day, log and plan changes, closes on account changes and restores focus on
dismissal. Its Calendar action waits for the sheet history layer to settle.

Settings → Appearance → Calendar view provides Monthly (default) and Compact
years. `calendarView` is a validated, independently timestamped account preference
using the existing metadata sync. It is not part of shared theme colors/presets.
No new table, migration, permission or auth API is required.

Compact years shows one seven-row, Monday-first band per year, newest first,
including empty years between the first activity and the present. Ten years
render initially; Show older years loads more without creating thousands of
year rows at once. Leap years and rare 54-column years retain every date.

Filled tiles mean a nonempty saved workout date, never rest credit or bypasses.
Multiple workouts on one date fill one tile. Future dates remain unfilled and
disabled. On the default dark theme the gym tiles are white; filled/muted colors
follow existing text/surface theme tokens for custom and light themes. Month
labels stay aligned with their week columns.

Tiles retain the existing day/history actions. Arrow up/down moves one day and
left/right one week; Home/End stays within a year. Only one date per year is a
tab stop, retained through refresh. Choose date provides a larger phone control
for the very small grid. Jump to today has been removed in both views; entering
Calendar keeps the header visible and does not auto-scroll. Display changes
never rewrite routines, logs, identities, records, ranks or warm-ups.

Validation covers all 128 weekly schedule patterns against a daily reference,
rest/pending/missed/empty-plan boundaries, leap/DST dates, future records,
preserved legacy bests, yearly geometry, preference merging, touch/keyboard
details, rollover, bypass versus gym attendance, narrow themes and older-year
loading. Browser regressions retain logging/history, saved-color and calendar
focus checks; a local-auth test verifies the preference across two phones. Real
service-worker offline save/reload is verified before publication.
