const STORAGE_KEY = "teacher-behavior-tracker-local-v1";
const BACKUP_FILE_VERSION = 1;
const DEFAULT_HALL_PASSES = 8;
const QUICK_NOTE_PRESETS = [
  "Phone",
  "Off task",
  "Disruptive",
  "Talking",
  "No Chromebook",
  "No pencil",
  "Helping others",
  "Great participation"
];

const DEFAULT_BEHAVIORS = [
  {
    id: "behavior-positive",
    label: "Positive behavior",
    tone: "positive",
    group: "Behavior",
    examples: "respectful, on task, follows directions, helps others"
  },
  {
    id: "behavior-negative",
    label: "Negative behavior",
    tone: "negative",
    group: "Behavior",
    examples: "disruptive, talking out, off task, phone violation, disrespect"
  },
  {
    id: "preparedness-positive",
    label: "Prepared",
    tone: "positive",
    group: "Preparedness",
    examples: "Chromebook, pencil, notebook, assignment, ready at start of class"
  },
  {
    id: "preparedness-negative",
    label: "Unprepared",
    tone: "negative",
    group: "Preparedness",
    examples: "missing materials or not ready at the start of class"
  },
  {
    id: "participation-positive",
    label: "Participating",
    tone: "positive",
    group: "Participation",
    examples: "answering questions, discussion, group work, labs, volunteering"
  },
  {
    id: "participation-negative",
    label: "Not participating",
    tone: "negative",
    group: "Participation",
    examples: "disengaged during discussion, group work, labs, or practice"
  }
];

const LEGACY_BEHAVIOR_MAP = {
  "on-task": "behavior-positive",
  respectful: "behavior-positive",
  disruption: "behavior-negative",
  "phone-violation": "behavior-negative",
  prepared: "preparedness-positive",
  unprepared: "preparedness-negative",
  participation: "participation-positive"
};

const DEFAULT_CONSEQUENCE_LADDER = [
  "Reminder and redirection",
  "Seat change or private conference",
  "Teacher contact home",
  "Office referral or team intervention"
];

const SAMPLE_STATE = createSampleState();

const appState = {
  data: loadState(),
  activeClassId: "",
  summaryClassId: "",
  contactClassId: "",
  selectedCategoryGroup: "Behavior",
  selectedStudentId: "",
  selectedBehaviorId: "",
  quickNote: "",
  noteModeOpen: false,
  reportStudentId: "",
  studentPrintMode: false,
  classroomMode: false,
  seatingChartMode: false,
  newClassName: "",
  bulkRosterText: "",
  bulkRosterPeriodId: "",
  selectedNotePreset: "",
  lastLoggedEventId: "",
  lastLogMessage: "",
  flashStudentId: "",
  flashTone: "",
  filters: {
    studentId: "all",
    periodId: "all",
    behaviorId: "all",
    range: "today",
    exactDate: getLocalDateString()
  },
  contactDrafts: {}
};

let flashTimeoutId = 0;
let feedbackTimeoutId = 0;

initializeApp();

function initializeApp() {
  if (!appState.data.students.length) {
    appState.data = createFreshState();
  }

  appState.activeClassId = appState.data.classPeriods[0]?.id || "";
  appState.summaryClassId = appState.activeClassId;
  appState.contactClassId = appState.activeClassId;
  appState.selectedCategoryGroup = appState.data.behaviorCategories[0]?.group || "Behavior";
  appState.selectedStudentId = getStudentsForActiveClass()[0]?.id || "";
  appState.selectedBehaviorId = appState.data.behaviorCategories[0]?.id || "";
  appState.noteModeOpen = false;
  appState.studentPrintMode = false;
  appState.bulkRosterPeriodId = appState.data.classPeriods[0]?.id || "";
  persistState();
  renderApp();
}

function renderApp() {
  const root = document.querySelector("#root");
  const activeClass = appState.data.classPeriods.find((period) => period.id === appState.activeClassId) || null;
  const activeStudents = getStudentsForActiveClass();
  const filteredEvents = getFilteredEvents();
  const stats = buildDashboardStats(filteredEvents);
  const dailySummary = buildStudentSummaryForExactDate(appState.filters.exactDate);
  const weeklySummary = buildStudentSummary("week");
  const reportStudent = appState.data.students.find((student) => student.id === appState.reportStudentId) || null;

  root.innerHTML = `
    <div class="app-shell ${appState.studentPrintMode ? "student-print-mode" : ""}">
      <header class="topbar">
        <div class="brand-lockup">
          <div class="brand-emblem" aria-hidden="true">${renderWarriorEmblem()}</div>
          <div>
            <p class="eyebrow">Teacher Dashboard</p>
            <h1>Buckeye Trail Warriors</h1>
            <p class="brand-subtitle">Behavior Tracker</p>
          </div>
        </div>
        <div class="topbar-copy">
          <p class="subtitle">
            Fast behavior logging for live instruction, reflection, and family communication.
          </p>
        </div>
        <div class="topbar-actions">
          <button class="secondary-button" data-action="toggle-classroom-mode">
            ${appState.classroomMode ? "Exit classroom mode" : "Classroom mode"}
          </button>
          <button class="secondary-button" data-action="toggle-seating-mode">
            ${appState.seatingChartMode ? "Roster view" : "Seating chart mode"}
          </button>
          ${appState.classroomMode ? "" : `
            <button class="secondary-button" data-action="export-backup">Backup data</button>
            <button class="secondary-button" data-action="restore-backup">Restore data</button>
            <button class="secondary-button" data-action="reset-sample">Reset to sample data</button>
            <button class="secondary-button" data-action="export-csv">Export filtered CSV</button>
            <button class="primary-button" data-action="print-dashboard">Print dashboard</button>
          `}
        </div>
      </header>
      <input id="backupFileInput" type="file" accept=".json,application/json" hidden>

      <section class="date-strip">
        <div class="date-strip-copy">
          <p class="eyebrow">Working Date</p>
          <h2>${escapeHtml(formatReadableDate(appState.filters.exactDate || getLocalDateString()))}</h2>
        </div>
        <div class="date-strip-actions">
          <button class="secondary-button" data-action="set-date-today">Today</button>
          <button class="secondary-button" data-action="shift-date" data-direction="-1">Previous Day</button>
          <button class="secondary-button" data-action="shift-date" data-direction="1">Next Day</button>
          <label class="field inline-date-field">
            <span>Select date</span>
            <input id="workingDate" type="date" value="${escapeAttribute(appState.filters.exactDate || getLocalDateString())}">
          </label>
        </div>
      </section>

      ${appState.classroomMode ? "" : `
        <section class="stats-strip">
          ${renderStatCard("Students", String(appState.data.students.length), "neutral")}
          ${renderStatCard("Positive on date", String(stats.positiveToday), "positive")}
          ${renderStatCard("Negative on date", String(stats.negativeToday), "negative")}
          ${renderStatCard("Parent contacts", String(appState.data.parentContacts.length), "neutral")}
        </section>
      `}

      <main class="main-grid">
        <section class="panel panel-span-2">
          ${renderPanelHeader("Quick Entry", activeClass ? `Students in ${activeClass.name}` : "Select a class", "Click a class to load that roster, then log behavior in a couple of clicks.")}
          ${renderBehaviorEntryPanel(activeStudents)}
          ${renderStudentGrid(activeStudents)}
        </section>

        ${appState.classroomMode ? "" : `
          <section class="panel">
            ${renderPanelHeader("Share This App", "Teacher-ready backup and setup", "Each teacher keeps their own local data, but can back it up or move it to another device.")}
            ${renderSharingPanel()}
          </section>

          <section class="panel">
            ${renderPanelHeader("Classes", "Add and manage classes", "Create your own classes or periods for the school year.")}
            ${renderClassManager()}
          </section>

          <section class="panel">
            ${renderPanelHeader("Roster", "Manage students", "Keep each student tied to a class period.")}
            ${renderRosterManager(activeStudents, activeClass)}
          </section>

          <section class="panel">
            ${renderPanelHeader("Filters", "Search behavior records", "Narrow events by student, date range, period, or behavior.")}
            ${renderFiltersPanel()}
            ${renderEventFeed(filteredEvents.slice(0, 16))}
          </section>

          <section class="panel panel-span-2">
            ${renderPanelHeader("Summaries", "Daily and weekly trends", "See which students need recognition, support, or follow-up.")}
            ${renderSummaryPanel(dailySummary, weeklySummary, stats.classPeriodTotals)}
          </section>

          <section class="panel">
            ${renderPanelHeader("Tracker Focus", "Three main categories", "Behavior, Preparedness, and Participation each log as positive or negative.")}
            ${renderBehaviorCategoryManager()}
          </section>

          <section class="panel">
            ${renderPanelHeader("Consequence Ladder", "Classroom response steps", "Customize the sequence you use for follow-up.")}
            ${renderConsequenceLadderPanel()}
          </section>

          <section class="panel panel-span-2">
            ${renderPanelHeader("Parent Contact", "Student communication log", "Track calls, emails, and follow-up notes by student.")}
            ${renderParentContactPanel()}
          </section>

          <section class="panel panel-span-2 printable-report">
            ${renderPanelHeader("Printable Report", reportStudent ? `Student report: ${escapeHtml(reportStudent.name)}` : "Choose a student report", "Use the roster buttons to print a single-student summary.")}
            ${renderStudentReport(reportStudent)}
          </section>
        `}
      </main>
      ${appState.lastLogMessage ? `<div class="toast-banner">${escapeHtml(appState.lastLogMessage)}</div>` : ""}
    </div>
  `;

  attachEventHandlers();
}

