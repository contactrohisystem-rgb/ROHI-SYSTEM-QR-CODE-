"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Utensils } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
}
interface CategoryView {
  id: string;
  name: string;
  products: ProductView[];
}

export function MenuSection() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodCatId, setProdCatId] = useState<string | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodSaving, setProdSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/menu");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  async function addProduct() {
    if (!prodCatId || !prodName || !prodPrice) return;
    setProdSaving(true);
    try {
      const res = await fetch("/api/menu/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: prodCatId, name: prodName, description: prodDesc || undefined, price: prodPrice }),
      });
      if (res.ok) {
        toast({ title: "Produto criado" });
        setProdName(""); setProdDesc(""); setProdPrice(""); setProdOpen(false); await load();
      } else { toast({ title: "Erro", variant: "destructive" }); }
    } finally { setProdSaving(false); }
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Menu</h2>
          <p className="text-sm text-muted-foreground">Categorias e produtos</p>
        </div>
        <Button size="sm" onClick={() => { setCatName(""); setCatOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova categoria
        </Button>
      </div>

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
                      setProdCatId(cat.id); setProdName(""); setProdDesc(""); setProdPrice(""); setProdOpen(true);
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
                          <div className="truncate text-sm font-medium">{p.name}</div>
                          {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
                        </div>
                        <span className="text-sm font-medium tabular">{formatMoney(p.priceMinor)}</span>
                        <Badge variant={p.available ? "secondary" : "outline"} className="cursor-pointer text-[10px]" onClick={() => toggleAvailable(p)}>
                          {p.available ? "Disponível" : "Indisp."}
                        </Badge>
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

      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo produto</DialogTitle><DialogDescription>Adicione um produto.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label htmlFor="prod-name">Nome</Label><Input id="prod-name" placeholder="Cerveja 2M" value={prodName} onChange={(e) => setProdName(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="prod-desc">Descrição</Label><Input id="prod-desc" placeholder="Cerveja local gelada" value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="prod-price">Preço (MZN)</Label><Input id="prod-price" placeholder="75" inputMode="decimal" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdOpen(false)}>Cancelar</Button>
            <Button onClick={addProduct} disabled={prodSaving || !prodName || !prodPrice}>{prodSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
