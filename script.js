// ============================================
// DAILY TASK TRACKER - Main JavaScript with Database
// ============================================

// State Management
let tasks = [];
let allHistory = [];
let allReminders = [];
let currentFilter = 'all';
let currentReminderTaskId = null;
let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;
let currentSwipeElement = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await DB.init();
    await loadFromDatabase();
    initEventListeners();
    updateCurrentDate();
    renderTasks();
    updateStats();
    renderActivityHeatmap();
    checkReminders();
    
    // Check reminders every minute
    setInterval(checkReminders, 60000);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Error initializing application. Please refresh the page.');
  }
});

// ============================================
// DATABASE LOADING
// ============================================

async function loadFromDatabase() {
  try {
    tasks = await DB.tasks.getAll();
    allHistory = await DB.history.getAll();
    allReminders = await DB.reminders.getAll();
    
    console.log('Loaded from database:', { tasks: tasks.length, history: allHistory.length });
  } catch (error) {
    console.error('Error loading from database:', error);
    tasks = [];
    allHistory = [];
    allReminders = [];
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
  document.getElementById('addBtn').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderTasks();
    });
  });

  document.getElementById('navTasks').addEventListener('click', () => switchView('tasks'));
  document.getElementById('navHistory').addEventListener('click', () => switchView('history'));
  document.getElementById('navActivity').addEventListener('click', () => switchView('activity'));

  document.getElementById('remCancel').addEventListener('click', closeReminderModal);
  document.getElementById('remSave').addEventListener('click', saveReminder);
  document.getElementById('reminderModal').addEventListener('click', (e) => {
    if (e.target.id === 'reminderModal') closeReminderModal();
  });

  document.getElementById('ampmAM').addEventListener('click', () => toggleAMPM('AM'));
  document.getElementById('ampmPM').addEventListener('click', () => toggleAMPM('PM'));

  document.getElementById('closeTaskHistory').addEventListener('click', closeTaskHistoryModal);
  document.getElementById('taskHistoryModal').addEventListener('click', (e) => {
    if (e.target.id === 'taskHistoryModal') closeTaskHistoryModal();
  });

  document.getElementById('remHour').addEventListener('input', (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) {
      e.target.value = '';
      return;
    }
    if (val > 12) e.target.value = 12;
    if (val < 1) e.target.value = 1;
  });

  document.getElementById('remMin').addEventListener('input', (e) => {
    let val = e.target.value;
    if (val === '') return;
    
    let numVal = parseInt(val);
    if (isNaN(numVal)) {
      e.target.value = '00';
      return;
    }
    
    if (numVal > 59) e.target.value = '59';
    if (numVal < 0) e.target.value = '00';
    
    if (e.target.value.length === 1 && numVal >= 0 && numVal <= 9) {
      e.target.value = '0' + e.target.value;
    }
  });
}

// ============================================
// TASK MANAGEMENT
// ============================================

async function addTask() {
  const input = document.getElementById('taskInput');
  const categorySelect = document.getElementById('categorySelect');
  const text = input.value.trim();
  const category = categorySelect.value;

  if (!text) {
    alert('Please enter a task name');
    return;
  }

  const task = {
    id: Date.now(),
    text,
    category: category || 'personal',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    await DB.tasks.add(task);
    tasks.push(task);
    
    input.value = '';
    categorySelect.value = '';
    
    renderTasks();
    updateStats();
    renderActivityHeatmap();
  } catch (error) {
    console.error('Error adding task:', error);
    alert('Error adding task. Please try again.');
  }
}

