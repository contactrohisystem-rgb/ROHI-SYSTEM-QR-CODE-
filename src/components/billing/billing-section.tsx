"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  QrCode,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/money";
import type { TableQrView } from "@/components/tables/table-card";
import { QrDetailDialog } from "@/components/tables/qr-detail-dialog";

// Demo quick-add catalog (preset items with categories). A proper per-restaurant
// product catalog (Product model) is Task 9; this delivers the search/category UX
// now while still creating real bill items via the existing billing API.
const CATALOG = [
  { name: "Cerveja 2M", price: 75, category: "Bebidas" },
  { name: "Refri", price: 40, category: "Bebidas" },
  { name: "Água", price: 30, category: "Bebidas" },
  { name: "Vinho (copo)", price: 120, category: "Bebidas" },
  { name: "Sumo natural", price: 50, category: "Bebidas" },
  { name: "Cambarito", price: 180, category: "Pratos" },
  { name: "Frango grelhado", price: 250, category: "Pratos" },
  { name: "Lulas grelhadas", price: 200, category: "Pratos" },
  { name: "Peixe grelhado", price: 300, category: "Pratos" },
  { name: "Arroz", price: 80, category: "Pratos" },
  { name: "Bolo", price: 120, category: "Sobremesas" },
  { name: "Gelado", price: 90, category: "Sobremesas" },
  { name: "Fruta", price: 60, category: "Sobremesas" },
  { name: "Café", price: 40, category: "Café" },
  { name: "Chá", price: 30, category: "Café" },
];
const CATEGORIES = ["Bebidas", "Pratos", "Sobremesas", "Café"];

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
  currency: string;
  subtotalMinor: number;
  adjustmentTotalMinor: number;
  totalMinor: number;
  items: BillItemView[];
  adjustments: BillAdjustmentView[];
}

