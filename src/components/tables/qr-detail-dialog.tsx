"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { QrStandPreview } from "./qr-stand-preview";
import type { TableQrView } from "./table-card";

function printQr(qrDataUrl: string, label: string) {
  const w = window.open("", "_blank", "width=420,height=620");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>ROHI QR — ${label}</title>
  <style>
    *{margin:0;box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#fff;color:#111}
    .card{display:flex;flex-direction:column;align-items:center;padding:24px;border:1px solid #eee;border-radius:14px}
    img{width:300px;height:300px}
    h1{margin-top:14px;font-size:20px;font-weight:600}
    .sub{margin-top:4px;font-size:12px;color:#666;letter-spacing:.08em;text-transform:uppercase}
    .brand{margin-top:18px;font-size:13px;font-weight:600;color:#16a34a}
  </style></head><body>
  <div class="card"><img src="${qrDataUrl}"/><h1>${label}</h1><div class="sub">ROHI QR Pay</div></div>
  <div class="brand">ROHI</div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function QrDetailDialog({
  table,
  open,
  onOpenChange,
  canManage,
}: {
  table: TableQrView;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(table.payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  async function rotateToken() {
    setRotating(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/rotate-token`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast({
        title: "Token renovado",
        description: "O QR anterior deixou de funcionar.",
      });
      router.refresh();
    } catch {
      toast({ title: "Erro ao renovar token", variant: "destructive" });
    } finally {
      setRotating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code — {table.label}</DialogTitle>
          <DialogDescription>
            O código contém apenas um token opaco. Nenhuma informação de conta
            ou pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Large QR */}
          <div className="flex justify-center rounded-xl border bg-white p-4">
            <img
              src={table.qrDataUrl}
              alt={`QR code for ${table.label}`}
              className="h-44 w-44"
            />
          </div>

          {/* Stand preview */}
          <QrStandPreview qrDataUrl={table.qrDataUrl} label={table.label} />

          {/* URL */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              URL do QR
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs">
                {table.payUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2"
                onClick={copyUrl}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={table.qrDataUrl}
                download={`rohi-qr-${table.label}.png`}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Transferir
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => printQr(table.qrDataUrl, table.label)}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimir
            </Button>
          </div>
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={rotating}
                >
                  {rotating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Renovar token
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Renovar o token do QR?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O QR actual deixará imediatamente de funcionar. Será gerado
                    um novo código — imprima-o de novo. Os clientes com o QR
                    antigo não conseguirão aceder à mesa.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={rotateToken}>
                    Renovar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
