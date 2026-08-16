// Small hand-rolled IndexedDB wrapper -- no external dependency, so it works
// fully offline with nothing to fetch from a CDN.
//
// Stores:
//   sessions     - one record per workout day you log
//   mesocycles   - training blocks (start date, length, split, current week, deload flag)
//   settings     - single record with your app-wide preferences
//   customPlans  - any plans you build/edit yourself (premade plans live in js/plans.js)

const DB_NAME = 'hypertrackDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byDate', 'date', { unique: false });
        store.createIndex('byMeso', 'mesoId', { unique: false });
      }
      if (!db.objectStoreNames.contains('mesocycles')) {
        db.createObjectStore('mesocycles', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customPlans')) {
        db.createObjectStore('customPlans', { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  // ---------------- sessions ----------------
  async addSession(session) {
    const db = await openDB();
    return promisify(tx(db, 'sessions', 'readwrite').add(session));
  },
  async updateSession(id, data) {
    const db = await openDB();
    const store = tx(db, 'sessions', 'readwrite');
    const existing = await promisify(store.get(id));
    if (!existing) throw new Error('Session not found: ' + id);
    const updated = Object.assign({}, existing, data, { id });
    return promisify(tx(db, 'sessions', 'readwrite').put(updated));
  },
  async getSession(id) {
    const db = await openDB();
    return promisify(tx(db, 'sessions', 'readonly').get(id));
  },
  async deleteSession(id) {
    const db = await openDB();
    return promisify(tx(db, 'sessions', 'readwrite').delete(id));
  },
  async getAllSessions() {
    const db = await openDB();
    return promisify(tx(db, 'sessions', 'readonly').getAll());
  },
  async getSessionsForMeso(mesoId) {
    const all = await this.getAllSessions();
    return all.filter(s => s.mesoId === mesoId);
  },
  // sets logged in the trailing N days, used for weekly volume dashboard
  async getSessionsSince(isoDate) {
    const all = await this.getAllSessions();
    return all.filter(s => s.date >= isoDate);
  },

  // ---------------- mesocycles ----------------
  async addMesocycle(meso) {
    const db = await openDB();
    return promisify(tx(db, 'mesocycles', 'readwrite').add(meso));
  },
  async updateMesocycle(id, data) {
    const db = await openDB();
    const store = tx(db, 'mesocycles', 'readwrite');
    const existing = await promisify(store.get(id));
    if (!existing) throw new Error('Mesocycle not found: ' + id);
    const updated = Object.assign({}, existing, data, { id });
    return promisify(tx(db, 'mesocycles', 'readwrite').put(updated));
  },
  async getMesocycle(id) {
    const db = await openDB();
    return promisify(tx(db, 'mesocycles', 'readonly').get(id));
  },
  async getAllMesocycles() {
    const db = await openDB();
    return promisify(tx(db, 'mesocycles', 'readonly').getAll());
  },
  async getActiveMesocycle() {
    const all = await this.getAllMesocycles();
    return all.find(m => m.active) || null;
  },

  // ---------------- settings ----------------
  async getSettings() {
    const db = await openDB();
    const existing = await promisify(tx(db, 'settings', 'readonly').get('main'));
    return existing || {
      id: 'main',
      units: 'lbs',
      restTimerSeconds: 120,
      onboarded: false,
      theme: 'dark'
    };
  },
  async saveSettings(data) {
    const db = await openDB();
    const current = await this.getSettings();
    const updated = Object.assign({}, current, data, { id: 'main' });
    return promisify(tx(db, 'settings', 'readwrite').put(updated));
  },

  // ---------------- custom plans ----------------
  async addCustomPlan(plan) {
    const db = await openDB();
    return promisify(tx(db, 'customPlans', 'readwrite').add(plan));
  },
  async getAllCustomPlans() {
    const db = await openDB();
    return promisify(tx(db, 'customPlans', 'readonly').getAll());
  },

  // ---------------- backup / restore ----------------
  async exportAll() {
    const [sessions, mesocycles, settings, customPlans] = await Promise.all([
      this.getAllSessions(),
      this.getAllMesocycles(),
      this.getSettings(),
      this.getAllCustomPlans()
    ]);
    return {
      exportedAt: new Date().toISOString(),
      appVersion: 1,
      sessions,
      mesocycles,
      settings,
      customPlans
    };
  },
  async importAll(data) {
    if (!data || !Array.isArray(data.sessions)) throw new Error('Invalid backup file');
    const db = await openDB();

    const clearStore = (name) => promisify(tx(db, name, 'readwrite').clear());
    await Promise.all(['sessions', 'mesocycles', 'customPlans'].map(clearStore));

    const put = (name, record) => promisify(tx(db, name, 'readwrite').put(record));
    for (const s of data.sessions) await put('sessions', s);
    for (const m of data.mesocycles || []) await put('mesocycles', m);
    for (const p of data.customPlans || []) await put('customPlans', p);
    if (data.settings) await put('settings', Object.assign({}, data.settings, { id: 'main' }));
  }
};

if (typeof module !== 'undefined') module.exports = { DB, openDB };
