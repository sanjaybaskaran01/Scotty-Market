/**
 * demo-db.ts
 * In-browser SQLite database using sql.js (WASM).
 * Initializes schema from the backend migrations and seeds with static data.
 * Returns a singleton DB instance for use by demo-api.ts.
 */

import initSqlJs, { Database } from 'sql.js';

// --- Schema (mirrors backend/src/db/schema.ts MIGRATIONS) ---

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transaction_ (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'plaid',
    provider_txn_id TEXT UNIQUE,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    name TEXT NOT NULL,
    merchant_name TEXT,
    merchant_key TEXT,
    category_primary TEXT,
    category_detailed TEXT,
    pending INTEGER NOT NULL DEFAULT 0,
    pending_transaction_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_txn_user_date ON transaction_(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_txn_user_category_date ON transaction_(user_id, category_primary, date);

  CREATE TABLE IF NOT EXISTS scotty_state (
    user_id TEXT PRIMARY KEY,
    happiness INTEGER NOT NULL DEFAULT 70,
    mood TEXT NOT NULL DEFAULT 'content',
    last_fed TEXT,
    food_credits INTEGER NOT NULL DEFAULT 10,
    last_reward_food TEXT,
    last_reward_at TEXT,
    growth_level INTEGER NOT NULL DEFAULT 1,
    stamina INTEGER NOT NULL DEFAULT 100,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budget (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    frequency TEXT NOT NULL DEFAULT 'Month',
    derived_daily_limit REAL,
    adaptive_enabled INTEGER NOT NULL DEFAULT 1,
    adaptive_max_adjust_pct REAL NOT NULL DEFAULT 10,
    last_auto_adjusted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, category)
  );

  CREATE TABLE IF NOT EXISTS quest (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    metric_params TEXT NOT NULL DEFAULT '{}',
    reward_food_type TEXT NOT NULL,
    happiness_delta INTEGER NOT NULL DEFAULT 5,
    created_by TEXT NOT NULL DEFAULT 'agent',
    goal_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_quest_user_status ON quest(user_id, status);

  CREATE TABLE IF NOT EXISTS insight (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    blurb TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'MEDIUM',
    metrics TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recurring_candidate (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    merchant_key TEXT NOT NULL,
    typical_amount REAL NOT NULL,
    cadence TEXT NOT NULL DEFAULT 'monthly',
    next_expected_date TEXT,
    confidence REAL NOT NULL DEFAULT 0.5,
    source TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goal (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    saved_so_far REAL NOT NULL DEFAULT 0,
    deadline TEXT,
    budget_percent INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_item (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    source_quest_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, item_type)
  );

  CREATE TABLE IF NOT EXISTS chat_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// --- Category inference (mirrors backend/src/services/nessie.ts) ---

function splitDescription(description: string): { prefix: string | null; detail: string | null } {
  const parts = description.split(' - ');
  if (parts.length <= 1) {
    const trimmed = description.trim();
    return { prefix: null, detail: trimmed.length > 0 ? trimmed : null };
  }
  const [prefixRaw, ...rest] = parts;
  return { prefix: prefixRaw.trim() || null, detail: rest.join(' - ').trim() || null };
}

function inferCategory(kind: string, description: string): string {
  const { prefix } = splitDescription(description);
  if (prefix) {
    const p = prefix.toLowerCase();
    if (p.includes('income')) return 'Income';
    if (p.includes('grocer')) return 'Groceries';
    if (p.includes('dining')) return 'Food & Drink';
    if (p.includes('travel')) return 'Transportation';
    if (p.includes('fun')) return 'Entertainment';
    if (p.includes('shopping')) return 'Shopping';
    if (p.includes('self-care')) return 'Health';
    if (p.includes('misc')) return 'Other';
    if (p.includes('transfer')) return 'Transfer';
    if (p.includes('subscription')) return 'Subscription';
  }
  const text = `${kind} ${description}`.toLowerCase();
  if (text.includes('subscription') || text.includes('netflix') || text.includes('spotify')) return 'Subscription';
  if (text.includes('grocer')) return 'Groceries';
  if (text.includes('dining') || text.includes('restaurant') || text.includes('coffee')) return 'Food & Drink';
  if (text.includes('travel') || text.includes('rideshare') || text.includes('uber') || text.includes('lyft')) return 'Transportation';
  if (text.includes('fun') || text.includes('movie') || text.includes('concert')) return 'Entertainment';
  if (text.includes('shopping') || text.includes('gift') || text.includes('clothes')) return 'Shopping';
  if (text.includes('self-care') || text.includes('pharmacy') || text.includes('wellness')) return 'Health';
  if (text.includes('transfer')) return 'Transfer';
  if (kind === 'deposit') return 'Income';
  return 'Other';
}

function inferSignedAmount(kind: string, amount: number): number {
  const abs = Math.abs(amount);
  if (kind === 'purchase' || kind === 'withdrawal') return -abs;
  if (kind === 'deposit') return abs;
  return -abs; // transfer: payer perspective
}

// --- Seed data ---

import seedSuiteRaw from '../data/demo-seed-transactions.json';

const seedSuite = seedSuiteRaw as {
  transactions: Array<{
    kind: string;
    account: string;
    date: string;
    amount: number;
    description: string;
    payeeAccount?: string;
  }>;
};

let _db: Database | null = null;
let _initPromise: Promise<Database> | null = null;

export async function getDemoDb(): Promise<Database> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs({
      // Metro bundler will include the wasm file; point to it explicitly if needed
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });

    const db = new SQL.Database();

    // Create schema
    db.run(SCHEMA_SQL);

    const userId = 'user_1';
    const now = new Date().toISOString();

    // Insert user profile
    db.run(
      `INSERT OR IGNORE INTO user_profile (id, timezone, preferences, created_at, updated_at)
       VALUES (?, 'America/New_York', '{}', ?, ?)`,
      [userId, now, now]
    );

    // Insert scotty state
    db.run(
      `INSERT OR IGNORE INTO scotty_state (user_id, happiness, mood, food_credits, growth_level, stamina, updated_at)
       VALUES (?, 72, 'happy', 15, 2, 100, ?)`, /* 'happy' maps to MoodState correctly */
      [userId, now]
    );

    // Insert default budgets
    const budgets = [
      { category: 'Food & Drink', amount: 400 },
      { category: 'Shopping', amount: 200 },
      { category: 'Transportation', amount: 150 },
      { category: 'Entertainment', amount: 100 },
      { category: 'Groceries', amount: 300 },
    ];
    budgets.forEach((b, i) => {
      const daily = Math.round((b.amount / 30) * 100) / 100;
      db.run(
        `INSERT OR IGNORE INTO budget (id, user_id, category, amount, period, frequency, derived_daily_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'monthly', 'Month', ?, ?, ?)`,
        [`budget_${i + 1}`, userId, b.category, b.amount, daily, now, now]
      );
    });

    // Insert goals
    const goals = [
      { id: 'goal_1', name: 'Emergency Fund', target: 5000, saved: 1250 },
      { id: 'goal_2', name: 'New Laptop', target: 1500, saved: 400 },
    ];
    goals.forEach((g) => {
      db.run(
        `INSERT OR IGNORE INTO goal (id, user_id, name, target_amount, saved_so_far, budget_percent, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 10, 'ACTIVE', ?, ?)`,
        [g.id, userId, g.name, g.target, g.saved, now, now]
      );
    });

    // Insert transactions from seed data
    const today = new Date();
    seedSuite.transactions.forEach((seedTx, i) => {
      const { detail, prefix } = splitDescription(seedTx.description || seedTx.kind);
      const merchant = (detail || seedTx.description || seedTx.kind).trim();
      const signedAmount = inferSignedAmount(seedTx.kind, seedTx.amount);
      const category = inferCategory(seedTx.kind, seedTx.description || '');
      const merchantKey = merchant.toLowerCase().trim();

      // Shift seed dates to be relative to today so "recent" data always looks current
      // seed dates are relative offsets from today (newest seed = today - 0..7 days)
      const seedDate = new Date(seedTx.date);
      const referenceDate = new Date('2026-01-24'); // newest seed date
      const offsetMs = referenceDate.getTime() - seedDate.getTime();
      const shiftedDate = new Date(today.getTime() - offsetMs);
      const dateStr = shiftedDate.toISOString().slice(0, 10);

      db.run(
        `INSERT OR IGNORE INTO transaction_ (id, user_id, provider, provider_txn_id, date, amount, currency, name, merchant_name, merchant_key, category_primary, category_detailed, pending, metadata, created_at, updated_at)
         VALUES (?, ?, 'nessie', ?, ?, ?, 'USD', ?, ?, ?, ?, ?, 0, '{}', ?, ?)`,
        [
          `${userId}_seed_${i}`,
          userId,
          `${userId}:seed:${i}`,
          dateStr,
          signedAmount,
          merchant,
          merchant,
          merchantKey,
          category,
          prefix ?? null,
          now,
          now,
        ]
      );
    });

    // Insert demo quests
    const questWindow = new Date();
    questWindow.setHours(0, 0, 0, 0);
    const questEnd = new Date(questWindow);
    questEnd.setHours(23, 59, 59, 999);
    const ws = questWindow.toISOString();
    const we = questEnd.toISOString();

    const quests = [
      {
        id: 'quest_1',
        title: 'Coffee Budget Quest',
        description: 'Keep your coffee spending under $10 today. Brew at home for bonus points!',
        metric_type: 'CATEGORY_SPEND_CAP',
        metric_params: JSON.stringify({ category: 'Food & Drink', cap: 10 }),
        reward_food_type: 'kibble',
        happiness_delta: 5,
        status: 'ACTIVE',
        confirmed_value: 5.75,
      },
      {
        id: 'quest_2',
        title: 'No Impulse Spending',
        description: 'Avoid shopping purchases today. Wait 24 hours before any non-essential purchase.',
        metric_type: 'CATEGORY_SPEND_CAP',
        metric_params: JSON.stringify({ category: 'Shopping', cap: 0 }),
        reward_food_type: 'bone',
        happiness_delta: 8,
        status: 'ACTIVE',
        confirmed_value: 0,
      },
      {
        id: 'quest_3',
        title: 'Savings Transfer',
        description: 'Transfer $50 to your emergency fund today.',
        metric_type: 'TRANSFER_AMOUNT',
        metric_params: JSON.stringify({ target_amount: 50 }),
        reward_food_type: 'steak',
        happiness_delta: 10,
        status: 'COMPLETED_VERIFIED',
        confirmed_value: 50,
      },
    ];

    quests.forEach((q) => {
      db.run(
        `INSERT OR IGNORE INTO quest (id, user_id, status, title, description, window_start, window_end, metric_type, metric_params, reward_food_type, happiness_delta, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?)`,
        [q.id, userId, q.status, q.title, q.description, ws, we, q.metric_type, q.metric_params, q.reward_food_type, q.happiness_delta, now, now]
      );
    });

    // Insert recurring subscriptions
    const recurringItems = [
      { id: 'rc_1', merchant_key: 'netflix', typical_amount: 15.99, cadence: 'monthly' },
      { id: 'rc_2', merchant_key: 'spotify', typical_amount: 9.99, cadence: 'monthly' },
      { id: 'rc_3', merchant_key: 'chatgpt plus', typical_amount: 20.0, cadence: 'monthly' },
    ];
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextDate = nextMonth.toISOString().slice(0, 10);

    recurringItems.forEach((r) => {
      db.run(
        `INSERT OR IGNORE INTO recurring_candidate (id, user_id, merchant_key, typical_amount, cadence, next_expected_date, confidence, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0.95, '{}', ?, ?)`,
        [r.id, userId, r.merchant_key, r.typical_amount, r.cadence, nextDate, now, now]
      );
    });

    // Insert demo insights
    const insights = [
      { id: 'ins_1', title: 'Great Grocery Week!', blurb: "You spent 18% less on groceries this week compared to your monthly average. Keep it up — that's $14 saved!", confidence: 'HIGH' },
      { id: 'ins_2', title: 'Subscription Alert', blurb: 'You have 3 active subscriptions totaling $45.98/month. Consider reviewing Netflix if you haven\'t watched recently.', confidence: 'MEDIUM' },
      { id: 'ins_3', title: 'Dining Out Trending Up', blurb: 'Dining out expenses are 22% higher this week. Cooking at home twice could save you ~$25.', confidence: 'MEDIUM' },
    ];
    const todayStr = today.toISOString().slice(0, 10);
    insights.forEach((ins) => {
      db.run(
        `INSERT OR IGNORE INTO insight (id, user_id, date, title, blurb, confidence, metrics, created_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`,
        [ins.id, userId, todayStr, ins.title, ins.blurb, ins.confidence, now]
      );
    });

    _db = db;
    return db;
  })();

  return _initPromise;
}

// Convenience: run a query returning all rows as plain objects
export function dbAll(db: Database, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, any>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function dbGet(db: Database, sql: string, params: any[] = []): Record<string, any> | null {
  const rows = dbAll(db, sql, params);
  return rows[0] ?? null;
}

export function dbRun(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
}

let _idCounter = 1000;
export function newId(prefix = 'row'): string {
  return `${prefix}_${Date.now()}_${_idCounter++}`;
}