function renderWarriorEmblem() {
  return `
    <svg viewBox="0 0 160 160" class="warrior-emblem" role="img" aria-label="Warrior head emblem">
      <circle cx="80" cy="80" r="74" fill="#dfe8ff"></circle>
      <path d="M80 20 L110 34 L104 54 L125 76 L111 132 L80 144 L49 132 L35 76 L56 54 L50 34 Z" fill="#2042b5"></path>
      <path d="M80 29 L101 39 L96 56 L110 70 L99 117 L80 126 L61 117 L50 70 L64 56 L59 39 Z" fill="#f9fbfd"></path>
      <path d="M65 66 L95 66 L104 83 L97 102 L80 113 L63 102 L56 83 Z" fill="#2042b5"></path>
      <path d="M68 74 L78 80 L65 86 Z" fill="#f9fbfd"></path>
      <path d="M92 74 L82 80 L95 86 Z" fill="#f9fbfd"></path>
      <path d="M80 84 L88 95 L80 104 L72 95 Z" fill="#6f86d8"></path>
      <path d="M62 46 L80 31 L98 46 L93 55 L67 55 Z" fill="#6f86d8"></path>
      <path d="M58 118 L80 129 L102 118 L96 109 L64 109 Z" fill="#6f86d8"></path>
    </svg>
  `;
}

