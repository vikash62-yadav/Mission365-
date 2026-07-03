const STORAGE_KEY = "mission365.v1";

const defaultState = {
  profile: null,
  goals: [],
  stats: {
    currentStreak: 0,
    longestStreak: 0,
    lastCompletionDate: null,
  },
};

let state = loadState();
let activePage = "home";
let pendingCompleteGoalId = null;
let selectedHistoryDate = null;

const els = {
  pages: {
    home: document.getElementById("homePage"),
    dashboard: document.getElementById("dashboardPage"),
    history: document.getElementById("historyPage"),
  },
  navItems: document.querySelectorAll("[data-page-link]"),
  createMissionButton: document.getElementById("createMissionButton"),
  missionDialog: document.getElementById("missionDialog"),
  missionForm: document.getElementById("missionForm"),
  nameInput: document.getElementById("nameInput"),
  missionInput: document.getElementById("missionInput"),
  goalForm: document.getElementById("goalForm"),
  subjectInput: document.getElementById("subjectInput"),
  goalDetailInput: document.getElementById("goalDetailInput"),
  plannedHoursInput: document.getElementById("plannedHoursInput"),
  plannedMinutesInput: document.getElementById("plannedMinutesInput"),
  currentStreak: document.getElementById("currentStreak"),
  longestStreak: document.getElementById("longestStreak"),
  todayHours: document.getElementById("todayHours"),
  missionName: document.getElementById("missionName"),
  missionDay: document.getElementById("missionDay"),
  journeyMission: document.getElementById("journeyMission"),
  journeyProgress: document.getElementById("journeyProgress"),
  journeyProgressBar: document.getElementById("journeyProgressBar"),
  todayProgress: document.getElementById("todayProgress"),
  todayProgressBar: document.getElementById("todayProgressBar"),
  homeDate: document.getElementById("homeDate"),
  welcomeText: document.getElementById("welcomeText"),
  todayGoals: document.getElementById("todayGoals"),
  todayGoalCount: document.getElementById("todayGoalCount"),
  dayHistoryList: document.getElementById("dayHistoryList"),
  dayRecordDetails: document.getElementById("dayRecordDetails"),
  dayHistoryCount: document.getElementById("dayHistoryCount"),
  completeDialog: document.getElementById("completeDialog"),
  completeForm: document.getElementById("completeForm"),
  completeGoalName: document.getElementById("completeGoalName"),
  completePlannedHours: document.getElementById("completePlannedHours"),
  actualHoursInput: document.getElementById("actualHoursInput"),
  actualMinutesInput: document.getElementById("actualMinutesInput"),
  settingsButton: document.getElementById("settingsButton"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  dashboardLayout: document.getElementById("dashboardLayout"),
  dashboardSidebar: document.getElementById("dashboardSidebar"),
  settingsDialog: document.getElementById("settingsDialog"),
  exportButton: document.getElementById("exportButton"),
  importInput: document.getElementById("importInput"),
  settingsMessage: document.getElementById("settingsMessage"),
};

normalizeState();
wireEvents();
render();

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(stored) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState() {
  const today = getTodayKey();
  const yesterday = addDays(today, -1);

  state.goals = Array.isArray(state.goals) ? state.goals : [];
  state.stats = { ...structuredClone(defaultState.stats), ...(state.stats || {}) };

  state.goals.forEach((goal) => {
    goal.name = goal.name || goal.subject || "Study Goal";
    if (goal.status === "Pending" && goal.date < today) {
      goal.status = "Incomplete";
      carryIncompleteGoalForward(goal, today);
    }
    if (goal.status === "Incomplete" && goal.date < today) {
      carryIncompleteGoalForward(goal, today);
    }
  });

  if (state.stats.lastCompletionDate && state.stats.lastCompletionDate < yesterday) {
    state.stats.currentStreak = 0;
  }

  saveState();
}

function wireEvents() {
  els.navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.dataset.pageLink;
      if (page === "dashboard" && !state.profile) {
        openMissionDialog();
        return;
      }
      setPage(page);
    });
  });

  els.createMissionButton.addEventListener("click", openMissionDialog);
  els.settingsButton.addEventListener("click", () => {
    els.settingsMessage.textContent = "";
    openDialog(els.settingsDialog);
  });

  els.sidebarToggle.addEventListener("click", toggleSidebar);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.closeDialog)?.close();
    });
  });

  els.missionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = els.nameInput.value.trim();
    const missionName = els.missionInput.value.trim();
    if (!name || !missionName) return;

    state.profile = {
      name,
      missionName,
      createdAt: new Date().toISOString(),
    };
    saveState();
    els.missionDialog.close();
    setPage("dashboard");
    render();
  });

  els.goalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.profile) {
      openMissionDialog();
      return;
    }

    const plannedHours = getTimeValue(els.plannedHoursInput, els.plannedMinutesInput);
    const subject = els.subjectInput.value.trim();
    const goalDetail = els.goalDetailInput.value.trim();
    if (!subject || !Number.isFinite(plannedHours) || plannedHours <= 0) return;

    state.goals.unshift({
      id: crypto.randomUUID(),
      subject,
      name: goalDetail || subject,
      plannedHours,
      actualHours: null,
      status: "Pending",
      date: getTodayKey(),
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    saveState();
    els.goalForm.reset();
    render();
  });

  els.completeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const actualHours = getTimeValue(els.actualHoursInput, els.actualMinutesInput);
    if (!pendingCompleteGoalId || !Number.isFinite(actualHours) || actualHours < 0) return;

    completeGoal(pendingCompleteGoalId, actualHours);
    pendingCompleteGoalId = null;
    els.completeDialog.close();
    render();
  });

  els.exportButton.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
}

