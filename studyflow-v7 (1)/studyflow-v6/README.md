# StudyFlow V6

A multi-page student study planner built with plain HTML, CSS, and JavaScript. No framework, backend, or database is required.

**Structure:** all layout is static HTML (`index.html`, `pages/*.html`) styled by `css/main.css`. `js/app.js` contains logic only: it reads and saves data and fills the elements and `<template>` blocks already in each page. `js/storage.js` is the single storage gateway.

## Pages

- Dashboard: overview, weekly progress, upcoming deadlines, recent sessions
- Courses: create/edit/delete courses and record assessment scores
- Timetable: choose availability and generate study sessions for the next seven days
- Study Room: focus timer and manual study-session logging
- Analytics: study time by course, session history, CSV export
- Assignments: tasks, priorities, due dates, status and course links
- Notes & Journal: create, edit and delete revision notes
- Settings: study target, appearance, JSON backup/restore, reset data

## Run locally

1. Extract the folder.
2. Open `studyflow-v6` in VS Code.
3. Install/enable the **Live Server** extension if you do not already have it.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Use the left navigation to move between pages.

The app stores information in the browser's `localStorage`. Data does not automatically sync between browsers or devices. Use Settings to export a backup regularly.

## Storage design

All pages use `js/storage.js` as the single storage gateway. The main data collections are courses, assignments, notes, sessions, timetable and settings. The storage module also attempts a one-time migration of the V4/V5 storage keys used by the earlier prototype.

## Current limitations

- Course assessment scores are averaged equally. Weighted assessment groups are not included in this V6 prototype yet.
- The timetable generator creates a simple course-by-course plan, not an optimization algorithm.
- Timer sessions are recorded when the user submits the session form, so the user can enter actual focused minutes.
- There are no accounts, cloud sync, or secure multi-user access.
