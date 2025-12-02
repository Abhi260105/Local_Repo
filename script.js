

// ============================================
// DAILY TASK TRACKER - Complete JavaScript
// ============================================

// State Management
let tasks = [];
let currentFilter = 'all';
let currentReminderTaskId = null;
let touchStartX = 0;
let touchCurrentX = 0;
let isSwiping = false;
let currentSwipeElement = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  initEventListeners();
  updateCurrentDate();
  renderTasks();
  updateStats();
  checkReminders();
  
  // Check reminders every minute
  setInterval(checkReminders, 60000);
  
  // Request notification permission if available
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
  // Add task
  document.getElementById('addBtn').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderTasks();
    });
  });

  // Navigation
  document.getElementById('navTasks').addEventListener('click', () => switchView('tasks'));
  document.getElementById('navHistory').addEventListener('click', () => switchView('history'));

  // Reminder modal controls
  document.getElementById('remCancel').addEventListener('click', closeReminderModal);
  document.getElementById('remSave').addEventListener('click', saveReminder);
  document.getElementById('reminderModal').addEventListener('click', (e) => {
    if (e.target.id === 'reminderModal') closeReminderModal();
  });

  // AM/PM toggle buttons
  document.getElementById('ampmAM').addEventListener('click', () => toggleAMPM('AM'));
  document.getElementById('ampmPM').addEventListener('click', () => toggleAMPM('PM'));

  // Task history modal
  document.getElementById('closeTaskHistory').addEventListener('click', closeTaskHistoryModal);
  document.getElementById('taskHistoryModal').addEventListener('click', (e) => {
    if (e.target.id === 'taskHistoryModal') closeTaskHistoryModal();
  });

  // Time input validation
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
    
    // Pad with zero if single digit
    if (e.target.value.length === 1 && numVal >= 0 && numVal <= 9) {
      e.target.value = '0' + e.target.value;
    }
  });
}

// ============================================
// TASK MANAGEMENT
// ============================================

function addTask() {
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
    createdAt: new Date().toISOString(),
    reminder: null,
    history: []
  };

  tasks.push(task);
  input.value = '';
  categorySelect.value = '';
  
  saveToStorage();
  renderTasks();
  updateStats();
}

function deleteTask(taskId) {
  if (confirm('Are you sure you want to delete this task?')) {
    tasks = tasks.filter(t => t.id !== taskId);
    saveToStorage();
    renderTasks();
    updateStats();
    
    // Re-render history if in history view
    if (document.getElementById('historySection').classList.contains('active')) {
      renderHistory();
    }
  }
}

function markTask(taskId, status) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const today = new Date().toDateString();
  const existingIndex = task.history.findIndex(h => 
    new Date(h.date).toDateString() === today
  );

  if (existingIndex >= 0) {
    task.history[existingIndex].status = status;
    task.history[existingIndex].date = new Date().toISOString();
  } else {
    task.history.push({
      date: new Date().toISOString(),
      status: status
    });
  }

  saveToStorage();
  renderTasks();
  updateStats();
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
  const hasReminder = task.reminder !== null;
  
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
  const todayHistory = task.history.find(h => 
    new Date(h.date).toDateString() === today
  );
  return todayHistory ? todayHistory.status : 'pending';
}

// ============================================
// TOUCH GESTURES (Mobile Swipe)
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
  
  // Auto-hide after 2 seconds
  setTimeout(() => {
    if (currentSwipeElement) {
      currentSwipeElement.classList.remove('show-delete');
    }
  }, 2000);
}

// ============================================
// REMINDERS
// ============================================

function openReminderModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  currentReminderTaskId = taskId;
  document.getElementById('reminderFor').textContent = `Reminder for: ${task.text}`;
  
  if (task.reminder) {
    const time = new Date(task.reminder.time);
    let hours = time.getHours();
    const minutes = time.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    
    document.getElementById('remHour').value = hours;
    document.getElementById('remMin').value = minutes.toString().padStart(2, '0');
    document.getElementById('remNote').value = task.reminder.note || '';
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

function saveReminder() {
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

  // Convert to 24-hour format
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

  // If time has passed today, set for tomorrow
  if (reminderTime < now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  task.reminder = {
    time: reminderTime.toISOString(),
    note: note,
    notified: false
  };

  saveToStorage();
  renderTasks();
  closeReminderModal();
  
  alert('Reminder set successfully!');
}

function checkReminders() {
  const now = new Date();
  let hasChanges = false;
  
  tasks.forEach(task => {
    if (task.reminder && !task.reminder.notified) {
      const reminderTime = new Date(task.reminder.time);
      
      if (now >= reminderTime) {
        showNotification(task);
        task.reminder.notified = true;
        hasChanges = true;
      }
    }
  });
  
  if (hasChanges) {
    saveToStorage();
    renderTasks();
  }
}

function showNotification(task) {
  const message = task.reminder.note 
    ? `${task.text}\n\n${task.reminder.note}`
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
  
  const completedToday = tasks.filter(task => {
    const todayHistory = task.history.find(h => 
      new Date(h.date).toDateString() === today
    );
    return todayHistory && todayHistory.status === 'completed';
  }).length;

  const totalToday = tasks.length;
  const streak = calculateStreak();

  // Update header stats
  document.getElementById('statsSummary').innerHTML = `
    <span>${completedToday}/${totalToday} Done</span>
    <span>${streak} Day Streak</span>
  `;

  // Update history page stats
  document.getElementById('statTotalTasks').textContent = tasks.length;
  document.getElementById('statCompleted').textContent = completedToday;
  
  const uniqueDays = new Set();
  tasks.forEach(task => {
    task.history.forEach(h => {
      uniqueDays.add(new Date(h.date).toDateString());
    });
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
    
    // Check if all tasks were completed on this date
    const allCompleted = tasks.every(task => {
      const history = task.history.find(h => 
        new Date(h.date).toDateString() === dateStr
      );
      return history && history.status === 'completed';
    });

    if (!allCompleted) break;
    
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
    
    // Prevent infinite loop
    if (streak > 1000) break;
  }

  return streak;
}

// ============================================
// NAVIGATION
// ============================================

function switchView(view) {
  // Update nav buttons
  document.getElementById('navTasks').classList.toggle('active', view === 'tasks');
  document.getElementById('navHistory').classList.toggle('active', view === 'history');
  
  // Show/hide views
  document.getElementById('tasksView').style.display = view === 'tasks' ? 'block' : 'none';
  document.getElementById('historySection').classList.toggle('active', view === 'history');

  if (view === 'history') {
    renderHistory();
  }
}

// ============================================
// HISTORY VIEW
// ============================================

function renderHistory() {
  const container = document.getElementById('taskHistoryList');
  const noHistory = document.getElementById('noHistory');

  if (tasks.length === 0 || tasks.every(t => t.history.length === 0)) {
    container.innerHTML = '';
    noHistory.style.display = 'block';
    return;
  }

  noHistory.style.display = 'none';
  container.innerHTML = tasks.map(task => createHistoryItemHTML(task)).join('');
}

function createHistoryItemHTML(task) {
  const completed = task.history.filter(h => h.status === 'completed').length;
  const failed = task.history.filter(h => h.status === 'failed').length;
  const total = task.history.length;
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
  
  // Weekday headers
  html += '<div class="weekdays">';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    html += `<div class="weekday">${day}</div>`;
  });
  html += '</div>';
  
  // Days grid
  html += '<div class="days-grid">';

  // Empty cells before first day of month
  for (let i = 0; i < startDay; i++) {
    html += '<div class="day-cell empty"></div>';
  }

  // Days of the month
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    const dateStr = date.toDateString();
    const history = task.history.find(h => 
      new Date(h.date).toDateString() === dateStr
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
// LOCAL STORAGE
// ============================================

function saveToStorage() {
  try {
    localStorage.setItem('dailyTaskTracker', JSON.stringify(tasks));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    alert('Error saving data. Your browser storage might be full.');
  }
}

function loadFromStorage() {
  try {
    const stored = localStorage.getItem('dailyTaskTracker');
    if (stored) {
      tasks = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
    tasks = [];
  }
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

