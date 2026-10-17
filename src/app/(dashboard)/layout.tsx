import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SessionMenu } from "@/components/layout/SessionMenu";
import { ShopDate } from "@/components/layout/ShopDate";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      headerMeta={
        <Suspense fallback={null}>
          <ShopDate />
          <SessionMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
