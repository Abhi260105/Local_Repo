// Storage keys
const TASKS_KEY = 'daily_tasks_v6';
const TASK_HISTORY_KEY = 'daily_task_history_v6';
const LAST_RESET_KEY = 'last_reset_date_v6';

// State variables
let currentFilter = 'all';
let tasks = [];
let taskHistory = [];
let lastResetDate = null;
let currentReminderTaskId = null;

// Constants
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Utility functions
function qs(id) {
  return document.getElementById(id);
}

function nowDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Storage functions
function loadAll() {
  try {
    tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    taskHistory = JSON.parse(localStorage.getItem(TASK_HISTORY_KEY) || '[]');
    lastResetDate = localStorage.getItem(LAST_RESET_KEY) || null;
  } catch (e) {
    console.error('load error', e);
    tasks = [];
    taskHistory = [];
    lastResetDate = null;
  }
}

function saveAll() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  localStorage.setItem(TASK_HISTORY_KEY, JSON.stringify(taskHistory));
  localStorage.setItem(LAST_RESET_KEY, lastResetDate || '');
}

// Initialization
function init() {
  loadAll();
  updateCurrentDate();
  checkDailyReset();
  renderTasks();
  renderHistoryView();
  updateStats();
  updateHeaderStats();
  startTickers();
  attachUI();
}