function renderStatCard(label, value, tone) {
  return `
    <article class="stat-card tone-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderPanelHeader(eyebrow, title, description) {
  return `
    <div class="panel-header">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p class="panel-description">${escapeHtml(description)}</p>
    </div>
  `;
}

function renderBehaviorEntryPanel(students) {
  const selectedStudent = students.find((student) => student.id === appState.selectedStudentId);
  const selectedBehavior = appState.data.behaviorCategories.find((behavior) => behavior.id === appState.selectedBehaviorId);
  const groupedBehaviors = getGroupedBehaviors();
  const activeGroup = groupedBehaviors.find((group) => group.name === appState.selectedCategoryGroup) || groupedBehaviors[0];

  if (!appState.activeClassId) {
    return '<div class="empty-box">Add a class and click it to start viewing students.</div>';
  }

  if (!students.length) {
    return '<div class="empty-box">This class has no students yet. Add students or paste a roster to get started.</div>';
  }

  return `
    <div class="quick-entry">
      <div class="quick-entry-topline">
        ${renderClassTabs()}
        ${renderQuickUndo()}
      </div>
      <div class="quick-entry-grid">
        <label class="field">
          <span>Student</span>
          <select id="selectedStudent">
            ${students.map((student) => `
              <option value="${escapeAttribute(student.id)}" ${student.id === appState.selectedStudentId ? "selected" : ""}>
                ${escapeHtml(student.name)}
              </option>
            `).join("")}
          </select>
        </label>

        <div class="field">
          <span>Optional note</span>
          <button class="secondary-button note-toggle" data-action="toggle-note-mode">
            ${appState.noteModeOpen ? "Hide note box" : "Add note if needed"}
          </button>
        </div>

        <div class="field">
          <span>Current category</span>
          <select id="selectedCategoryGroup">
            ${groupedBehaviors.map((group) => `
              <option value="${escapeAttribute(group.name)}" ${group.name === appState.selectedCategoryGroup ? "selected" : ""}>
                ${escapeHtml(group.name)}
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      ${appState.noteModeOpen ? `
        <label class="field">
          <span>Teacher note</span>
          <input id="quickNoteInput" type="text" value="${escapeAttribute(appState.quickNote)}" placeholder="Optional note for the next click">
        </label>
      ` : ""}

      <div class="quick-presets-panel">
        <div class="quick-presets-header">
          <strong>Quick note presets</strong>
          <span>${appState.selectedNotePreset ? `Next note: ${escapeHtml(appState.selectedNotePreset)}` : "Tap only when needed"}</span>
        </div>
        <div class="quick-presets-grid">
          ${QUICK_NOTE_PRESETS.map((preset) => `
            <button
              class="preset-chip ${preset === appState.selectedNotePreset ? "active-preset-chip" : ""}"
              data-action="select-note-preset"
              data-note="${escapeAttribute(preset)}"
            >
              ${escapeHtml(preset)}
            </button>
          `).join("")}
          ${appState.selectedNotePreset ? '<button class="secondary-button compact-button" data-action="clear-note-preset">Clear preset</button>' : ""}
        </div>
      </div>

      <div class="category-quick-grid single-category-grid">
        <article class="category-card active-category-card">
          <div class="category-card-header">
            <h3>${escapeHtml(activeGroup?.name || "Category")}</h3>
            <p>${escapeHtml(activeGroup?.examples || "")}</p>
          </div>
          <div class="student-tile-actions">
            <button class="positive-chip" data-action="choose-behavior" data-behavior-id="${escapeAttribute(activeGroup?.positive?.id || "")}">
              + ${escapeHtml(activeGroup?.positive?.label || "Positive")}
            </button>
            <button class="negative-chip" data-action="choose-behavior" data-behavior-id="${escapeAttribute(activeGroup?.negative?.id || "")}">
              - ${escapeHtml(activeGroup?.negative?.label || "Negative")}
            </button>
          </div>
        </article>
      </div>

      <div class="selection-summary">
        <span class="tone-pill tone-${selectedBehavior?.tone || "positive"}">${escapeHtml(selectedBehavior?.tone || "behavior")}</span>
        <p>
          ${escapeHtml(selectedStudent?.name || "Select a student")} is selected.
          The student tiles below are the fastest way to log during class.
        </p>
        <button class="secondary-button" data-action="toggle-note-mode">
          ${appState.noteModeOpen ? "Close note box" : "Need a note?"}
        </button>
      </div>
    </div>
  `;
}

function renderStudentGrid(students) {
  const activeGroup = getGroupedBehaviors().find((group) => group.name === appState.selectedCategoryGroup) || getGroupedBehaviors()[0];
  const positiveBehavior = activeGroup?.positive;
  const negativeBehavior = activeGroup?.negative;

  if (!appState.activeClassId) {
    return '<div class="empty-box">Choose a class to view its students.</div>';
  }

  if (!students.length) {
    return '<div class="empty-box">No students are assigned to this class yet.</div>';
  }

  return `
    <div class="student-grid ${appState.seatingChartMode ? "seating-chart-grid" : ""}">
      ${students.map((student) => {
        const period = appState.data.classPeriods.find((entry) => entry.id === student.periodId);
        const counts = getStudentCountsForDate(student.id, appState.filters.exactDate || getLocalDateString());
        return `
          <article class="student-tile ${student.id === appState.selectedStudentId ? "selected" : ""} ${student.id === appState.flashStudentId ? `flash-${appState.flashTone}` : ""}">
            <button class="student-select" data-action="select-student" data-student-id="${escapeAttribute(student.id)}">
              <strong>${escapeHtml(student.name)}</strong>
              <span>${escapeHtml(period?.name || "No period")}</span>
              <span>${escapeHtml(student.seatLabel || "")}</span>
            </button>
            ${appState.seatingChartMode
              ? `
                <label class="seat-field">
                  <span>Seat label</span>
                  <input
                    class="seat-input"
                    type="text"
                    data-role="seat-label"
                    data-student-id="${escapeAttribute(student.id)}"
                    value="${escapeAttribute(student.seatLabel || "")}"
                  >
                </label>
              `
              : ""}
            <div class="student-metrics">
              <span class="metric-pill positive-text">Today +${counts.positive}</span>
              <span class="metric-pill negative-text">Today -${counts.negative}</span>
              <span class="metric-pill">Passes ${student.hallPassesRemaining ?? DEFAULT_HALL_PASSES}</span>
            </div>
            <div class="student-tile-actions">
              <button class="positive-chip" data-action="quick-log" data-student-id="${escapeAttribute(student.id)}" data-behavior-id="${escapeAttribute(positiveBehavior?.id || "")}">
                + ${escapeHtml(activeGroup?.name || "Category")}
              </button>
              <button class="negative-chip" data-action="quick-log" data-student-id="${escapeAttribute(student.id)}" data-behavior-id="${escapeAttribute(negativeBehavior?.id || "")}">
                - ${escapeHtml(activeGroup?.name || "Category")}
              </button>
            </div>
            <div class="hall-pass-actions">
              <button class="secondary-button compact-button" data-action="use-hall-pass" data-student-id="${escapeAttribute(student.id)}">Use pass</button>
              <button class="secondary-button compact-button" data-action="restore-hall-pass" data-student-id="${escapeAttribute(student.id)}">Restore pass</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderRosterManager(students, activeClass) {
  const periodOptions = appState.data.classPeriods.length
    ? appState.data.classPeriods.map((period) => `
        <option value="${escapeAttribute(period.id)}" ${period.id === appState.bulkRosterPeriodId ? "selected" : ""}>${escapeHtml(period.name)}</option>
      `).join("")
    : '<option value="">Add a class first</option>';

  const singleStudentOptions = appState.data.classPeriods.length
    ? appState.data.classPeriods.map((period) => `
        <option value="${escapeAttribute(period.id)}" ${period.id === appState.activeClassId ? "selected" : ""}>${escapeHtml(period.name)}</option>
      `).join("")
    : '<option value="">Add a class first</option>';

  return `
    <div class="stack">
      <form id="addStudentForm" class="stack form-card">
        <label class="field">
          <span>Student name</span>
          <input id="newStudentName" type="text" placeholder="Add student">
        </label>
        <label class="field">
          <span>Class period</span>
          <select id="newStudentPeriod">
            ${singleStudentOptions}
          </select>
        </label>
        <button class="primary-button" type="submit" ${appState.data.classPeriods.length ? "" : "disabled"}>Add student</button>
      </form>

      <form id="bulkRosterForm" class="stack form-card">
        <label class="field">
          <span>Paste roster into class</span>
          <select id="bulkRosterPeriod">
            ${periodOptions}
          </select>
        </label>
        <label class="field">
          <span>Student names</span>
          <textarea
            id="bulkRosterText"
            rows="7"
            placeholder="Paste one student per line&#10;Ariana Lopez&#10;Miles Carter&#10;Jada Nguyen"
          >${escapeHtml(appState.bulkRosterText)}</textarea>
        </label>
        <button class="primary-button" type="submit" ${appState.data.classPeriods.length ? "" : "disabled"}>Import roster</button>
      </form>

      <div class="stack">
        ${students.length ? students.map((student) => {
          const period = appState.data.classPeriods.find((entry) => entry.id === student.periodId);
          return `
            <article class="list-row">
              <div>
                <strong>${escapeHtml(student.name)}</strong>
                <p>${escapeHtml(period?.name || "No period assigned")}</p>
              </div>
              <div class="row-actions">
                <button class="secondary-button" data-action="preview-student-report" data-student-id="${escapeAttribute(student.id)}">Preview</button>
                <button class="primary-button" data-action="print-student-report" data-student-id="${escapeAttribute(student.id)}">Print</button>
                <button class="danger-button" data-action="remove-student" data-student-id="${escapeAttribute(student.id)}">Remove</button>
              </div>
            </article>
          `;
        }).join("") : `<div class="empty-box">${activeClass ? `No students are in ${escapeHtml(activeClass.name)} yet.` : "Select a class to view its roster."}</div>`}
      </div>
    </div>
  `;
}

function renderClassManager() {
  return `
    <div class="stack">
      <form id="addClassForm" class="stack form-card">
        <label class="field">
          <span>Class name</span>
          <input id="newClassName" type="text" value="${escapeAttribute(appState.newClassName)}" placeholder="Example: Period 3 English">
        </label>
        <button class="primary-button" type="submit">Add class</button>
      </form>

      <div class="stack">
        ${appState.data.classPeriods.map((period, index) => {
          const studentCount = appState.data.students.filter((student) => student.periodId === period.id).length;
          return `
            <article class="list-row ${period.id === appState.activeClassId ? "active-class-row" : ""}">
              <div>
                <input
                  type="text"
                  class="inline-edit-input"
                  data-role="class-name"
                  data-index="${index}"
                  value="${escapeAttribute(period.name)}"
                >
                <p>${studentCount} ${studentCount === 1 ? "student" : "students"}</p>
              </div>
              <div class="row-actions">
                <button class="secondary-button" data-action="open-class" data-period-id="${escapeAttribute(period.id)}">Open</button>
                <button class="danger-button" data-action="remove-class" data-period-id="${escapeAttribute(period.id)}">Remove</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFiltersPanel() {
  return `
    <div class="filter-grid">
      <label class="field">
        <span>Student</span>
        <select id="filterStudent">
          <option value="all">All students</option>
          ${appState.data.students.map((student) => `
            <option value="${escapeAttribute(student.id)}" ${student.id === appState.filters.studentId ? "selected" : ""}>
              ${escapeHtml(student.name)}
            </option>
          `).join("")}
        </select>
      </label>

      <label class="field">
        <span>Period</span>
        <select id="filterPeriod">
          <option value="all">All periods</option>
          ${appState.data.classPeriods.map((period) => `
            <option value="${escapeAttribute(period.id)}" ${period.id === appState.filters.periodId ? "selected" : ""}>
              ${escapeHtml(period.name)}
            </option>
          `).join("")}
        </select>
      </label>

      <label class="field">
        <span>Behavior</span>
        <select id="filterBehavior">
          <option value="all">All behaviors</option>
          ${appState.data.behaviorCategories.map((behavior) => `
            <option value="${escapeAttribute(behavior.id)}" ${behavior.id === appState.filters.behaviorId ? "selected" : ""}>
              ${escapeHtml(behavior.label)}
            </option>
          `).join("")}
        </select>
      </label>

      <label class="field">
        <span>Date range</span>
        <select id="filterRange">
          <option value="today" ${appState.filters.range === "today" ? "selected" : ""}>Today</option>
          <option value="week" ${appState.filters.range === "week" ? "selected" : ""}>This week</option>
          <option value="all" ${appState.filters.range === "all" ? "selected" : ""}>All saved data</option>
        </select>
      </label>

      <label class="field">
        <span>Specific date</span>
        <input id="filterExactDate" type="date" value="${escapeAttribute(appState.filters.exactDate)}">
      </label>
    </div>
  `;
}

function renderEventFeed(events) {
  if (!events.length) {
    return '<div class="stack compact-stack top-gap"><div class="empty-box">No events match these filters yet.</div></div>';
  }

  return `
    <div class="stack compact-stack top-gap">
      ${events.map((event) => `
        <article class="event-row tone-${escapeAttribute(event.tone)}">
          <div>
            <strong>${escapeHtml(event.studentName)}</strong>
            <p>${escapeHtml(event.behaviorLabel)} in ${escapeHtml(event.periodName)}</p>
          </div>
          <div class="event-side">
            <div class="event-meta">
              <span>${escapeHtml(formatDateTime(event.timestamp))}</span>
              <span>${escapeHtml(event.note || "No note")}</span>
            </div>
            <button class="danger-button compact-button" data-action="delete-event" data-event-id="${escapeAttribute(event.id)}">
              Delete
            </button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSummaryPanel(dailySummary, weeklySummary, classPeriodTotals) {
  const activeSummaryClassId = appState.summaryClassId || appState.activeClassId || appState.data.classPeriods[0]?.id || "";
  const filteredDailySummary = dailySummary.filter((row) => row.periodId === activeSummaryClassId);
  const filteredWeeklySummary = weeklySummary.filter((row) => row.periodId === activeSummaryClassId);

  return `
    <div class="summary-layout">
      <section class="summary-tabs-section">
        <h3>Class tabs</h3>
        <div class="summary-tabs">
          ${appState.data.classPeriods.map((period) => `
            <button
              class="summary-tab ${period.id === activeSummaryClassId ? "active-summary-tab" : ""}"
              data-action="select-summary-class"
              data-period-id="${escapeAttribute(period.id)}"
            >
              ${escapeHtml(period.name)}
            </button>
          `).join("")}
        </div>
      </section>
      <section>
        <h3>Daily summary by student</h3>
        ${renderSummaryTable(filteredDailySummary)}
      </section>
      <section>
        <h3>Weekly summary by student</h3>
        ${renderSummaryTable(filteredWeeklySummary)}
      </section>
      <section>
        <h3>Behavior totals by class period</h3>
        <div class="stack compact-stack">
          ${appState.data.classPeriods.map((period) => {
            const totals = classPeriodTotals[period.id] || { positive: 0, negative: 0 };
            return `
              <article class="list-row">
                <div>
                  <strong>${escapeHtml(period.name)}</strong>
                  <p>${totals.positive} positive, ${totals.negative} negative</p>
                </div>
                <span class="period-score">${escapeHtml(formatSignedNumber(totals.positive - totals.negative))}</span>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderSummaryTable(rows) {
  if (!rows.length) {
    return '<div class="empty-box">No events logged for this view yet.</div>';
  }

  return `
    <div class="summary-table">
      ${rows.map((row) => `
        <article class="summary-row">
          <strong>${escapeHtml(row.studentName)}</strong>
          <span class="positive-text">${row.positive} positive</span>
          <span class="negative-text">${row.negative} negative</span>
          <span>${escapeHtml(formatSignedNumber(row.score))}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function renderBehaviorCategoryManager() {
  return `
    <div class="stack">
      ${appState.data.behaviorCategories.map((behavior, index) => `
        <article class="behavior-edit-row">
          <div>
            <strong>${escapeHtml(behavior.group || "Category")}</strong>
            <p>${escapeHtml(behavior.label)}</p>
          </div>
          <span class="tone-pill tone-${escapeAttribute(behavior.tone)}">${escapeHtml(behavior.tone)}</span>
        </article>
      `).join("")}
      <div class="empty-box">The tracker now stays focused on three main buckets: Behavior, Preparedness, and Participation.</div>
    </div>
  `;
}

function renderConsequenceLadderPanel() {
  return `
    <div class="stack">
      ${appState.data.consequenceLadder.map((step, index) => `
        <label class="field">
          <span>Step ${index + 1}</span>
          <input type="text" data-role="ladder-step" data-index="${index}" value="${escapeAttribute(step)}">
        </label>
      `).join("")}
      <button class="secondary-button" data-action="add-ladder-step">Add step</button>
    </div>
  `;
}

function renderSharingPanel() {
  return `
    <div class="stack">
      <div class="info-card">
        <strong>How sharing works</strong>
        <p>
          Send this folder to another teacher and they can use the tracker on their own computer. Their records stay private in their browser unless they choose to back them up.
        </p>
      </div>
      <div class="info-card">
        <strong>Backup your records</strong>
        <p>
          Use <strong>Backup data</strong> to download one file with classes, students, behavior records, categories, and parent contacts.
        </p>
      </div>
      <div class="info-card">
        <strong>Restore on another device</strong>
        <p>
          Open the tracker there, click <strong>Restore data</strong>, and choose your saved backup file.
        </p>
      </div>
    </div>
  `;
}

function renderClassTabs() {
  if (!appState.data.classPeriods.length) {
    return '<div class="empty-inline">Add a class to begin.</div>';
  }

  return `
    <div class="summary-tabs class-tabs">
      ${appState.data.classPeriods.map((period) => `
        <button
          class="summary-tab ${period.id === appState.activeClassId ? "active-summary-tab" : ""}"
          data-action="open-class"
          data-period-id="${escapeAttribute(period.id)}"
        >
          ${escapeHtml(period.name)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderQuickUndo() {
  return appState.lastLoggedEventId
    ? '<button class="primary-button" data-action="undo-last-log">Undo last log</button>'
    : '<div class="empty-inline">Recent logs will show an undo button here.</div>';
}

function renderParentContactPanel() {
  const activeContactClassId = appState.contactClassId || appState.activeClassId || appState.data.classPeriods[0]?.id || "";
  const visibleStudents = appState.data.students.filter((student) => student.periodId === activeContactClassId);

  return `
    <div class="contact-panel-layout">
      <section class="summary-tabs-section">
        <h3>Class tabs</h3>
        <div class="summary-tabs">
          ${appState.data.classPeriods.map((period) => `
            <button
              class="summary-tab ${period.id === activeContactClassId ? "active-summary-tab" : ""}"
              data-action="select-contact-class"
              data-period-id="${escapeAttribute(period.id)}"
            >
              ${escapeHtml(period.name)}
            </button>
          `).join("")}
        </div>
      </section>
      <div class="contact-grid">
      ${visibleStudents.length ? visibleStudents.map((student) => {
        const period = appState.data.classPeriods.find((entry) => entry.id === student.periodId);
        const studentContacts = appState.data.parentContacts
          .filter((contact) => contact.studentId === student.id)
          .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

        return `
          <article class="contact-card">
            <div class="contact-header">
              <div>
                <strong>${escapeHtml(student.name)}</strong>
                <p>${escapeHtml(period?.name || "No period")}</p>
              </div>
              <span class="contact-count">${studentContacts.length} contacts</span>
            </div>
            <label class="field">
              <span>New contact note</span>
              <textarea rows="3" data-role="contact-draft" data-student-id="${escapeAttribute(student.id)}" placeholder="Called home, emailed guardian, counselor follow-up...">${escapeHtml(appState.contactDrafts[student.id] || "")}</textarea>
            </label>
            <button class="primary-button" data-action="save-contact" data-student-id="${escapeAttribute(student.id)}">Save contact</button>
            <div class="stack compact-stack">
              ${studentContacts.length
                ? studentContacts.slice(0, 4).map((contact) => `
                    <article class="contact-entry">
                      <span>${escapeHtml(formatDateTime(contact.timestamp))}</span>
                      <p>${escapeHtml(contact.note)}</p>
                    </article>
                  `).join("")
                : '<div class="empty-box">No parent contacts logged.</div>'}
            </div>
          </article>
        `;
      }).join("") : '<div class="empty-box">No students are in this class yet.</div>'}
      </div>
    </div>
  `;
}

function renderStudentReport(student) {
  if (!student) {
    return '<div class="empty-box">Select a student report from the roster to prepare a printable summary.</div>';
  }

  const period = appState.data.classPeriods.find((entry) => entry.id === student.periodId);
  const studentEvents = appState.data.behaviorEvents
    .filter((event) => event.studentId === student.id)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
  const studentContacts = appState.data.parentContacts
    .filter((contact) => contact.studentId === student.id)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
  const hallPassHistory = (appState.data.hallPassEvents || [])
    .filter((entry) => entry.studentId === student.id)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

  const totals = studentEvents.reduce(
    (summary, event) => {
      const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
      if (behavior?.tone === "negative") {
        summary.negative += 1;
      } else {
        summary.positive += 1;
      }
      return summary;
    },
    { positive: 0, negative: 0 }
  );

  return `
    <div class="report-layout">
      <div class="report-block">
        <h3>${escapeHtml(student.name)}</h3>
        <p>${escapeHtml(period?.name || "No period assigned")}</p>
        <p>Positive events: ${totals.positive}</p>
        <p>Negative events: ${totals.negative}</p>
        <p>Hall passes remaining: ${student.hallPassesRemaining ?? DEFAULT_HALL_PASSES}</p>
      </div>

      <div class="report-block">
        <h3>Recent behavior events</h3>
        ${studentEvents.length
          ? studentEvents.slice(0, 8).map((event) => {
              const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
              return `
                <div class="report-entry">
                  <strong>${escapeHtml(behavior?.label || "Behavior")}</strong>
                  <span>${escapeHtml(formatDateTime(event.timestamp))}</span>
                  <p>${escapeHtml(event.note || "No note")}</p>
                </div>
              `;
            }).join("")
          : "<p>No behavior events logged yet.</p>"}
      </div>

      <div class="report-block">
        <h3>Parent contact log</h3>
        ${studentContacts.length
          ? studentContacts.slice(0, 8).map((contact) => `
              <div class="report-entry">
                <strong>${escapeHtml(formatDateTime(contact.timestamp))}</strong>
                <p>${escapeHtml(contact.note)}</p>
              </div>
            `).join("")
          : "<p>No parent contacts logged yet.</p>"}
      </div>
      <div class="report-block">
        <h3>Hall pass history</h3>
        ${hallPassHistory.length
          ? hallPassHistory.slice(0, 8).map((entry) => `
              <div class="report-entry">
                <strong>${escapeHtml(entry.action === "used" ? "Hall pass used" : "Hall pass restored")}</strong>
                <span>${escapeHtml(formatDateTime(entry.timestamp))}</span>
                <p>${escapeHtml(entry.note || "No note")}</p>
              </div>
            `).join("")
          : "<p>No hall pass changes logged yet.</p>"}
      </div>
    </div>
    <div class="report-toolbar">
      <button class="primary-button" data-action="print-current-student-report" data-student-id="${escapeAttribute(student.id)}">
        Print this student report
      </button>
    </div>
  `;
}

function attachEventHandlers() {
  const root = document.querySelector("#root");

  root.querySelector('[data-action="toggle-classroom-mode"]')?.addEventListener("click", () => {
    appState.classroomMode = !appState.classroomMode;
    renderApp();
  });
  root.querySelector('[data-action="toggle-seating-mode"]')?.addEventListener("click", () => {
    appState.seatingChartMode = !appState.seatingChartMode;
    renderApp();
  });
  root.querySelector('[data-action="export-backup"]')?.addEventListener("click", exportBackupFile);
  root.querySelector('[data-action="restore-backup"]')?.addEventListener("click", () => {
    root.querySelector("#backupFileInput")?.click();
  });
  root.querySelector("#backupFileInput")?.addEventListener("change", (event) => {
    restoreBackupFile(event.target.files?.[0] || null);
    event.target.value = "";
  });

  root.querySelector('[data-action="reset-sample"]')?.addEventListener("click", () => {
    appState.data = createFreshState();
    appState.selectedStudentId = appState.data.students[0]?.id || "";
    appState.selectedBehaviorId = appState.data.behaviorCategories[0]?.id || "";
    appState.quickNote = "";
    appState.selectedNotePreset = "";
    appState.lastLoggedEventId = "";
    appState.lastLogMessage = "";
    appState.flashStudentId = "";
    appState.flashTone = "";
    appState.reportStudentId = "";
    appState.contactDrafts = {};
    persistState();
    renderApp();
  });

  root.querySelector('[data-action="export-csv"]')?.addEventListener("click", exportFilteredCsv);
  root.querySelector('[data-action="print-dashboard"]')?.addEventListener("click", () => {
    appState.studentPrintMode = false;
    renderApp();
    window.setTimeout(() => window.print(), 60);
  });
  root.querySelector('[data-action="set-date-today"]')?.addEventListener("click", () => {
    appState.filters.exactDate = getLocalDateString();
    appState.filters.range = "today";
    renderApp();
  });
  root.querySelectorAll('[data-action="shift-date"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.filters.exactDate = shiftDateString(
        appState.filters.exactDate || getLocalDateString(),
        Number(button.dataset.direction)
      );
      appState.filters.range = "today";
      renderApp();
    });
  });
  root.querySelectorAll('[data-action="toggle-note-mode"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.noteModeOpen = !appState.noteModeOpen;
      if (!appState.noteModeOpen) {
        appState.quickNote = "";
      }
      renderApp();
    });
  });

  root.querySelector("#selectedStudent")?.addEventListener("change", (event) => {
    appState.selectedStudentId = event.target.value;
    renderApp();
  });

  root.querySelector("#selectedCategoryGroup")?.addEventListener("change", (event) => {
    setSelectedCategoryGroup(event.target.value);
  });

  root.querySelector("#quickNoteInput")?.addEventListener("input", (event) => {
    appState.quickNote = event.target.value;
    if (event.target.value.trim()) {
      appState.selectedNotePreset = "";
    }
  });

  root.querySelector("#workingDate")?.addEventListener("change", (event) => {
    appState.filters.exactDate = event.target.value || getLocalDateString();
    appState.filters.range = "today";
    renderApp();
  });

  root.querySelectorAll('[data-action="choose-behavior"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedBehaviorId = button.dataset.behaviorId;
      const selectedBehavior = appState.data.behaviorCategories.find((behavior) => behavior.id === button.dataset.behaviorId);
      appState.selectedCategoryGroup = selectedBehavior?.group || appState.selectedCategoryGroup;
      logBehaviorEvent(appState.selectedStudentId, button.dataset.behaviorId, getPendingNote());
    });
  });

  root.querySelector("#newClassName")?.addEventListener("input", (event) => {
    appState.newClassName = event.target.value;
  });

  root.querySelector("#bulkRosterText")?.addEventListener("input", (event) => {
    appState.bulkRosterText = event.target.value;
  });

  root.querySelector("#bulkRosterPeriod")?.addEventListener("change", (event) => {
    appState.bulkRosterPeriodId = event.target.value;
  });

  root.querySelector("#addClassForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    addClass(appState.newClassName);
  });

  root.querySelector("#addStudentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = root.querySelector("#newStudentName").value.trim();
    const periodId = root.querySelector("#newStudentPeriod").value;
    if (!name || !periodId) {
      return;
    }

    const student = {
      id: crypto.randomUUID(),
      name,
      periodId,
      seatLabel: `Seat ${appState.data.students.length + 1}`,
      hallPassesRemaining: DEFAULT_HALL_PASSES
    };

    appState.data.students.push(student);
    appState.selectedStudentId = student.id;
    persistState();
    renderApp();
  });

  root.querySelector("#bulkRosterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    importBulkRoster(appState.bulkRosterText, appState.bulkRosterPeriodId);
  });

  root.querySelectorAll('[data-action="select-student"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedStudentId = button.dataset.studentId;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="quick-log"]').forEach((button) => {
    button.addEventListener("click", () => {
      logBehaviorEvent(button.dataset.studentId, button.dataset.behaviorId, getPendingNote());
    });
  });

  root.querySelectorAll('[data-action="select-note-preset"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedNotePreset = button.dataset.note || "";
      appState.quickNote = "";
      renderApp();
    });
  });

  root.querySelector('[data-action="clear-note-preset"]')?.addEventListener("click", () => {
    appState.selectedNotePreset = "";
    renderApp();
  });

  root.querySelector('[data-action="undo-last-log"]')?.addEventListener("click", undoLastLog);

  root.querySelectorAll('[data-action="remove-student"]').forEach((button) => {
    button.addEventListener("click", () => {
      removeStudent(button.dataset.studentId);
    });
  });

  root.querySelectorAll('[data-action="remove-class"]').forEach((button) => {
    button.addEventListener("click", () => {
      removeClass(button.dataset.periodId);
    });
  });

  root.querySelectorAll('[data-action="delete-event"]').forEach((button) => {
    button.addEventListener("click", () => {
      deleteBehaviorEvent(button.dataset.eventId);
    });
  });

  root.querySelectorAll('[data-action="open-class"]').forEach((button) => {
    button.addEventListener("click", () => {
      setActiveClass(button.dataset.periodId);
    });
  });

  root.querySelectorAll('[data-action="preview-student-report"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.reportStudentId = button.dataset.studentId;
      appState.studentPrintMode = false;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="print-student-report"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.reportStudentId = button.dataset.studentId;
      appState.studentPrintMode = true;
      renderApp();
      window.setTimeout(() => window.print(), 60);
    });
  });

  root.querySelectorAll('[data-action="print-current-student-report"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.reportStudentId = button.dataset.studentId;
      appState.studentPrintMode = true;
      renderApp();
      window.setTimeout(() => window.print(), 60);
    });
  });

  root.querySelectorAll('[data-action="select-summary-class"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.summaryClassId = button.dataset.periodId;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="select-contact-class"]').forEach((button) => {
    button.addEventListener("click", () => {
      appState.contactClassId = button.dataset.periodId;
      renderApp();
    });
  });

  root.querySelectorAll('[data-action="use-hall-pass"]').forEach((button) => {
    button.addEventListener("click", () => {
      updateHallPass(button.dataset.studentId, -1);
    });
  });

  root.querySelectorAll('[data-action="restore-hall-pass"]').forEach((button) => {
    button.addEventListener("click", () => {
      updateHallPass(button.dataset.studentId, 1);
    });
  });

  bindFilters(root);
  bindClassEditors(root);
  bindSeatEditors(root);
  bindBehaviorEditors(root);
  bindConsequenceEditors(root);
  bindContactEditors(root);
}

