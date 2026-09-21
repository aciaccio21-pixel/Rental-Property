import { getSessionFromRequest } from "@/lib/auth";
import { getSql } from "@/lib/postgres";

export const dynamic = "force-dynamic";
type Sql = ReturnType<typeof getSql>;

function nowIso() { return new Date().toISOString(); }
function cleanText(value: unknown, max = 180) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function amountValue(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error("Enter a valid amount greater than zero.");
  return Math.round(amount * 100) / 100;
}

async function seedStarterData(sql: Sql, ownerId: string) {
  const [profile] = await sql`SELECT owner_id FROM portfolio_profiles WHERE owner_id = ${ownerId}`;
  if (profile) return;
  const now = nowIso();
  await sql`INSERT INTO portfolio_profiles (owner_id, starter_data, created_at, updated_at)
    VALUES (${ownerId}, false, ${now}, ${now})`;
}

async function loadPortfolio(sql: Sql, ownerId: string) {
  const [profileRows, properties, transactions, occupancy, closes] = await Promise.all([
    sql`SELECT starter_data AS "starterData" FROM portfolio_profiles WHERE owner_id = ${ownerId}`,
    sql`SELECT id, name, group_name AS "groupName", rental_type AS "rentalType", address, tenant_name AS "tenantName",
      monthly_rent AS "monthlyRent", estimated_monthly_costs AS "estimatedMonthlyCosts", active, is_demo AS "isDemo"
      FROM properties WHERE owner_id = ${ownerId} ORDER BY group_name, name`,
    sql`SELECT id, property_id AS "propertyId", kind, amount, date::text, category, counterparty, payment_method AS "paymentMethod",
      notes, tax_treatment AS "taxTreatment", receipt_on_file AS "receiptOnFile", is_demo AS "isDemo"
      FROM transactions WHERE owner_id = ${ownerId} ORDER BY date DESC, created_at DESC`,
    sql`SELECT id, property_id AS "propertyId", month, available_nights AS "availableNights", booked_nights AS "bookedNights",
      revenue, is_demo AS "isDemo" FROM occupancy WHERE owner_id = ${ownerId} ORDER BY month DESC`,
    sql`SELECT id, month, status, notes, closed_at AS "closedAt" FROM monthly_closes WHERE owner_id = ${ownerId} ORDER BY month DESC`,
  ]);
  return { starterData: Boolean(profileRows[0]?.starterData), properties, transactions, occupancy, closes };
}

function authenticatedOwner(request: Request) { return getSessionFromRequest(request)?.username || null; }

