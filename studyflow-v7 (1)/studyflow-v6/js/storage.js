/* Central storage gateway. Pages should use this module instead of localStorage directly. */
(function () {
  const PREFIX = "studyFlowV6_";
  const defaults = {
    courses: [], assignments: [], notes: [], sessions: [],
    timetable: { days: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "21:00", sessionMinutes: 50, breakMinutes: 10, sessions: [] },
    settings: { weeklyHours: 12, theme: "light", displayName: "Student", semester: "Current semester" }
  };
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function migrateIfNeeded(key) {
    if (localStorage.getItem(PREFIX + key) !== null) return;
    try {
      if (key === "courses") {
        const old = JSON.parse(localStorage.getItem("studyFlowV4Courses") || "null");
        if (Array.isArray(old)) set(key, old.map(c => ({ id: c.id || crypto.randomUUID(), name: c.name || "Untitled course", creditHours: Number(c.creditHours) || 0, targetGrade: Number(c.targetGrade) || 0, assessments: (c.groups || []).flatMap(g => (g.assessments || []).map(a => ({ id: a.id || crypto.randomUUID(), name: a.name || "Assessment", score: a.score === "" || a.score == null ? "" : Number(a.score) }))) })));
      } else if (key === "sessions") {
        const old = JSON.parse(localStorage.getItem("studyFlowV4Sessions") || "null");
        if (Array.isArray(old)) set(key, old);
      } else if (key === "settings") {
        const old = JSON.parse(localStorage.getItem("studyFlowV4Settings") || "null");
        if (old && typeof old === "object") set(key, { ...defaults.settings, ...old });
      } else if (key === "timetable") {
        const old = JSON.parse(localStorage.getItem("studyFlowV5Timetable") || "null");
        if (old && typeof old === "object") set(key, { ...defaults.timetable, ...old, sessions: Array.isArray(old.sessions) ? old.sessions : [] });
      }
    } catch (error) { console.warn("StudyFlow migration skipped for", key, error); }
  }
  function get(key) {
    try { migrateIfNeeded(key); const raw = localStorage.getItem(PREFIX + key); return raw === null ? clone(defaults[key]) : JSON.parse(raw); }
    catch (error) { console.warn("StudyFlow could not read", key, error); return clone(defaults[key]); }
  }
  function set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (error) { console.error("StudyFlow could not save", key, error); return false; }
  }
  function all() { return Object.fromEntries(Object.keys(defaults).map(key => [key, get(key)])); }
  function update(key, updater) { const value = updater(get(key)); set(key, value); return value; }
  function exportData() { return { app: "StudyFlow", version: 6, exportedAt: new Date().toISOString(), data: all() }; }
  function importData(bundle) {
    if (!bundle || bundle.app !== "StudyFlow" || !bundle.data) throw new Error("This is not a valid StudyFlow backup.");
    Object.keys(defaults).forEach(key => { if (Object.prototype.hasOwnProperty.call(bundle.data, key)) set(key, bundle.data[key]); });
  }
  function clearAll() { Object.keys(defaults).forEach(key => set(key, clone(defaults[key]))); }
  window.StudyStore = { get, set, update, all, exportData, importData, clearAll, defaults: clone(defaults) };
})();
