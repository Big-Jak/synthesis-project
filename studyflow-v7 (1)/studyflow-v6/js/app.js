/* StudyFlow logic. All layout lives in the HTML files; this file only reads/saves data
   and fills the <template> blocks and elements that already exist in each page. */
(function () {
  const store = window.StudyStore;
  const page = document.body.dataset.page;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString(16).slice(2);
  const pad = n => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtDate = v => v ? new Date(v + (String(v).length === 10 ? "T12:00:00" : "")).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No due date";
  const mins = n => { n = Math.max(0, Math.round(Number(n) || 0)); return `${Math.floor(n / 60)}h ${n % 60}m`; };
  const sum = list => list.reduce((n, s) => n + (Number(s.durationMinutes) || 0), 0);
  const byDateDesc = (a, b) => b.date.localeCompare(a.date);
  const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  const hasScore = a => a.score !== "" && a.score !== null && a.score !== undefined && Number.isFinite(Number(a.score));
  const courseGrade = c => { const g = (c.assessments || []).filter(hasScore); return g.length ? g.reduce((n, a) => n + Number(a.score), 0) / g.length : null; };
  const courseProgress = c => { const all = c.assessments || []; return all.length ? Math.round(all.filter(hasScore).length / all.length * 100) : 0; };
  const daysUntil = a => Math.ceil((new Date(a.dueDate + "T23:59:59") - new Date()) / 86400000);
  const dueSoon = a => a.dueDate && a.status !== "Done" && a.dueDate >= today() && daysUntil(a) <= 7;
  const toMin = t => Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]);
  const toTime = n => pad(Math.floor(n / 60)) + ":" + pad(n % 60);

  /* ---------- helpers that fill existing markup ---------- */
  function bind(node, data, cls = {}) {
    $$("[data-b]", node).forEach(el => {
      const k = el.dataset.b, v = data[k];
      el.textContent = v ?? "";
      if (el.hasAttribute("data-opt")) el.hidden = !v;
      if (cls[k]) el.classList.add(...cls[k].split(" "));
    });
    $$("[data-w]", node).forEach(el => { el.style.width = (data[el.dataset.w] || 0) + "%"; });
    $$("[data-id]", node).forEach(el => { el.dataset.id = data.id; });
    return node;
  }
  const make = (tpl, data = {}, cls = {}) => bind($("#" + tpl).content.firstElementChild.cloneNode(true), data, cls);
  const emptyState = (icon, title, text) => make("tpl-empty", { icon, title, text });
  function show(container, items, build, empty) { container.replaceChildren(...(items.length ? items.map(build) : [emptyState(...empty)])); }
  function message(text, type = "success") {
    const el = $("#global-message"); el.textContent = text; el.className = `notice ${type}`;
    clearTimeout(message.t); message.t = setTimeout(() => el.classList.add("hidden"), 3500);
  }
  function fillCourses(select) { store.get("courses").forEach(c => select.add(new Option(c.name, c.id))); }
  function download(name, content, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function applyTheme() { document.documentElement.dataset.theme = store.get("settings").theme || "light"; }

  /* ---------- shared chrome ---------- */
  function initShell() {
    const s = store.get("settings");
    applyTheme();
    $("#avatar").textContent = (s.displayName || "S").trim().charAt(0).toUpperCase() || "S";
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if ($("#semester")) $("#semester").textContent = s.semester;
    $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  }

  /* ---------- dashboard ---------- */
  function dashboard() {
    const courses = store.get("courses"), assignments = store.get("assignments"), sessions = store.get("sessions"), s = store.get("settings");
    const week = sessions.filter(x => new Date(x.date) >= weekStart());
    const actual = sum(week), target = (Number(s.weeklyHours) || 0) * 60;
    const pct = target ? Math.min(100, Math.round(actual / target * 100)) : 0;
    const open = assignments.filter(a => a.status !== "Done");
    const next = open.filter(a => a.dueDate && a.dueDate >= today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const h = new Date().getHours(), greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    $("#hero-title").textContent = `${greet}, ${(s.displayName || "Student").trim()}.`;
    $("#hero-line").textContent = (target - actual > 0 ? `${mins(target - actual)} left to reach this week's target.` : "Weekly target reached. Anything more is a bonus.") +
      (next ? ` Next deadline: ${next.title}, ${fmtDate(next.dueDate)}.` : " No deadlines coming up.");
    $("#hero-ring").style.setProperty("--p", pct); $("#hero-pct").textContent = pct + "%";
    $("#hero-done").textContent = mins(actual); $("#hero-of").textContent = `studied of ${mins(target)} this week`;
    const idx = (new Date().getDay() + 6) % 7, start = weekStart();
    const per = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = new Date(start); d.setDate(d.getDate() + i); return sum(week.filter(x => new Date(x.date).toDateString() === d.toDateString())); });
    const max = Math.max(60, ...per);
    $$("#hero-bars div").forEach((el, i) => { el.classList.toggle("on", i === idx); el.title = mins(per[i]); $("i", el).style.height = Math.max(4, per[i] / max * 100) + "%"; });
    const avg = courses.map(courseGrade).filter(n => n !== null);
    $("#stat-courses").textContent = courses.length; $("#stat-courses-note").textContent = "In your course list";
    $("#stat-week").textContent = mins(actual); $("#stat-week-note").textContent = `${pct}% of your ${s.weeklyHours}-hour target`;
    $("#stat-open").textContent = open.length; $("#stat-open-note").textContent = "Still on your task list";
    $("#stat-avg").textContent = avg.length ? Math.round(avg.reduce((a, b) => a + b, 0) / avg.length) + "%" : "--";
    $("#stat-avg-note").textContent = avg.length ? "Across courses with scored assessments" : "Add scores to see this";
    $("#week-text").textContent = `${mins(actual)} studied out of ${mins(target)}`; $("#week-pct").textContent = pct + "%";
    $("#week-fill").style.width = pct + "%"; $("#week-fill").classList.toggle("green", pct >= 100);
    show($("#deadline-list"), [...open].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 4),
      a => make("tpl-deadline", { title: a.title, sub: `${a.courseName || "No course"} · ${fmtDate(a.dueDate)}`, priority: a.priority || "Normal" }, { priority: dueSoon(a) ? "amber" : "" }),
      ["✓", "All clear for now", "Add an assignment when something new comes up."]);
    sessionList($("#recent-list"), sessions, 5, true);
  }
  function sessionList(container, sessions, limit, withNotes) {
    show(container, [...sessions].sort(byDateDesc).slice(0, limit),
      x => make("tpl-session", { title: x.courseName || "General study", sub: new Date(x.date).toLocaleString() + (withNotes && x.notes ? " · " + x.notes : ""), dur: mins(x.durationMinutes) }),
      ["◷", "Your first session is waiting", "Use the Study Room to record focused time."]);
  }

  /* ---------- courses ---------- */
  function courses() {
    const form = $("#course-form");
    const resetForm = () => { form.reset(); $("#course-id").value = ""; $("#course-form-title").textContent = "Add a course"; };
    const draw = () => {
      const list = store.get("courses"); $("#course-count").textContent = `${list.length} total`;
      show($("#course-list"), list, c => {
        const g = courseGrade(c);
        const card = make("tpl-course", { id: c.id, name: c.name, meta: `${Number(c.creditHours) || 0} credits · Target ${Number(c.targetGrade) || 0}%`, grade: g === null ? "No scores" : `Avg. ${Math.round(g)}%`, progress: courseProgress(c), progressText: `${courseProgress(c)}% of assessments graded` }, { grade: g !== null && g >= c.targetGrade ? "green" : "" });
        const box = $(".assessment-list", card);
        if (!(c.assessments || []).length) box.remove();
        else box.append(...c.assessments.map(a => make("tpl-assessment", { name: a.name, score: hasScore(a) ? a.score + "%" : "Not graded" })));
        return card;
      }, ["▤", "No courses yet", "Add a course to start tracking grades and assessments."]);
    };
    draw();
    $("#course-cancel").addEventListener("click", resetForm);
    form.addEventListener("submit", e => {
      e.preventDefault();
      const assessments = $("#course-assessments").value.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
        const i = line.lastIndexOf(":"), raw = i < 0 ? "" : line.slice(i + 1).trim();
        return { id: uid(), name: (i < 0 ? line : line.slice(0, i)).trim(), score: raw === "" ? "" : Number(raw) };
      });
      if (assessments.some(a => a.score !== "" && (!Number.isFinite(a.score) || a.score < 0 || a.score > 100))) return message("Assessment scores must be between 0 and 100.", "error");
      const data = { id: $("#course-id").value || uid(), name: $("#course-name").value.trim(), creditHours: Number($("#course-credits").value) || 0, targetGrade: Number($("#course-target").value) || 0, assessments };
      if (!data.name) return message("Enter a course name.", "error");
      if (data.targetGrade < 0 || data.targetGrade > 100) return message("Target score must be between 0 and 100.", "error");
      const list = store.get("courses"), i = list.findIndex(c => c.id === data.id);
      i >= 0 ? list[i] = data : list.push(data);
      store.set("courses", list); resetForm(); draw(); message("Course saved.");
    });
    $("#course-list").addEventListener("click", e => {
      const b = e.target.closest("button[data-action]"); if (!b) return;
      const c = store.get("courses").find(x => x.id === b.dataset.id); if (!c) return;
      if (b.dataset.action === "delete") {
        if (confirm(`Delete ${c.name}?`)) { store.set("courses", store.get("courses").filter(x => x.id !== c.id)); draw(); message("Course deleted."); }
      } else {
        $("#course-id").value = c.id; $("#course-name").value = c.name; $("#course-credits").value = c.creditHours; $("#course-target").value = c.targetGrade;
        $("#course-assessments").value = (c.assessments || []).map(a => `${a.name}: ${a.score ?? ""}`).join("\n");
        $("#course-form-title").textContent = "Edit course"; $("#course-name").focus();
      }
    });
  }

  /* ---------- assignments ---------- */
  function assignments() {
    fillCourses($("#assignment-course")); $("#assignment-due").min = today();
    const draw = () => {
      const f = $("#assignment-filter").value;
      const tasks = store.get("assignments").filter(a => f === "all" || (f === "done" ? a.status === "Done" : a.status !== "Done")).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
      show($("#assignment-list"), tasks, a => make("tpl-task", { id: a.id, title: a.title, sub: `${a.courseName || "No course"} · ${a.type || "Task"} · ${fmtDate(a.dueDate)}`, details: a.details, priority: a.priority || "Normal", status: a.status || "Open", toggle: a.status === "Done" ? "Reopen" : "Done ✓" },
        { priority: a.priority === "Urgent" ? "red" : a.priority === "High" ? "amber" : "", status: a.status === "Done" ? "green" : "" }),
        ["☷", "Nothing in this view", "Add a task or change the filter."]);
    };
    draw();
    $("#assignment-filter").addEventListener("change", draw);
    $("#assignment-form").addEventListener("submit", e => {
      e.preventDefault();
      const course = store.get("courses").find(c => c.id === $("#assignment-course").value), tasks = store.get("assignments");
      tasks.push({ id: uid(), title: $("#assignment-title").value.trim(), courseId: course?.id || "", courseName: course?.name || "", dueDate: $("#assignment-due").value, priority: $("#assignment-priority").value, type: $("#assignment-type").value, details: $("#assignment-details").value.trim(), status: "Open", createdAt: new Date().toISOString() });
      store.set("assignments", tasks); e.target.reset(); draw(); message("Assignment saved.");
    });
    $("#assignment-list").addEventListener("click", e => {
      const b = e.target.closest("button[data-task]"); if (!b) return;
      let tasks = store.get("assignments");
      tasks = b.dataset.task === "delete" ? tasks.filter(a => a.id !== b.dataset.id) : tasks.map(a => a.id === b.dataset.id ? { ...a, status: a.status === "Done" ? "Open" : "Done" } : a);
      store.set("assignments", tasks); draw();
    });
  }

  /* ---------- notes ---------- */
  function notes() {
    fillCourses($("#note-course"));
    const resetForm = () => { $("#note-form").reset(); $("#note-id").value = ""; $("#note-form-title").textContent = "Write a note"; };
    const draw = () => {
      const list = store.get("notes"); $("#note-count").textContent = list.length;
      show($("#notes-list"), [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), n => make("tpl-note", { id: n.id, title: n.title, meta: `${n.courseName || "General"} · Updated ${fmtDate((n.updatedAt || "").slice(0, 10))}`, body: n.body }),
        ["✎", "Your notebook is empty", "Write a concept summary, question, or revision reflection."]);
    };
    draw();
    $("#note-clear").addEventListener("click", resetForm);
    $("#note-form").addEventListener("submit", e => {
      e.preventDefault();
      const list = store.get("notes"), id = $("#note-id").value, course = store.get("courses").find(c => c.id === $("#note-course").value), old = list.find(n => n.id === id);
      const note = { id: id || uid(), title: $("#note-title").value.trim(), courseId: course?.id || "", courseName: course?.name || "General", body: $("#note-body").value.trim(), createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      const i = list.findIndex(n => n.id === id); i >= 0 ? list[i] = note : list.push(note);
      store.set("notes", list); resetForm(); draw(); message("Note saved.");
    });
    $("#notes-list").addEventListener("click", e => {
      const b = e.target.closest("button[data-note]"); if (!b) return;
      const list = store.get("notes"), n = list.find(x => x.id === b.dataset.id); if (!n) return;
      if (b.dataset.note === "delete") { if (confirm("Delete this note?")) { store.set("notes", list.filter(x => x.id !== n.id)); draw(); message("Note deleted."); } }
      else { $("#note-id").value = n.id; $("#note-title").value = n.title; $("#note-course").value = n.courseId || ""; $("#note-body").value = n.body; $("#note-form-title").textContent = "Edit note"; window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  }

  /* ---------- analytics ---------- */
  function analytics() {
    const sessions = store.get("sessions"), list = store.get("courses"), s = store.get("settings");
    const total = sum(sessions), weekly = sum(sessions.filter(x => new Date(x.date) >= weekStart())), target = (Number(s.weeklyHours) || 0) * 60;
    const set = (id, v, note) => { $("#" + id).textContent = v; $("#" + id + "-note").textContent = note; };
    set("stat-total", mins(total), `${sessions.length} saved sessions`);
    set("stat-week", mins(weekly), `${target ? Math.round(weekly / target * 100) : 0}% of weekly target`);
    set("stat-courses", list.length, "With grade and study records");
    set("stat-avg", sessions.length ? mins(total / sessions.length) : "--", "Across all saved sessions");
    const per = list.map(c => ({ c, m: sum(sessions.filter(x => x.courseId === c.id)), g: courseGrade(c) })).sort((a, b) => b.m - a.m);
    show($("#course-time"), per, x => make("tpl-percourse", { name: x.c.name, sub: `${mins(x.m)} recorded` + (x.g === null ? "" : ` · Average score ${Math.round(x.g)}%`), share: total ? x.m / total * 100 : 0 }), ["▥", "No course data yet", "Add a course and log study sessions."]);
    const rows = [...sessions].sort(byDateDesc).slice(0, 12);
    $("#history-body").replaceChildren(...(rows.length ? rows.map(x => $("tr", make("tpl-history", { date: new Date(x.date).toLocaleDateString(), course: x.courseName || "General study", dur: mins(x.durationMinutes) }))) : [(() => { const tr = document.createElement("tr"), td = tr.insertCell(); td.colSpan = 3; td.className = "muted"; td.textContent = "No sessions recorded yet."; return tr; })()]));
    $("#export-csv").addEventListener("click", () => {
      const all = [["Date", "Course", "Duration minutes", "Notes"], ...sessions.map(x => [x.date, x.courseName, x.durationMinutes, x.notes || ""])];
      download("studyflow-sessions.csv", all.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
    });
  }

  /* ---------- timetable ---------- */
  function timetable() {
    const t = store.get("timetable");
    $$("input[name=days]").forEach(el => { el.checked = t.days.includes(Number(el.value)); });
    $("#start-time").value = t.startTime; $("#end-time").value = t.endTime; $("#session-length").value = t.sessionMinutes; $("#break-length").value = t.breakMinutes;
    const draw = () => {
      const items = (store.get("timetable").sessions || []).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
      $("#sum-planned").textContent = items.length;
      $("#sum-time").textContent = mins(items.filter(x => x.status !== "Skipped").reduce((n, x) => n + x.durationMinutes, 0));
      $("#sum-done").textContent = items.filter(x => x.status === "Complete").length;
      $("#sum-skipped").textContent = items.filter(x => x.status === "Skipped").length;
      const groups = {}; items.forEach(x => (groups[x.date] ||= []).push(x));
      show($("#schedule-list"), Object.entries(groups), ([date, list]) => {
        const day = make("tpl-day", { date: fmtDate(date), total: mins(list.reduce((n, x) => n + x.durationMinutes, 0)) });
        $(".slots", day).append(...list.map(x => make("tpl-slot", { id: x.id, time: `${x.startTime} to ${x.endTime}`, course: x.courseName, sub: `${mins(x.durationMinutes)} · ${x.status || "Planned"}` })));
        return day;
      }, ["▦", "No timetable generated", "Choose your available days and generate a plan."]);
    };
    draw();
    $("#timetable-form").addEventListener("submit", e => {
      e.preventDefault();
      const list = store.get("courses"), days = $$("input[name=days]:checked").map(el => Number(el.value));
      const start = $("#start-time").value, end = $("#end-time").value, sessionMinutes = Number($("#session-length").value), breakMinutes = Number($("#break-length").value);
      const weekly = Number(store.get("settings").weeklyHours) || 0;
      if (!days.length) return message("Choose at least one available day.", "error");
      if (start >= end) return message("End time must be later than start time.", "error");
      if (sessionMinutes < 15 || sessionMinutes > 180 || breakMinutes < 0 || breakMinutes > 60) return message("Check the session and break lengths.", "error");
      if (!list.length) return message("Add courses before generating a timetable.", "error");
      if (weekly <= 0) return message("Set a weekly study target in Settings first.", "error");
      const next = { days, startTime: start, endTime: end, sessionMinutes, breakMinutes, sessions: [] };
      const queue = list.map(c => ({ id: c.id, name: c.name, minutes: Math.max(30, Math.round(weekly * 60 / list.length)) }));
      let qi = 0; const base = new Date(); base.setHours(0, 0, 0, 0);
      for (let off = 0; off < 7 && qi < queue.length; off++) {
        const date = new Date(base); date.setDate(date.getDate() + off);
        if (!days.includes(date.getDay())) continue;
        let cursor = toMin(start); const endMin = toMin(end);
        if (off === 0) { const n = new Date(); cursor = Math.max(cursor, n.getHours() * 60 + n.getMinutes() + 5); }
        while (qi < queue.length && cursor < endMin) {
          const task = queue[qi], dur = Math.min(sessionMinutes, task.minutes);
          if (cursor + dur > endMin) break;
          next.sessions.push({ id: uid(), courseId: task.id, courseName: task.name, date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, startTime: toTime(cursor), endTime: toTime(cursor + dur), durationMinutes: dur, status: "Planned" });
          task.minutes -= dur; cursor += dur + breakMinutes; if (task.minutes <= 0) qi++;
        }
      }
      store.set("timetable", next); draw(); message("Timetable generated.");
    });
    $("#clear-timetable").addEventListener("click", () => { store.set("timetable", { ...store.get("timetable"), sessions: [] }); draw(); message("Generated sessions cleared."); });
    $("#schedule-list").addEventListener("click", e => {
      const b = e.target.closest("button[data-schedule]"); if (!b) return;
      const tt = store.get("timetable"), target = b.dataset.schedule === "complete" ? "Complete" : "Skipped";
      tt.sessions = tt.sessions.map(x => x.id === b.dataset.id ? { ...x, status: x.status === target ? "Planned" : target } : x);
      store.set("timetable", tt); draw();
    });
  }

  /* ---------- study room ---------- */
  function studyRoom() {
    fillCourses($("#focus-course"));
    let timer = { duration: 1500, remaining: 1500, elapsed: 0, running: false, id: null };
    const show_ = () => {
      $("#timer-display").textContent = `${pad(Math.floor(timer.remaining / 60))}:${pad(timer.remaining % 60)}`;
      $("#timer-display").style.setProperty("--p", Math.round(timer.elapsed / timer.duration * 100));
      $("#timer-start").textContent = timer.running ? "Focusing…" : timer.elapsed ? "Resume focus" : "Start focus";
      $("#timer-start").disabled = timer.running; $("#timer-pause").disabled = !timer.running;
      $("#timer-status").textContent = timer.remaining === 0 ? "Session complete. Nice work!" : timer.running ? "Focus mode is on. Keep going." : "Ready when you are.";
      $("#session-duration").value = Math.max(1, Math.round(timer.elapsed / 60));
    };
    const stop = () => { clearInterval(timer.id); timer.id = null; timer.running = false; };
    const reset = () => { stop(); const n = Math.max(1, Math.min(180, Number($("#focus-minutes").value) || 25)); timer = { duration: n * 60, remaining: n * 60, elapsed: 0, running: false, id: null }; show_(); };
    $("#timer-start").addEventListener("click", () => {
      if (timer.remaining <= 0) reset(); if (timer.running) return; timer.running = true;
      timer.id = setInterval(() => { timer.remaining--; timer.elapsed++; if (timer.remaining <= 0) { timer.remaining = 0; stop(); } show_(); }, 1000); show_();
    });
    $("#timer-pause").addEventListener("click", () => { stop(); show_(); });
    $("#timer-reset").addEventListener("click", reset);
    $("#focus-minutes").addEventListener("change", () => { if (!timer.running) reset(); });
    const draw = () => sessionList($("#recent-list"), store.get("sessions"), 5, false);
    draw();
    $("#session-form").addEventListener("submit", e => {
      e.preventDefault();
      const d = Number($("#session-duration").value); if (!Number.isFinite(d) || d <= 0) return message("Enter a valid session duration.", "error");
      const course = store.get("courses").find(c => c.id === $("#focus-course").value), list = store.get("sessions");
      list.push({ id: uid(), courseId: course?.id || "", courseName: course?.name || "General study", durationMinutes: Math.round(d), notes: $("#session-notes").value.trim(), date: new Date().toISOString() });
      store.set("sessions", list); $("#session-notes").value = ""; draw(); message("Study session saved.");
    });
  }

  /* ---------- settings ---------- */
  function settings() {
    const s = store.get("settings");
    $("#display-name").value = s.displayName; $("#semester-name").value = s.semester; $("#weekly-target").value = s.weeklyHours; $("#theme-setting").value = s.theme;
    $("#storage-summary").replaceChildren(...Object.entries(store.all()).map(([key, v]) => make("tpl-store", { key, count: Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : "Saved" })));
    $("#settings-form").addEventListener("submit", e => {
      e.preventDefault();
      const weeklyHours = Number($("#weekly-target").value);
      if (weeklyHours < 1 || weeklyHours > 100) return message("Weekly target must be between 1 and 100 hours.", "error");
      store.set("settings", { ...store.get("settings"), displayName: $("#display-name").value.trim() || "Student", semester: $("#semester-name").value.trim() || "Current semester", weeklyHours, theme: $("#theme-setting").value });
      initShell(); message("Preferences saved.");
    });
    $("#backup-export").addEventListener("click", () => download(`studyflow-backup-${today()}.json`, JSON.stringify(store.exportData(), null, 2)));
    $("#backup-file").addEventListener("change", async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const bundle = JSON.parse(await file.text());
        if (!confirm("Import this backup? Existing StudyFlow data in these categories will be replaced.")) return;
        store.importData(bundle); message("Backup imported. Reloading."); setTimeout(() => location.reload(), 600);
      } catch (err) { message(err.message || "Could not import this backup.", "error"); } finally { e.target.value = ""; }
    });
    $("#reset-data").addEventListener("click", () => {
      if (confirm("This will erase all StudyFlow data in this browser. Export a backup first if you need one. Continue?")) { store.clearAll(); message("All local data reset."); setTimeout(() => location.href = "../index.html", 500); }
    });
  }

  initShell();
  ({ dashboard, courses, assignments, notes, analytics, timetable, "study-room": studyRoom, settings }[page] || dashboard)();
})();