function render() {
  renderHomeDate();
  renderProfile();
  renderStats();
  renderTodayGoals();
  renderHistory();
  renderPages();
}

function renderPages() {
  Object.entries(els.pages).forEach(([page, element]) => {
    element.classList.toggle("is-active", page === activePage);
  });

  els.navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.pageLink === activePage);
  });
}

function renderProfile() {
  if (state.profile) {
    els.welcomeText.textContent = `${state.profile.name}'s mission`;
    els.missionName.textContent = state.profile.missionName;
    els.journeyMission.textContent = `Mission: ${state.profile.missionName}`;
    els.missionDay.textContent = `\uD83D\uDD25 Day ${getMissionDay()}`;
    els.nameInput.value = state.profile.name;
    els.missionInput.value = state.profile.missionName;
  } else {
    els.welcomeText.textContent = "Today";
    els.missionName.textContent = "Not set";
    els.journeyMission.textContent = "Mission: Not set";
    els.missionDay.textContent = "\uD83D\uDD25 Day 0";
    els.nameInput.value = "";
    els.missionInput.value = "";
  }
}

function toggleSidebar() {
  const isHidden = els.dashboardSidebar.classList.toggle("is-hidden");
  els.dashboardLayout.classList.toggle("sidebar-is-hidden", isHidden);
  els.sidebarToggle.textContent = isHidden ? "Show Sidebar" : "Hide Sidebar";
  els.sidebarToggle.setAttribute("aria-expanded", String(!isHidden));
}

function renderStats() {
  const progress = getTodayProgress();
  els.currentStreak.textContent = String(state.stats.currentStreak || 0);
  els.longestStreak.textContent = String(state.stats.longestStreak || 0);
  els.todayHours.textContent = formatHours(getTodayTotalHours());
  els.todayProgress.textContent = `${progress}%`;
  els.todayProgressBar.style.width = `${progress}%`;
  els.journeyProgress.textContent = `Progress Today: ${progress}%`;
  els.journeyProgressBar.style.width = `${progress}%`;
}

