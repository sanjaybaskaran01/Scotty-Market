/**
 * api.ts — DEMO BRANCH
 *
 * Replaces all HTTP fetch calls with direct in-memory sql.js queries.
 * The public API surface is identical to api.prod.ts so no component code changes.
 *
 * On the production branch this file makes HTTP calls to the Express backend.
 * On the demo branch it calls getDemoDb() and queries sql.js directly.
 */

import {
  Transaction,
  TransactionCategory,
  Achievement,
  ScottyState,
  HealthMetrics,
  DailyInsight,
  FoodType,
  BudgetItem,
  AccountInfo,
  Quest,
  UserProfile,
  ChatAction,
  BudgetProjectionsResponse,
} from '../types';

import { getDemoDb, dbAll, dbGet, dbRun, newId } from './demo-db';
import demoInsights from '../data/demo-insights.json';

const DEFAULT_USER_ID = 'user_1';

// ─── Category Mapping (same as api.prod.ts) ───

const BACKEND_TO_FRONTEND_CATEGORY: Record<string, TransactionCategory> = {
  'Food & Drink': 'food_dining',
  'Food and Drink': 'food_dining',
  Groceries: 'groceries',
  Transportation: 'transport',
  Travel: 'transport',
  Entertainment: 'entertainment',
  Recreation: 'entertainment',
  Shopping: 'shopping',
  Merchandise: 'shopping',
  Subscription: 'subscriptions',
  Service: 'subscriptions',
  Utilities: 'utilities',
  Education: 'education',
  Health: 'health',
  Healthcare: 'health',
  Medical: 'health',
  Transfer: 'other',
  Payment: 'other',
  Other: 'other',
};