export async function GET(request: Request) {
  const ownerId = authenticatedOwner(request);
  if (!ownerId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const sql = getSql(); await seedStarterData(sql, ownerId);
    return Response.json(await loadPortfolio(sql, ownerId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load the portfolio." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ownerId = authenticatedOwner(request);
  if (!ownerId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const sql = getSql(), payload = (await request.json()) as Record<string, unknown>;
    const action = cleanText(payload.action, 40), now = nowIso();
    if (action === "create_transaction") {
      const kind = cleanText(payload.kind, 12), propertyId = cleanText(payload.propertyId, 80);
      const date = cleanText(payload.date, 10), category = cleanText(payload.category, 80);
      if (!["income", "expense"].includes(kind) || !propertyId || !date || !category)
        return Response.json({ error: "Complete all required transaction fields." }, { status: 400 });
      const [property] = await sql`SELECT id FROM properties WHERE id = ${propertyId} AND owner_id = ${ownerId}`;
      if (!property) return Response.json({ error: "Property not found." }, { status: 404 });
      await sql`INSERT INTO transactions
        (id, owner_id, property_id, kind, amount, date, category, counterparty, payment_method, notes, tax_treatment, receipt_on_file, is_demo, created_at)
        VALUES (${crypto.randomUUID()}, ${ownerId}, ${propertyId}, ${kind}, ${amountValue(payload.amount)}, ${date}, ${category},
        ${cleanText(payload.counterparty)}, ${cleanText(payload.paymentMethod, 80)}, ${cleanText(payload.notes, 500)},
        ${kind === "income" ? "income" : cleanText(payload.taxTreatment, 30) || "review"}, ${Boolean(payload.receiptOnFile)}, false, ${now})`;
    } else if (action === "create_property") {
      const name = cleanText(payload.name, 120), rentalType = cleanText(payload.rentalType, 30);
      if (!name || !["long_term", "short_term", "mixed"].includes(rentalType))
        return Response.json({ error: "Enter a property name and rental type." }, { status: 400 });
      await sql`INSERT INTO properties
        (id, owner_id, name, group_name, rental_type, address, tenant_name, monthly_rent, estimated_monthly_costs, active, is_demo, created_at)
        VALUES (${crypto.randomUUID()}, ${ownerId}, ${name}, ${cleanText(payload.groupName, 120)}, ${rentalType}, ${cleanText(payload.address, 180)},
        ${cleanText(payload.tenantName, 120)}, ${Math.max(0, Number(payload.monthlyRent) || 0)},
        ${Math.max(0, Number(payload.estimatedMonthlyCosts) || 0)}, true, false, ${now})`;
    } else if (action === "update_property") {
      const id = cleanText(payload.id, 80), name = cleanText(payload.name, 120), rentalType = cleanText(payload.rentalType, 30);
      if (!id || !name || !["long_term", "short_term", "mixed"].includes(rentalType))
        return Response.json({ error: "Enter a property name and rental type." }, { status: 400 });
      const result = await sql`UPDATE properties SET name = ${name}, group_name = ${cleanText(payload.groupName, 120)},
        rental_type = ${rentalType}, address = ${cleanText(payload.address, 180)}, tenant_name = ${cleanText(payload.tenantName, 120)},
        monthly_rent = ${Math.max(0, Number(payload.monthlyRent) || 0)}, estimated_monthly_costs = ${Math.max(0, Number(payload.estimatedMonthlyCosts) || 0)}
        WHERE id = ${id} AND owner_id = ${ownerId}`;
      if (!result.count) return Response.json({ error: "Property not found." }, { status: 404 });
    } else if (action === "upsert_occupancy") {
      const propertyId = cleanText(payload.propertyId, 80), month = cleanText(payload.month, 7);
      const requestedAvailable = Number(payload.availableNights), requestedBooked = Number(payload.bookedNights);
      if (!Number.isFinite(requestedAvailable) || !Number.isFinite(requestedBooked))
        return Response.json({ error: "Enter available and booked nights." }, { status: 400 });
      const available = Math.max(1, Math.min(31, Math.round(requestedAvailable)));
      const booked = Math.max(0, Math.min(available, Math.round(requestedBooked)));
      if (!propertyId || !/^\d{4}-\d{2}$/.test(month))
        return Response.json({ error: "Choose a short-term rental and month." }, { status: 400 });
      const [property] = await sql`SELECT id FROM properties WHERE id = ${propertyId} AND owner_id = ${ownerId} AND rental_type IN ('short_term', 'mixed')`;
      if (!property) return Response.json({ error: "Short-term rental not found." }, { status: 404 });
      await sql`INSERT INTO occupancy (id, owner_id, property_id, month, available_nights, booked_nights, revenue, is_demo, updated_at)
        VALUES (${crypto.randomUUID()}, ${ownerId}, ${propertyId}, ${month}, ${available}, ${booked}, ${Math.max(0, Number(payload.revenue) || 0)}, false, ${now})
        ON CONFLICT(owner_id, property_id, month) DO UPDATE SET available_nights = EXCLUDED.available_nights,
        booked_nights = EXCLUDED.booked_nights, revenue = EXCLUDED.revenue, is_demo = false, updated_at = EXCLUDED.updated_at`;
    } else if (action === "close_month") {
      const month = cleanText(payload.month, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return Response.json({ error: "Choose a valid month." }, { status: 400 });
      await sql`INSERT INTO monthly_closes (id, owner_id, month, status, notes, closed_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${ownerId}, ${month}, 'closed', ${cleanText(payload.notes, 500)}, ${now}, ${now})
        ON CONFLICT(owner_id, month) DO UPDATE SET status = 'closed', notes = EXCLUDED.notes, closed_at = EXCLUDED.closed_at, updated_at = EXCLUDED.updated_at`;
    } else if (action === "delete_transaction") {
      await sql`DELETE FROM transactions WHERE id = ${cleanText(payload.id, 80)} AND owner_id = ${ownerId}`;
    } else if (action === "clear_starter") {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM transactions WHERE owner_id = ${ownerId} AND is_demo = true`;
        await tx`DELETE FROM occupancy WHERE owner_id = ${ownerId} AND is_demo = true`;
        await tx`DELETE FROM properties WHERE owner_id = ${ownerId} AND is_demo = true`;
        await tx`UPDATE portfolio_profiles SET starter_data = false, updated_at = ${now} WHERE owner_id = ${ownerId}`;
      });
    } else return Response.json({ error: "Unknown action." }, { status: 400 });
    return Response.json(await loadPortfolio(sql, ownerId));
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "Could not save the change.";
    return Response.json({ error: code === "23505" ? "That record already exists." : message }, { status: 500 });
  }
}
