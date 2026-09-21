import { redirect } from "next/navigation";
import { RentalDashboard } from "./rental-dashboard";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  const displayName = process.env.APP_DISPLAY_NAME || session.username;

  return <RentalDashboard displayName={displayName.split(" ")[0] || "Anthony"} />;
}