function mapCategory(backendCategory: string | null): TransactionCategory {
  if (!backendCategory) return 'other';
  if (BACKEND_TO_FRONTEND_CATEGORY[backendCategory]) {
    return BACKEND_TO_FRONTEND_CATEGORY[backendCategory];
  }
  const lower = backendCategory.toLowerCase();
  for (const [key, value] of Object.entries(BACKEND_TO_FRONTEND_CATEGORY)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return 'other';
}

function mapDbTransaction(row: Record<string, any>): Transaction {
  return {
    id: row.id as string,
    amount: Math.abs(row.amount as number),
    category: mapCategory(row.category_primary as string | null),
    merchant: (row.merchant_name || row.name) as string,
    date: new Date(row.date as string),
    isSubscription: (row.category_primary as string | null)?.toLowerCase().includes('subscription') ?? false,
    isIncoming: (row.amount as number) > 0,
  };
}

// ─── Transactions ───

export async function fetchTransactions(days: number = 30): Promise<Transaction[]> {
  const db = await getDemoDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const rows = dbAll(
    db,
    `SELECT * FROM transaction_ WHERE user_id = ? AND date >= ? ORDER BY date DESC`,
    [DEFAULT_USER_ID, cutoff.toISOString().slice(0, 10)]
  );
  return rows.map(mapDbTransaction);
}

export async function fetchTodaySpend(): Promise<number> {
  const transactions = await fetchTransactions(7);
  const now = new Date();
  return transactions
    .filter((t) => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      const diffMs = now.getTime() - d.getTime();
      return diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000 && !t.isIncoming;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

// ─── Scotty State ───

export async function fetchScottyState(): Promise<ScottyState> {
  const db = await getDemoDb();
  const row = dbGet(db, `SELECT * FROM scotty_state WHERE user_id = ?`, [DEFAULT_USER_ID]);
  if (!row) {
    return { happiness: 70, mood: 'sad', lastFed: null, foodCredits: 10 };
  }
  // Apply happiness decay: -2 per hour since last_fed
  let happiness = row.happiness as number;
  if (row.last_fed) {
    const hoursSinceLastFed = (Date.now() - new Date(row.last_fed as string).getTime()) / 3_600_000;
    happiness = Math.max(0, Math.round(happiness - hoursSinceLastFed * 2));
  }
  const mood = happiness >= 60 ? 'happy' : 'sad';
  return {
    happiness,
    mood: (mood === 'happy' ? 'happy' : 'sad') as ScottyState['mood'],
    lastFed: row.last_fed ? new Date(row.last_fed as string) : null,
    foodCredits: row.food_credits as number,
  };
}

export async function feedScottyAPI(foodType: FoodType): Promise<ScottyState> {
  const db = await getDemoDb();
  const boost = foodType === 'meal' ? 20 : 10;
  const now = new Date().toISOString();
  dbRun(
    db,
    `UPDATE scotty_state SET happiness = MIN(100, happiness + ?), last_fed = ?, food_credits = MAX(0, food_credits - 1), updated_at = ? WHERE user_id = ?`,
    [boost, now, now, DEFAULT_USER_ID]
  );
  return fetchScottyState();
}

export async function setScottyHappiness(happiness: number): Promise<void> {
  const db = await getDemoDb();
  const now = new Date().toISOString();
  dbRun(db, `UPDATE scotty_state SET happiness = ?, updated_at = ? WHERE user_id = ?`, [
    Math.max(0, Math.min(100, happiness)),
    now,
    DEFAULT_USER_ID,
  ]);
}

// ─── Daily Payload ───

export interface DailyPayload {
  insights: Array<{
    id: string;
    title: string;
    blurb: string;
    confidence: string;
    metrics: Record<string, any>;
  }>;
  activeQuest: {
    id: string;
    title: string;
    status: string;
    metric_type: string;
    metric_params: Record<string, any>;
    reward_food_type: string;
    happiness_delta: number;
    window_start: string;
    window_end: string;
  } | null;
  optionalActions: Array<{ id: string; type: string; payload: Record<string, any> }>;
  scottyState: {
    happiness: number;
    mood: string;
    food_credits: number;
    last_reward_food: string | null;
    last_reward_at: string | null;
  };
}

export async function fetchDailyPayload(): Promise<DailyPayload> {
  const db = await getDemoDb();
  const scottyRow = dbGet(db, `SELECT * FROM scotty_state WHERE user_id = ?`, [DEFAULT_USER_ID]);
  const insightRows = dbAll(db, `SELECT * FROM insight WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [
    DEFAULT_USER_ID,
  ]);
  const questRow = dbGet(
    db,
    `SELECT * FROM quest WHERE user_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
    [DEFAULT_USER_ID]
  );

  return {
    insights: insightRows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      blurb: r.blurb as string,
      confidence: r.confidence as string,
      metrics: {},
    })),
    activeQuest: questRow
      ? {
          id: questRow.id as string,
          title: questRow.title as string,
          status: questRow.status as string,
          metric_type: questRow.metric_type as string,
          metric_params: JSON.parse((questRow.metric_params as string) || '{}'),
          reward_food_type: questRow.reward_food_type as string,
          happiness_delta: questRow.happiness_delta as number,
          window_start: questRow.window_start as string,
          window_end: questRow.window_end as string,
        }
      : null,
    optionalActions: [],
    scottyState: {
      happiness: scottyRow?.happiness as number ?? 70,
      mood: scottyRow?.mood as string ?? 'content',
      food_credits: scottyRow?.food_credits as number ?? 10,
      last_reward_food: scottyRow?.last_reward_food as string | null ?? null,
      last_reward_at: scottyRow?.last_reward_at as string | null ?? null,
    },
  };
}

// ─── Health Metrics ───

export async function fetchHealthMetrics(): Promise<HealthMetrics> {
  const db = await getDemoDb();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const budgetRows = dbAll(db, `SELECT * FROM budget WHERE user_id = ?`, [DEFAULT_USER_ID]);
  const txRows = dbAll(
    db,
    `SELECT * FROM transaction_ WHERE user_id = ? AND date >= ? AND amount < 0`,
    [DEFAULT_USER_ID, thirtyDaysAgo.toISOString().slice(0, 10)]
  );

  const totalBudget = budgetRows.reduce((s, b) => s + (b.amount as number), 0);
  const totalSpent = txRows.reduce((s, t) => s + Math.abs(t.amount as number), 0);
  const budgetAdherence = totalBudget > 0 ? Math.round(Math.min(100, (1 - totalSpent / totalBudget) * 100 + 60)) : 70;

  const incomeRows = dbAll(
    db,
    `SELECT SUM(amount) as total FROM transaction_ WHERE user_id = ? AND date >= ? AND amount > 0`,
    [DEFAULT_USER_ID, thirtyDaysAgo.toISOString().slice(0, 10)]
  );
  const totalIncome = (incomeRows[0]?.total as number) || 1;
  const savingsRate = Math.round(Math.min(100, Math.max(0, ((totalIncome - totalSpent) / totalIncome) * 100)));

  const impulseScore = 72;
  const overallScore = Math.round(budgetAdherence * 0.4 + savingsRate * 0.3 + impulseScore * 0.3);

  return { budgetAdherence, savingsRate, impulseScore, overallScore };
}

