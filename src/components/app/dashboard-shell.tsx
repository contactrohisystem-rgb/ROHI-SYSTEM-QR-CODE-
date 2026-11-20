"use client";

import { useState } from "react";
import {
  CreditCard,
  LayoutDashboard,
  Map,
  Menu,
  Plug,
  Receipt,
  Settings,
  Table2,
  type LucideIcon,
} from "lucide-react";

import { Brand } from "@/components/app/brand";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TablesSection } from "@/components/tables/tables-section";
import { PosSection } from "@/components/pos/pos-section";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { FloorPlanSection } from "@/components/floor-plan/floor-plan-section";
import { BillingSection } from "@/components/billing/billing-section";
import { PaymentsSection, type TransactionView } from "@/components/payments/payments-section";
import { SettingsSection } from "@/components/settings/settings-section";
import { BrandTheme } from "@/components/app/brand-theme";
import { RestaurantSwitcher } from "@/components/app/restaurant-switcher";
import type { RestaurantBrand } from "@/lib/brand";
import type { MembershipView } from "@/types/next-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { TableQrView } from "@/components/tables/table-card";
import type { DashboardStats } from "@/components/dashboard/dashboard-section";

type SectionId =
  | "dashboard"
  | "floor-plan"
  | "tables"
  | "billing"
  | "payments"
  | "pos"
  | "settings";

interface NavItem {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  stage: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, stage: "2" },
  { id: "floor-plan", label: "Floor Plan", icon: Map, stage: "3" },
  { id: "tables", label: "Tables & QR", icon: Table2, stage: "4" },
  { id: "billing", label: "Billing", icon: Receipt, stage: "5" },
  { id: "payments", label: "Payments", icon: CreditCard, stage: "6" },
  { id: "pos", label: "POS Sync", icon: Plug, stage: "8" },
  { id: "settings", label: "Settings", icon: Settings, stage: "10" },
];

const SECTION_TITLES: Record<SectionId, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Revenue, payments and table activity" },
  "floor-plan": { title: "Floor Plan", subtitle: "Interactive restaurant layout" },
  tables: { title: "Tables & QR", subtitle: "Manage tables and QR codes" },
  billing: { title: "Billing", subtitle: "Open bills and lightweight POS" },
  payments: { title: "Payments", subtitle: "Transaction history and status" },
  pos: { title: "POS Synchronisation", subtitle: "POS connection and sync records" },
  settings: { title: "Settings", subtitle: "Restaurant, staff and configuration" },
};

function PlaceholderSection({ label, stage }: { label: string; stage: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <LayoutDashboard className="h-6 w-6" />
      </div>
      <p className="text-base font-medium">{label}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This section is part of redesign Stage {stage} and will be built next.
        The underlying backend for this feature already exists.
      </p>
    </div>
  );
}

function SidebarBody({
  active,
  onSelect,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"}`}
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export interface ShellUser {
  name?: string | null;
  email?: string | null;
  activeRole?: string | null;
  platformRole?: string | null;
  activeRestaurantId?: string;
  activeRestaurantName?: string | null;
}

export function DashboardShell({
  user,
  tables,
  canManage,
  stats,
  transactions,
  brand,
  memberships,
}: {
  user: ShellUser;
  tables: TableQrView[];
  canManage: boolean;
  stats: DashboardStats;
  transactions: TransactionView[];
  brand?: RestaurantBrand;
  memberships?: MembershipView[];
}) {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user.name ?? user.email ?? "U")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  function select(id: SectionId) {
    setActive(id);
    setMobileOpen(false);
  }

  const meta = SECTION_TITLES[active];

  return (
    <BrandTheme brand={brand}>
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          {brand?.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt=""
              className="h-8 w-8 rounded-md object-cover"
            />
          ) : null}
          <div className={brand?.logoUrl ? "ml-2.5" : ""}>
            <Brand />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarBody active={active} onSelect={select} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-xs font-medium">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-sidebar-foreground">
                {user.name ?? user.email}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {user.activeRole ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
          <div className="flex h-16 items-center px-5">
            <Brand />
          </div>
          <div className="py-4">
            <SidebarBody active={active} onSelect={select} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
          {/* Mobile menu trigger (Sheet is controlled via open/onOpenChange) */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight">
                {meta.title}
              </h1>
              {memberships && memberships.length > 1 ? (
                <RestaurantSwitcher
                  memberships={memberships}
                  activeId={user.activeRestaurantId}
                />
              ) : user.activeRestaurantName ? (
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {user.activeRestaurantName}
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {meta.subtitle}
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Demo
            </Badge>
          </div>
          <SignOutButton />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div key={active} className="animate-fade-up">
            {active === "dashboard" && (
              <DashboardSection stats={stats} tables={tables} />
            )}
            {active === "tables" && (
              <TablesSection tables={tables} canManage={canManage} />
            )}
            {active === "pos" && (
              <PosSection
                tables={tables.map((t) => ({
                  id: t.id,
                  label: t.label,
                  hasOpenBill: !!t.activeBill,
                }))}
              />
            )}
            {active === "floor-plan" && (
              <FloorPlanSection tables={tables} canManage={canManage} />
            )}
            {active === "billing" && (
              <BillingSection tables={tables} canManage={canManage} />
            )}
            {active === "payments" && (
              <PaymentsSection transactions={transactions} />
            )}
            {active === "settings" && <SettingsSection />}
          </div>
        </main>
      </div>
    </div>
    </BrandTheme>
  );
}