function renderTodayGoals() {
  const today = getTodayKey();
  const todayGoals = state.goals.filter((goal) => goal.date === today);
  els.todayGoalCount.textContent = String(todayGoals.length);

  if (!todayGoals.length) {
    els.todayGoals.innerHTML = `<div class="empty-state">Create one clear goal for today.</div>`;
    return;
  }

  els.todayGoals.innerHTML = todayGoals.map(renderGoalCard).join("");
  els.todayGoals.querySelectorAll("[data-complete-goal]").forEach((button) => {
    button.addEventListener("click", () => openCompleteDialog(button.dataset.completeGoal));
  });
  els.todayGoals.querySelectorAll("[data-incomplete-goal]").forEach((button) => {
    button.addEventListener("click", () => markIncomplete(button.dataset.incompleteGoal));
  });
  els.todayGoals.querySelectorAll("[data-delete-goal]").forEach((button) => {
    button.addEventListener("click", () => deleteGoal(button.dataset.deleteGoal));
  });
}

function renderHomeDate() {
  els.homeDate.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(getAppDate());
}

function renderGoalCard(goal) {
  const isPending = goal.status === "Pending";
  const isIncomplete = goal.status === "Incomplete";
  return `
    <article class="goal-card">
      <div class="goal-main">
        <div class="goal-title-row">
          <strong class="goal-title">${escapeHtml(goal.name)}</strong>
          <span class="status-pill ${goal.status.toLowerCase()}">${goal.status}</span>
        </div>
        <span class="meta-line"><span class="subject-pill">${escapeHtml(goal.subject)}</span> Planned Hours: ${formatHours(goal.plannedHours)}</span>
        ${goal.actualHours !== null ? `<span class="meta-line">Actual Hours: ${formatHours(goal.actualHours)}</span>` : ""}
      </div>
      ${
        isPending
          ? `<div class="card-actions">
              <button class="success-button" type="button" data-complete-goal="${goal.id}">Complete</button>
              <button class="danger-button" type="button" data-incomplete-goal="${goal.id}">Incomplete</button>
              <button class="delete-button" type="button" data-delete-goal="${goal.id}">Delete</button>
            </div>`
          : isIncomplete
            ? `<div class="card-actions single-action">
                <button class="success-button" type="button" data-complete-goal="${goal.id}">Complete</button>
              </div>`
            : ""
      }
    </article>
  `;
}

function renderHistory() {
  const dailySummaries = getDailySummaries();

  els.dayHistoryCount.textContent = String(dailySummaries.length);

  if (!dailySummaries.length) {
    selectedHistoryDate = null;
    els.dayHistoryList.innerHTML = `<div class="empty-state">Day-wise history will appear here.</div>`;
    els.dayRecordDetails.innerHTML = "";
    return;
  }

  if (!selectedHistoryDate || !dailySummaries.some((summary) => summary.date === selectedHistoryDate)) {
    selectedHistoryDate = dailySummaries[0].date;
  }

  els.dayHistoryList.innerHTML = dailySummaries.map(renderDayRecordCard).join("");
  els.dayRecordDetails.innerHTML = renderDayRecordDetails(selectedHistoryDate);

  els.dayHistoryList.querySelectorAll("[data-history-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedHistoryDate = button.dataset.historyDate;
      renderHistory();
    });
  });
}

function renderDayRecordCard(summary) {
  return `
    <button class="history-card day-record-card ${summary.date === selectedHistoryDate ? "is-selected" : ""}" type="button" data-history-date="${summary.date}">
      <div class="history-main">
        <div class="history-title-row">
          <strong class="history-title">${formatDate(summary.date)}</strong>
          <span class="status-pill">${summary.progress}%</span>
        </div>
        <span class="meta-line">Total Study Hours: ${formatHours(summary.totalHours)}</span>
        <span class="meta-line">Completed Goals: ${summary.completed}</span>
        <span class="meta-line">Incomplete Goals: ${summary.incomplete}</span>
      </div>
    </button>
  `;
}

