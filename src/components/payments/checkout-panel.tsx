"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

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
}

/**
 * Guest checkout panel. Renders the "Pay" affordance and drives the payment
 * state machine: bill -> method -> initiating -> awaiting -> success/error.
 *
 * The table token (from the QR) is the guest credential and is sent with
 * every payment API call. On success it shows a confirmation card WITHOUT
 * refreshing the server bill (which would now be PAID and disappear from the
 * active-bill query); the page handles the reload case separately.
 *
 * Uses the MockProvider for now (no real M-Pesa credentials). The
 * "Simular aprovação" button stands in for the provider's signed webhook
 * arriving with "customer approved".
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

  // Stop polling when the component unmounts.
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
        // Transient poll errors are ignored; the next tick retries.
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
    <Card>
      <CardContent className="space-y-4 py-6">
        {view === "bill" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("total")}
              </span>
              <span className="text-xl font-semibold">{totalFormatted}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => setView("method")}
            >
              {t("pay")} {totalFormatted}
            </Button>
          </div>
        )}

        {view === "method" && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("bill")}
              className="-ml-2"
            >
              <ArrowLeft className="h-4 w-4" /> {t("back")}
            </Button>
            <p className="text-sm font-medium">{t("chooseMethod")}</p>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                <div>
                  <div className="text-sm font-medium">{t("mpesaDemo")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("mpesaDemoNote")}
                  </div>
                </div>
              </div>
              <Badge variant="secondary">{t("demo")}</Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">+258</span>
                <Input
                  id="phone"
                  inputMode="numeric"
                  placeholder="84XXXXXXX"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
            </div>
            <Button
              className="w-full"
              onClick={startPayment}
              disabled={phone.length !== 9}
            >
              {t("confirm")} {totalFormatted}
            </Button>
          </div>
        )}

        {view === "initiating" && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("initiating")}</p>
          </div>
        )}

        {view === "awaiting" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium">{t("awaiting")}</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {t("awaitingNote")}
              </p>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <p className="mb-2 text-xs text-muted-foreground">
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
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("confirming")}</p>
          </div>
        )}

        {view === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-base font-semibold">{t("success")}</p>
            <div className="w-full rounded-md border bg-muted/40 px-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("paidAmount")}
                </span>
                <span className="font-semibold">{totalFormatted}</span>
              </div>
            </div>
            <p className="max-w-xs text-xs text-muted-foreground">
              {t("successNote")}
            </p>
          </div>
        )}

        {view === "error" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm font-medium">{t("errorGeneric")}</p>
            {error && (
              <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
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
