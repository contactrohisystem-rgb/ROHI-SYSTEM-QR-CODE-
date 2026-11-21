"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Utensils, Flame } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface ProductView {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
  available: boolean;
  kitchenStationId: string | null;
}
interface CategoryView {
  id: string;
  name: string;
  products: ProductView[];
}
interface StationView {
  id: string;
  name: string;
  sortOrder: number;
  productCount: number;
}

export function MenuSection() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [stations, setStations] = useState<StationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodCatId, setProdCatId] = useState<string | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStationId, setProdStationId] = useState<string>("__none__");
  const [prodSaving, setProdSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductView | null>(null);
  // Stations management
  const [stationsOpen, setStationsOpen] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [stationSaving, setStationSaving] = useState(false);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editingStationName, setEditingStationName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [menuRes, stRes] = await Promise.all([
        fetch("/api/menu"),
        fetch("/api/kitchen/stations"),
      ]);
      if (menuRes.ok) {
        const data = await menuRes.json();
        setCategories(data.categories ?? []);
      }
      if (stRes.ok) {
        const data = await stRes.json();
        setStations(data.stations ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadStations = async () => {
    const res = await fetch("/api/kitchen/stations");
    if (res.ok) {
      const data = await res.json();
      setStations(data.stations ?? []);
    }
  };

  async function addCategory() {
    if (!catName) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName }),
      });
      if (res.ok) {
        toast({ title: "Categoria criada" });
        setCatName(""); setCatOpen(false); await load();
      }
    } finally { setCatSaving(false); }
  }

  async function saveProduct() {
    if (editingProduct) {
      // Edit existing
      setProdSaving(true);
      try {
        const res = await fetch(`/api/menu/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prodName,
            description: prodDesc || null,
            price: prodPrice,
            kitchenStationId: prodStationId === "__none__" ? null : prodStationId,
          }),
        });
        if (res.ok) {
          toast({ title: "Produto actualizado" });
          setProdOpen(false); setEditingProduct(null); await load();
        } else { toast({ title: "Erro", variant: "destructive" }); }
      } finally { setProdSaving(false); }
    } else {
      // Create
      if (!prodCatId || !prodName || !prodPrice) return;
      setProdSaving(true);
      try {
        const res = await fetch("/api/menu/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: prodCatId,
            name: prodName,
            description: prodDesc || undefined,
            price: prodPrice,
            kitchenStationId: prodStationId === "__none__" ? null : prodStationId,
          }),
        });
        if (res.ok) {
          toast({ title: "Produto criado" });
          setProdName(""); setProdDesc(""); setProdPrice(""); setProdStationId("__none__"); setProdOpen(false); await load();
        } else { toast({ title: "Erro", variant: "destructive" }); }
      } finally { setProdSaving(false); }
    }
  }

  function openEditProduct(p: ProductView) {
    setEditingProduct(p);
    setProdName(p.name);
    setProdDesc(p.description ?? "");
    setProdPrice(String(p.priceMinor / 100));
    setProdStationId(p.kitchenStationId ?? "__none__");
    setProdCatId(null);
    setProdOpen(true);
  }

  async function deleteCategory(id: string) {
    const res = await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Categoria eliminada" }); await load(); }
  }

  async function deleteProduct(id: string) {
    const res = await fetch(`/api/menu/products/${id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Produto eliminado" }); await load(); }
  }

  async function toggleAvailable(p: ProductView) {
    const res = await fetch(`/api/menu/products/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !p.available }),
    });
    if (res.ok) await load();
  }

  // Station CRUD
  async function addStation() {
    if (!newStationName) return;
    setStationSaving(true);
    try {
      const res = await fetch("/api/kitchen/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStationName }),
      });
      if (res.ok) {
        toast({ title: "Estação criada" });
        setNewStationName("");
        await loadStations();
      }
    } finally { setStationSaving(false); }
  }

  async function saveStationRename(id: string) {
    if (!editingStationName) return;
    const res = await fetch(`/api/kitchen/stations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingStationName }),
    });
    if (res.ok) {
      toast({ title: "Estação actualizada" });
      setEditingStationId(null);
      await loadStations();
    }
  }

  async function deleteStation(id: string) {
    const res = await fetch(`/api/kitchen/stations/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Estação eliminada", description: "Produtos voltaram à fila padrão." });
      await load();
    }
  }

  const stationNameById = new Map(stations.map((s) => [s.id, s.name]));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Menu</h2>
          <p className="text-sm text-muted-foreground">Categorias, produtos e estações de cozinha</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStationsOpen((v) => !v)}>
            <Flame className="mr-1.5 h-4 w-4" /> Estações {stations.length > 0 && `(${stations.length})`}
          </Button>
          <Button size="sm" onClick={() => { setCatName(""); setCatOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova categoria
          </Button>
        </div>
      </div>

      {/* Kitchen stations management (collapsible) */}
      {stationsOpen && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Estações de Cozinha</h3>
              <span className="text-xs text-muted-foreground">— cada produto é encaminhado para a sua estação no KDS</span>
            </div>

            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Nova estação (ex: Grelha, Bar...)"
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStation()}
                className="h-9 max-w-xs"
              />
              <Button size="sm" onClick={addStation} disabled={stationSaving || !newStationName}>
                {stationSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                Adicionar
              </Button>
            </div>

            {stations.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Sem estações. Os pedidos vão todos para a fila padrão do KDS.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {stations.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-2">
                    {editingStationId === s.id ? (
                      <>
                        <Input
                          value={editingStationName}
                          onChange={(e) => setEditingStationName(e.target.value)}
                          className="h-8 max-w-[200px]"
                          autoFocus
                        />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => saveStationRename(s.id)}>Guardar</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingStationId(null)}>Cancelar</Button>
                      </>
                    ) : (
                      <>
                        <Flame className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium">{s.name}</span>
                        <Badge variant="outline" className="text-[10px]">{s.productCount} produto{s.productCount === 1 ? "" : "s"}</Badge>
                        <Button size="ghost" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => { setEditingStationId(s.id); setEditingStationName(s.name); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="ghost" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar estação?</AlertDialogTitle>
                              <AlertDialogDescription>Os produtos desta estação voltam à fila padrão. A estação é removida do KDS.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteStation(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {categories.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-10">
          <Utensils className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sem categorias. Crie a primeira.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{cat.name}</h3>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => {
                      setProdCatId(cat.id); setProdName(""); setProdDesc(""); setProdPrice(""); setProdStationId("__none__"); setProdOpen(true);
                    }}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Produto
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar categoria?</AlertDialogTitle>
                          <AlertDialogDescription>Todos os produtos serão eliminados.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCategory(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {cat.products.length > 0 && (
                  <div className="mt-3 divide-y divide-border/60">
                    {cat.products.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 py-2">
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{p.name}</span>
                            {p.kitchenStationId && (
                              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                                <Flame className="h-2.5 w-2.5" />
                                {stationNameById.get(p.kitchenStationId) ?? "—"}
                              </Badge>
                            )}
                          </div>
                          {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
                        </div>
                        <span className="text-sm font-medium tabular">{formatMoney(p.priceMinor)}</span>
                        <Badge variant={p.available ? "secondary" : "outline"} className="cursor-pointer text-[10px]" onClick={() => toggleAvailable(p)}>
                          {p.available ? "Disponível" : "Indisp."}
                        </Badge>
                        <Button size="ghost" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openEditProduct(p)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="ghost" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteProduct(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova categoria</DialogTitle><DialogDescription>Adicione uma categoria.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cat-name">Nome</Label>
            <Input id="cat-name" placeholder="Entradas, Bebidas..." value={catName} onChange={(e) => setCatName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button onClick={addCategory} disabled={catSaving || !catName}>{catSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={prodOpen} onOpenChange={(o) => { setProdOpen(o); if (!o) setEditingProduct(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingProduct ? "Editar produto" : "Novo produto"}</DialogTitle><DialogDescription>{editingProduct ? "Altere as propriedades do produto." : "Adicione um produto."}</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label htmlFor="prod-name">Nome</Label><Input id="prod-name" placeholder="Cerveja 2M" value={prodName} onChange={(e) => setProdName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="prod-desc">Descrição</Label><Input id="prod-desc" placeholder="Cerveja local gelada" value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="prod-price">Preço (MZN)</Label><Input id="prod-price" placeholder="75" inputMode="decimal" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} /></div>
            <div className="space-y-2">
              <Label htmlFor="prod-station">Estação de cozinha</Label>
              <Select value={prodStationId} onValueChange={setProdStationId}>
                <SelectTrigger id="prod-station">
                  <SelectValue placeholder="Fila padrão (sem estação)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Fila padrão (sem estação)</SelectItem>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determina para que estação o item é encaminhado no KDS.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProdOpen(false); setEditingProduct(null); }}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={prodSaving || !prodName || !prodPrice || (!editingProduct && !prodCatId)}>{prodSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{editingProduct ? "Guardar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