function updateCurrentDate() {
  const now = new Date();
  qs('currentDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  qs('todayHeader').textContent = DAY_NAMES[now.getDay()];
}

function checkDailyReset() {
  const todayStr = nowDateStr();
  if (lastResetDate !== todayStr) {
    tasks.forEach(t => {
      t.status = {
        sunday: null,
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null
      };
      t.reminderShown = false;
    });
    lastResetDate = todayStr;
    saveAll();
    renderTasks();
    updateStats();
    updateHeaderStats();
  }
}

// Filter functions
function filterTasks(category) {
  currentFilter = category;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.filter === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderTasks();
}

// Task management functions
function addTaskFromInput() {
  const input = qs('taskInput');
  const categorySelect = qs('categorySelect');
  const title = input.value.trim();
  if (!title) return;

  const newTask = {
    id: Date.now(),
    title,
    category: categorySelect.value || 'none',
    status: {
      sunday: null,
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null
    },
    reminder: null,
    reminderShown: false
  };

  tasks.push(newTask);
  input.value = '';
  categorySelect.value = '';
  saveAll();
  renderTasks();
  renderHistoryView();
  updateStats();
  updateHeaderStats();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  taskHistory = taskHistory.filter(h => h.taskId !== id);
  saveAll();
  renderTasks();
  renderHistoryView();
  updateStats();
  updateHeaderStats();
}

function setTaskStatus(id, val) {
  const todayKey = DAYS[new Date().getDay()];
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.status[todayKey] = !!val;

  const todayStr = nowDateStr();
  let histTask = taskHistory.find(h => h.taskId === id);
  if (!histTask) {
    histTask = {
      taskId: id,
      title: t.title,
      history: []
    };
    taskHistory.push(histTask);
  }

  const existingIdx = histTask.history.findIndex(h => h.date === todayStr);
  if (existingIdx >= 0) {
    histTask.history[existingIdx].status = !!val;
  } else {
    histTask.history.push({
      date: todayStr,
      status: !!val
    });
  }

  saveAll();
  renderTasks();
  renderHistoryView();
  updateStats();
  updateHeaderStats();
}

// Reminder functions
function openReminderModalFor(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  currentReminderTaskId = id;
  qs('reminderFor').textContent = task.title;
  qs('remHour').value = task.reminder ? task.reminder.hour : 12;
  qs('remMin').value = task.reminder ? String(task.reminder.minute).padStart(2, '0') : '00';
  if (task.reminder && task.reminder.ampm === 'PM') {
    qs('ampmPM').classList.add('active');
    qs('ampmAM').classList.remove('active');
  } else {
    qs('ampmAM').classList.add('active');
    qs('ampmPM').classList.remove('active');
  }
  qs('remNote').value = task.reminder ? (task.reminder.note || '') : '';
  showModal('reminderModal');
}

function saveReminderForCurrent() {
  if (!currentReminderTaskId) return;
  const task = tasks.find(t => t.id === currentReminderTaskId);
  if (!task) return;
  let hour = parseInt(qs('remHour').value, 10);
  if (isNaN(hour) || hour < 1) hour = 12;
  if (hour > 12) hour = 12;
  let minute = parseInt(qs('remMin').value, 10);
  if (isNaN(minute) || minute < 0) minute = 0;
  if (minute > 59) minute = 59;
  const ampm = qs('ampmPM').classList.contains('active') ? 'PM' : 'AM';
  const note = qs('remNote').value.trim();
  task.reminder = {
    hour,
    minute,
    ampm,
    note
  };
  task.reminderShown = false;
  saveAll();
  hideModal('reminderModal');
  renderTasks();
  alert('Reminder saved: ' + `${hour}:${String(minute).padStart(2, '0')} ${ampm}`);
}

// Render functions
function renderTasks() {
  const list = qs('tasksList');
  list.innerHTML = '';
  const todayKey = DAYS[new Date().getDay()];

  if (!tasks || tasks.length === 0) {
    qs('emptyState').style.display = 'block';
    return;
  } else {
    qs('emptyState').style.display = 'none';
  }

  let filtered = tasks;
  if (currentFilter !== 'all') {
    filtered = tasks.filter(t => t.category === currentFilter);
  }

  const sorted = [...filtered].sort((a, b) => {
    const aStatus = (a.status && typeof a.status === 'object') ? a.status[todayKey] : null;
    const bStatus = (b.status && typeof b.status === 'object') ? b.status[todayKey] : null;
    if (aStatus === null && bStatus !== null) return -1;
    if (aStatus !== null && bStatus === null) return 1;
    return 0;
  });

  sorted.forEach(task => {
    const row = document.createElement('div');
    row.className = 'task-row';

    const deleteArea = document.createElement('div');
    deleteArea.className = 'swipe-delete';
    deleteArea.innerHTML = '🗑️';
    deleteArea.addEventListener('click', () => {
      if (confirm(`Delete "${task.title}"?`)) {
        deleteTask(task.id);
      }
    });

    const content = document.createElement('div');
    content.className = 'task-content';

    const title = document.createElement('div');
    title.className = 'task-title';
    const categoryIcons = {
      'work': '💼',
      'personal': '🏠',
      'health': '💪',
      'learning': '📚',
      'none': ''
    };

    const categoryBadge = task.category && task.category !== 'none' ?
      `<span style="background:rgba(100,255,218,0.1);padding:2px 8px;border-radius:6px;font-size:0.8rem;margin-right:8px">${categoryIcons[task.category] || ''}</span>` :
      '';

    title.innerHTML = categoryBadge + escapeHtml(task.title);

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const bell = document.createElement('div');
    bell.className = 'icon-bell';
    bell.innerHTML = '🔔';
    if (task.reminder) {
      const b = document.createElement('span');
      b.className = 'badge';
      bell.appendChild(b);
    }
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      openReminderModalFor(task.id);
    });

    const statusBox = document.createElement('div');
    statusBox.className = 'status-actions';
    const currentStatus = (task.status && typeof task.status === 'object') ? task.status[todayKey] : null;

    if (currentStatus === null) {
      const yes = document.createElement('button');
      yes.className = 'btn-status btn-yes';
      yes.textContent = 'Yes';
      const no = document.createElement('button');
      no.className = 'btn-status btn-no';
      no.textContent = 'No';
      yes.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setTaskStatus(task.id, true);
      });
      no.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setTaskStatus(task.id, false);
      });
      statusBox.appendChild(yes);
      statusBox.appendChild(no);
    } else {
      const b = document.createElement('div');
      b.className = 'status-badge ' + (currentStatus ? 'done' : 'failed');
      b.textContent = currentStatus ? '✓' : '✗';
      statusBox.appendChild(b);
    }

    meta.appendChild(bell);
    meta.appendChild(statusBox);
    content.appendChild(title);
    content.appendChild(meta);
    row.appendChild(deleteArea);
    row.appendChild(content);
    bindSwipeToDelete(content, row, task.id);
    list.appendChild(row);
  });
}

