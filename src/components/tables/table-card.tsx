"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Loader2, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export interface TableQrView {
  id: string;
  label: string;
  area: string | null;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  token: string;
  payUrl: string;
  qrDataUrl: string;
}

const STATUS_LABEL: Record<TableQrView["status"], string> = {
  AVAILABLE: "Disponível",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
};

const STATUS_VARIANT: Record<
  TableQrView["status"],
  "secondary" | "default" | "outline"
> = {
  AVAILABLE: "secondary",
  OCCUPIED: "default",
  RESERVED: "outline",
};

export function TableCard({ table }: { table: TableQrView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function updateStatus(status: TableQrView["status"]) {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Estado actualizado" });
      router.refresh();
    } catch {
      toast({ title: "Erro ao actualizar", variant: "destructive" });
    } finally {
      setStatusLoading(false);
    }
  }

  async function deleteTable() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "table_has_bills") {
          toast({
            title: "Não é possível eliminar",
            description: "Esta mesa tem contas associadas.",
            variant: "destructive",
          });
        } else {
          throw new Error();
        }
      } else {
        toast({ title: "Mesa eliminada" });
        router.refresh();
      }
    } catch {
      toast({ title: "Erro ao eliminar", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{table.label}</CardTitle>
          {table.area && (
            <p className="text-xs text-muted-foreground">{table.area}</p>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[table.status]}>
          {STATUS_LABEL[table.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center rounded-md border bg-white p-2">
          {/* QR is a generated PNG data URL; <img> is appropriate here. */}
          <img
            src={table.qrDataUrl}
            alt={`Código QR para ${table.label}`}
            className="h-32 w-32"
          />
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a href={table.payUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Ver página
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <a
              href={table.qrDataUrl}
              download={`rohi-qr-${table.label}.png`}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> QR
            </a>
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Select
            value={table.status}
            onValueChange={(v) =>
              updateStatus(v as TableQrView["status"])
            }
            disabled={statusLoading}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AVAILABLE">Disponível</SelectItem>
              <SelectItem value="OCCUPIED">Ocupada</SelectItem>
              <SelectItem value="RESERVED">Reservada</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={deleteLoading}
                aria-label="Eliminar mesa"
              >
                {deleteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar mesa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem a certeza que pretende eliminar &quot;{table.label}&quot;?
                  Esta acção não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteTable}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