async function deleteTask(taskId) {
  if (confirm('Are you sure you want to delete this task?')) {
    try {
      await DB.tasks.delete(taskId);
      await DB.history.deleteByTaskId(taskId);
      await DB.reminders.delete(taskId);
      
      tasks = tasks.filter(t => t.id !== taskId);
      allHistory = allHistory.filter(h => h.taskId !== taskId);
      allReminders = allReminders.filter(r => r.taskId !== taskId);
      
      renderTasks();
      updateStats();
      renderActivityHeatmap();
      
      if (document.getElementById('historySection').classList.contains('active')) {
        renderHistory();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task. Please try again.');
    }
  }
}

async function markTask(taskId, status) {
  try {
    const today = new Date().toDateString();
    
    const existingEntry = allHistory.find(h => 
      h.taskId === taskId && new Date(h.date).toDateString() === today
    );

    if (existingEntry) {
      existingEntry.status = status;
      existingEntry.date = new Date().toISOString();
      await DB.history.update(existingEntry);
    } else {
      const newEntry = {
        taskId: taskId,
        date: new Date().toISOString(),
        status: status
      };
      const id = await DB.history.add(newEntry);
      newEntry.id = id;
      allHistory.push(newEntry);
    }

    renderTasks();
    updateStats();
    renderActivityHeatmap();
  } catch (error) {
    console.error('Error marking task:', error);
    alert('Error updating task status. Please try again.');
  }
}

// ============================================
// RENDERING
// ============================================

function renderTasks() {
  const container = document.getElementById('tasksList');
  const emptyState = document.getElementById('emptyState');
  
  const filteredTasks = tasks.filter(task => {
    if (currentFilter === 'all') return true;
    return task.category === currentFilter;
  });

  if (filteredTasks.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = filteredTasks.map(task => createTaskHTML(task)).join('');
}

function createTaskHTML(task) {
  const todayStatus = getTodayStatus(task);
  const reminder = allReminders.find(r => r.taskId === task.id);
  const hasReminder = reminder !== null;
  
  return `
    <div class="task-row" data-task-id="${task.id}">
      <div class="swipe-delete" onclick="deleteTask(${task.id})">🗑️</div>
      <div class="task-content" 
           ontouchstart="handleTouchStart(event, ${task.id})"
           ontouchmove="handleTouchMove(event)"
           ontouchend="handleTouchEnd(event)">
        <div class="task-title">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          ${task.category ? `<span style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">${capitalizeFirst(task.category)}</span>` : ''}
          <span class="icon-bell" onclick="openReminderModal(${task.id})">
            ${hasReminder ? '🔔' : '🔕'}
            ${hasReminder ? '<span class="badge"></span>' : ''}
          </span>
          ${renderStatusActions(task.id, todayStatus)}
        </div>
      </div>
    </div>
  `;
}

function renderStatusActions(taskId, status) {
  if (status === 'completed') {
    return '<span class="status-badge done">✓</span>';
  } else if (status === 'failed') {
    return '<span class="status-badge failed">✗</span>';
  } else {
    return `
      <div class="status-actions">
        <button class="btn-status btn-yes" onclick="markTask(${taskId}, 'completed')">Yes</button>
        <button class="btn-status btn-no" onclick="markTask(${taskId}, 'failed')">No</button>
      </div>
    `;
  }
}

function getTodayStatus(task) {
  const today = new Date().toDateString();
  const todayHistory = allHistory.find(h => 
    h.taskId === task.id && new Date(h.date).toDateString() === today
  );
  return todayHistory ? todayHistory.status : 'pending';
}

// ============================================
// TOUCH GESTURES
// ============================================

function handleTouchStart(event, taskId) {
  touchStartX = event.touches[0].clientX;
  isSwiping = true;
  currentSwipeElement = event.currentTarget.parentElement;
}

function handleTouchMove(event) {
  if (!isSwiping) return;
  
  touchCurrentX = event.touches[0].clientX;
  const diff = touchStartX - touchCurrentX;

  if (diff > 50) {
    currentSwipeElement.classList.add('show-delete');
  } else {
    currentSwipeElement.classList.remove('show-delete');
  }
}

function handleTouchEnd(event) {
  isSwiping = false;
  
  setTimeout(() => {
    if (currentSwipeElement) {
      currentSwipeElement.classList.remove('show-delete');
    }
  }, 2000);
}

// ============================================
// REMINDERS
// ============================================

async function openReminderModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  currentReminderTaskId = taskId;
  document.getElementById('reminderFor').textContent = `Reminder for: ${task.text}`;
  
  const reminder = allReminders.find(r => r.taskId === taskId);
  
  if (reminder) {
    const time = new Date(reminder.time);
    let hours = time.getHours();
    const minutes = time.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    
    document.getElementById('remHour').value = hours;
    document.getElementById('remMin').value = minutes.toString().padStart(2, '0');
    document.getElementById('remNote').value = reminder.note || '';
    toggleAMPM(ampm);
  } else {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    
    document.getElementById('remHour').value = hours;
    document.getElementById('remMin').value = minutes.toString().padStart(2, '0');
    document.getElementById('remNote').value = '';
    toggleAMPM(ampm);
  }

  document.getElementById('reminderModal').classList.add('show');
}

function closeReminderModal() {
  document.getElementById('reminderModal').classList.remove('show');
  currentReminderTaskId = null;
}

function toggleAMPM(period) {
  document.getElementById('ampmAM').classList.toggle('active', period === 'AM');
  document.getElementById('ampmPM').classList.toggle('active', period === 'PM');
}

async function saveReminder() {
  const task = tasks.find(t => t.id === currentReminderTaskId);
  if (!task) return;

  const hourInput = document.getElementById('remHour').value;
  const minInput = document.getElementById('remMin').value;
  
  if (!hourInput || !minInput) {
    alert('Please enter a valid time');
    return;
  }

  let hours = parseInt(hourInput);
  const minutes = parseInt(minInput);
  const isPM = document.getElementById('ampmPM').classList.contains('active');
  const note = document.getElementById('remNote').value.trim();

  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;

  const now = new Date();
  const reminderTime = new Date(
    now.getFullYear(), 
    now.getMonth(), 
    now.getDate(), 
    hours, 
    minutes
  );

  if (reminderTime < now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  const reminder = {
    taskId: currentReminderTaskId,
    time: reminderTime.toISOString(),
    note: note,
    notified: false
  };

  try {
    await DB.reminders.set(reminder);
    
    const existingIndex = allReminders.findIndex(r => r.taskId === currentReminderTaskId);
    if (existingIndex >= 0) {
      allReminders[existingIndex] = reminder;
    } else {
      allReminders.push(reminder);
    }
    
    renderTasks();
    closeReminderModal();
    alert('Reminder set successfully!');
  } catch (error) {
    console.error('Error saving reminder:', error);
    alert('Error saving reminder. Please try again.');
  }
}

async function checkReminders() {
  const now = new Date();
  let hasChanges = false;
  
  for (let reminder of allReminders) {
    if (!reminder.notified) {
      const reminderTime = new Date(reminder.time);
      
      if (now >= reminderTime) {
        const task = tasks.find(t => t.id === reminder.taskId);
        if (task) {
          showNotification(task, reminder);
          reminder.notified = true;
          await DB.reminders.set(reminder);
          hasChanges = true;
        }
      }
    }
  }
  
  if (hasChanges) {
    renderTasks();
  }
}

function showNotification(task, reminder) {
  const message = reminder.note 
    ? `${task.text}\n\n${reminder.note}`
    : task.text;
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Reminder 🔔', { 
      body: message,
      icon: '🔔'
    });
  } else {
    alert(`⏰ Task Reminder:\n\n${message}`);
  }
}

// ============================================
// STATISTICS
// ============================================

function updateStats() {
  const today = new Date().toDateString();
  
  const completedToday = allHistory.filter(h => {
    return new Date(h.date).toDateString() === today && h.status === 'completed';
  }).length;

  const totalToday = tasks.length;
  const streak = calculateStreak();

  document.getElementById('statsSummary').innerHTML = `
    <span>${completedToday}/${totalToday} Done</span>
    <span>${streak} Day Streak</span>
  `;

  document.getElementById('statTotalTasks').textContent = tasks.length;
  document.getElementById('statCompleted').textContent = completedToday;
  
  const uniqueDays = new Set();
  allHistory.forEach(h => {
    uniqueDays.add(new Date(h.date).toDateString());
  });
  document.getElementById('statDaysTracked').textContent = uniqueDays.size;
}

function calculateStreak() {
  if (tasks.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  while (true) {
    const dateStr = currentDate.toDateString();
    
    const completedTasks = allHistory.filter(h => 
      new Date(h.date).toDateString() === dateStr && h.status === 'completed'
    ).length;

    if (completedTasks !== tasks.length) break;
    
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
    
    if (streak > 1000) break;
  }

  return streak;
}

// ============================================
// ACTIVITY HEATMAP
// ============================================

function renderActivityHeatmap() {
  const container = document.getElementById('activityHeatmap');
  const weeks = 20; // Show last 20 weeks
  const today = new Date();
  
  // Calculate start date (weeks ago from today)
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7));
  startDate.setHours(0, 0, 0, 0);
  
  // Group history by date
  const activityByDate = {};
  allHistory.forEach(h => {
    if (h.status === 'completed') {
      const dateStr = new Date(h.date).toDateString();
      activityByDate[dateStr] = (activityByDate[dateStr] || 0) + 1;
    }
  });
  
  // Find max activities for color scaling
  const maxActivities = Math.max(...Object.values(activityByDate), 1);
  
  let html = '<div class="heatmap-grid">';
  
  // Generate cells for each day
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toDateString();
    
    const count = activityByDate[dateStr] || 0;
    const level = getActivityLevel(count, maxActivities);
    
    const isToday = dateStr === today.toDateString();
    const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    html += `
      <div class="heatmap-cell level-${level} ${isToday ? 'today' : ''}" 
           title="${dayLabel}: ${count} completed"
           data-count="${count}">
      </div>
    `;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function getActivityLevel(count, max) {
  if (count === 0) return 0;
  const percentage = count / max;
  if (percentage <= 0.25) return 1;
  if (percentage <= 0.50) return 2;
  if (percentage <= 0.75) return 3;
  return 4;
}

// ============================================
// NAVIGATION
// ============================================

function switchView(view) {
  document.getElementById('navTasks').classList.toggle('active', view === 'tasks');
  document.getElementById('navHistory').classList.toggle('active', view === 'history');
  document.getElementById('navActivity').classList.toggle('active', view === 'activity');
  
  document.getElementById('tasksView').style.display = view === 'tasks' ? 'block' : 'none';
  document.getElementById('historySection').classList.toggle('active', view === 'history');
  document.getElementById('activitySection').classList.toggle('active', view === 'activity');

  if (view === 'history') {
    renderHistory();
  } else if (view === 'activity') {
    renderActivityHeatmap();
  }
}

// ============================================
// HISTORY VIEW
// ============================================

function renderHistory() {
  const container = document.getElementById('taskHistoryList');
  const noHistory = document.getElementById('noHistory');

  if (tasks.length === 0 || allHistory.length === 0) {
    container.innerHTML = '';
    noHistory.style.display = 'block';
    return;
  }

  noHistory.style.display = 'none';
  container.innerHTML = tasks.map(task => createHistoryItemHTML(task)).join('');
}

function createHistoryItemHTML(task) {
  const taskHistory = allHistory.filter(h => h.taskId === task.id);
  const completed = taskHistory.filter(h => h.status === 'completed').length;
  const failed = taskHistory.filter(h => h.status === 'failed').length;
  const total = taskHistory.length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return `
    <div class="history-item-row" data-task-id="${task.id}">
      <div class="history-delete" onclick="deleteTask(${task.id})">🗑️</div>
      <div class="task-history-item" onclick="showTaskHistory(${task.id})">
        <div class="task-history-title">${escapeHtml(task.text)}</div>
        <div class="task-history-stats">
          <span class="task-history-stat">✓ ${completed} completed</span>
          <span class="task-history-stat">✗ ${failed} failed</span>
          <span class="task-history-stat">📊 ${rate}% success rate</span>
        </div>
      </div>
    </div>
  `;
}

function showTaskHistory(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('taskHistoryTitle').textContent = task.text;
  
  const calendar = generateCalendar(task);
  document.getElementById('taskHistoryContent').innerHTML = calendar;
  document.getElementById('taskHistoryModal').classList.add('show');
}

function closeTaskHistoryModal() {
  document.getElementById('taskHistoryModal').classList.remove('show');
}

function generateCalendar(task) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  let html = '<div class="history-calendar">';
  
  html += '<div class="weekdays">';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    html += `<div class="weekday">${day}</div>`;
  });
  html += '</div>';
  
  html += '<div class="days-grid">';

  for (let i = 0; i < startDay; i++) {
    html += '<div class="day-cell empty"></div>';
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    const dateStr = date.toDateString();
    const history = allHistory.find(h => 
      h.taskId === task.id && new Date(h.date).toDateString() === dateStr
    );
    
    let className = 'day-cell';
    let emoji = '';
    
    if (history) {
      if (history.status === 'completed') {
        className += ' completed';
        emoji = '✓';
      } else if (history.status === 'failed') {
        className += ' failed';
        emoji = '✗';
      }
    }

    html += `
      <div class="${className}">
        <div class="day-num">${day}</div>
        <div class="day-status">${emoji}</div>
      </div>
    `;
  }

  html += '</div></div>';
  return html;
}

// ============================================
// DATE & TIME
// ============================================

function updateCurrentDate() {
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const dateStr = new Date().toLocaleDateString('en-US', options);
  document.getElementById('currentDate').textContent = dateStr;
  
  const today = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  document.getElementById('todayHeader').textContent = today;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// MAKE FUNCTIONS GLOBALLY ACCESSIBLE
// ============================================

window.markTask = markTask;
window.deleteTask = deleteTask;
window.openReminderModal = openReminderModal;
window.showTaskHistory = showTaskHistory;
window.handleTouchStart = handleTouchStart;
window.handleTouchMove = handleTouchMove;
window.handleTouchEnd = handleTouchEnd;

console.log('Daily Task Tracker loaded successfully! 🚀');