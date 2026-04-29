# Classroom Behavior Tracker

A single-page classroom behavior tracker for high school teachers who want fast in-class logging without a backend or login.

## Features

- Add and manage classes or periods
- Roster and seating-style quick-entry view
- Student tiles as the main fast-entry workflow
- Today counts on each student tile
- Visual feedback and toast confirmation after each log
- Undo last logged behavior event
- Quick note presets for common classroom situations
- Hall pass tracker with remaining pass count by student
- Seating chart mode with editable seat labels
- Classroom mode for a simplified live-instruction view
- Paste a full class roster into a selected class
- Delete an accidentally logged behavior event
- Three main quick-log categories: Behavior, Preparedness, and Participation
- Current category dropdown for switching between Behavior, Preparedness, and Participation
- Optional notes stay hidden unless you open the note box
- Top date selector for switching the tracker to a specific day
- Automatic timestamps on behavior events
- Optional teacher notes on each event
- Daily and weekly student summaries
- Daily and weekly trends split into class tabs
- Totals by class period
- Filters by student, period, behavior, and date range
- Customizable consequence ladder
- Parent contact log by student
- Student communication log organized into class tabs
- Printable student report
- Print just one student's report from the roster
- CSV export
- Full backup and restore with a single JSON file
- Local storage persistence
- Sample mock student data on first load

## How to run

1. Open [index.html](./index.html) in a browser.
2. The app is fully local and should run directly from `file://` with no setup.
3. All data saves automatically in the browser with `localStorage`.
4. Use `Backup data` if you want a copy you can move to another device or restore later.

## Tech notes

- The app is fully self-contained and does not depend on an internet connection.
- The app logic lives in `app.js`.
- Styling lives in `styles.css`.
- No database or external backend is required.
- Each teacher's records stay on their own browser unless they intentionally export a backup file.

## Customize

- Edit `DEFAULT_BEHAVIORS` in `app.js` to change the built-in behavior categories.
- Edit `DEFAULT_CONSEQUENCE_LADDER` in `app.js` to set your classroom response steps.
- Edit `createSampleState()` in `app.js` to change the sample students, periods, events, and parent contacts.
- Edit `QUICK_NOTE_PRESETS` in `app.js` to change the quick note buttons.
- Edit `DEFAULT_HALL_PASSES` in `app.js` to change the starting hall pass amount.

## Managing classes

- Use the `Add and manage classes` panel to create your own classes.
- Edit a class name directly in the class list.
- Click `Open` on a class to view only the students in that class.
- Students are assigned to a class when you add them to the roster.
- A class cannot be deleted until its students are moved or removed.

## Importing a roster

- Use the roster panel to paste student names into a selected class.
- Paste one student per line.
- If a pasted name already exists in that class, it will be skipped.

## Printing a student report

- Use `Preview` in the roster to load a single student report on screen.
- Use `Print` in the roster, or `Print this student report` in the report panel, to print only that student.
- Student reports now include hall pass remaining and hall pass history.

## Sharing with other teachers

- Share the whole folder so another teacher can open `index.html` on their own computer.
- Their data will be separate from yours because the app stores records in that browser only.
- Use `Backup data` to save one JSON file with classes, students, behavior events, hall pass history, behavior categories, consequence steps, and parent contacts.
- Use `Restore data` to load that JSON backup into another browser copy of the tracker.
- Restoring a backup replaces the current saved tracker data in that browser.

## Code structure

- `app.js`: top-level state, rendering, persistence, exports, printing, and UI sections
- `styles.css`: layout, colors, responsive styling, and print styles

## Notes

- This app stores everything locally in the current browser only.
- If you clear browser storage, the saved records are removed.
- Use the `Delete` button in the recent event list if a positive or negative click was logged by mistake.
- The quickest flow is: click a class tab, tap a quick note preset only if needed, then use the student tile buttons.
- Use the current category dropdown to switch the quick-entry buttons between Behavior, Preparedness, and Participation.
- Notes are optional and hidden by default so most logs can happen in about two clicks.
- Use `Undo last log` right after a mistaken behavior click.
- Use `Classroom mode` when you want to hide backup, filters, reports, and other lower-frequency panels during live instruction.
- Use `Seating chart mode` when you want to edit seat labels and view students more like a classroom layout.
- Each student starts with hall passes and can use or restore them directly from the student tile.
- Use the date strip near the top to jump to a different day.
- Use the class tabs in the trends panel to switch between class rosters.
- Use the class tabs in the student communication log to switch between classes there as well.
