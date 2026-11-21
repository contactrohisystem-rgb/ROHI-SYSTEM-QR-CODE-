"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

import { DigitalReceipt } from "./guest-extras";

type View =
  | "bill"
  | "method"
  | "initiating"
  | "awaiting"
  | "confirming"
  | "success"
  | "error";

export interface CheckoutBill {
  id: string;
  totalMinor: number;
  currency: string;
  restaurantName?: string;
  tableLabel?: string;
}

/**
 * Guest checkout panel (light theme, mobile-first). Drives the payment state
 * machine: bill -> method -> initiating -> awaiting -> success/error.
 *
 * The table token (from the QR) is the guest credential, sent with every
 * payment API call. On success it shows a confirmation card with the
 * transaction reference — WITHOUT refreshing the server bill (which would now
 * be PAID and disappear from the active-bill query).
 *
 * Uses the MockProvider for now (no real M-Pesa credentials). The "Simular
 * aprovação" button stands in for the provider's signed webhook.
 */
export function CheckoutPanel({
  tableToken,
  bill,
  locale,
}: {
  tableToken: string;
  bill: CheckoutBill;
  locale: "pt" | "en";
}) {
  const t = useTranslations("GuestPay");
  const [view, setView] = useState<View>("bill");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }
  useEffect(() => () => stopPolling(), []);

  function startPolling(pid: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/payments/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableToken, paymentId: pid }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const status = data.payment?.status;
        if (status === "SUCCEEDED") {
          stopPolling();
          setView("success");
        } else if (status === "FAILED") {
          stopPolling();
          setError(t("paymentFailed"));
          setView("error");
        }
      } catch {
        /* transient — next tick retries */
      }
    }, 2000);
  }

  async function startPayment() {
    setView("initiating");
    setError(null);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableToken,
          providerCode: "MOCK",
          customerIdentifier: phone || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "initiate_failed");
      }
      const data = await res.json();
      const pid = data.payment?.paymentId as string;
      setPaymentId(pid);
      setView("awaiting");
      startPolling(pid);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
      setView("error");
    }
  }

  async function simulateConfirm() {
    if (!paymentId) return;
    setView("confirming");
    try {
      const res = await fetch("/api/payments/mock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableToken, paymentId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "confirm_failed");
      }
      const data = await res.json();
      stopPolling();
      if (data.payment?.status === "SUCCEEDED") {
        setView("success");
      } else {
        setError(t("paymentFailed"));
        setView("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
      setView("error");
    }
  }

  const totalFormatted = formatMoney(bill.totalMinor, bill.currency, locale);

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-5">
        {view === "bill" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("total")}
              </span>
              <span className="text-2xl font-semibold tabular tracking-tight">
                {totalFormatted}
              </span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => setView("method")}
            >
              {t("pay")} {totalFormatted}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {view === "method" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setView("bill")}
              className="-ml-1 inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("back")}
            </button>
            <p className="text-sm font-medium">{t("chooseMethod")}</p>
            <div className="flex items-center justify-between rounded-xl border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t("mpesaDemo")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t("mpesaDemoNote")}
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {t("demo")}
              </Badge>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("methodsNote")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">
                {t("phone")}
              </Label>
              <div className="flex items-center gap-2 rounded-xl border bg-card px-3">
                <span className="text-sm text-muted-foreground">+258</span>
                <Input
                  id="phone"
                  inputMode="numeric"
                  placeholder="84XXXXXXX"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                  }
                  className="h-11 border-0 px-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("phoneHint")}
              </p>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={startPayment}
              disabled={phone.length !== 9}
            >
              {t("confirm")} {totalFormatted}
            </Button>
          </div>
        )}

        {view === "initiating" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("initiating")}</p>
          </div>
        )}

        {view === "awaiting" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm font-medium">{t("awaiting")}</p>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                {t("awaitingNote")}
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-border/60 p-3">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {t("simulateNote")}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={simulateConfirm}
              >
                {t("simulateApproval")}
              </Button>
            </div>
          </div>
        )}

        {view === "confirming" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("confirming")}</p>
          </div>
        )}

        {view === "success" && (
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-base font-semibold">{t("success")}</p>
            <div className="w-full rounded-xl bg-muted/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("paidAmount")}</span>
                <span className="font-semibold tabular">{totalFormatted}</span>
              </div>
            </div>
            {paymentId && (
              <div className="w-full rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("reference")}</span>
                  <span className="font-mono font-medium">
                    {paymentId.slice(0, 16)}
                  </span>
                </div>
              </div>
            )}
            <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
              {t("successNote")}
            </p>
            {/* Digital receipt */}
            {paymentId && (
              <DigitalReceipt
                restaurantName={bill.restaurantName ?? "ROHI"}
                tableLabel={bill.tableLabel ?? "—"}
                amountMinor={bill.totalMinor}
                currency={bill.currency}
                methodLabel={locale === "pt" ? "M-Pesa (Demo)" : "M-Pesa (Demo)"}
                reference={paymentId.slice(0, 16)}
                paidAt={new Date().toISOString()}
                locale={locale}
              />
            )}
          </div>
        )}

        {view === "error" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-sm font-medium">{t("errorGeneric")}</p>
            {error && (
              <p className="max-w-xs text-[11px] text-muted-foreground">
                {error}
              </p>
            )}
            <Button variant="outline" onClick={() => setView("method")}>
              {t("retry")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
