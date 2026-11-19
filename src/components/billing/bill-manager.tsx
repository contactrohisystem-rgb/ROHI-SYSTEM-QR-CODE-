"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { formatMoney } from "@/lib/money";

interface BillItemView {
  id: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}
interface BillAdjustmentView {
  id: string;
  type: string;
  label: string;
  amountMinor: number;
}
interface BillView {
  id: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  adjustmentTotalMinor: number;
  totalMinor: number;
  items: BillItemView[];
  adjustments: BillAdjustmentView[];
}

const ADJ_TYPE_LABEL: Record<string, string> = {
  DISCOUNT: "Desconto",
  SURCHARGE: "Taxa",
  SERVICE: "Serviço",
  TAX: "Imposto",
};

/**
 * Bill manager dialog. Fetches the table's active (OPEN) bill and lets staff
 * add/remove items and adjustments and void the bill. Totals are computed
 * server-side and re-fetched after every mutation.
 */
export function BillManager({
  tableId,
  tableName,
  open,
  onOpenChange,
  canVoid,
}: {
  tableId: string;
  tableName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canVoid: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bill, setBill] = useState<BillView | null>(null);
  const [loading, setLoading] = useState(false);

  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [itemLoading, setItemLoading] = useState(false);

  const [adjType, setAdjType] = useState("DISCOUNT");
  const [adjLabel, setAdjLabel] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjLoading, setAdjLoading] = useState(false);

  const [voidLoading, setVoidLoading] = useState(false);

  const loadBill = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/bills/active`);
      if (res.ok) {
        const data = await res.json();
        setBill(data.bill);
      }
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    if (open) loadBill();
    else setBill(null);
  }, [open, loadBill]);

  async function addItem() {
    if (!bill || !itemName || !itemPrice) return;
    setItemLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: itemName,
          quantity: Number(itemQty) || 1,
          unitPrice: itemPrice,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Erro ao adicionar");
      }
      setItemName("");
      setItemQty("1");
      setItemPrice("");
      await loadBill();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setItemLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/items/${itemId}`, {
      method: "DELETE",
    });
    if (res.ok) await loadBill();
    else toast({ title: "Erro ao remover", variant: "destructive" });
  }

  async function addAdjustment() {
    if (!bill || !adjLabel || !adjAmount) return;
    setAdjLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: adjType, label: adjLabel, amount: adjAmount }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "adjustment_makes_total_negative") {
          throw new Error("O desconto excede o total da conta.");
        }
        throw new Error(d.error || "Erro ao adicionar");
      }
      setAdjLabel("");
      setAdjAmount("");
      await loadBill();
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setAdjLoading(false);
    }
  }

  async function removeAdjustment(adjId: string) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/adjustments/${adjId}`, {
      method: "DELETE",
    });
    if (res.ok) await loadBill();
    else toast({ title: "Erro ao remover", variant: "destructive" });
  }

  async function voidBill() {
    if (!bill) return;
    setVoidLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/void`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Conta anulada" });
        onOpenChange(false);
        router.refresh();
      } else {
        toast({ title: "Erro ao anular", variant: "destructive" });
      }
    } finally {
      setVoidLoading(false);
    }
  }

  const cur = bill?.currency ?? "MZN";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conta — {tableName}</DialogTitle>
          <DialogDescription>Itens, ajustamentos e total.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !bill ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem conta activa.
          </p>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-4">
              {/* Items */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Itens</h4>
                {bill.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem itens.</p>
                ) : (
                  <div className="space-y-1">
                    {bill.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{it.name}</span>
                          <span className="ml-1 text-muted-foreground">
                            {it.quantity} × {formatMoney(it.unitPriceMinor, cur)}
                          </span>
                        </div>
                        <span className="font-medium">
                          {formatMoney(it.totalMinor, cur)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(it.id)}
                          aria-label="Remover item"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-[1fr_56px_88px_36px] gap-2 pt-1">
                  <Input
                    placeholder="Item"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Qtd"
                    inputMode="numeric"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Preço"
                    inputMode="decimal"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={addItem}
                    disabled={itemLoading || !itemName || !itemPrice}
                    aria-label="Adicionar item"
                  >
                    {itemLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Adjustments */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Ajustamentos</h4>
                {bill.adjustments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem ajustamentos.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {bill.adjustments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{a.label}</span>{" "}
                          <span className="text-muted-foreground">
                            ({ADJ_TYPE_LABEL[a.type] ?? a.type})
                          </span>
                        </span>
                        <span
                          className={
                            a.amountMinor < 0 ? "text-destructive" : ""
                          }
                        >
                          {formatMoney(a.amountMinor, cur)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAdjustment(a.id)}
                          aria-label="Remover ajustamento"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-[116px_1fr_88px_36px] gap-2 pt-1">
                  <Select value={adjType} onValueChange={setAdjType}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISCOUNT">Desconto</SelectItem>
                      <SelectItem value="SURCHARGE">Taxa</SelectItem>
                      <SelectItem value="SERVICE">Serviço</SelectItem>
                      <SelectItem value="TAX">Imposto</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Descrição"
                    value={adjLabel}
                    onChange={(e) => setAdjLabel(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Valor"
                    inputMode="decimal"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={addAdjustment}
                    disabled={adjLoading || !adjLabel || !adjAmount}
                    aria-label="Adicionar ajustamento"
                  >
                    {adjLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(bill.subtotalMinor, cur)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ajustamentos</span>
                  <span>{formatMoney(bill.adjustmentTotalMinor, cur)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(bill.totalMinor, cur)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          {canVoid && bill && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={voidLoading}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Anular
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anular conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A conta será marcada como anulada. Esta acção não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={voidBill}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Anular
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