function bindFilters(root) {
  root.querySelector("#filterStudent")?.addEventListener("change", (event) => {
    appState.filters.studentId = event.target.value;
    renderApp();
  });
  root.querySelector("#filterPeriod")?.addEventListener("change", (event) => {
    appState.filters.periodId = event.target.value;
    renderApp();
  });
  root.querySelector("#filterBehavior")?.addEventListener("change", (event) => {
    appState.filters.behaviorId = event.target.value;
    renderApp();
  });
  root.querySelector("#filterRange")?.addEventListener("change", (event) => {
    appState.filters.range = event.target.value;
    renderApp();
  });
  root.querySelector("#filterExactDate")?.addEventListener("change", (event) => {
    appState.filters.exactDate = event.target.value;
    renderApp();
  });
}

function bindBehaviorEditors(root) {
  root.querySelectorAll('[data-role="behavior-label"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      appState.data.behaviorCategories[index].label = event.target.value;
      persistState();
    });
  });

  root.querySelectorAll('[data-role="behavior-tone"]').forEach((select) => {
    select.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.index);
      appState.data.behaviorCategories[index].tone = event.target.value;
      persistState();
      renderApp();
    });
  });

  root.querySelector('[data-action="add-category"]')?.addEventListener("click", () => {
    const category = {
      id: `custom-${Date.now()}`,
      label: "New behavior",
      tone: "positive"
    };
    appState.data.behaviorCategories.push(category);
    appState.selectedBehaviorId = category.id;
    persistState();
    renderApp();
  });
}

