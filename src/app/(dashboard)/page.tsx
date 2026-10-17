import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { can } from "@/server/auth/policy";
import { getSession } from "@/server/auth/session";
import { briefFor } from "@/server/brief/load";
import { shopTimeZone, shopToday } from "@/server/clock";
import { getOrderService } from "@/server/orders";

/** Reads orders from PostgreSQL at request time (never during the build), for signed-in users only. */
async function DashboardData() {
  await connection();
  const session = await getSession();
  if (!can(session, "orders:read")) redirect("/login");
  const today = shopToday();
  const orders = await getOrderService().listOrders();
  // Not awaited: the dashboard renders immediately and the brief streams in.
  const briefPromise = briefFor(orders, today);
  return (
    <Dashboard
      orders={orders}
      today={today}
      timeZone={shopTimeZone()}
      briefPromise={briefPromise}
      // UI hint only; every write is re-checked in the server actions.
      canEdit={can(session, "orders:write")}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  );
}