// ─── User Profile ───

export async function fetchUserProfile(): Promise<UserProfile> {
  const db = await getDemoDb();
  const budgetRows = dbAll(db, `SELECT SUM(amount) as total FROM budget WHERE user_id = ?`, [DEFAULT_USER_ID]);
  const totalBudget = (budgetRows[0]?.total as number) || 1150;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const incomeRows = dbAll(
    db,
    `SELECT COALESCE(SUM(amount), 0) as total FROM transaction_ WHERE user_id = ? AND date >= ? AND amount > 0`,
    [DEFAULT_USER_ID, thirtyDaysAgo.toISOString().slice(0, 10)]
  );
  const spendRows = dbAll(
    db,
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transaction_ WHERE user_id = ? AND date >= ? AND amount < 0`,
    [DEFAULT_USER_ID, thirtyDaysAgo.toISOString().slice(0, 10)]
  );

  const income = (incomeRows[0]?.total as number) || 0;
  const spend = (spendRows[0]?.total as number) || 0;

  return {
    monthlyBudget: totalBudget,
    monthlySavingsGoal: Math.round(totalBudget * 0.2),
    currentBalance: Math.round((income - spend) * 100) / 100,
  };
}

// ─── Budgets ───

export async function fetchBudgets(): Promise<BudgetItem[]> {
  const db = await getDemoDb();
  const rows = dbAll(db, `SELECT * FROM budget WHERE user_id = ?`, [DEFAULT_USER_ID]);
  return rows.map((b) => ({
    id: b.id as string,
    category: b.category as string,
    frequency: (b.frequency as string === 'Day' || b.frequency as string === 'Year'
      ? b.frequency
      : 'Month') as BudgetItem['frequency'],
    limitAmount: b.amount as number,
    derivedDailyLimit: b.derived_daily_limit as number,
    adaptiveEnabled: Boolean(b.adaptive_enabled),
    adaptiveMaxAdjustPct: b.adaptive_max_adjust_pct as number,
    lastAutoAdjustedAt: (b.last_auto_adjusted_at as string | null) ?? null,
    spent: 0,
  }));
}

export async function createBudget(
  category: string,
  limitAmount: number,
  frequency: 'Day' | 'Month' | 'Year' = 'Month',
  adaptiveEnabled: boolean = true,
  adaptiveMaxAdjustPct: number = 10
): Promise<any> {
  const db = await getDemoDb();
  const now = new Date().toISOString();
  const id = newId('budget');
  const daily =
    frequency === 'Day' ? limitAmount : frequency === 'Year' ? limitAmount / 365 : limitAmount / 30;
  dbRun(
    db,
    `INSERT OR REPLACE INTO budget (id, user_id, category, amount, period, frequency, derived_daily_limit, adaptive_enabled, adaptive_max_adjust_pct, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      DEFAULT_USER_ID,
      category,
      limitAmount,
      frequency === 'Day' ? 'daily' : frequency === 'Year' ? 'yearly' : 'monthly',
      frequency,
      Math.round(daily * 100) / 100,
      adaptiveEnabled ? 1 : 0,
      adaptiveMaxAdjustPct,
      now,
      now,
    ]
  );
  return { id, category, limitAmount, frequency };
}

export async function updateBudget(
  budgetId: string,
  updates: {
    category?: string;
    limitAmount?: number;
    frequency?: 'Day' | 'Month' | 'Year';
    adaptiveEnabled?: boolean;
    adaptiveMaxAdjustPct?: number;
  }
): Promise<any> {
  const db = await getDemoDb();
  const now = new Date().toISOString();
  const current = dbGet(db, `SELECT * FROM budget WHERE id = ?`, [budgetId]);
  if (!current) throw new Error(`Budget ${budgetId} not found`);

  const freq = updates.frequency ?? (current.frequency as string);
  const amount = updates.limitAmount ?? (current.amount as number);
  const daily = freq === 'Day' ? amount : freq === 'Year' ? amount / 365 : amount / 30;

  dbRun(
    db,
    `UPDATE budget SET category = ?, amount = ?, frequency = ?, derived_daily_limit = ?, adaptive_enabled = ?, adaptive_max_adjust_pct = ?, updated_at = ? WHERE id = ?`,
    [
      updates.category ?? current.category,
      amount,
      freq,
      Math.round(daily * 100) / 100,
      updates.adaptiveEnabled !== undefined ? (updates.adaptiveEnabled ? 1 : 0) : current.adaptive_enabled,
      updates.adaptiveMaxAdjustPct ?? current.adaptive_max_adjust_pct,
      now,
      budgetId,
    ]
  );
  return { id: budgetId, ...updates };
}