function getGroupedBehaviors() {
  return ["Behavior", "Preparedness", "Participation"].map((groupName) => {
    const grouped = appState.data.behaviorCategories.filter((behavior) => behavior.group === groupName);
    return {
      name: groupName,
      examples: grouped[0]?.examples || "",
      positive: grouped.find((behavior) => behavior.tone === "positive"),
      negative: grouped.find((behavior) => behavior.tone === "negative")
    };
  });
}

function setSelectedCategoryGroup(groupName) {
  appState.selectedCategoryGroup = groupName;
  const matchingBehavior = appState.data.behaviorCategories.find(
    (behavior) => behavior.group === groupName && behavior.tone === "positive"
  );
  if (matchingBehavior) {
    appState.selectedBehaviorId = matchingBehavior.id;
  }
  renderApp();
}

function bindClassEditors(root) {
  root.querySelectorAll('[data-role="class-name"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      appState.data.classPeriods[index].name = event.target.value;
      persistState();
    });

    input.addEventListener("blur", (event) => {
      const index = Number(event.target.dataset.index);
      const trimmed = event.target.value.trim();
      appState.data.classPeriods[index].name = trimmed || `Class ${index + 1}`;
      persistState();
      renderApp();
    });
  });
}

function bindSeatEditors(root) {
  root.querySelectorAll('[data-role="seat-label"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      const student = appState.data.students.find((entry) => entry.id === event.target.dataset.studentId);
      if (!student) {
        return;
      }
      student.seatLabel = event.target.value;
      persistState();
    });
  });
}

