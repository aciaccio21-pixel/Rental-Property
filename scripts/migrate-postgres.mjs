import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations.");

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  await sql.begin(async (tx) => {
    await tx`CREATE TABLE IF NOT EXISTS portfolio_profiles (
      owner_id TEXT PRIMARY KEY,
      starter_data BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await tx`CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      group_name TEXT NOT NULL DEFAULT '',
      rental_type TEXT NOT NULL CHECK (rental_type IN ('long_term', 'short_term', 'mixed')),
      address TEXT NOT NULL DEFAULT '',
      tenant_name TEXT NOT NULL DEFAULT '',
      monthly_rent DOUBLE PRECISION NOT NULL DEFAULT 0,
      estimated_monthly_costs DOUBLE PRECISION NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await tx`CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
      amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
      date DATE NOT NULL,
      category TEXT NOT NULL,
      counterparty TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      tax_treatment TEXT NOT NULL DEFAULT 'review',
      receipt_on_file BOOLEAN NOT NULL DEFAULT false,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await tx`CREATE TABLE IF NOT EXISTS occupancy (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      available_nights INTEGER NOT NULL CHECK (available_nights BETWEEN 1 AND 31),
      booked_nights INTEGER NOT NULL CHECK (booked_nights >= 0 AND booked_nights <= available_nights),
      revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (owner_id, property_id, month)
    )`;
    await tx`CREATE TABLE IF NOT EXISTS monthly_closes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      month TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT NOT NULL DEFAULT '',
      closed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (owner_id, month)
    )`;
    await tx`CREATE INDEX IF NOT EXISTS properties_owner_idx ON properties(owner_id)`;
    await tx`CREATE INDEX IF NOT EXISTS transactions_owner_date_idx ON transactions(owner_id, date DESC)`;
    await tx`CREATE INDEX IF NOT EXISTS occupancy_owner_month_idx ON occupancy(owner_id, month DESC)`;
  });
  console.log("PostgreSQL schema is ready.");
} finally {
  await sql.end();
}