function bindSwipeToDelete(contentEl, containerRow, taskId) {
  let startX = 0,
    currentX = 0,
    dragging = false;
  const threshold = 90,
    maxSlide = 110;

  function pointerStart(x) {
    startX = x;
    currentX = x;
    dragging = true;
    contentEl.style.transition = 'none';
  }

  function pointerMove(x) {
    if (!dragging) return;
    currentX = x;
    const diff = startX - currentX;
    if (diff > 0) {
      const px = Math.min(diff, maxSlide);
      contentEl.style.transform = `translateX(-${px}px)`;
      if (px > 20) containerRow.classList.add('show-delete');
      else containerRow.classList.remove('show-delete');
    }
  }

  function pointerEnd() {
    if (!dragging) return;
    dragging = false;
    contentEl.style.transition = 'transform .2s ease';
    const diff = startX - currentX;
    if (diff > threshold) {
      contentEl.style.transform = `translateX(-${maxSlide}px)`;
      setTimeout(() => {
        if (confirm(`Delete this task?`)) {
          deleteTask(taskId);
        } else {
          containerRow.classList.remove('show-delete');
          contentEl.style.transform = 'translateX(0)';
        }
      }, 220);
    } else {
      containerRow.classList.remove('show-delete');
      contentEl.style.transform = 'translateX(0)';
    }
  }

  contentEl.addEventListener('touchstart', (e) => pointerStart(e.touches[0].clientX), {
    passive: true
  });
  contentEl.addEventListener('touchmove', (e) => pointerMove(e.touches[0].clientX), {
    passive: true
  });
  contentEl.addEventListener('touchend', () => pointerEnd());
  contentEl.addEventListener('mousedown', (e) => pointerStart(e.clientX));
  window.addEventListener('mousemove', (e) => pointerMove(e.clientX));
  window.addEventListener('mouseup', () => pointerEnd());
}

function deleteTaskHistory(taskId) {
  taskHistory = taskHistory.filter(h => h.taskId !== taskId);
  saveAll();
  renderHistoryView();
  updateStats();
}

function renderHistoryView() {
  const list = qs('taskHistoryList');
  list.innerHTML = '';

  if (!taskHistory || taskHistory.length === 0) {
    qs('noHistory').style.display = 'block';
    return;
  }

  qs('noHistory').style.display = 'none';

  taskHistory.forEach(histTask => {
    const task = tasks.find(t => t.id === histTask.taskId);
    if (!task) return;

    const row = document.createElement('div');
    row.className = 'history-item-row';

    const deleteArea = document.createElement('div');
    deleteArea.className = 'history-delete';
    deleteArea.innerHTML = '🗑️';
    deleteArea.addEventListener('click', () => {
      if (confirm(`Delete history for "${histTask.title}"?`)) {
        deleteTaskHistory(histTask.taskId);
      }
    });

    const item = document.createElement('div');
    item.className = 'task-history-item';

    const title = document.createElement('div');
    title.className = 'task-history-title';
    title.textContent = histTask.title;

    const stats = document.createElement('div');
    stats.className = 'task-history-stats';

    const totalDays = histTask.history.length;
    const completedDays = histTask.history.filter(h => h.status).length;
    const failedDays = histTask.history.filter(h => !h.status).length;

    stats.innerHTML = `
      <div class="task-history-stat"><span style="color:var(--success)">✓</span> ${completedDays}</div>
      <div class="task-history-stat"><span style="color:var(--danger)">✗</span> ${failedDays}</div>
      <div class="task-history-stat"><span style="color:var(--muted)">📅</span> ${totalDays} days</div>
    `;

    item.appendChild(title);
    item.appendChild(stats);

    item.addEventListener('click', () => openTaskHistoryModal(histTask.taskId));

    row.appendChild(deleteArea);
    row.appendChild(item);
    bindSwipeToDeleteHistory(item, row, histTask.taskId);
    list.appendChild(row);
  });
}

function bindSwipeToDeleteHistory(contentEl, containerRow, taskId) {
  let startX = 0,
    currentX = 0,
    dragging = false;
  const threshold = 90,
    maxSlide = 110;

  function pointerStart(x) {
    startX = x;
    currentX = x;
    dragging = true;
    contentEl.style.transition = 'none';
  }

  function pointerMove(x) {
    if (!dragging) return;
    currentX = x;
    const diff = currentX - startX;
    if (diff > 0) {
      const px = Math.min(diff, maxSlide);
      contentEl.style.transform = `translateX(${px}px)`;
      if (px > 20) containerRow.classList.add('show-delete');
      else containerRow.classList.remove('show-delete');
    }
  }

  function pointerEnd() {
    if (!dragging) return;
    dragging = false;
    contentEl.style.transition = 'transform .2s ease';
    const diff = currentX - startX;
    if (diff > threshold) {
      contentEl.style.transform = `translateX(${maxSlide}px)`;
      setTimeout(() => {
        if (confirm(`Delete history for this task?`)) {
          deleteTaskHistory(taskId);
        } else {
          containerRow.classList.remove('show-delete');
          contentEl.style.transform = 'translateX(0)';
        }
      }, 220);
    } else {
      containerRow.classList.remove('show-delete');
      contentEl.style.transform = 'translateX(0)';
    }
  }

  contentEl.addEventListener('touchstart', (e) => pointerStart(e.touches[0].clientX), {
    passive: true
  });
  contentEl.addEventListener('touchmove', (e) => pointerMove(e.touches[0].clientX), {
    passive: true
  });
  contentEl.addEventListener('touchend', () => pointerEnd());
  contentEl.addEventListener('mousedown', (e) => pointerStart(e.clientX));
  window.addEventListener('mousemove', (e) => pointerMove(e.clientX));
  window.addEventListener('mouseup', () => pointerEnd());
}

