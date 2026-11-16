import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CashbackSettings,
  ClaimStatus,
  CustomerBenefitType,
  CustomerMaster,
  DisbursementCancelRequest,
  Invoice,
  PayoutMethod,
} from '../types/cashback';

// Normalize API URL (supports both https://xxx.supabase.co and https://xxx.supabase.co/rest/v1/)
function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const DEFAULT_SUPABASE_URL = 'https://mtfnpbqkcgfddgwkqsrp.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Zm5wYnFrY2dmZGRnd2txc3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMDM2MTIsImV4cCI6MjEwOTc3OTYxMn0.2lDFTRG56LCiPPoNVTwohjvQe5iBCQjUkk6soyBna6c';

export const SUPABASE_URL = normalizeSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
);
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1/`;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Table Names
export const INVOICES_TABLE = 'invoices';
export const CUSTOMERS_TABLE = 'customers';
export const SETTINGS_TABLE = 'settings';
export const CANCEL_REQUESTS_TABLE = 'cancel_requests';
export const SYSTEM_INFO_TABLE = 'system_info';

export const MAIN_SETTINGS_ROW_ID = 'current_settings';
export const SYSTEM_INFO_ROW_ID = 'database_info';

export type SupabaseTableName =
  | typeof INVOICES_TABLE
  | typeof CUSTOMERS_TABLE
  | typeof SETTINGS_TABLE
  | typeof CANCEL_REQUESTS_TABLE
  | typeof SYSTEM_INFO_TABLE;

export const ALL_SUPABASE_TABLES: SupabaseTableName[] = [
  INVOICES_TABLE,
  CUSTOMERS_TABLE,
  SETTINGS_TABLE,
  CANCEL_REQUESTS_TABLE,
  SYSTEM_INFO_TABLE,
];

// -------------------------------------------------------------
// SQL Setup Script for Supabase SQL Editor (Copy-Paste Ready)
// -------------------------------------------------------------
export const SUPABASE_SETUP_SQL = `-- ============================================================
-- CashbackPro - Script Setup Tabel & Realtime Database Supabase
-- Jalankan script ini di Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- 1. Tabel: invoices (Rekap Faktur & Bukti Pencairan)
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT,
  category TEXT NOT NULL DEFAULT 'Umum',
  items_description TEXT,
  purchase_amount NUMERIC NOT NULL DEFAULT 0,
  cashback_percentage NUMERIC NOT NULL DEFAULT 0,
  cashback_amount NUMERIC NOT NULL DEFAULT 0,
  claim_status TEXT NOT NULL DEFAULT 'pending',
  payout_method TEXT NOT NULL DEFAULT 'transfer_bank',
  disbursed_date TEXT,
  disbursed_at TEXT,
  recipient_name TEXT,
  disbursed_by TEXT,
  disbursement_proof_photo TEXT,
  disbursement_signature TEXT,
  disbursement_notes TEXT,
  notes TEXT,
  get_parcel BOOLEAN DEFAULT TRUE,
  benefit_type TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices (date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON public.invoices (customer_name);
CREATE INDEX IF NOT EXISTS idx_invoices_claim_status ON public.invoices (claim_status);

-- 2. Tabel: customers (Master Data Konsumen)
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  customer_code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  address TEXT,
  city TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  e_wallet_type TEXT,
  e_wallet_number TEXT,
  preferred_payout_method TEXT,
  notes TEXT,
  joined_date TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers (customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);

-- 3. Tabel: settings (Aturan Cashback, Profil Perusahaan & PIN Admin)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'flat',
  flat_percentage NUMERIC NOT NULL DEFAULT 2,
  tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_purchase_amount NUMERIC NOT NULL DEFAULT 0,
  max_cashback_per_transaction NUMERIC,
  rounding TEXT NOT NULL DEFAULT 'exact',
  claim_validity_days INTEGER NOT NULL DEFAULT 30,
  store_name TEXT NOT NULL DEFAULT 'CashbackPro',
  currency TEXT NOT NULL DEFAULT 'IDR',
  min_spend_for_parcel NUMERIC DEFAULT 5000000,
  excluded_customer_names JSONB DEFAULT '[]'::jsonb,
  customer_benefit_overrides JSONB DEFAULT '{}'::jsonb,
  company_profile JSONB,
  admin_pin TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabel: cancel_requests (Pengajuan Pembatalan Pencairan Petugas -> ACC Admin)
CREATE TABLE IF NOT EXISTS public.cancel_requests (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_code TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  admin_note TEXT,
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cancel_requests_status ON public.cancel_requests (status);

-- 5. Tabel: system_info (Metadata & Status Sinkronisasi Aplikasi)
CREATE TABLE IF NOT EXISTS public.system_info (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'CashbackPro Rekapitulasi',
  version TEXT NOT NULL DEFAULT '2.0',
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. Aktifkan Row Level Security (RLS) & Kebijakan Akses Aplikasi
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access invoices" ON public.invoices;
CREATE POLICY "Allow full access invoices" ON public.invoices
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access customers" ON public.customers;
CREATE POLICY "Allow full access customers" ON public.customers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access settings" ON public.settings;
CREATE POLICY "Allow full access settings" ON public.settings
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access cancel_requests" ON public.cancel_requests;
CREATE POLICY "Allow full access cancel_requests" ON public.cancel_requests
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access system_info" ON public.system_info;
CREATE POLICY "Allow full access system_info" ON public.system_info
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Aktifkan Sinkronisasi Realtime Multi-Perangkat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cancel_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cancel_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_info') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_info;
  END IF;
END $$;`;

// -------------------------------------------------------------
// Row <-> Domain Mappers
// -------------------------------------------------------------
function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function mapInvoiceToRow(inv: Invoice): Record<string, any> {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    date: inv.date,
    customer_name: inv.customerName,
    customer_phone: inv.customerPhone || '',
    customer_email: inv.customerEmail ?? null,
    category: inv.category || 'Umum',
    items_description: inv.itemsDescription ?? null,
    purchase_amount: Number(inv.purchaseAmount || 0),
    cashback_percentage: Number(inv.cashbackPercentage || 0),
    cashback_amount: Number(inv.cashbackAmount || 0),
    claim_status: inv.claimStatus,
    payout_method: inv.payoutMethod,
    disbursed_date: inv.disbursedDate ?? null,
    disbursed_at: inv.disbursedAt ?? null,
    recipient_name: inv.recipientName ?? null,
    disbursed_by: inv.disbursedBy ?? null,
    disbursement_proof_photo: inv.disbursementProofPhoto ?? null,
    disbursement_signature: inv.disbursementSignature ?? null,
    disbursement_notes: inv.disbursementNotes ?? null,
    notes: inv.notes ?? null,
    get_parcel: inv.getParcel ?? true,
    benefit_type: inv.benefitType ?? null,
    created_at: inv.createdAt || new Date().toISOString(),
  };
}

function mapRowToInvoice(row: Record<string, any>): Invoice {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number ?? ''),
    date: String(row.date ?? ''),
    customerName: String(row.customer_name ?? ''),
    customerPhone: String(row.customer_phone ?? ''),
    customerEmail: row.customer_email ?? undefined,
    category: String(row.category ?? 'Umum'),
    itemsDescription: row.items_description ?? undefined,
    purchaseAmount: Number(row.purchase_amount ?? 0),
    cashbackPercentage: Number(row.cashback_percentage ?? 0),
    cashbackAmount: Number(row.cashback_amount ?? 0),
    claimStatus: (row.claim_status || 'pending') as ClaimStatus,
    payoutMethod: (row.payout_method || 'transfer_bank') as PayoutMethod,
    disbursedDate: row.disbursed_date ?? undefined,
    disbursedAt: row.disbursed_at ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    disbursedBy: row.disbursed_by ?? undefined,
    disbursementProofPhoto: row.disbursement_proof_photo ?? undefined,
    disbursementSignature: row.disbursement_signature ?? undefined,
    disbursementNotes: row.disbursement_notes ?? undefined,
    notes: row.notes ?? undefined,
    getParcel: row.get_parcel === null || row.get_parcel === undefined ? undefined : Boolean(row.get_parcel),
    benefitType: (row.benefit_type ?? undefined) as CustomerBenefitType | undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapCustomerToRow(cust: CustomerMaster): Record<string, any> {
  return {
    id: cust.id,
    customer_code: cust.customerCode,
    name: cust.name,
    phone: cust.phone || '',
    email: cust.email ?? null,
    address: cust.address ?? null,
    city: cust.city ?? null,
    bank_name: cust.bankName ?? null,
    bank_account_number: cust.bankAccountNumber ?? null,
    bank_account_holder: cust.bankAccountHolder ?? null,
    e_wallet_type: cust.eWalletType ?? null,
    e_wallet_number: cust.eWalletNumber ?? null,
    preferred_payout_method: cust.preferredPayoutMethod ?? null,
    notes: cust.notes ?? null,
    joined_date: cust.joinedDate || new Date().toISOString().split('T')[0],
    is_active: cust.isActive ?? true,
  };
}

function mapRowToCustomer(row: Record<string, any>): CustomerMaster {
  return {
    id: String(row.id),
    customerCode: String(row.customer_code ?? ''),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    bankName: row.bank_name ?? undefined,
    bankAccountNumber: row.bank_account_number ?? undefined,
    bankAccountHolder: row.bank_account_holder ?? undefined,
    eWalletType: row.e_wallet_type ?? undefined,
    eWalletNumber: row.e_wallet_number ?? undefined,
    preferredPayoutMethod: (row.preferred_payout_method ?? undefined) as PayoutMethod | undefined,
    notes: row.notes ?? undefined,
    joinedDate: String(row.joined_date ?? ''),
    isActive: row.is_active === null || row.is_active === undefined ? true : Boolean(row.is_active),
  };
}

function mapSettingsToRow(s: CashbackSettings): Record<string, any> {
  return {
    id: MAIN_SETTINGS_ROW_ID,
    mode: s.mode,
    flat_percentage: Number(s.flatPercentage ?? 2),
    tiers: Array.isArray(s.tiers) ? s.tiers : [],
    min_purchase_amount: Number(s.minPurchaseAmount ?? 0),
    max_cashback_per_transaction:
      s.maxCashbackPerTransaction === null || s.maxCashbackPerTransaction === undefined
        ? null
        : Number(s.maxCashbackPerTransaction),
    rounding: s.rounding || 'exact',
    claim_validity_days: Number(s.claimValidityDays ?? 30),
    store_name: s.storeName || 'CashbackPro',
    currency: s.currency || 'IDR',
    min_spend_for_parcel:
      s.minSpendForParcel === null || s.minSpendForParcel === undefined
        ? 5000000
        : Number(s.minSpendForParcel),
    excluded_customer_names: Array.isArray(s.excludedCustomerNames) ? s.excludedCustomerNames : [],
    customer_benefit_overrides: s.customerBenefitOverrides || {},
    company_profile: s.companyProfile ?? null,
    admin_pin: s.adminPin ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapRowToSettings(row: Record<string, any>): CashbackSettings {
  return {
    mode: row.mode === 'tiered' ? 'tiered' : 'flat',
    flatPercentage: Number(row.flat_percentage ?? 2),
    tiers: Array.isArray(row.tiers) ? row.tiers : [],
    minPurchaseAmount: Number(row.min_purchase_amount ?? 0),
    maxCashbackPerTransaction:
      row.max_cashback_per_transaction === null || row.max_cashback_per_transaction === undefined
        ? null
        : Number(row.max_cashback_per_transaction),
    rounding: row.rounding || 'exact',
    claimValidityDays: Number(row.claim_validity_days ?? 30),
    storeName: String(row.store_name ?? 'CashbackPro'),
    currency: String(row.currency ?? 'IDR'),
    minSpendForParcel:
      row.min_spend_for_parcel === null || row.min_spend_for_parcel === undefined
        ? 5000000
        : Number(row.min_spend_for_parcel),
    excludedCustomerNames: Array.isArray(row.excluded_customer_names)
      ? row.excluded_customer_names
      : [],
    customerBenefitOverrides:
      row.customer_benefit_overrides && typeof row.customer_benefit_overrides === 'object'
        ? row.customer_benefit_overrides
        : {},
    companyProfile: row.company_profile ?? undefined,
    adminPin: row.admin_pin ?? undefined,
  };
}

function mapCancelRequestToRow(req: DisbursementCancelRequest): Record<string, any> {
  return {
    id: req.id,
    customer_name: req.customerName,
    customer_code: req.customerCode ?? null,
    amount: Number(req.amount ?? 0),
    requested_by: req.requestedBy,
    reason: req.reason,
    status: req.status,
    requested_at: req.requestedAt,
    reviewed_at: req.reviewedAt ?? null,
    reviewed_by: req.reviewedBy ?? null,
    admin_note: req.adminNote ?? null,
    executed_at: req.executedAt ?? null,
  };
}

function mapRowToCancelRequest(row: Record<string, any>): DisbursementCancelRequest {
  return {
    id: String(row.id),
    customerName: String(row.customer_name ?? ''),
    customerCode: row.customer_code ?? undefined,
    amount: Number(row.amount ?? 0),
    requestedBy: String(row.requested_by ?? ''),
    reason: String(row.reason ?? ''),
    status: row.status || 'pending',
    requestedAt: String(row.requested_at ?? ''),
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    adminNote: row.admin_note ?? undefined,
    executedAt: row.executed_at ?? undefined,
  };
}

// -------------------------------------------------------------
// Connection & Table Readiness Check
// -------------------------------------------------------------
export interface SupabaseConnectionStatus {
  connected: boolean;
  tablesReady: boolean;
  tableStatus: Record<SupabaseTableName, boolean>;
  missingTables: SupabaseTableName[];
  errorMessage?: string;
}

export async function checkSupabaseStatus(): Promise<SupabaseConnectionStatus> {
  const tableStatus: Record<SupabaseTableName, boolean> = {
    invoices: false,
    customers: false,
    settings: false,
    cancel_requests: false,
    system_info: false,
  };

  let networkError: string | undefined;
  let reachedServer = false;

  await Promise.all(
    ALL_SUPABASE_TABLES.map(async (tableName) => {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true });
        if (!error) {
          tableStatus[tableName] = true;
          reachedServer = true;
        } else if (isMissingTableError(error)) {
          tableStatus[tableName] = false;
          reachedServer = true;
        } else {
          // Other server/RLS error still proves server reachable
          tableStatus[tableName] = false;
          reachedServer = true;
          networkError = error.message;
        }
      } catch (err: any) {
        networkError = err?.message || 'Gagal menjangkau server Supabase';
      }
    })
  );

  const missingTables = ALL_SUPABASE_TABLES.filter((t) => !tableStatus[t]);
  const tablesReady = missingTables.length === 0;

  return {
    connected: reachedServer,
    tablesReady,
    tableStatus,
    missingTables,
    errorMessage: networkError,
  };
}

export async function testSupabaseConnection(): Promise<boolean> {
  const status = await checkSupabaseStatus();
  return status.connected && status.tablesReady;
}

// -------------------------------------------------------------
// Initial Sync (Upload local data if Supabase tables are empty)
// -------------------------------------------------------------
export interface SupabaseSyncInitResult {
  success: boolean;
  needsSqlSetup: boolean;
  seededTables: string[];
  existingTables: string[];
  missingTables: SupabaseTableName[];
  totalInvoicesInCloud: number;
  totalCustomersInCloud: number;
}

export async function ensureSupabaseTablesSynced(
  initialInvoices: Invoice[],
  initialCustomers: CustomerMaster[],
  defaultSettings: CashbackSettings,
  initialCancelRequests: DisbursementCancelRequest[] = []
): Promise<SupabaseSyncInitResult> {
  const status = await checkSupabaseStatus();
  if (!status.connected || !status.tablesReady) {
    return {
      success: false,
      needsSqlSetup: status.connected && !status.tablesReady,
      seededTables: [],
      existingTables: ALL_SUPABASE_TABLES.filter((t) => status.tableStatus[t]),
      missingTables: status.missingTables,
      totalInvoicesInCloud: 0,
      totalCustomersInCloud: 0,
    };
  }

  const seededTables: string[] = [];
  const existingTables: string[] = [];
  let totalInvoices = 0;
  let totalCustomers = 0;

  try {
    // 1. settings
    const { data: settingsRow } = await supabase
      .from(SETTINGS_TABLE)
      .select('id')
      .eq('id', MAIN_SETTINGS_ROW_ID)
      .maybeSingle();

    if (!settingsRow) {
      await saveSettingsToSupabase(defaultSettings);
      seededTables.push(SETTINGS_TABLE);
    } else {
      existingTables.push(SETTINGS_TABLE);
    }

    // 2. customers
    const { count: custCount } = await supabase
      .from(CUSTOMERS_TABLE)
      .select('id', { count: 'exact', head: true });
    totalCustomers = custCount || 0;
    if (totalCustomers === 0 && initialCustomers.length > 0) {
      await batchUpdateCustomersInSupabase(initialCustomers);
      totalCustomers = initialCustomers.length;
      seededTables.push(CUSTOMERS_TABLE);
    } else {
      existingTables.push(CUSTOMERS_TABLE);
    }

    // 3. invoices
    const { count: invCount } = await supabase
      .from(INVOICES_TABLE)
      .select('id', { count: 'exact', head: true });
    totalInvoices = invCount || 0;
    if (totalInvoices === 0 && initialInvoices.length > 0) {
      await batchUpdateInvoicesInSupabase(initialInvoices);
      totalInvoices = initialInvoices.length;
      seededTables.push(INVOICES_TABLE);
    } else {
      existingTables.push(INVOICES_TABLE);
    }

    // 4. cancel_requests
    const { count: cancelCount } = await supabase
      .from(CANCEL_REQUESTS_TABLE)
      .select('id', { count: 'exact', head: true });
    if ((cancelCount || 0) === 0 && initialCancelRequests.length > 0) {
      await batchUpdateCancelRequestsInSupabase(initialCancelRequests);
      seededTables.push(CANCEL_REQUESTS_TABLE);
    } else {
      existingTables.push(CANCEL_REQUESTS_TABLE);
    }

    // 5. system_info
    const { data: sysRow } = await supabase
      .from(SYSTEM_INFO_TABLE)
      .select('id')
      .eq('id', SYSTEM_INFO_ROW_ID)
      .maybeSingle();
    if (!sysRow) {
      await supabase.from(SYSTEM_INFO_TABLE).upsert({
        id: SYSTEM_INFO_ROW_ID,
        app_name: 'CashbackPro Rekapitulasi',
        version: '2.0',
        status: 'active',
        last_sync_at: new Date().toISOString(),
        metadata: {
          supabaseUrl: SUPABASE_URL,
          tables: ALL_SUPABASE_TABLES,
        },
      });
      seededTables.push(SYSTEM_INFO_TABLE);
    } else {
      existingTables.push(SYSTEM_INFO_TABLE);
    }

    return {
      success: true,
      needsSqlSetup: false,
      seededTables,
      existingTables,
      missingTables: [],
      totalInvoicesInCloud: totalInvoices,
      totalCustomersInCloud: totalCustomers,
    };
  } catch (err) {
    console.error('ensureSupabaseTablesSynced error:', err);
    return {
      success: false,
      needsSqlSetup: false,
      seededTables,
      existingTables,
      missingTables: [],
      totalInvoicesInCloud: totalInvoices,
      totalCustomersInCloud: totalCustomers,
    };
  }
}

// -------------------------------------------------------------
// Fetch & Realtime Subscriptions
// -------------------------------------------------------------
export async function fetchAllInvoicesFromSupabase(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from(INVOICES_TABLE)
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRowToInvoice);
}

export function subscribeSupabaseInvoices(
  onData: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void
): () => void {
  let isActive = true;
  let refreshTimer: number | null = null;

  const load = async () => {
    try {
      const items = await fetchAllInvoicesFromSupabase();
      if (isActive) onData(items);
    } catch (err: any) {
      console.warn('Supabase invoices load warning:', err?.message || err);
      if (onError && err instanceof Error) onError(err);
    }
  };

  load();

  const channel = supabase
    .channel(`realtime-${INVOICES_TABLE}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: INVOICES_TABLE },
      () => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          load();
        }, 120);
      }
    )
    .subscribe();

  return () => {
    isActive = false;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}