export async function autoAdjustBudgets(): Promise<any> {
  return { adjustments: [], skipped: 0 };
}

// ─── Budget Projections ───

export async function fetchBudgetProjections(): Promise<BudgetProjectionsResponse> {
  const db = await getDemoDb();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const budgets = await fetchBudgets();
  const projections = await Promise.all(
    budgets.map(async (b) => {
      const spentRows = dbAll(
        db,
        `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transaction_
         WHERE user_id = ? AND date >= ? AND amount < 0 AND category_primary = ?`,
        [DEFAULT_USER_ID, monthStart, b.category]
      );
      const spent = (spentRows[0]?.total as number) || 0;
      const dailyRate = spent / today.getDate();
      const projectedSpend = dailyRate * 30;
      const projectedPercent = b.limitAmount > 0 ? (projectedSpend / b.limitAmount) * 100 : 0;
      return {
        category: b.category,
        currentSpent: Math.round(spent * 100) / 100,
        budgetLimit: b.limitAmount,
        projectedSpend: Math.round(projectedSpend * 100) / 100,
        projectedPercent: Math.round(projectedPercent),
        overBudget: projectedSpend > b.limitAmount,
        dailyRate7d: Math.round(dailyRate * 100) / 100,
        dailyRatePeriod: Math.round(dailyRate * 100) / 100,
      };
    })
  );

  const totalDailySpent = projections.reduce((s, p) => s + p.dailyRate7d, 0);
  const totalBudgets = budgets.reduce((s, b) => s + b.derivedDailyLimit, 0);

  return {
    projections,
    dailySummary: {
      totalDailySpent: Math.round(totalDailySpent * 100) / 100,
      totalDailyLimit: Math.round(totalBudgets * 100) / 100,
      projectedDailyPercent: totalBudgets > 0 ? Math.round((totalDailySpent / totalBudgets) * 100) : 0,
    },
  };
}

// ─── Accounts ───

export async function fetchAccounts(): Promise<{ accounts: AccountInfo[]; totalBalance: number }> {
  const profile = await fetchUserProfile();
  return {
    accounts: [
      { id: 'demo_checking', type: 'checking', nickname: 'Primary Checking', balance: profile.currentBalance },
      { id: 'demo_savings', type: 'savings', nickname: 'Emergency Savings', balance: 1250 },
    ],
    totalBalance: Math.round((profile.currentBalance + 1250) * 100) / 100,
  };
}

// ─── Quests ───

function buildQuestDescription(quest: Record<string, any>): string {
  if (quest.description && (quest.description as string).trim().length > 10) return quest.description as string;
  const params = JSON.parse((quest.metric_params as string) || '{}');
  const cap = params.cap || params.target_amount || 0;
  const cat = params.category || '';
  const merchant = params.merchant || params.merchant_key || '';
  switch (quest.metric_type as string) {
    case 'CATEGORY_SPEND_CAP':
      return cap > 0 ? `Keep your ${cat} spending under $${cap.toFixed(2)} today.` : `Watch your ${cat} spending today.`;
    case 'MERCHANT_SPEND_CAP':
      return cap > 0 ? `Limit spending at ${merchant || 'this merchant'} to $${cap.toFixed(2)}.` : `Cut back at ${merchant || 'this merchant'} today.`;
    case 'NO_MERCHANT_CHARGE':
      return `Avoid any purchases at ${merchant || 'this merchant'} today.`;
    case 'TRANSFER_AMOUNT':
      return cap > 0 ? `Transfer $${cap.toFixed(2)} to your savings.` : `Make a savings transfer today.`;
    default:
      return 'Complete this quest to earn rewards!';
  }
}

const QUEST_EMOJI: Record<string, string> = {
  CATEGORY_SPEND_CAP: '🍖',
  MERCHANT_SPEND_CAP: '☕',
  NO_MERCHANT_CHARGE: '🚫',
  TRANSFER_AMOUNT: '💰',
};
const QUEST_COLORS = ['#ffb3ba', '#fff9c4', '#c8e6c9', '#bbdefb', '#e1bee7'];

function mapQuestStatus(s: string): Quest['status'] {
  const u = s.toUpperCase();
  if (u === 'COMPLETED_VERIFIED' || u === 'COMPLETED') return 'completed';
  if (u === 'FAILED' || u === 'EXPIRED') return 'failed';
  return 'active';
}

