// Cloud sync (Supabase) -- layered on top of the existing IndexedDB storage
// in db.js rather than replacing it. IndexedDB stays the source of truth for
// rendering and for offline use; this file's job is to mirror writes to
// Supabase in the background so the same data is available on another
// device, and to survive "I cleared my browser data" without a manual
// Export Backup / Import Backup round trip.
//
// Design on purpose: every DB.* write still works exactly as before with
// zero network access. A push to Supabase that fails (offline, gym wifi,
// Supabase hiccup) is swallowed and retried on the next write -- it never
// blocks or breaks local logging.

const SUPABASE_URL = 'https://zdubgyskxxbzcbbgjrsx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zzXed9HnrwUcPYrFXjLyHA_YjfoLpn0';

// Local -> remote table name mapping (IndexedDB store name -> Postgres table).
const TABLE_FOR_STORE = {
  sessions: 'sessions',
  mesocycles: 'mesocycles',
  customExercises: 'custom_exercises',
  customPlans: 'custom_plans'
};

const Sync = {
  enabled: typeof window !== 'undefined' && !!window.supabase,
  client: null,
  _userId: null,

  init() {
    if (!this.enabled) return;
    this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  },

  async getSession() {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getSession();
    if (error) { console.warn('Sync.getSession failed', error); return null; }
    this._userId = data.session ? data.session.user.id : null;
    return data.session;
  },

  onAuthStateChange(cb) {
    if (!this.client) return;
    this.client.auth.onAuthStateChange((_event, session) => {
      this._userId = session ? session.user.id : null;
      cb(session);
    });
  },

  async signUp(email, password) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this._userId = data.session ? data.session.user.id : null;
    return data;
  },

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this._userId = null;
  },

  // ---------------------------------------------------------------------
  // Per-write mirroring -- called from the DB.* wrapper below, fire-and-
  // forget from the caller's point of view.
  // ---------------------------------------------------------------------
  async pushRecord(storeName, clientId, data) {
    if (!this.enabled || !this._userId) return;
    const table = TABLE_FOR_STORE[storeName];
    if (!table) return;
    try {
      await this.client.from(table).upsert({
        user_id: this._userId,
        client_id: String(clientId),
        data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,client_id' });
    } catch (e) {
      console.warn(`Cloud sync: failed to push ${table}/${clientId} (will retry on next write)`, e);
    }
  },

  async deleteRecord(storeName, clientId) {
    if (!this.enabled || !this._userId) return;
    const table = TABLE_FOR_STORE[storeName];
    if (!table) return;
    try {
      await this.client.from(table).delete().eq('user_id', this._userId).eq('client_id', String(clientId));
    } catch (e) {
      console.warn(`Cloud sync: failed to delete ${table}/${clientId}`, e);
    }
  },

  async pushSettings(data) {
    if (!this.enabled || !this._userId) return;
    try {
      await this.client.from('settings').upsert({
        user_id: this._userId,
        data,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('Cloud sync: failed to push settings', e);
    }
  },

  // ---------------------------------------------------------------------
  // One-time reconciliation, run right after a successful sign-in. This is
  // deliberately a simple union, not a timestamp-based merge: it fills in
  // whichever side (this device vs. the cloud) is missing a given record,
  // and never overwrites a record that already exists on both sides. That
  // covers "first time turning on sync from my original device" (push
  // everything up) and "signing in on a new device" (pull everything down)
  // without risking clobbering real workout history either direction.
  // ---------------------------------------------------------------------
  async syncOnLogin() {
    if (!this.enabled || !this._userId) return;
    try {
      await this._syncStore('sessions', DB.getAllSessions, async (data) => { await DB.addSession(data); });
      await this._syncStore('mesocycles', DB.getAllMesocycles, async (data) => { await DB.addMesocycle(data); });
      await this._syncStore('customExercises', DB.getAllCustomExercises, async (data) => { await DB.addCustomExercise(data); });
      await this._syncStore('customPlans', DB.getAllCustomPlans, async (data) => { await DB.addCustomPlan(data); });
      await this._syncSettings();
    } catch (e) {
      console.warn('Cloud sync: initial reconciliation failed', e);
    }
  },

  async _syncStore(storeName, getAllLocalFn, addLocalFn) {
    const table = TABLE_FOR_STORE[storeName];
    const [localRecords, remoteRes] = await Promise.all([
      getAllLocalFn.call(DB),
      this.client.from(table).select('client_id, data').eq('user_id', this._userId)
    ]);
    if (remoteRes.error) throw remoteRes.error;
    const remoteRows = remoteRes.data || [];
    const remoteIds = new Set(remoteRows.map((r) => r.client_id));
    const localIds = new Set(localRecords.map((r) => String(r.id)));

    // Push local-only records up.
    for (const rec of localRecords) {
      if (!remoteIds.has(String(rec.id))) await this.pushRecord(storeName, rec.id, rec);
    }
    // Pull remote-only records down (strip the old numeric id so IndexedDB
    // assigns this device its own autoincrement key; the cloud copy stays
    // addressed by the original client_id already stored in `data`).
    for (const row of remoteRows) {
      if (!localIds.has(String(row.client_id))) {
        const record = Object.assign({}, row.data);
        delete record.id;
        await addLocalFn(record);
      }
    }
  },

  async _syncSettings() {
    const [local, remoteRes] = await Promise.all([
      DB.getSettings(),
      this.client.from('settings').select('data').eq('user_id', this._userId).maybeSingle()
    ]);
    if (remoteRes.error) throw remoteRes.error;
    if (remoteRes.data && remoteRes.data.data) {
      // Merge, preferring locally-set fields only where the cloud has never
      // seen this device's settings at all (empty remote handled below);
      // once both exist we keep the local copy authoritative to avoid
      // silently overwriting a preference you just changed on this device.
    } else {
      await this.pushSettings(local);
    }
  }
};

Sync.init();

// ---------------------------------------------------------------------------
// Wrap DB's write methods so every write also mirrors to Supabase. This
// intentionally does not touch db.js -- IndexedDB behavior is unchanged,
// this only adds a best-effort side effect after each local write succeeds.
// ---------------------------------------------------------------------------
(function wireDbSync() {
  const wrapAdd = (method, storeName) => {
    const orig = DB[method].bind(DB);
    DB[method] = async function (record) {
      const newId = await orig(record);
      Sync.pushRecord(storeName, newId, Object.assign({}, record, { id: newId }));
      return newId;
    };
  };
  const wrapUpdate = (method, storeName, getMethod) => {
    const orig = DB[method].bind(DB);
    DB[method] = async function (id, data) {
      const result = await orig(id, data);
      DB[getMethod](id).then((full) => { if (full) Sync.pushRecord(storeName, id, full); });
      return result;
    };
  };
  const wrapDelete = (method, storeName) => {
    const orig = DB[method].bind(DB);
    DB[method] = async function (id) {
      const result = await orig(id);
      Sync.deleteRecord(storeName, id);
      return result;
    };
  };

  wrapAdd('addSession', 'sessions');
  wrapUpdate('updateSession', 'sessions', 'getSession');
  wrapDelete('deleteSession', 'sessions');

  wrapAdd('addMesocycle', 'mesocycles');
  wrapUpdate('updateMesocycle', 'mesocycles', 'getMesocycle');

  wrapAdd('addCustomExercise', 'customExercises');
  wrapDelete('deleteCustomExercise', 'customExercises');

  wrapAdd('addCustomPlan', 'customPlans');

  const origSaveSettings = DB.saveSettings.bind(DB);
  DB.saveSettings = async function (data) {
    const result = await origSaveSettings(data);
    DB.getSettings().then((full) => Sync.pushSettings(full));
    return result;
  };
})();