export async function fetchAllCustomersFromSupabase(): Promise<CustomerMaster[]> {
  const { data, error } = await supabase
    .from(CUSTOMERS_TABLE)
    .select('*')
    .order('customer_code', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRowToCustomer);
}

export function subscribeSupabaseCustomers(
  onData: (customers: CustomerMaster[]) => void,
  onError?: (err: Error) => void
): () => void {
  let isActive = true;
  let refreshTimer: number | null = null;

  const load = async () => {
    try {
      const items = await fetchAllCustomersFromSupabase();
      if (isActive) onData(items);
    } catch (err: any) {
      console.warn('Supabase customers load warning:', err?.message || err);
      if (onError && err instanceof Error) onError(err);
    }
  };

  load();

  const channel = supabase
    .channel(`realtime-${CUSTOMERS_TABLE}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CUSTOMERS_TABLE },
      () => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          load();
        }, 120);
      }
    )
    .subscribe();

  return () => {
    isActive = false;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}

export async function fetchSettingsFromSupabase(): Promise<CashbackSettings | null> {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('id', MAIN_SETTINGS_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRowToSettings(data) : null;
}

export function subscribeSupabaseSettings(
  onData: (settings: CashbackSettings) => void,
  onError?: (err: Error) => void
): () => void {
  let isActive = true;
  let refreshTimer: number | null = null;

  const load = async () => {
    try {
      const item = await fetchSettingsFromSupabase();
      if (isActive && item) onData(item);
    } catch (err: any) {
      console.warn('Supabase settings load warning:', err?.message || err);
      if (onError && err instanceof Error) onError(err);
    }
  };

  load();

  const channel = supabase
    .channel(`realtime-${SETTINGS_TABLE}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SETTINGS_TABLE },
      () => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          load();
        }, 120);
      }
    )
    .subscribe();

  return () => {
    isActive = false;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}