function mapDbQuest(row: Record<string, any>, index: number): Quest {
  const params = JSON.parse((row.metric_params as string) || '{}');
  const cap = params.cap || params.target_amount || 0;
  return {
    id: row.id as string,
    title: row.title as string,
    subtitle: buildQuestDescription(row),
    emoji: QUEST_EMOJI[row.metric_type as string] || '🎯',
    xpReward: (row.happiness_delta as number) * 5,
    progress: 0,
    goal: cap,
    progressUnit: row.metric_type === 'NO_MERCHANT_CHARGE' ? 'charges' : 'spent',
    bgColor: QUEST_COLORS[index % QUEST_COLORS.length],
    status: mapQuestStatus(row.status as string),
    createdBy: row.created_by as string,
    goalId: (row.goal_id as string | null) ?? undefined,
  };
}

export async function fetchDailyQuests(userId: string = DEFAULT_USER_ID): Promise<Quest[]> {
  const db = await getDemoDb();
  const rows = dbAll(db, `SELECT * FROM quest WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`, [userId]);
  return rows.map(mapDbQuest);
}

export async function refreshDailyQuests(userId: string = DEFAULT_USER_ID): Promise<Quest[]> {
  return fetchDailyQuests(userId);
}

export async function fetchActiveQuest(): Promise<Achievement | null> {
  const db = await getDemoDb();
  const row = dbGet(
    db,
    `SELECT * FROM quest WHERE user_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
    [DEFAULT_USER_ID]
  );
  if (!row) return null;
  const params = JSON.parse((row.metric_params as string) || '{}');
  return {
    id: row.id as string,
    title: row.title as string,
    description: buildQuestDescription(row),
    targetAmount: params.cap || params.target_amount,
    currentAmount: 0,
    completed: false,
    category: mapCategory(params.category ?? null),
    aiGenerated: row.created_by === 'agent',
  };
}

// ─── Chat ───

let _insightIndex = 0;

export async function sendChatMessageAPI(
  message: string
): Promise<{ response: string; actions: ChatAction[] }> {
  const lc = message.toLowerCase();

  let response: string;
  if (lc.includes('budget')) {
    response =
      "I've been watching your budgets closely! Your Food & Drink budget is at 67% for the month — still on track, but watch out for weekend dining. Want me to suggest a daily limit?";
  } else if (lc.includes('spend') || lc.includes('transaction')) {
    response =
      "Your biggest spending categories this week are Dining ($42) and Subscriptions ($46). You're doing great on transportation though — 30% under budget!";
  } else if (lc.includes('save') || lc.includes('goal')) {
    response =
      "You're making great progress on your Emergency Fund goal! At your current pace you'll hit $5,000 in about 3 months. Keep it up 🐱";
  } else if (lc.includes('scotty') || lc.includes('wynter') || lc.includes('pet')) {
    response =
      "Wynter is feeling pretty happy today! She got fed this morning and loves that you stayed under budget yesterday. Keep up the good work and she'll be thriving!";
  } else {
    const insight = demoInsights[_insightIndex % demoInsights.length];
    _insightIndex++;
    response = insight.blurb;
  }

  return { response, actions: [] };
}

export async function fetchChatSuggestedActions(): Promise<ChatAction[]> {
  return [
    { id: 'ca_1', label: 'How is my budget?', icon: 'wallet', category: 'budget', prompt: 'How am I doing on my budgets this month?' },
    { id: 'ca_2', label: 'Show spending trends', icon: 'chart', category: 'spending', prompt: 'What are my spending trends?' },
    { id: 'ca_3', label: 'Check savings goal', icon: 'savings', category: 'goal', prompt: 'How close am I to my savings goal?' },
  ];
}

// ─── Insights (mapped to DailyInsight) ───

export function mapInsightToFrontend(
  insight: { id: string; title: string; blurb: string; confidence: string; metrics: Record<string, any> }
): DailyInsight {
  const type: DailyInsight['type'] =
    insight.confidence === 'HIGH' ? 'positive' : insight.confidence === 'LOW' ? 'warning' : 'neutral';
  return { id: insight.id, message: insight.blurb, type, date: new Date() };
}

// ─── Subscriptions ───

export async function fetchSubscriptions(): Promise<
  Array<{ merchant: string; amount: number; nextDate: string; cadence: string }>
> {
  const db = await getDemoDb();
  const rows = dbAll(db, `SELECT * FROM recurring_candidate WHERE user_id = ?`, [DEFAULT_USER_ID]);
  return rows.map((r) => ({
    merchant: r.merchant_key as string,
    amount: r.typical_amount as number,
    nextDate: r.next_expected_date as string,
    cadence: r.cadence as string,
  }));
}

export interface UpcomingBillsData {
  subscriptions: Array<{
    merchant_key: string;
    typical_amount: number;
    next_expected_date: string;
    cadence: string;
  }>;
  bill_days: number[];
  due_today: Array<{
    merchant_key: string;
    typical_amount: number;
    next_expected_date: string;
  }>;
}

export async function fetchUpcomingBills(): Promise<UpcomingBillsData> {
  const db = await getDemoDb();
  const rows = dbAll(db, `SELECT * FROM recurring_candidate WHERE user_id = ?`, [DEFAULT_USER_ID]);
  const today = new Date().getDate();
  return {
    subscriptions: rows.map((r) => ({
      merchant_key: r.merchant_key,
      typical_amount: r.typical_amount,
      next_expected_date: r.next_expected_date,
      cadence: r.cadence,
    })),
    bill_days: [today + 3, today + 7, today + 15].map((d) => Math.min(d, 28)),
    due_today: [] as any[],
  };
}

// ─── Spending Trends ───

export async function fetchSpendingTrend(): Promise<{ months: string[]; totals: number[] }> {
  const db = await getDemoDb();
  const months: string[] = [];
  const totals: number[] = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStart = d.toISOString().slice(0, 7) + '-01';
    const nextMonthStart = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 7) + '-01';
    const label = d.toLocaleString('default', { month: 'short' });
    const rows = dbAll(
      db,
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transaction_ WHERE user_id = ? AND date >= ? AND date < ? AND amount < 0`,
      [DEFAULT_USER_ID, monthStart, nextMonthStart]
    );
    months.push(label);
    totals.push(Math.round(((rows[0]?.total as number) || 0) * 100) / 100);
  }

  return { months, totals };
}