function bindConsequenceEditors(root) {
  root.querySelectorAll('[data-role="ladder-step"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      appState.data.consequenceLadder[index] = event.target.value;
      persistState();
    });
  });

  root.querySelector('[data-action="add-ladder-step"]')?.addEventListener("click", () => {
    appState.data.consequenceLadder.push("New consequence step");
    persistState();
    renderApp();
  });
}

function bindContactEditors(root) {
  root.querySelectorAll('[data-role="contact-draft"]').forEach((textarea) => {
    textarea.addEventListener("input", (event) => {
      appState.contactDrafts[event.target.dataset.studentId] = event.target.value;
    });
  });

  root.querySelectorAll('[data-action="save-contact"]').forEach((button) => {
    button.addEventListener("click", () => {
      const studentId = button.dataset.studentId;
      const note = (appState.contactDrafts[studentId] || "").trim();
      if (!note) {
        return;
      }

      appState.data.parentContacts.unshift({
        id: crypto.randomUUID(),
        studentId,
        timestamp: new Date().toISOString(),
        note
      });

      appState.contactDrafts[studentId] = "";
      persistState();
      renderApp();
    });
  });
}

function logBehaviorEvent(studentId, behaviorId, note) {
  const student = appState.data.students.find((entry) => entry.id === studentId);
  const behavior = appState.data.behaviorCategories.find((entry) => entry.id === behaviorId);
  if (!student || !behavior) {
    return;
  }

  const createdEvent = {
    id: crypto.randomUUID(),
    studentId,
    behaviorId,
    periodId: student.periodId,
    note: note.trim(),
    timestamp: new Date().toISOString()
  };
  appState.data.behaviorEvents.unshift(createdEvent);

  appState.lastLoggedEventId = createdEvent.id;
  appState.quickNote = "";
  appState.selectedNotePreset = "";
  appState.noteModeOpen = false;
  persistState();
  showStudentFeedback(student.id, behavior.tone, `Logged: ${student.name} - ${behavior.label}.`);
  renderApp();
}

function deleteBehaviorEvent(eventId) {
  appState.data.behaviorEvents = appState.data.behaviorEvents.filter((event) => event.id !== eventId);
  if (appState.lastLoggedEventId === eventId) {
    appState.lastLoggedEventId = "";
  }
  persistState();
  renderApp();
}

function removeStudent(studentId) {
  appState.data.students = appState.data.students.filter((student) => student.id !== studentId);
  appState.data.behaviorEvents = appState.data.behaviorEvents.filter((event) => event.studentId !== studentId);
  appState.data.parentContacts = appState.data.parentContacts.filter((contact) => contact.studentId !== studentId);
  appState.data.hallPassEvents = (appState.data.hallPassEvents || []).filter((entry) => entry.studentId !== studentId);

  if (appState.selectedStudentId === studentId) {
    appState.selectedStudentId = appState.data.students[0]?.id || "";
  }

  persistState();
  renderApp();
}

function addClass(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  const newClass = {
    id: `p-${Date.now()}`,
    name: trimmedName
  };

  appState.data.classPeriods.push(newClass);

  appState.newClassName = "";
  if (!appState.bulkRosterPeriodId) {
    appState.bulkRosterPeriodId = newClass.id;
  }
  if (!appState.activeClassId) {
    setActiveClass(newClass.id);
    return;
  }
  persistState();
  renderApp();
}

function removeClass(periodId) {
  const hasStudents = appState.data.students.some((student) => student.periodId === periodId);
  if (hasStudents) {
    window.alert("Move or remove students from this class before deleting it.");
    return;
  }

  appState.data.classPeriods = appState.data.classPeriods.filter((period) => period.id !== periodId);

  if (appState.filters.periodId === periodId) {
    appState.filters.periodId = "all";
  }

  if (appState.bulkRosterPeriodId === periodId) {
    appState.bulkRosterPeriodId = appState.data.classPeriods[0]?.id || "";
  }

  if (appState.activeClassId === periodId) {
    appState.activeClassId = appState.data.classPeriods[0]?.id || "";
    appState.selectedStudentId = getStudentsForActiveClass()[0]?.id || "";
  }

  persistState();
  renderApp();
}

