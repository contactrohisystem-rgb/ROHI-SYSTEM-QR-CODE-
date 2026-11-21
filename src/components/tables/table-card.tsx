"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, QrCode, Receipt, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/money";
import { BillManager } from "@/components/billing/bill-manager";
import { QrDetailDialog } from "./qr-detail-dialog";

export interface ActiveBillSummary {
  id: string;
  totalMinor: number;
  currency: string;
  hasPendingPayment: boolean;
}

export interface NextReservationSummary {
  customerName: string;
  partySize: number;
  time: string; // ISO datetime
  status: string;
}

export interface TableQrView {
  id: string;
  label: string;
  area: string | null;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  token: string;
  shape: string;
  seats: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  payUrl: string;
  qrDataUrl: string;
  activeBill: ActiveBillSummary | null;
  // Stage 13D: next upcoming reservation assigned to this table (today/forward).
  nextReservation: NextReservationSummary | null;
}

function cardStatus(t: TableQrView): { label: string; cls: string } {
  if (t.activeBill?.hasPendingPayment)
    return {
      label: "A aguardar pagamento",
      cls: "bg-[oklch(0.7_0.15_65/0.16)] text-[oklch(0.78_0.15_65)]",
    };
  if (t.activeBill)
    return { label: "Conta aberta", cls: "bg-primary/15 text-primary" };
  if (t.status === "RESERVED")
    return {
      label: "Reservada",
      cls: "bg-[oklch(0.7_0.15_65/0.14)] text-[oklch(0.78_0.15_65)]",
    };
  if (t.status === "OCCUPIED")
    return { label: "Ocupada", cls: "bg-muted text-muted-foreground" };
  return { label: "Disponível", cls: "bg-primary/10 text-primary/80" };
}

export function TableCard({
  table,
  canManage,
}: {
  table: TableQrView;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [billOpen, setBillOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const st = cardStatus(table);

  return (
    <>
      <Card className="overflow-hidden transition-shadow hover:shadow-lg">
        <CardContent className="p-4">
          {/* header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{table.label}</div>
              {table.area && (
                <div className="text-[11px] text-muted-foreground">
                  {table.area}
                </div>
              )}
            </div>
            <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              {table.seats}
            </Badge>
          </div>

          {/* QR thumbnail */}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group mt-3 flex w-full flex-col items-center rounded-lg border bg-white p-3 transition-colors hover:border-primary/40"
            aria-label={`Ver QR de ${table.label}`}
          >
            <img
              src={table.qrDataUrl}
              alt={`QR code for ${table.label}`}
              className="h-24 w-24"
            />
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary">
              <QrCode className="h-3 w-3" /> Ver QR
            </span>
          </button>

          {/* status + bill */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Badge variant="secondary" className={st.cls}>
              {st.label}
            </Badge>
            {table.activeBill ? (
              <span className="text-sm font-semibold tabular text-primary">
                {formatMoney(
                  table.activeBill.totalMinor,
                  table.activeBill.currency,
                )}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Sem conta</span>
            )}
          </div>

          {/* Next reservation (Stage 13D) */}
          {table.nextReservation && (
            <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <CalendarClock className="h-3 w-3" />
                {new Date(table.nextReservation.time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                <span className="text-muted-foreground">· {table.nextReservation.partySize} pax</span>
              </div>
              <div className="mt-0.5 truncate text-muted-foreground">
                {table.nextReservation.customerName}
                {table.nextReservation.status === "PENDING" && " · pende."}
              </div>
            </div>
          )}

          {/* actions */}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setBillOpen(true)}
              disabled={!table.activeBill}
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Conta
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={table.payUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Página
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <BillManager
        tableId={table.id}
        tableName={table.label}
        open={billOpen}
        onOpenChange={(v) => {
          setBillOpen(v);
          if (!v) router.refresh();
        }}
        canVoid={canManage}
      />

      <QrDetailDialog
        table={table}
        open={qrOpen}
        onOpenChange={setQrOpen}
        canManage={canManage}
      />
    </>
  );
}
