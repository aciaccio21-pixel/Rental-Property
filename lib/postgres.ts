import "server-only";

import postgres from "postgres";

const globalForDatabase = globalThis as unknown as {
  rentalSql?: ReturnType<typeof postgres>;
};

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  if (!globalForDatabase.rentalSql) {
    globalForDatabase.rentalSql = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
    });
  }

  return globalForDatabase.rentalSql;
}
