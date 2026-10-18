const STORAGE_KEY = "study-log.entries.v1";

const form = document.querySelector("#study-form");
const dateInput = document.querySelector("#entry-date");
const subjectInput = document.querySelector("#entry-subject");
const minutesInput = document.querySelector("#entry-minutes");
const noteInput = document.querySelector("#entry-note");
const clearButton = document.querySelector("#clear-button");
const entryList = document.querySelector("#entry-list");
const emptyState = document.querySelector("#empty-state");
const saveState = document.querySelector("#save-state");
const charCount = document.querySelector("#char-count");
const editingLabel = document.querySelector("#editing-label");
const entryCount = document.querySelector("#entry-count");
const summaryRow = document.querySelector("#summary-row");
const searchInput = document.querySelector("#search-input");
const rhythmChart = document.querySelector("#rhythm-chart");
const progressMessage = document.querySelector("#progress-message");
const progressDetail = document.querySelector("#progress-detail");

let entries = loadEntries();

function loadEntries() {
  const rawEntries = localStorage.getItem(STORAGE_KEY);

  if (!rawEntries) {
    return [];
  }

  try {
    const parsedEntries = JSON.parse(rawEntries);
    return Array.isArray(parsedEntries) ? parsedEntries : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function getTodayIso() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function parseIsoDate(dateText) {
  return new Date(`${dateText}T00:00:00`);
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortEntries() {
  entries.sort((a, b) => b.date.localeCompare(a.date));
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parseIsoDate(dateText));
}

function formatShortDate(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(parseIsoDate(dateText));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}分`;
  }

  return remainingMinutes === 0
    ? `${hours}時間`
    : `${hours}時間${remainingMinutes}分`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredEntries() {
  const query = searchInput.value.trim().toLowerCase();

  return entries.filter((entry) => {
    const searchableText = `${entry.date} ${entry.subject} ${entry.note}`.toLowerCase();
    return !query || searchableText.includes(query);
  });
}

function renderEntries() {
  const filteredEntries = getFilteredEntries();

  entryList.innerHTML = filteredEntries
    .map((entry) => {
      const note = entry.note
        ? `<p class="entry-note">${escapeHtml(entry.note)}</p>`
        : "";

      return `
        <li class="entry-card">
          <div class="entry-topline">
            <span class="entry-date">${formatDate(entry.date)}</span>
            <span class="duration-badge">${formatDuration(entry.minutes)}</span>
          </div>
          <h3 class="entry-subject">${escapeHtml(entry.subject)}</h3>
          ${note}
          <div class="entry-actions">
            <button type="button" data-action="edit" data-date="${entry.date}">編集</button>
            <button class="danger-button" type="button" data-action="delete" data-date="${entry.date}">削除</button>
          </div>
        </li>
      `;
    })
    .join("");

  if (entries.length > 0 && filteredEntries.length === 0) {
    emptyState.innerHTML = `
      <strong>検索に合う学習ログがありません</strong>
      <span>別のキーワードで探してみてください。</span>
    `;
  } else {
    emptyState.innerHTML = `
      <strong>学習ログはまだありません</strong>
      <span>今日学んだことを記録して、最初の一歩を残しましょう。</span>
    `;
  }

  emptyState.hidden = filteredEntries.length > 0;
  entryList.hidden = filteredEntries.length === 0;
}

function renderSummary() {
  entryCount.textContent = entries.length;

  const totalMinutes = entries.reduce((total, entry) => total + entry.minutes, 0);
  const averageMinutes = entries.length ? Math.round(totalMinutes / entries.length) : 0;
  summaryRow.innerHTML = `
    <span class="summary-chip">合計 ${formatDuration(totalMinutes)}</span>
    <span class="summary-chip">1件あたり ${formatDuration(averageMinutes)}</span>
  `;
}

function renderProgress() {
  if (entries.length === 0) {
    rhythmChart.innerHTML = "";
    progressMessage.textContent = "記録を保存すると、ここに表示されます";
    progressDetail.textContent = "記録を続けると、最近の学習時間を確認できます。";
    return;
  }

  const recentEntries = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reverse();
  const totalMinutes = recentEntries.reduce((total, entry) => total + entry.minutes, 0);
  const averageMinutes = Math.round(totalMinutes / recentEntries.length);

  rhythmChart.innerHTML = createProgressSvg(recentEntries);
  progressMessage.textContent = `合計 ${formatDuration(totalMinutes)} 学習しました`;
  progressDetail.textContent = `最近${recentEntries.length}件の平均: ${formatDuration(averageMinutes)}`;
}

function createProgressSvg(recentEntries) {
  const width = 360;
  const height = 170;
  const padding = { top: 22, right: 18, bottom: 34, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxMinutes = Math.max(...recentEntries.map((entry) => entry.minutes));
  const points = recentEntries.map((entry, index) => {
    const x =
      recentEntries.length === 1
        ? padding.left + chartWidth / 2
        : padding.left + (chartWidth / (recentEntries.length - 1)) * index;
    const y = height - padding.bottom - (entry.minutes / maxMinutes) * chartHeight;

    return { x, y, entry };
  });
  const linePath = buildSmoothPath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${height - padding.bottom} L ${firstPoint.x} ${
    height - padding.bottom
  } Z`;

  return `
    <svg
      class="rhythm-svg"
      viewBox="0 0 ${width} ${height}"
      role="img"
      aria-label="最近${recentEntries.length}件の学習時間"
    >
      <defs>
        <linearGradient id="study-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2e7d72" />
          <stop offset="100%" stop-color="#4d84b8" />
        </linearGradient>
        <linearGradient id="study-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#5eb7a6" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#5eb7a6" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <g class="rhythm-grid" aria-hidden="true">
        <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" />
        <line x1="${padding.left}" y1="${padding.top + chartHeight / 2}" x2="${
          width - padding.right
        }" y2="${padding.top + chartHeight / 2}" />
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${
          height - padding.bottom
        }" />
      </g>
      <path class="rhythm-area" d="${areaPath}" aria-hidden="true"></path>
      <path class="rhythm-wave" d="${linePath}" aria-hidden="true"></path>
      ${points
        .map(
          ({ x, y, entry }) => `
            <g class="rhythm-point">
              <circle cx="${x}" cy="${y}" r="4.6"></circle>
              <text class="study-point-label" x="${x}" y="${y - 10}" text-anchor="middle">${entry.minutes}分</text>
              <text class="rhythm-axis-label" x="${x}" y="${height - 10}" text-anchor="middle">${formatShortDate(
                entry.date,
              )}</text>
            </g>
          `,
        )
        .join("")}
    </svg>
  `;
}

function buildSmoothPath(points) {
  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previousPoint = points[index - 1];
    const controlX = (previousPoint.x + point.x) / 2;
    return `${path} C ${controlX} ${previousPoint.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function render() {
  sortEntries();
  renderSummary();
  renderProgress();
  renderEntries();
}

function resetForm() {
  form.reset();
  dateInput.value = getTodayIso();
  editingLabel.textContent = "今日の学習を記録しています";
  updateCharCount();
  updateSaveState("未保存");
}

function updateCharCount() {
  charCount.textContent = noteInput.value.length;
}

function updateSaveState(text) {
  saveState.textContent = text;
}

function loadEntryIntoForm(entry) {
  dateInput.value = entry.date;
  subjectInput.value = entry.subject;
  minutesInput.value = entry.minutes;
  noteInput.value = entry.note;
  editingLabel.textContent = `${formatDate(entry.date)}の学習ログを編集中`;
  updateCharCount();
  updateSaveState("編集中");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const subject = subjectInput.value.trim();
  const minutes = Number(minutesInput.value);
  const note = noteInput.value.trim();

  if (!date || !subject || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    updateSaveState("入力を確認");
    return;
  }

  const existingIndex = entries.findIndex((entry) => entry.date === date);
  const now = new Date().toISOString();
  const nextEntry = {
    id: existingIndex >= 0 ? entries[existingIndex].id : createId(),
    date,
    subject,
    minutes,
    note,
    createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    entries[existingIndex] = nextEntry;
  } else {
    entries.push(nextEntry);
  }

  saveEntries();
  render();
  loadEntryIntoForm(nextEntry);
  updateSaveState("保存済み");
});

dateInput.addEventListener("change", () => {
  if (!dateInput.value) {
    return;
  }

  const existingEntry = entries.find((entry) => entry.date === dateInput.value);

  if (existingEntry) {
    loadEntryIntoForm(existingEntry);
    return;
  }

  subjectInput.value = "";
  minutesInput.value = "";
  noteInput.value = "";
  editingLabel.textContent = `${formatDate(dateInput.value)}の学習を記録しています`;
  updateCharCount();
  updateSaveState("未保存");
});

noteInput.addEventListener("input", () => {
  updateCharCount();
  updateSaveState("編集中");
});

subjectInput.addEventListener("input", () => updateSaveState("編集中"));
minutesInput.addEventListener("input", () => updateSaveState("編集中"));

clearButton.addEventListener("click", resetForm);

entryList.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const entryDate = button.dataset.date;
  const entry = entries.find((item) => item.date === entryDate);

  if (!entry) {
    return;
  }

  if (button.dataset.action === "edit") {
    loadEntryIntoForm(entry);
    document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (button.dataset.action === "delete") {
    const shouldDelete = confirm(`${formatDate(entry.date)}の学習ログを削除しますか？`);

    if (!shouldDelete) {
      return;
    }

    entries = entries.filter((item) => item.date !== entry.date);
    saveEntries();
    render();
    resetForm();
  }
});

searchInput.addEventListener("input", renderEntries);

dateInput.value = getTodayIso();
updateCharCount();
render();