export function BillingSection({
  tables,
  canManage,
}: {
  tables: TableQrView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(
    tables.find((t) => t.activeBill)?.id ?? tables[0]?.id ?? null,
  );
  const [bill, setBill] = useState<BillView | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Bebidas");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [adjType, setAdjType] = useState("DISCOUNT");
  const [adjLabel, setAdjLabel] = useState("");
  const [adjAmount, setAdjAmount] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedId) ?? null;

  const loadBill = useCallback(async () => {
    if (!selectedId) {
      setBill(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${selectedId}/bills/active`);
      if (res.ok) {
        const data = await res.json();
        setBill(data.bill);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  async function openBill() {
    if (!selectedId) return;
    const res = await fetch(`/api/tables/${selectedId}/bills`, {
      method: "POST",
    });
    if (res.ok) {
      toast({ title: "Conta aberta" });
      await loadBill();
      router.refresh();
    } else {
      toast({ title: "Erro ao abrir conta", variant: "destructive" });
    }
  }

  async function addItem(name: string, price: number) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, quantity: 1, unitPrice: String(price) }),
    });
    if (res.ok) await loadBill();
    else toast({ title: "Erro ao adicionar", variant: "destructive" });
  }

  async function changeQty(itemId: string, delta: number) {
    if (!bill) return;
    const item = bill.items.find((i) => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) {
      await removeItem(itemId);
      return;
    }
    const res = await fetch(`/api/bills/${bill.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty }),
    });
    if (res.ok) await loadBill();
  }

  async function removeItem(itemId: string) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/items/${itemId}`, {
      method: "DELETE",
    });
    if (res.ok) await loadBill();
  }

  async function addAdjustment() {
    if (!bill || !adjLabel || !adjAmount) return;
    const res = await fetch(`/api/bills/${bill.id}/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: adjType, label: adjLabel, amount: adjAmount }),
    });
    if (res.ok) {
      setAdjLabel("");
      setAdjAmount("");
      await loadBill();
    } else {
      const d = await res.json().catch(() => ({}));
      toast({
        title: d.error === "adjustment_makes_total_negative" ? "Desconto excede o total" : "Erro",
        variant: "destructive",
      });
    }
  }

  async function removeAdjustment(adjId: string) {
    if (!bill) return;
    const res = await fetch(`/api/bills/${bill.id}/adjustments/${adjId}`, {
      method: "DELETE",
    });
    if (res.ok) await loadBill();
  }

  const filteredCatalog = CATALOG.filter(
    (c) =>
      c.category === category &&
      c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const cur = bill?.currency ?? "MZN";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Contas</h2>
        <p className="text-sm text-muted-foreground">
          Abra e edite contas; confirme para pagamento por QR
        </p>
      </div>

      {/* Table selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedId(t.id)}
            className={`flex shrink-0 flex-col items-start rounded-lg border px-3 py-2 transition-colors ${
              selectedId === t.id
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted/40"
            }`}
          >
            <span className="text-xs font-medium">{t.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {t.activeBill
                ? formatMoney(t.activeBill.totalMinor, t.activeBill.currency)
                : "Sem conta"}
            </span>
          </button>
        ))}
      </div>

      {!selectedTable ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Seleccione uma mesa
          </CardContent>
        </Card>
      ) : !bill ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <Receipt className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {selectedTable.label} não tem conta aberta
            </p>
            <Button onClick={openBill}>
              <Plus className="mr-1.5 h-4 w-4" /> Abrir conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Catalog */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Adicionar itens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Procurar item..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      category === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {filteredCatalog.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => addItem(c.name, c.price)}
                    className="flex flex-col items-start rounded-lg border border-border/60 p-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="text-xs font-medium">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatMoney(c.price * 100, cur)}
                    </span>
                  </button>
                ))}
              </div>
              {/* custom item */}
              <Separator />
              <div className="space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Item personalizado
                </div>
                <div className="grid grid-cols-[1fr_70px_36px] gap-2">
                  <Input
                    placeholder="Nome"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Preço"
                    inputMode="decimal"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      if (customName && customPrice) {
                        addItem(customName, Number(customPrice));
                        setCustomName("");
                        setCustomPrice("");
                      }
                    }}
                    disabled={!customName || !customPrice}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bill editor */}
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {selectedTable.label} · Conta
              </CardTitle>
              {bill.items.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {bill.items.length} itens
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {bill.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem itens. Adicione a partir do catálogo.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {bill.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {it.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatMoney(it.unitPriceMinor, cur)} cada
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => changeQty(it.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-5 text-center text-sm font-medium tabular">
                          {it.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => changeQty(it.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="w-20 text-right text-sm font-medium tabular">
                        {formatMoney(it.totalMinor, cur)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(it.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* adjustments */}
              {bill.adjustments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    {bill.adjustments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          {a.label}
                          <button
                            onClick={() => removeAdjustment(a.id)}
                            className="text-muted-foreground/60 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                        <span
                          className={
                            a.amountMinor < 0 ? "text-destructive" : ""
                          }
                        >
                          {formatMoney(a.amountMinor, cur)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* add adjustment */}
              <div className="grid grid-cols-[110px_1fr_70px_36px] gap-2">
                <Select value={adjType} onValueChange={setAdjType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISCOUNT">Desconto</SelectItem>
                    <SelectItem value="SERVICE">Serviço</SelectItem>
                    <SelectItem value="TAX">Imposto</SelectItem>
                    <SelectItem value="SURCHARGE">Taxa</SelectItem>
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
                  disabled={!adjLabel || !adjAmount}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* totals */}
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular">
                    {formatMoney(bill.subtotalMinor, cur)}
                  </span>
                </div>
                {bill.adjustmentTotalMinor !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ajustamentos</span>
                    <span className="tabular">
                      {formatMoney(bill.adjustmentTotalMinor, cur)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular">
                    {formatMoney(bill.totalMinor, cur)}
                  </span>
                </div>
              </div>

              {/* confirm for QR checkout */}
              <Button
                className="w-full"
                size="lg"
                onClick={() => setQrOpen(true)}
                disabled={bill.items.length === 0}
              >
                <QrCode className="mr-2 h-4 w-4" /> Confirmar para pagamento
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                O cliente paga escaneando o QR da mesa
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTable && (
        <QrDetailDialog
          table={selectedTable}
          open={qrOpen}
          onOpenChange={setQrOpen}
          canManage={canManage}
        />
      )}
    </div>
  );
}
