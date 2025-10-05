/**
 * Serialization / DTO mapping utilities.
 * Transforms raw DB row objects (snake_case) into API response shapes (camelCase)
 * and computes any derived fields required by contract/integration tests.
 */

// Shared small helpers
function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function camelCaseObject<T extends Record<string, any>>(row: T): any {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    out[toCamelCaseKey(k)] = row[k];
  }
  return out;
}

// ---------- User ----------
export interface UserDTO {
  id: number;
  name: string;
  role?: string; // admin in tests
  isAdmin?: boolean; // alt flag for verify endpoint
}

export function serializeUser(row: any): UserDTO {
  if (!row) return row;
  const base = camelCaseObject(row);
  // If role present, derive isAdmin; if admin flag present derive role
  if (base.role && base.role === 'admin') {
    base.isAdmin = true;
  } else if (base.isAdmin && base.isAdmin === true && !base.role) {
    base.role = 'admin';
  }
  return base;
}

// ---------- Expense & Splits ----------
export interface ExpenseSplitDTO {
  userId: number;
  amount: number; // already 2-decimal number
  percentage?: number; // computed if total available
}

export interface ExpenseDTO {
  id: number;
  groupId: number;
  amount: number;
  description: string;
  paidBy: number; // user id
  splits?: ExpenseSplitDTO[];
  createdAt?: string;
}

/**
 * Map raw expense row + splits to DTO adding percentage with two decimals (33.33) per tests.
 */
export function serializeExpense(expense: any, splits?: any[]): ExpenseDTO {
  const base = camelCaseObject(expense);
  const dto: ExpenseDTO = {
    id: base.id,
    groupId: base.groupId ?? base.group_id,
    amount: Number(Number(base.amount).toFixed(2)),
    description: base.description,
    paidBy: base.paidBy ?? base.paid_by,
    createdAt: base.createdAt || (base.created_at ? new Date(base.created_at).toISOString() : undefined),
  };
  // Add legacy snake_case duplicates for backward compatibility
  (dto as any).group_id = dto.groupId;
  (dto as any).paid_by = dto.paidBy;
  if (splits && splits.length) {
      const total = splits.reduce((acc, s) => acc + Number(s.amount), 0) || 0;
      // NOTE: Removed unused pre-distribution equal percentage calculation. We now derive the
      // percentage strictly from actual share amounts to avoid mismatch / dead code.
      dto.splits = splits.map((s) => {
        const obj: any = {
          userId: s.user_id ?? s.userId,
          amount: Number(Number(s.amount).toFixed(2)),
          percentage: total > 0 ? Number(((Number(s.amount) / total) * 100).toFixed(2)) : undefined,
        };
        // legacy fields
        obj.expense_id = s.expense_id ?? dto.id;
        obj.user_id = s.user_id ?? s.userId;
        return obj;
      });
  }
  return dto;
}

// ---------- Balance ----------
export interface UserBalanceDTO {
  userId: number;
  userName: string;
  owes: Record<string, number>; // maps userId -> amount they owe to that user
  owed: Record<string, number>; // maps userId -> amount owed by others
  balance: number; // net
}

export interface GroupBalancesDTO {
  groupId: number;
  balances: UserBalanceDTO[];
  settlements: any[]; // placeholder until settlement algorithm added
}

/**
 * Convert internal arrays (if produced) to map objects; caller provides arrays for owes/owed.
 */
export function serializeGroupBalances(groupId: number, raw: Array<{
  userId: number; userName: string; balance: number; owes?: Array<{ userId: number; amount: number }>; owed?: Array<{ userId: number; amount: number }>
}>): GroupBalancesDTO {
  return {
    groupId,
    balances: raw.map(r => ({
      userId: r.userId,
      userName: r.userName,
      balance: Number(Number(r.balance).toFixed(2)),
      owes: (r.owes || []).reduce((m, it) => { m[it.userId] = Number(Number(it.amount).toFixed(2)); return m; }, {} as Record<string, number>),
      owed: (r.owed || []).reduce((m, it) => { m[it.userId] = Number(Number(it.amount).toFixed(2)); return m; }, {} as Record<string, number>),
    })),
    settlements: [],
  };
}