function importBulkRoster(text, periodId) {
  const targetPeriodId = periodId || appState.data.classPeriods[0]?.id || "";
  if (!targetPeriodId) {
    return;
  }

  const names = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!names.length) {
    return;
  }

  const existingNames = new Set(
    appState.data.students
      .filter((student) => student.periodId === targetPeriodId)
      .map((student) => student.name.trim().toLowerCase())
  );

  const newStudents = [];
  names.forEach((name) => {
    const normalized = name.toLowerCase();
    if (existingNames.has(normalized)) {
      return;
    }

    existingNames.add(normalized);
    newStudents.push({
      id: crypto.randomUUID(),
      name,
      periodId: targetPeriodId,
      seatLabel: `Seat ${appState.data.students.length + newStudents.length + 1}`,
      hallPassesRemaining: DEFAULT_HALL_PASSES
    });
  });

  if (!newStudents.length) {
    window.alert("No new students were added. The pasted names may already exist in that class.");
    return;
  }

  appState.data.students.push(...newStudents);
  appState.selectedStudentId = newStudents[0].id;
  appState.bulkRosterText = "";
  persistState();
  renderApp();
}

function setActiveClass(periodId) {
  appState.activeClassId = periodId;
  appState.bulkRosterPeriodId = periodId;
  appState.selectedStudentId = getStudentsForActiveClass()[0]?.id || "";
  persistState();
  renderApp();
}

function getStudentsForActiveClass() {
  if (!appState.activeClassId) {
    return [];
  }

  return appState.data.students
    .filter((student) => student.periodId === appState.activeClassId)
    .sort((left, right) => String(left.seatLabel || "").localeCompare(String(right.seatLabel || "")) || left.name.localeCompare(right.name));
}

function getStudentCountsForDate(studentId, dateString) {
  return appState.data.behaviorEvents.reduce(
    (summary, event) => {
      if (event.studentId !== studentId || !matchesExactDate(event.timestamp, dateString)) {
        return summary;
      }
      const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
      if (behavior?.tone === "negative") {
        summary.negative += 1;
      } else {
        summary.positive += 1;
      }
      return summary;
    },
    { positive: 0, negative: 0 }
  );
}

function getPendingNote() {
  return (appState.selectedNotePreset || appState.quickNote || "").trim();
}

function undoLastLog() {
  if (!appState.lastLoggedEventId) {
    return;
  }

  const eventToUndo = appState.data.behaviorEvents.find((event) => event.id === appState.lastLoggedEventId);
  if (!eventToUndo) {
    appState.lastLoggedEventId = "";
    renderApp();
    return;
  }

  const student = appState.data.students.find((entry) => entry.id === eventToUndo.studentId);
  const behavior = appState.data.behaviorCategories.find((entry) => entry.id === eventToUndo.behaviorId);
  appState.data.behaviorEvents = appState.data.behaviorEvents.filter((event) => event.id !== eventToUndo.id);
  appState.lastLoggedEventId = "";
  persistState();
  setToastMessage(`Undid: ${student?.name || "Student"} - ${behavior?.label || "Behavior"}.`);
  renderApp();
}

function updateHallPass(studentId, delta) {
  const student = appState.data.students.find((entry) => entry.id === studentId);
  if (!student) {
    return;
  }

  const current = student.hallPassesRemaining ?? DEFAULT_HALL_PASSES;
  if (delta < 0 && current <= 0) {
    return;
  }

  student.hallPassesRemaining = Math.max(0, Math.min(DEFAULT_HALL_PASSES, current + delta));
  appState.data.hallPassEvents = appState.data.hallPassEvents || [];
  appState.data.hallPassEvents.unshift({
    id: crypto.randomUUID(),
    studentId,
    action: delta < 0 ? "used" : "restored",
    note: delta < 0 ? "Hall pass used" : "Hall pass restored",
    timestamp: new Date().toISOString()
  });
  persistState();
  setToastMessage(`${student.name} ${delta < 0 ? "used" : "restored"} a hall pass.`);
  renderApp();
}

function showStudentFeedback(studentId, tone, message) {
  appState.flashStudentId = studentId;
  appState.flashTone = tone;
  setToastMessage(message);

  window.clearTimeout(flashTimeoutId);
  flashTimeoutId = window.setTimeout(() => {
    appState.flashStudentId = "";
    appState.flashTone = "";
    renderApp();
  }, 700);
}

function setToastMessage(message) {
  appState.lastLogMessage = message;
  window.clearTimeout(feedbackTimeoutId);
  feedbackTimeoutId = window.setTimeout(() => {
    appState.lastLogMessage = "";
    renderApp();
  }, 2200);
}

function getFilteredEvents() {
  return appState.data.behaviorEvents
    .map((event) => {
      const student = appState.data.students.find((entry) => entry.id === event.studentId);
      const period = appState.data.classPeriods.find((entry) => entry.id === event.periodId);
      const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);

      return {
        ...event,
        studentName: student?.name || "Unknown student",
        periodName: period?.name || "Unknown period",
        behaviorLabel: behavior?.label || "Unknown behavior",
        tone: behavior?.tone || "positive"
      };
    })
    .filter((event) => {
      if (appState.filters.studentId !== "all" && event.studentId !== appState.filters.studentId) {
        return false;
      }
      if (appState.filters.periodId !== "all" && event.periodId !== appState.filters.periodId) {
        return false;
      }
      if (appState.filters.behaviorId !== "all" && event.behaviorId !== appState.filters.behaviorId) {
        return false;
      }
      if (appState.filters.exactDate && !matchesExactDate(event.timestamp, appState.filters.exactDate)) {
        return false;
      }
      return matchesRange(event.timestamp, appState.filters.range);
    })
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
}

function buildDashboardStats(filteredEvents) {
  const selectedDate = appState.filters.exactDate || getLocalDateString();
  const positiveToday = appState.data.behaviorEvents.filter((event) => {
    const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
    return matchesExactDate(event.timestamp, selectedDate) && behavior?.tone === "positive";
  }).length;

  const negativeToday = appState.data.behaviorEvents.filter((event) => {
    const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
    return matchesExactDate(event.timestamp, selectedDate) && behavior?.tone === "negative";
  }).length;

  const classPeriodTotals = {};
  filteredEvents.forEach((event) => {
    if (!classPeriodTotals[event.periodId]) {
      classPeriodTotals[event.periodId] = { positive: 0, negative: 0 };
    }
    if (event.tone === "negative") {
      classPeriodTotals[event.periodId].negative += 1;
    } else {
      classPeriodTotals[event.periodId].positive += 1;
    }
  });

  return {
    positiveToday,
    negativeToday,
    classPeriodTotals
  };
}

function buildStudentSummary(range) {
  const rows = appState.data.students.map((student) => {
    const events = appState.data.behaviorEvents.filter((event) => {
      return event.studentId === student.id && matchesRange(event.timestamp, range);
    });

    const totals = events.reduce(
      (summary, event) => {
        const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
        if (behavior?.tone === "negative") {
          summary.negative += 1;
        } else {
          summary.positive += 1;
        }
        return summary;
      },
      { positive: 0, negative: 0 }
    );

    return {
      studentId: student.id,
      studentName: student.name,
      periodId: student.periodId,
      positive: totals.positive,
      negative: totals.negative,
      score: totals.positive - totals.negative
    };
  });

  return rows.sort((left, right) => right.score - left.score || left.studentName.localeCompare(right.studentName));
}

function buildStudentSummaryForExactDate(exactDate) {
  const targetDate = exactDate || getLocalDateString();
  const rows = appState.data.students.map((student) => {
    const events = appState.data.behaviorEvents.filter((event) => {
      return event.studentId === student.id && matchesExactDate(event.timestamp, targetDate);
    });

    const totals = events.reduce(
      (summary, event) => {
        const behavior = appState.data.behaviorCategories.find((entry) => entry.id === event.behaviorId);
        if (behavior?.tone === "negative") {
          summary.negative += 1;
        } else {
          summary.positive += 1;
        }
        return summary;
      },
      { positive: 0, negative: 0 }
    );

    return {
      studentId: student.id,
      studentName: student.name,
      periodId: student.periodId,
      positive: totals.positive,
      negative: totals.negative,
      score: totals.positive - totals.negative
    };
  });

  return rows.sort((left, right) => right.score - left.score || left.studentName.localeCompare(right.studentName));
}