function renderDayRecordDetails(dateKey) {
  const goals = state.goals.filter((goal) => goal.date === dateKey);
  const completed = goals.filter((goal) => goal.status === "Completed");
  const incomplete = goals.filter((goal) => goal.status === "Incomplete");
  const totalHours = completed.reduce((total, goal) => total + Number(goal.actualHours || 0), 0);
  const progress = goals.length ? Math.round((completed.length / goals.length) * 100) : 0;
  const missionName = state.profile?.missionName || "Not set";

  return `
    <article class="history-card day-detail-card">
      <div class="history-main">
        <div class="history-title-row">
          <strong class="history-title">${formatDate(dateKey)}</strong>
          <span class="status-pill">${progress}%</span>
        </div>
        <span class="meta-line">Mission: ${escapeHtml(missionName)}</span>
        <span class="meta-line">Total Study Hours: ${formatHours(totalHours)}</span>
        <span class="meta-line">Completed Goals: ${completed.length}</span>
        <span class="meta-line">Incomplete Goals: ${incomplete.length}</span>
        <div class="progress-track" aria-hidden="true"><span style="width: ${progress}%"></span></div>
      </div>
      <div class="day-detail-grid">
        <section class="history-detail-section">
          <h4>Completed Goals</h4>
          ${completed.length ? completed.map((goal) => renderHistoryGoal(goal, true)).join("") : `<div class="empty-state compact">No completed goals.</div>`}
        </section>
        <section class="history-detail-section">
          <h4>Incomplete Goals</h4>
          ${incomplete.length ? incomplete.map((goal) => renderHistoryGoal(goal, false)).join("") : `<div class="empty-state compact">No incomplete goals.</div>`}
        </section>
      </div>
    </article>
  `;
}

function renderHistoryGoal(goal, isCompleted) {
  return `
    <article class="history-goal-card">
      <div class="history-main">
        <div class="history-title-row">
          <strong class="history-title">${isCompleted ? "" : "&#128532; "}${escapeHtml(goal.name)}</strong>
          <span class="status-pill ${goal.status.toLowerCase()}">${goal.status}</span>
        </div>
        <span class="meta-line">${escapeHtml(goal.subject)}</span>
        <span class="meta-line">Planned Hours: ${formatHours(goal.plannedHours)}</span>
        ${isCompleted ? `<span class="meta-line">Actual Hours: ${formatHours(goal.actualHours || 0)}</span>` : ""}
      </div>
    </article>
  `;
}

function setPage(page) {
  activePage = page;
  renderPages();
}

function openMissionDialog() {
  openDialog(els.missionDialog);
}

function openCompleteDialog(goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return;

  pendingCompleteGoalId = goalId;
  els.completeGoalName.textContent = goal.name;
  els.completePlannedHours.textContent = `Planned Hours: ${formatHours(goal.plannedHours)}`;
  const plannedTime = splitHours(goal.plannedHours);
  els.actualHoursInput.value = plannedTime.hours;
  els.actualMinutesInput.value = plannedTime.minutes || "";
  openDialog(els.completeDialog);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function completeGoal(goalId, actualHours) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return;

  const completedDate = getTodayKey();
  const wasAlreadyCompleted = goal.status === "Completed";
  goal.status = "Completed";
  goal.actualHours = actualHours;
  goal.completedAt = new Date().toISOString();
  goal.date = completedDate;

  if (!wasAlreadyCompleted) {
    updateStreakForCompletion(completedDate);
  }

  saveState();
}

function updateStreakForCompletion(dateKey) {
  const lastDate = state.stats.lastCompletionDate;
  if (lastDate === dateKey) return;

  if (lastDate === addDays(dateKey, -1)) {
    state.stats.currentStreak += 1;
  } else {
    state.stats.currentStreak = 1;
  }

  state.stats.lastCompletionDate = dateKey;
  state.stats.longestStreak = Math.max(state.stats.longestStreak, state.stats.currentStreak);
}

function markIncomplete(goalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return;
  goal.status = "Incomplete";
  goal.actualHours = null;
  saveState();
  render();
}

