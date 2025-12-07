// ============================================
// DATABASE MANAGEMENT - IndexedDB
// ============================================

const DB_NAME = 'DailyTaskTrackerDB';
const DB_VERSION = 1;
let db = null;

// Initialize Database
async function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database failed to open');
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;

      // Create Tasks Store
      if (!db.objectStoreNames.contains('tasks')) {
        const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
        tasksStore.createIndex('category', 'category', { unique: false });
        tasksStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create History Store
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        historyStore.createIndex('taskId', 'taskId', { unique: false });
        historyStore.createIndex('date', 'date', { unique: false });
        historyStore.createIndex('status', 'status', { unique: false });
      }

      // Create Reminders Store
      if (!db.objectStoreNames.contains('reminders')) {
        const remindersStore = db.createObjectStore('reminders', { keyPath: 'taskId' });
        remindersStore.createIndex('time', 'time', { unique: false });
      }

      console.log('Database setup complete');
    };
  });
}

// ============================================
// TASK OPERATIONS
// ============================================

async function addTaskToDB(task) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const store = transaction.objectStore('tasks');
    const request = store.add(task);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllTasks() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks'], 'readonly');
    const store = transaction.objectStore('tasks');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getTaskById(taskId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks'], 'readonly');
    const store = transaction.objectStore('tasks');
    const request = store.get(taskId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateTask(task) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const store = transaction.objectStore('tasks');
    const request = store.put(task);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteTaskFromDB(taskId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks'], 'readwrite');
    const store = transaction.objectStore('tasks');
    const request = store.delete(taskId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// HISTORY OPERATIONS
// ============================================

async function addHistoryEntry(entry) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.add(entry);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateHistoryEntry(entry) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.put(entry);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getHistoryByTaskId(taskId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const index = store.index('taskId');
    const request = index.getAll(taskId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllHistory() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['history'], 'readonly');
    const store = transaction.objectStore('history');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteHistoryByTaskId(taskId) {
  return new Promise(async (resolve, reject) => {
    try {
      const history = await getHistoryByTaskId(taskId);
      const transaction = db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');

      history.forEach(entry => {
        store.delete(entry.id);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================
// REMINDER OPERATIONS
// ============================================

async function setReminder(reminder) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reminders'], 'readwrite');
    const store = transaction.objectStore('reminders');
    const request = store.put(reminder);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getReminder(taskId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    const request = store.get(taskId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllReminders() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reminders'], 'readonly');
    const store = transaction.objectStore('reminders');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteReminder(taskId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['reminders'], 'readwrite');
    const store = transaction.objectStore('reminders');
    const request = store.delete(taskId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function clearAllData() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks', 'history', 'reminders'], 'readwrite');
    
    transaction.objectStore('tasks').clear();
    transaction.objectStore('history').clear();
    transaction.objectStore('reminders').clear();

    transaction.oncomplete = () => {
      console.log('All data cleared');
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

// Export functions for use in other scripts
window.DB = {
  init: initDatabase,
  tasks: {
    add: addTaskToDB,
    getAll: getAllTasks,
    getById: getTaskById,
    update: updateTask,
    delete: deleteTaskFromDB
  },
  history: {
    add: addHistoryEntry,
    update: updateHistoryEntry,
    getByTaskId: getHistoryByTaskId,
    getAll: getAllHistory,
    deleteByTaskId: deleteHistoryByTaskId
  },
  reminders: {
    set: setReminder,
    get: getReminder,
    getAll: getAllReminders,
    delete: deleteReminder
  },
  clearAll: clearAllData
};

console.log('Database module loaded successfully! 🗄️');