// ─── Goals ───

export interface GoalData {
  id: string;
  name: string;
  target_amount: number;
  saved_so_far: number;
  deadline: string | null;
  budget_percent: number;
  status: string;
  created_at: string;
}

export async function fetchGoals(): Promise<GoalData[]> {
  const db = await getDemoDb();
  const rows = dbAll(db, `SELECT * FROM goal WHERE user_id = ? AND status = 'ACTIVE' ORDER BY created_at`, [
    DEFAULT_USER_ID,
  ]);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    target_amount: r.target_amount as number,
    saved_so_far: r.saved_so_far as number,
    deadline: (r.deadline as string | null) ?? null,
    budget_percent: r.budget_percent as number,
    status: r.status as string,
    created_at: r.created_at as string,
  }));
}

export async function createGoal(
  name: string,
  targetAmount: number,
  deadline?: string,
  savedSoFar?: number,
  budgetPercent?: number
): Promise<GoalData> {
  const db = await getDemoDb();
  const now = new Date().toISOString();
  const id = newId('goal');
  dbRun(
    db,
    `INSERT INTO goal (id, user_id, name, target_amount, saved_so_far, deadline, budget_percent, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [id, DEFAULT_USER_ID, name, targetAmount, savedSoFar ?? 0, deadline ?? null, budgetPercent ?? 10, now, now]
  );
  return {
    id,
    name,
    target_amount: targetAmount,
    saved_so_far: savedSoFar ?? 0,
    deadline: deadline ?? null,
    budget_percent: budgetPercent ?? 10,
    status: 'ACTIVE',
    created_at: now,
  };
}

// ─── Budget Generation (stub) ───

export async function generateBudgets(apply: boolean = true): Promise<any> {
  const budgets = await fetchBudgets();
  return {
    budgets: budgets.map((b) => ({
      category: b.category,
      limit_amount: b.limitAmount,
      frequency: b.frequency,
      reasoning: 'Based on your spending history',
    })),
    applied: apply,
  };
}

// ─── Admin / seed stubs ───

export async function seedNessieDemo(): Promise<void> {}
export async function runFullSeed(): Promise<void> {}
export async function checkBackendHealth(): Promise<boolean> {
  return true;
}

// ─── BudgetProgress export ───

export interface BudgetProgress {
  category: string;
  amount: number;
  spent: number;
  period: 'monthly' | 'weekly' | string;
}
