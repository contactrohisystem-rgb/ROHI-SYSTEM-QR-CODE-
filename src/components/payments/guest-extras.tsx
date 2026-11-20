"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Package, Receipt as ReceiptIcon, Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface OrderItemView {
  id: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  notes: string | null;
}
interface OrderView {
  id: string;
  status: string;
  createdAt: string;
  items: OrderItemView[];
}

const STATUS_FLOW = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY", "SERVED"];
const STATUS_LABEL_PT: Record<string, string> = {
  SUBMITTED: "Enviado",
  RECEIVED: "Recebido",
  ACCEPTED: "Aceite",
  PREPARING: "A preparar",
  READY: "Pronto",
  SERVED: "Servido",
  CANCELLED: "Cancelado",
  REJECTED: "Rejeitado",
};
const STATUS_LABEL_EN: Record<string, string> = {
  SUBMITTED: "Submitted",
  RECEIVED: "Received",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  SERVED: "Served",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

/**
 * Guest order tracking — polls GET /api/orders?tableToken=<opaque> every 5s
 * and shows the status of submitted orders as a progress timeline.
 */
export function GuestOrderTracking({
  tableToken,
  locale,
}: {
  tableToken: string;
  locale: "pt" | "en";
}) {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/orders?tableToken=${encodeURIComponent(tableToken)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setOrders(data.orders ?? []);
      } catch {} finally {
        if (active) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [tableToken]);

  if (loading)
    return <div className="py-4 text-center text-sm text-muted-foreground">{locale === "pt" ? "A carregar..." : "Loading..."}</div>;

  const activeOrders = orders.filter((o) => !["SERVED", "CANCELLED", "REJECTED"].includes(o.status));
  const labels = locale === "pt" ? STATUS_LABEL_PT : STATUS_LABEL_EN;

  if (activeOrders.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Package className="h-3.5 w-3.5" />
        {locale === "pt" ? "Pedidos" : "Orders"}
      </div>
      {activeOrders.map((order) => {
        const currentStep = STATUS_FLOW.indexOf(order.status);
        const isRejected = order.status === "REJECTED" || order.status === "CANCELLED";
        return (
          <Card key={order.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 12)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(order.createdAt).toLocaleTimeString(locale === "pt" ? "pt-PT" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Progress timeline */}
              {!isRejected ? (
                <div className="mt-3 flex items-center gap-1">
                  {STATUS_FLOW.map((step, i) => {
                    const done = i <= currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={step} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          } ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                        >
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <span className={`text-[9px] ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {labels[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  <Clock className="h-3.5 w-3.5" />
                  {labels[order.status]}
                </div>
              )}

              {/* Items summary */}
              <div className="mt-2 text-xs text-muted-foreground">
                {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Digital receipt — shown after successful payment.
 * Displays: restaurant name, table, amount, method, reference, date.
 * Printable via window.print().
 */
export function DigitalReceipt({
  restaurantName,
  tableLabel,
  amountMinor,
  currency,
  methodLabel,
  reference,
  paidAt,
  locale,
}: {
  restaurantName: string;
  tableLabel: string;
  amountMinor: number;
  currency: string;
  methodLabel: string;
  reference: string;
  paidAt: string;
  locale: "pt" | "en";
}) {
  const [showReceipt, setShowReceipt] = useState(false);

  function printReceipt() {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const pt = locale === "pt";
    w.document.write(`<!doctype html><html><head><title>ROHI Recibo</title>
      <style>
        *{margin:0;box-sizing:border-box;font-family:ui-sans-serif,system-ui,sans-serif}
        body{padding:24px;color:#111;background:#fff}
        .header{text-align:center;border-bottom:2px solid #16a34a;padding-bottom:16px;margin-bottom:16px}
        .header h1{font-size:18px;font-weight:700}
        .header .sub{font-size:11px;color:#666;margin-top:4px}
        .row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
        .row .label{color:#666}
        .row .value{font-weight:600}
        .total{border-top:1px solid #ddd;margin-top:12px;padding-top:12px;font-size:18px;font-weight:700}
        .ref{font-family:monospace;font-size:11px;color:#666;margin-top:16px;text-align:center}
        .footer{text-align:center;margin-top:24px;font-size:10px;color:#999}
      </style></head><body>
      <div class="header">
        <h1>${restaurantName}</h1>
        <div class="sub">ROHI QR Pay · ${pt ? "Recibo de Pagamento" : "Payment Receipt"}</div>
      </div>
      <div class="row"><span class="label">${pt ? "Mesa" : "Table"}</span><span class="value">${tableLabel}</span></div>
      <div class="row"><span class="label">${pt ? "Método" : "Method"}</span><span class="value">${methodLabel}</span></div>
      <div class="row"><span class="label">${pt ? "Data" : "Date"}</span><span class="value">${new Date(paidAt).toLocaleString(pt ? "pt-PT" : "en-US")}</span></div>
      <div class="total">
        <span>${pt ? "Valor pago" : "Amount paid"}</span>
        <span style="float:right">${(amountMinor / 100).toFixed(2)} ${currency}</span>
      </div>
      <div class="ref">Ref: ${reference}</div>
      <div class="footer">ROHI — ${pt ? "Pagamento seguro por QR" : "Secure QR Payment"}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  if (!showReceipt)
    return (
      <Button variant="outline" className="w-full" onClick={() => setShowReceipt(true)}>
        <ReceiptIcon className="mr-1.5 h-4 w-4" />
        {locale === "pt" ? "Ver recibo" : "View receipt"}
      </Button>
    );

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {locale === "pt" ? "Recibo de Pagamento" : "Payment Receipt"}
        </div>
        <div className="mt-1 text-sm font-semibold">{restaurantName}</div>
      </div>
      <Separator />
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{locale === "pt" ? "Mesa" : "Table"}</span>
          <span className="font-medium">{tableLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{locale === "pt" ? "Método" : "Method"}</span>
          <span className="font-medium">{methodLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{locale === "pt" ? "Data" : "Date"}</span>
          <span className="font-medium">{new Date(paidAt).toLocaleString(locale === "pt" ? "pt-PT" : "en-US")}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-base font-semibold">
          <span>{locale === "pt" ? "Valor pago" : "Amount paid"}</span>
          <span className="tabular">{(amountMinor / 100).toFixed(2)} {currency}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span className="text-muted-foreground">{locale === "pt" ? "Referência" : "Reference"}</span>
          <span className="font-mono text-xs font-medium">{reference}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={printReceipt}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          {locale === "pt" ? "Imprimir" : "Print"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowReceipt(false)}>
          {locale === "pt" ? "Fechar" : "Close"}
        </Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">
        {locale === "pt" ? "Recibo ROHI — não substitui factura fiscal" : "ROHI receipt — not a fiscal invoice"}
      </p>
    </div>
  );
}