// ---------- Activity ----------
export interface ActivityDTO {
  id: number;
  type: string; // e.g., expense_created
  description?: string;
  userId?: number;
  userName?: string;
  groupId?: number;
  groupName?: string;
  expenseId?: number;
  expenseDescription?: string;
  amount?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Basic activity serializer – currently DB only stores generic fields. We'll map action/entity to a simple type key.
 * Can be extended when richer activity metadata is persisted.
 */
export function serializeActivity(row: any): ActivityDTO {
  const base = camelCaseObject(row);
  let parsedDetails: any = undefined;
  if (base.details) {
    try { parsedDetails = typeof base.details === 'string' ? JSON.parse(base.details) : base.details; } catch { parsedDetails = { raw: base.details }; }
  }
  const type = deriveActivityType(base.action, base.entityType || base.entity_type, parsedDetails);

  const dto: ActivityDTO = {
    id: base.id,
    type,
    description: buildActivityDescription(type, parsedDetails),
    timestamp: base.createdAt || (base.created_at ? new Date(base.created_at).toISOString() : new Date().toISOString()),
    metadata: parsedDetails || {},
  };
  // Fallback: if no structured description produced and original details looked like plain text
  if (!dto.description && parsedDetails && parsedDetails.raw) {
    dto.description = parsedDetails.raw;
  }

  // Flatten commonly expected fields from metadata
  if (parsedDetails) {
    // Allowlist of metadata keys we consider safe to surface / flatten
    const ALLOWED_FLATTEN: Record<string, (val: any) => any> = {
      userId: v => v,
      userName: v => v,
      groupId: v => v,
      groupName: v => v,
      expenseId: v => v,
      description: v => v, // used to derive expenseDescription
      amount: v => Number(Number(v).toFixed(2)),
      addedUserId: v => v,
      addedUserName: v => v,
      removedUserId: v => v,
      removedUserName: v => v,
      paidBy: v => v,
      paidByName: v => v,
    };

    // Flatten with precedence rules similar to previous logic but constrained to allowlist
    for (const key of Object.keys(ALLOWED_FLATTEN)) {
      if (parsedDetails[key] !== undefined) {
        const value = ALLOWED_FLATTEN[key](parsedDetails[key]);
        switch (key) {
          case 'userId': dto.userId = value; break;
          case 'userName': dto.userName = value; break;
          case 'groupId': dto.groupId = value; break;
          case 'groupName': dto.groupName = value; break;
          case 'expenseId': dto.expenseId = value; break;
          case 'description': dto.expenseDescription = value; break;
          case 'amount': dto.amount = value; break;
          case 'addedUserId': dto.userId = value; break;
          case 'addedUserName': dto.userName = value; break;
          case 'removedUserId': dto.userId = value; break;
          case 'removedUserName': dto.userName = value; break;
          case 'paidBy': dto.userId = value; break;
          case 'paidByName': dto.userName = value; break;
        }
      }
    }

    // Sanitize metadata: retain only allowed keys so we don't leak future internal fields
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(ALLOWED_FLATTEN)) {
      if (parsedDetails[key] !== undefined) sanitized[key] = parsedDetails[key];
    }
    dto.metadata = sanitized;
  }
  return dto;
}

function deriveActivityType(action: string, entityType: string, details?: any): string {
  // Normalize values
  const act = (action || '').toLowerCase();
  const ent = (entityType || '').toLowerCase();
  // Map to past-tense style expected by tests
  const actionMap: Record<string, string> = {
    create: 'created',
    update: 'updated',
    delete: 'deleted',
  };
  const base = actionMap[act] || act || 'event';

  if (ent === 'group' && details) {
    if (details.addedUserId) return 'group_member_added';
    if (details.removedUserId) return 'group_member_removed';
  }
  return `${ent}_${base}`;
}

function buildActivityDescription(type: string, details?: any): string | undefined {
  if (!details) return undefined;
  if (type.startsWith('expense_') && details.description) {
    // Provide verb phrase (Created/Updated/Deleted) expense: <desc>
    const verb = capitalize(type.replace('expense_', '').replace('_', ' '));
    return `${verb} expense: ${details.description}`;
  }
  if (type === 'group_member_added' && details.addedUserId) return 'Added group member';
  if (type === 'group_member_removed' && details.removedUserId) return 'Removed group member';
  if (type === 'group_created' && details.groupName) return `Created group: ${details.groupName}`;
  if (type === 'group_deleted' && details.groupId) return 'Deleted group';
  if (type === 'user_created' && details.userName) return `Created user: ${details.userName}`;
  if (type === 'user_deleted' && details.userId) return 'Deleted user';
  return undefined;
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function serializeActivities(rows: any[]): ActivityDTO[] {
  return rows.map(serializeActivity);
}

// Wrapper helper for activity endpoint
export function wrapActivities(rows: any[]) {
  return { activities: serializeActivities(rows) };
}

// ---------- Exports (aggregate) ----------
export const serializers = {
  serializeUser,
  serializeExpense,
  serializeGroupBalances,
  serializeActivity,
  serializeActivities,
  wrapActivities,
};