function exportFilteredCsv() {
  const rows = [["Student", "Period", "Behavior", "Tone", "Timestamp", "Teacher Note"]];

  getFilteredEvents().forEach((event) => {
    rows.push([
      event.studentName,
      event.periodName,
      event.behaviorLabel,
      event.tone,
      formatDateTime(event.timestamp),
      event.note || ""
    ]);
  });

  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `behavior-events-${getLocalDateString()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportBackupFile() {
  const backupPayload = {
    app: "Buckeye Trail Warriors Behavior Tracker",
    version: BACKUP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    data: appState.data
  };

  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `buckeye-trail-warriors-backup-${getLocalDateString()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function restoreBackupFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const restored = JSON.parse(String(reader.result || "{}"));
      const data = restored?.data || restored;
      const normalized = normalizeLoadedState({
        classPeriods: data.classPeriods || [],
        students: data.students || [],
        behaviorCategories: data.behaviorCategories || DEFAULT_BEHAVIORS,
        behaviorEvents: data.behaviorEvents || [],
        consequenceLadder: data.consequenceLadder || DEFAULT_CONSEQUENCE_LADDER,
        parentContacts: data.parentContacts || [],
        hallPassEvents: data.hallPassEvents || []
      });

      if (!normalized.classPeriods.length) {
        window.alert("That backup file does not contain any classes to restore.");
        return;
      }

      appState.data = normalized;
      appState.newClassName = "";
      appState.bulkRosterText = "";
      appState.quickNote = "";
      appState.selectedNotePreset = "";
      appState.lastLoggedEventId = "";
      appState.lastLogMessage = "";
      appState.flashStudentId = "";
      appState.flashTone = "";
      appState.noteModeOpen = false;
      appState.studentPrintMode = false;
      appState.contactDrafts = {};
      appState.activeClassId = normalized.classPeriods[0]?.id || "";
      appState.summaryClassId = appState.activeClassId;
      appState.contactClassId = appState.activeClassId;
      appState.bulkRosterPeriodId = appState.activeClassId;
      appState.selectedStudentId = getStudentsForActiveClass()[0]?.id || "";
      appState.selectedCategoryGroup = normalized.behaviorCategories[0]?.group || "Behavior";
      appState.selectedBehaviorId = normalized.behaviorCategories[0]?.id || "";
      appState.reportStudentId = "";
      persistState();
      renderApp();
      window.alert("Backup restored. This browser now has the imported classes and student records.");
    } catch (error) {
      console.error("Unable to restore backup", error);
      window.alert("That file could not be restored. Please choose a tracker backup JSON file.");
    }
  });
  reader.readAsText(file);
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.data));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return createFreshState();
    }

    const parsed = JSON.parse(saved);
    return normalizeLoadedState({
      classPeriods: parsed.classPeriods || SAMPLE_STATE.classPeriods,
      students: parsed.students || SAMPLE_STATE.students,
      behaviorCategories: parsed.behaviorCategories || DEFAULT_BEHAVIORS,
      behaviorEvents: parsed.behaviorEvents || [],
      consequenceLadder: parsed.consequenceLadder || DEFAULT_CONSEQUENCE_LADDER,
      parentContacts: parsed.parentContacts || [],
      hallPassEvents: parsed.hallPassEvents || []
    });
  } catch (error) {
    console.error("Unable to load saved state", error);
    return createFreshState();
  }
}

function createFreshState() {
  return JSON.parse(JSON.stringify(SAMPLE_STATE));
}

function createSampleState() {
  const periods = [
    { id: "p1", name: "Period 1" },
    { id: "p2", name: "Period 2" },
    { id: "p4", name: "Period 4" }
  ];

  const students = [
    { id: "s1", name: "Ariana Lopez", periodId: "p1", seatLabel: "A1", hallPassesRemaining: 7 },
    { id: "s2", name: "Miles Carter", periodId: "p1", seatLabel: "A2", hallPassesRemaining: 8 },
    { id: "s3", name: "Jada Nguyen", periodId: "p2", seatLabel: "B1", hallPassesRemaining: 8 },
    { id: "s4", name: "Ethan Brooks", periodId: "p2", seatLabel: "B2", hallPassesRemaining: 6 },
    { id: "s5", name: "Nina Patel", periodId: "p4", seatLabel: "C1", hallPassesRemaining: 8 },
    { id: "s6", name: "Jordan Kim", periodId: "p4", seatLabel: "C2", hallPassesRemaining: 8 }
  ];

  const now = new Date();
  const earlierToday = new Date(now.getTime() - 45 * 60000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60000).toISOString();

  return {
    classPeriods: periods,
    students,
    behaviorCategories: DEFAULT_BEHAVIORS,
    behaviorEvents: [
      { id: "e1", studentId: "s1", periodId: "p1", behaviorId: "participation-positive", note: "Volunteered answer during warm-up", timestamp: earlierToday },
      { id: "e2", studentId: "s2", periodId: "p1", behaviorId: "behavior-negative", note: "Phone out during notes", timestamp: twoHoursAgo },
      { id: "e3", studentId: "s3", periodId: "p2", behaviorId: "preparedness-positive", note: "Had materials and notebook ready", timestamp: earlierToday },
      { id: "e4", studentId: "s4", periodId: "p2", behaviorId: "behavior-negative", note: "Side conversation during directions", timestamp: twoDaysAgo },
      { id: "e5", studentId: "s5", periodId: "p4", behaviorId: "behavior-positive", note: "Helped a peer reset", timestamp: earlierToday },
      { id: "e6", studentId: "s6", periodId: "p4", behaviorId: "preparedness-negative", note: "Missing calculator", timestamp: twoDaysAgo }
    ],
    consequenceLadder: [...DEFAULT_CONSEQUENCE_LADDER],
    hallPassEvents: [
      { id: "h1", studentId: "s1", timestamp: earlierToday, action: "used", note: "Restroom" },
      { id: "h2", studentId: "s4", timestamp: twoDaysAgo, action: "used", note: "Nurse" }
    ],
    parentContacts: [
      { id: "c1", studentId: "s2", timestamp: twoDaysAgo, note: "Emailed home about repeated phone distractions." },
      { id: "c2", studentId: "s4", timestamp: earlierToday, note: "Called guardian to discuss class interruptions and next steps." }
    ]
  };
}

function normalizeLoadedState(state) {
  const behaviorCategories = DEFAULT_BEHAVIORS.map((behavior) => ({ ...behavior }));
  const validIds = new Set(behaviorCategories.map((behavior) => behavior.id));

  return {
    ...state,
    classPeriods: (state.classPeriods || []).map((period, index) => ({
      id: period.id || `p-${index + 1}`,
      name: period.name || `Class ${index + 1}`
    })),
    students: (state.students || []).map((student, index) => ({
      ...student,
      id: student.id || `s-${index + 1}`,
      seatLabel: student.seatLabel || `Seat ${index + 1}`,
      hallPassesRemaining: Number.isFinite(student.hallPassesRemaining) ? student.hallPassesRemaining : DEFAULT_HALL_PASSES
    })),
    behaviorCategories,
    behaviorEvents: (state.behaviorEvents || []).map((event) => ({
      ...event,
      behaviorId: migrateBehaviorId(event.behaviorId, validIds)
    })),
    parentContacts: state.parentContacts || [],
    consequenceLadder: state.consequenceLadder?.length ? [...state.consequenceLadder] : [...DEFAULT_CONSEQUENCE_LADDER],
    hallPassEvents: state.hallPassEvents || []
  };
}

function migrateBehaviorId(behaviorId, validIds) {
  if (validIds.has(behaviorId)) {
    return behaviorId;
  }

  return LEGACY_BEHAVIOR_MAP[behaviorId] || "behavior-positive";
}

function matchesRange(timestamp, range) {
  if (range === "all") {
    return true;
  }

  const now = new Date();
  const eventDate = new Date(timestamp);

  if (range === "today") {
    return eventDate.toDateString() === now.toDateString();
  }

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const distance = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(startOfWeek.getDate() - distance);
  startOfWeek.setHours(0, 0, 0, 0);
  return eventDate >= startOfWeek;
}

function matchesExactDate(timestamp, exactDate) {
  return formatDateInputValue(new Date(timestamp)) === exactDate;
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatSignedNumber(value) {
  return value > 0 ? `+${value}` : String(value);
}

function getLocalDateString() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function shiftDateString(dateString, deltaDays) {
  const base = new Date(`${dateString}T12:00:00`);
  base.setDate(base.getDate() + deltaDays);
  return formatDateInputValue(base);
}

function formatDateInputValue(date) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatReadableDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function toCsvCell(value) {
  const normalized = String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