function carryIncompleteGoalForward(goal, today) {
  const carryKey = goal.carryKey || goal.id;
  const chainIsCompleted = state.goals.some((item) => (item.carryKey || item.id) === carryKey && item.status === "Completed");
  if (chainIsCompleted) return;

  const alreadyCarriedToday = state.goals.some((item) => item.carryKey === carryKey && item.date === today);
  if (alreadyCarriedToday) return;

  state.goals.unshift({
    id: crypto.randomUUID(),
    subject: goal.subject,
    name: goal.name,
    plannedHours: goal.plannedHours,
    actualHours: null,
    status: "Pending",
    date: today,
    createdAt: new Date().toISOString(),
    completedAt: null,
    carryKey,
    carriedFrom: goal.id,
  });
}

function deleteGoal(goalId) {
  const shouldDelete = confirm("Delete this goal?");
  if (!shouldDelete) return;

  state.goals = state.goals.filter((goal) => goal.id !== goalId);
  saveState();
  render();
}

function getTodayTotalHours() {
  const today = getTodayKey();
  return state.goals
    .filter((goal) => goal.status === "Completed" && goal.date === today)
    .reduce((total, goal) => total + Number(goal.actualHours || 0), 0);
}

function getTodayProgress() {
  const today = getTodayKey();
  const todayGoals = state.goals.filter((goal) => goal.date === today);
  if (!todayGoals.length) return 0;

  const completedGoals = todayGoals.filter((goal) => goal.status === "Completed").length;
  return Math.round((completedGoals / todayGoals.length) * 100);
}

function getMissionDay() {
  if (!state.profile?.createdAt) return 0;

  const createdDate = new Date(state.profile.createdAt);
  if (Number.isNaN(createdDate.getTime())) return 0;

  const today = new Date(`${getTodayKey()}T00:00:00`);
  const start = new Date(createdDate);
  start.setHours(0, 0, 0, 0);
  const diff = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

function getDailySummaries() {
  const summaries = new Map();

  state.goals.forEach((goal) => {
    if (!summaries.has(goal.date)) {
      summaries.set(goal.date, {
        date: goal.date,
        totalHours: 0,
        completed: 0,
        incomplete: 0,
        total: 0,
        progress: 0,
      });
    }

    const summary = summaries.get(goal.date);
    summary.total += 1;
    if (goal.status === "Completed") {
      summary.completed += 1;
      summary.totalHours += Number(goal.actualHours || 0);
    }
    if (goal.status === "Incomplete") {
      summary.incomplete += 1;
    }
  });

  return Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      progress: summary.total ? Math.round((summary.completed / summary.total) * 100) : 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function exportData() {
  const payload = {
    app: "Mission365",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mission365-export-${getTodayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  els.settingsMessage.textContent = "Export ready.";
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedState = parsed.data || parsed;
      validateImportedState(importedState);
      state = {
        profile: importedState.profile || null,
        goals: importedState.goals || [],
        stats: { ...structuredClone(defaultState.stats), ...(importedState.stats || {}) },
      };
      normalizeState();
      els.settingsMessage.textContent = "Import complete.";
      setPage(state.profile ? "dashboard" : "home");
      render();
    } catch {
      els.settingsMessage.textContent = "Import failed. Choose a valid Mission365 JSON file.";
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function validateImportedState(importedState) {
  if (!importedState || typeof importedState !== "object") {
    throw new Error("Invalid import");
  }
  if (!Array.isArray(importedState.goals)) {
    throw new Error("Invalid goals");
  }
}

function getTodayKey() {
  return getRealTodayKey();
}

function getRealTodayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function getAppDate() {
  return new Date(`${getTodayKey()}T00:00:00`);
}

function addDays(dateKey, amount) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatHours(value) {
  const number = Number(value || 0);
  const totalMinutes = Math.round(number * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours} hr ${minutes} min`;
  if (hours) return `${hours} hr`;
  return `${minutes} min`;
}

function getTimeValue(hoursInput, minutesInput) {
  const hours = Number(hoursInput.value || 0);
  const minutes = Number(minutesInput.value || 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
  if (hours < 0 || minutes < 0 || minutes > 59) return NaN;
  return hours + minutes / 60;
}

function splitHours(value) {
  const totalMinutes = Math.round(Number(value || 0) * 60);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}