function openTaskHistoryModal(taskId) {
  const histTask = taskHistory.find(h => h.taskId === taskId);
  const task = tasks.find(t => t.id === taskId);

  if (!histTask || !histTask.history || histTask.history.length === 0) {
    alert('No history recorded for this task yet.');
    return;
  }

  qs('taskHistoryTitle').textContent = `📈 ${task ? task.title : histTask.title}`;

  const content = qs('taskHistoryContent');
  content.innerHTML = '';

  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px';

  const completed = histTask.history.filter(h => h.status).length;
  const total = histTask.history.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const completedBox = document.createElement('div');
  completedBox.className = 'stat-box';
  completedBox.innerHTML = `<div class="stat-value">${completed}/${total}</div><div class="stat-label">Completed</div>`;

  const percentBox = document.createElement('div');
  percentBox.className = 'stat-box';
  percentBox.innerHTML = `<div class="stat-value">${percentage}%</div><div class="stat-label">Success Rate</div>`;

  statsDiv.appendChild(completedBox);
  statsDiv.appendChild(percentBox);
  content.appendChild(statsDiv);

  // Create calendar
  const calendarDiv = document.createElement('div');
  calendarDiv.className = 'history-calendar';

  const weekdaysDiv = document.createElement('div');
  weekdaysDiv.className = 'weekdays';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    const wd = document.createElement('div');
    wd.className = 'weekday';
    wd.textContent = day;
    weekdaysDiv.appendChild(wd);
  });
  calendarDiv.appendChild(weekdaysDiv);

  // Sort history by date
  const sortedHistory = [...histTask.history].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (sortedHistory.length > 0) {
    const firstDate = new Date(sortedHistory[0].date);
    const lastDate = new Date(sortedHistory[sortedHistory.length - 1].date);

    // Create a map for quick lookup
    const historyMap = {};
    sortedHistory.forEach(h => {
      historyMap[h.date] = h.status;
    });

    const daysGrid = document.createElement('div');
    daysGrid.className = 'days-grid';

    // Start from first Sunday before or on first date
    const startDate = new Date(firstDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on last Saturday after or on last date
    const endDate = new Date(lastDate);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = nowDateStr(currentDate);
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';

      const dayNum = document.createElement('div');
      dayNum.className = 'day-num';
      dayNum.textContent = currentDate.getDate();

      const dayStatus = document.createElement('div');
      dayStatus.className = 'day-status';

      if (historyMap.hasOwnProperty(dateStr)) {
        if (historyMap[dateStr]) {
          dayCell.classList.add('completed');
          dayStatus.textContent = '✅';
        } else {
          dayCell.classList.add('failed');
          dayStatus.textContent = '❌';
        }
      } else {
        if (currentDate < firstDate || currentDate > lastDate) {
          dayCell.classList.add('empty');
          dayStatus.textContent = '';
        } else {
          dayStatus.textContent = '—';
        }
      }

      dayCell.appendChild(dayNum);
      dayCell.appendChild(dayStatus);
      daysGrid.appendChild(dayCell);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    calendarDiv.appendChild(daysGrid);
  }

  content.appendChild(calendarDiv);
  showModal('taskHistoryModal');
}

function updateStats() {
  const totalTasks = tasks.length;
  const todayStr = nowDateStr();
  const todayKey = DAYS[new Date().getDay()];

  // Count only TODAY's completed tasks
  let todayCompleted = 0;
  tasks.forEach(task => {
    const currentStatus = (task.status && typeof task.status === 'object') ? task.status[todayKey] : null;
    if (currentStatus === true) {
      todayCompleted++;
    }
  });

  // Count unique days with task history
  const uniqueDates = new Set();
  taskHistory.forEach(histTask => {
    histTask.history.forEach(h => {
      uniqueDates.add(h.date);
    });
  });

  const daysTracked = uniqueDates.size;

  qs('statTotalTasks').textContent = totalTasks;
  qs('statCompleted').textContent = todayCompleted;
  qs('statDaysTracked').textContent = daysTracked;
}