export async function fetchAllCancelRequestsFromSupabase(): Promise<DisbursementCancelRequest[]> {
  const { data, error } = await supabase
    .from(CANCEL_REQUESTS_TABLE)
    .select('*')
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRowToCancelRequest);
}

export function subscribeSupabaseCancelRequests(
  onData: (requests: DisbursementCancelRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  let isActive = true;
  let refreshTimer: number | null = null;

  const load = async () => {
    try {
      const items = await fetchAllCancelRequestsFromSupabase();
      if (isActive) onData(items);
    } catch (err: any) {
      console.warn('Supabase cancel_requests load warning:', err?.message || err);
      if (onError && err instanceof Error) onError(err);
    }
  };

  load();

  const channel = supabase
    .channel(`realtime-${CANCEL_REQUESTS_TABLE}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: CANCEL_REQUESTS_TABLE },
      () => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          load();
        }, 120);
      }
    )
    .subscribe();

  return () => {
    isActive = false;
    if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    supabase.removeChannel(channel);
  };
}

// -------------------------------------------------------------
// CRUD Mutations
// -------------------------------------------------------------
export async function saveInvoiceToSupabase(invoice: Invoice): Promise<void> {
  const { error } = await supabase
    .from(INVOICES_TABLE)
    .upsert(mapInvoiceToRow(invoice), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteInvoiceFromSupabase(invoiceId: string): Promise<void> {
  const { error } = await supabase.from(INVOICES_TABLE).delete().eq('id', invoiceId);
  if (error) throw error;
}

export async function batchUpdateInvoicesInSupabase(invoices: Invoice[]): Promise<void> {
  if (!invoices || invoices.length === 0) return;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < invoices.length; i += CHUNK_SIZE) {
    const chunk = invoices.slice(i, i + CHUNK_SIZE).map(mapInvoiceToRow);
    const { error } = await supabase.from(INVOICES_TABLE).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function saveCustomerToSupabase(customer: CustomerMaster): Promise<void> {
  const { error } = await supabase
    .from(CUSTOMERS_TABLE)
    .upsert(mapCustomerToRow(customer), { onConflict: 'id' });
  if (error) throw error;
}

export async function batchUpdateCustomersInSupabase(customers: CustomerMaster[]): Promise<void> {
  if (!customers || customers.length === 0) return;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
    const chunk = customers.slice(i, i + CHUNK_SIZE).map(mapCustomerToRow);
    const { error } = await supabase.from(CUSTOMERS_TABLE).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function deleteCustomerFromSupabase(customerId: string): Promise<void> {
  const { error } = await supabase.from(CUSTOMERS_TABLE).delete().eq('id', customerId);
  if (error) throw error;
}

export async function saveSettingsToSupabase(settings: CashbackSettings): Promise<void> {
  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(mapSettingsToRow(settings), { onConflict: 'id' });
  if (error) throw error;
}

export async function saveCancelRequestToSupabase(req: DisbursementCancelRequest): Promise<void> {
  const { error } = await supabase
    .from(CANCEL_REQUESTS_TABLE)
    .upsert(mapCancelRequestToRow(req), { onConflict: 'id' });
  if (error) throw error;
}

export async function batchUpdateCancelRequestsInSupabase(
  requests: DisbursementCancelRequest[]
): Promise<void> {
  if (!requests || requests.length === 0) return;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    const chunk = requests.slice(i, i + CHUNK_SIZE).map(mapCancelRequestToRow);
    const { error } = await supabase
      .from(CANCEL_REQUESTS_TABLE)
      .upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }
}

// -------------------------------------------------------------
// Full Sync, Reset & Backup Restore
// -------------------------------------------------------------
export async function forceSyncAllToSupabase(
  invoices: Invoice[],
  customers: CustomerMaster[],
  settings: CashbackSettings,
  cancelRequests: DisbursementCancelRequest[] = []
): Promise<{ invoicesCount: number; customersCount: number }> {
  await saveSettingsToSupabase(settings);
  if (customers.length > 0) {
    await batchUpdateCustomersInSupabase(customers);
  }
  if (invoices.length > 0) {
    await batchUpdateInvoicesInSupabase(invoices);
  }
  if (cancelRequests.length > 0) {
    await batchUpdateCancelRequestsInSupabase(cancelRequests);
  }

  await supabase.from(SYSTEM_INFO_TABLE).upsert({
    id: SYSTEM_INFO_ROW_ID,
    app_name: 'CashbackPro Rekapitulasi',
    version: '2.0',
    status: 'active',
    last_sync_at: new Date().toISOString(),
    metadata: {
      totalInvoicesInCloud: invoices.length,
      totalCustomersInCloud: customers.length,
      manualSyncTriggered: true,
    },
  });

  return { invoicesCount: invoices.length, customersCount: customers.length };
}

export async function deleteAllInvoicesFromSupabase(): Promise<number> {
  const { count } = await supabase
    .from(INVOICES_TABLE)
    .select('id', { count: 'exact', head: true });
  const { error } = await supabase.from(INVOICES_TABLE).delete().neq('id', '');
  if (error) throw error;
  return count || 0;
}

export async function deleteAllCancelRequestsFromSupabase(): Promise<number> {
  const { count } = await supabase
    .from(CANCEL_REQUESTS_TABLE)
    .select('id', { count: 'exact', head: true });
  const { error } = await supabase.from(CANCEL_REQUESTS_TABLE).delete().neq('id', '');
  if (error) throw error;
  return count || 0;
}

export async function deleteAllDataFromSupabase(): Promise<{
  deletedInvoices: number;
  deletedCustomers: number;
  deletedCancelRequests: number;
}> {
  const deletedInvoices = await deleteAllInvoicesFromSupabase();

  const { count: custCount } = await supabase
    .from(CUSTOMERS_TABLE)
    .select('id', { count: 'exact', head: true });
  const { error: custErr } = await supabase.from(CUSTOMERS_TABLE).delete().neq('id', '');
  if (custErr) throw custErr;
  const deletedCustomers = custCount || 0;

  const deletedCancelRequests = await deleteAllCancelRequestsFromSupabase();

  await supabase.from(SYSTEM_INFO_TABLE).upsert({
    id: SYSTEM_INFO_ROW_ID,
    app_name: 'CashbackPro Rekapitulasi',
    version: '2.0',
    status: 'wiped',
    last_sync_at: new Date().toISOString(),
    metadata: {
      lastWipedAt: new Date().toISOString(),
      totalInvoices: 0,
      totalCustomers: 0,
    },
  });

  return { deletedInvoices, deletedCustomers, deletedCancelRequests };
}

export async function restoreBackupToSupabase(
  invoices: Invoice[],
  customers: CustomerMaster[],
  settings?: CashbackSettings
): Promise<void> {
  await deleteAllDataFromSupabase();

  if (customers.length > 0) {
    await batchUpdateCustomersInSupabase(customers);
  }
  if (invoices.length > 0) {
    await batchUpdateInvoicesInSupabase(invoices);
  }
  if (settings) {
    await saveSettingsToSupabase(settings);
  }

  await supabase.from(SYSTEM_INFO_TABLE).upsert({
    id: SYSTEM_INFO_ROW_ID,
    app_name: 'CashbackPro Rekapitulasi',
    version: '2.0',
    status: 'active',
    last_sync_at: new Date().toISOString(),
    metadata: {
      lastRestoredAt: new Date().toISOString(),
      totalInvoices: invoices.length,
      totalCustomers: customers.length,
    },
  });
}