function updateHeaderStats() {
  const todayKey = DAYS[new Date().getDay()];
  let todayCompleted = 0;
  let totalTasks = tasks.length;

  tasks.forEach(task => {
    const currentStatus = (task.status && typeof task.status === 'object') ? task.status[todayKey] : null;
    if (currentStatus === true) {
      todayCompleted++;
    }
  });

  // Calculate streak
  const streak = calculateStreak();

  const statsSummary = qs('statsSummary');
  statsSummary.innerHTML = `
    <span>📊 ${todayCompleted}/${totalTasks} Done</span>
    <span>🔥 ${streak} Day Streak</span>
  `;
}

function calculateStreak() {
  if (taskHistory.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect all dates where at least one task was completed
  const completedDates = new Set();
  taskHistory.forEach(histTask => {
    histTask.history.forEach(h => {
      if (h.status) {
        completedDates.add(h.date);
      }
    });
  });

  // Convert to array and sort
  const sortedDates = Array.from(completedDates).sort().reverse();

  if (sortedDates.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date(today);

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = nowDateStr(currentDate);
    if (sortedDates.includes(dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Modal functions
function showModal(id) {
  qs(id).classList.add('show');
}

function hideModal(id) {
  qs(id).classList.remove('show');
}

// UI event handlers
function attachUI() {
  qs('addBtn').addEventListener('click', addTaskFromInput);
  qs('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTaskFromInput();
  });

  qs('ampmAM').addEventListener('click', () => {
    qs('ampmAM').classList.add('active');
    qs('ampmPM').classList.remove('active');
  });

  qs('ampmPM').addEventListener('click', () => {
    qs('ampmPM').classList.add('active');
    qs('ampmAM').classList.remove('active');
  });

  qs('remSave').addEventListener('click', saveReminderForCurrent);
  qs('remCancel').addEventListener('click', () => hideModal('reminderModal'));
  qs('closeTaskHistory').addEventListener('click', () => hideModal('taskHistoryModal'));

  // Navigation
  qs('navTasks').addEventListener('click', () => {
    qs('navTasks').classList.add('active');
    qs('navHistory').classList.remove('active');
    qs('tasksView').style.display = 'block';
    qs('historySection').classList.remove('active');
  });

  qs('navHistory').addEventListener('click', () => {
    qs('navHistory').classList.add('active');
    qs('navTasks').classList.remove('active');
    qs('tasksView').style.display = 'none';
    qs('historySection').classList.add('active');
    renderHistoryView();
    updateStats();
  });

  // Close modals on background click
  qs('reminderModal').addEventListener('click', (e) => {
    if (e.target === qs('reminderModal')) hideModal('reminderModal');
  });

  qs('taskHistoryModal').addEventListener('click', (e) => {
    if (e.target === qs('taskHistoryModal')) hideModal('taskHistoryModal');
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterTasks(btn.dataset.filter);
    });
  });
}

// Timer functions
function startTickers() {
  setInterval(() => {
    updateCurrentDate();
    checkDailyReset();
  }, 60000); // Check every minute

  // Check reminders every 30 seconds
  setInterval(() => {
    checkReminders();
  }, 30000);

  // Initial check
  checkReminders();
}

function checkReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  tasks.forEach(task => {
    if (!task.reminder || task.reminderShown) return;

    let reminderHour = task.reminder.hour;
    if (task.reminder.ampm === 'PM' && reminderHour !== 12) {
      reminderHour += 12;
    } else if (task.reminder.ampm === 'AM' && reminderHour === 12) {
      reminderHour = 0;
    }

    const reminderMinute = task.reminder.minute;

    // Calculate 1 minute before reminder time
    let alertHour = reminderHour;
    let alertMinute = reminderMinute - 1;

    if (alertMinute < 0) {
      alertMinute = 59;
      alertHour -= 1;
      if (alertHour < 0) alertHour = 23;
    }

    // Check if current time matches alert time (1 minute before)
    if (currentHour === alertHour && currentMinute === alertMinute) {
      const noteText = task.reminder.note ? `\n\nNote: ${task.reminder.note}` : '';
      const timeStr = `${task.reminder.hour}:${String(task.reminder.minute).padStart(2, '0')} ${task.reminder.ampm}`;
      alert(`⏰ Reminder: ${task.title}\n\nScheduled for: ${timeStr}${noteText}`);
      task.reminderShown = true;
      saveAll();
    }
  });
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}