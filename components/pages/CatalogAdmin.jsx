"use client";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ExternalLink, ImageOff, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { catalogAdmin, parsePreco, formatBRL } from "@/lib/catalogApi";

const errMsg = (e, fb) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join(" ") || fb;
  return fb;
};

const SETTINGS_EMPTY = { ativo: false, titulo: "", descricao: "", whatsapp: "", mensagemInicial: "" };
const CAT_EMPTY = { nome: "", ordem: 0, ativo: true };
const PROD_EMPTY = { nome: "", descricao: "", preco: "", imagemUrl: "", sku: "", categoriaId: "none", ordem: 0, ativo: true };

const Section = ({ title, description, action, children, testId }) => (
  <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6" data-testid={testId}>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-heading text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const CatalogAdmin = ({ onLogout }) => {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(SETTINGS_EMPTY);
  const [savingSettings, setSavingSettings] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [catForm, setCatForm] = useState(null); // { editing, data }
  const [prodForm, setProdForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null); // { kind, item }

  const handleErr = useCallback((e, fb) => {
    if (e?.response?.status === 401) return onLogout?.();
    toast.error(errMsg(e, fb));
  }, [onLogout]);

  useEffect(() => {
    axios.get("/api/clientes")
      .then((r) => setClientes(Array.isArray(r.data) ? r.data : []))
      .catch((e) => handleErr(e, "Não foi possível carregar os clientes."));
  }, [handleErr]);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, c, p] = await Promise.all([catalogAdmin.getSettings(id), catalogAdmin.listCategories(id), catalogAdmin.listProducts(id)]);
      setSettings({ ...SETTINGS_EMPTY, ...s });
      setCategories(c);
      setProducts(p);
    } catch (e) {
      handleErr(e, "Não foi possível carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  }, [handleErr]);
  useEffect(() => { load(clienteId); }, [clienteId, load]);

  const cliente = clientes.find((c) => c.id === clienteId);
  const catalogId = settings.catalogId || settings.id;
  const catName = (id) => categories.find((c) => c.id === id)?.nome;

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        ativo: !!settings.ativo,
        titulo: settings.titulo,
        descricao: settings.descricao,
        whatsapp: (settings.whatsapp || "").trim(),
        mensagemInicial: settings.mensagemInicial,
      };
      const data = await catalogAdmin.saveSettings(clienteId, payload);
      setSettings((s) => ({ ...s, ...(data?.settings || data || {}) }));
      toast.success("Configurações do catálogo salvas.");
    } catch (e) {
      handleErr(e, "Não foi possível salvar as configurações.");
    } finally {
      setSavingSettings(false);
    }
  };

  const saveCategory = async () => {
    const d = catForm.data;
    if (!d.nome.trim()) return toast.error("Informe o nome da categoria.");
    setSaving(true);
    try {
      const payload = { nome: d.nome.trim(), ordem: Number(d.ordem) || 0, ativo: !!d.ativo };
      if (catForm.editing) await catalogAdmin.updateCategory(catForm.editing.id, payload);
      else await catalogAdmin.createCategory({ ...payload, clienteId, ...(catalogId ? { catalogId } : {}) });
      toast.success(catForm.editing ? "Categoria atualizada." : "Categoria criada.");
      setCatForm(null);
      setCategories(await catalogAdmin.listCategories(clienteId));
    } catch (e) {
      handleErr(e, "Não foi possível salvar a categoria.");
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async () => {
    const d = prodForm.data;
    if (!d.nome.trim()) return toast.error("Informe o nome do produto.");
    const preco = parsePreco(d.preco);
    if (String(d.preco ?? "").trim() && preco === null) return toast.error("Preço inválido. Use, por exemplo, 29,90.");
    setSaving(true);
    try {
      const payload = {
        nome: d.nome.trim(),
        descricao: d.descricao || "",
        preco,
        imagemUrl: (d.imagemUrl || "").trim(),
        sku: (d.sku || "").trim(),
        categoriaId: d.categoriaId === "none" ? null : d.categoriaId,
        ordem: Number(d.ordem) || 0,
        ativo: !!d.ativo,
      };
      if (prodForm.editing) await catalogAdmin.updateProduct(prodForm.editing.id, payload);
      else await catalogAdmin.createProduct({ ...payload, clienteId, ...(catalogId ? { catalogId } : {}) });
      toast.success(prodForm.editing ? "Produto atualizado." : "Produto criado.");
      setProdForm(null);
      setProducts(await catalogAdmin.listProducts(clienteId));
    } catch (e) {
      handleErr(e, "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const { kind, item } = toDelete;
    try {
      if (kind === "cat") {
        await catalogAdmin.deleteCategory(item.id);
        setCategories((l) => l.filter((x) => x.id !== item.id));
      } else {
        await catalogAdmin.deleteProduct(item.id);
        setProducts((l) => l.filter((x) => x.id !== item.id));
      }
      toast.success("Removido.");
    } catch (e) {
      handleErr(e, "Não foi possível remover.");
    }
    setToDelete(null);
  };

  const setS = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value }));
  const setC = (k, v) => setCatForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));
  const setP = (k, v) => setProdForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));
  const publicUrl = cliente?.slug && typeof window !== "undefined" ? `${window.location.origin}/catalogo/${cliente.slug}` : "";

  return (
    <div data-testid="catalog-admin-view">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">Catálogo WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">Produtos com carrinho simples; o pedido é finalizado pelo WhatsApp da loja.</p>
      </div>

      <div className="mb-6 max-w-md">
        <Label>Cliente</Label>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="mt-1 bg-white" data-testid="catalog-client-select"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {!clienteId ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400" data-testid="catalog-no-client">
          <Store className="mx-auto mb-2 h-6 w-6" /> Selecione um cliente para configurar o catálogo.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <Section title="Configurações" description="Ative o catálogo e defina os dados da loja." testId="catalog-settings"
            action={publicUrl && (
              <a href={`/catalogo/${cliente.slug}`} target="_blank" rel="noreferrer" data-testid="catalog-public-link" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
                <ExternalLink className="h-4 w-4" /> Ver catálogo público
              </a>
            )}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch checked={!!settings.ativo} onCheckedChange={(v) => setSettings((s) => ({ ...s, ativo: v }))} data-testid="catalog-settings-ativo" id="catAtivo" />
                <Label htmlFor="catAtivo">{settings.ativo ? "Catálogo ativo" : "Catálogo desativado"}</Label>
              </div>
              <div>
                <Label htmlFor="catTitulo">Título</Label>
                <Input id="catTitulo" className="mt-1" value={settings.titulo || ""} onChange={setS("titulo")} placeholder="Ex: Cardápio da Padaria" data-testid="catalog-settings-titulo" />
              </div>
              <div>
                <Label htmlFor="catWhats">WhatsApp da loja</Label>
                <Input id="catWhats" className="mt-1" value={settings.whatsapp || ""} onChange={setS("whatsapp")} placeholder="Ex: +55 (11) 99999-9999" data-testid="catalog-settings-whatsapp" />
                <p className="mt-1 text-xs text-slate-500">Com DDI e DDD. Espaços, parênteses e hífens são removidos no link.</p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="catDesc">Descrição</Label>
                <Textarea id="catDesc" className="mt-1" rows={2} value={settings.descricao || ""} onChange={setS("descricao")} data-testid="catalog-settings-descricao" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="catMsg">Mensagem inicial</Label>
                <Textarea id="catMsg" className="mt-1" rows={2} value={settings.mensagemInicial || ""} onChange={setS("mensagemInicial")} placeholder="Olá! Gostaria de fazer este pedido:" data-testid="catalog-settings-mensagem" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={saveSettings} disabled={savingSettings} data-testid="catalog-settings-save" className="rounded-full bg-indigo-600 hover:bg-indigo-700">
                {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar configurações
              </Button>
            </div>
          </Section>

          <Section title="Categorias" description="Opcional. Organizam os produtos na página pública." testId="catalog-categories-section"
            action={<Button variant="outline" className="rounded-full" data-testid="catalog-cat-new" onClick={() => setCatForm({ editing: null, data: { ...CAT_EMPTY, ordem: categories.length } })}><Plus className="mr-2 h-4 w-4" /> Nova categoria</Button>}>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-400" data-testid="catalog-cat-empty">Nenhuma categoria.</p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid={`catalog-cat-row-${c.id}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{c.nome}</span>
                      <span className="text-xs text-slate-400">ordem {c.ordem ?? 0}</span>
                      {c.ativo === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inativa</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Editar categoria" data-testid={`catalog-cat-edit-${c.id}`} onClick={() => setCatForm({ editing: c, data: { ...CAT_EMPTY, ...c, nome: c.nome || "" } })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 hover:bg-red-50" aria-label="Excluir categoria" data-testid={`catalog-cat-delete-${c.id}`} onClick={() => setToDelete({ kind: "cat", item: c })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Produtos" description="Somente produtos ativos aparecem na página pública." testId="catalog-products-section"
            action={<Button className="rounded-full bg-indigo-600 hover:bg-indigo-700" data-testid="catalog-prod-new" onClick={() => setProdForm({ editing: null, data: { ...PROD_EMPTY, ordem: products.length } })}><Plus className="mr-2 h-4 w-4" /> Novo produto</Button>}>
            {products.length === 0 ? (
              <p className="text-sm text-slate-400" data-testid="catalog-prod-empty">Nenhum produto.</p>
            ) : (
              <div className="space-y-3">
                {products.map((p) => {
                  const preco = parsePreco(p.preco);
                  return (
                    <div key={p.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-3" data-testid={`catalog-prod-row-${p.id}`}>
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {p.imagemUrl ? <img src={p.imagemUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageOff className="h-5 w-5" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{p.nome}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.ativo === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>{p.ativo === false ? "Inativo" : "Ativo"}</span>
                          {p.categoriaId && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{catName(p.categoriaId) || "Categoria removida"}</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {preco !== null ? formatBRL(preco) : "Sem preço"}{p.sku ? ` · SKU ${p.sku}` : ""} · ordem {p.ordem ?? 0}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Editar produto" data-testid={`catalog-prod-edit-${p.id}`}
                          onClick={() => setProdForm({ editing: p, data: { ...PROD_EMPTY, ...p, nome: p.nome || "", descricao: p.descricao || "", imagemUrl: p.imagemUrl || "", sku: p.sku || "", preco: preco !== null ? String(preco).replace(".", ",") : "", categoriaId: p.categoriaId || "none", ativo: p.ativo !== false } })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 hover:bg-red-50" aria-label="Excluir produto" data-testid={`catalog-prod-delete-${p.id}`} onClick={() => setToDelete({ kind: "prod", item: p })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}

      <Dialog open={!!catForm} onOpenChange={(o) => !o && setCatForm(null)}>
        <DialogContent className="sm:max-w-md" data-testid="catalog-cat-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{catForm?.editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Categorias agrupam os produtos no catálogo.</DialogDescription>
          </DialogHeader>
          {catForm && (
            <div className="space-y-4">
              <div><Label>Nome</Label><Input className="mt-1" value={catForm.data.nome} onChange={(e) => setC("nome", e.target.value)} data-testid="catalog-cat-nome" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Ordem</Label><Input className="mt-1" type="number" value={catForm.data.ordem} onChange={(e) => setC("ordem", e.target.value)} data-testid="catalog-cat-ordem" /></div>
                <div className="flex items-end gap-2 pb-2"><Switch checked={!!catForm.data.ativo} onCheckedChange={(v) => setC("ativo", v)} data-testid="catalog-cat-ativo" /><span className="text-sm">{catForm.data.ativo ? "Ativa" : "Inativa"}</span></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCatForm(null)}>Cancelar</Button>
            <Button onClick={saveCategory} disabled={saving} data-testid="catalog-cat-save" className="rounded-full bg-indigo-600 hover:bg-indigo-700">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!prodForm} onOpenChange={(o) => !o && setProdForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="catalog-prod-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{prodForm?.editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>Somente o nome é obrigatório.</DialogDescription>
          </DialogHeader>
          {prodForm && (
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input className="mt-1" value={prodForm.data.nome} onChange={(e) => setP("nome", e.target.value)} data-testid="catalog-prod-nome" /></div>
              <div><Label>Descrição</Label><Textarea className="mt-1" rows={3} value={prodForm.data.descricao} onChange={(e) => setP("descricao", e.target.value)} data-testid="catalog-prod-descricao" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Preço (R$)</Label><Input className="mt-1" inputMode="decimal" placeholder="Ex: 29,90" value={prodForm.data.preco} onChange={(e) => setP("preco", e.target.value)} data-testid="catalog-prod-preco" /></div>
                <div><Label>SKU</Label><Input className="mt-1" value={prodForm.data.sku} onChange={(e) => setP("sku", e.target.value)} data-testid="catalog-prod-sku" /></div>
              </div>
              <div><Label>URL da imagem</Label><Input className="mt-1" placeholder="https://..." value={prodForm.data.imagemUrl} onChange={(e) => setP("imagemUrl", e.target.value)} data-testid="catalog-prod-imagem" /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={prodForm.data.categoriaId} onValueChange={(v) => setP("categoriaId", v)}>
                  <SelectTrigger className="mt-1" data-testid="catalog-prod-categoria"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Ordem</Label><Input className="mt-1" type="number" value={prodForm.data.ordem} onChange={(e) => setP("ordem", e.target.value)} data-testid="catalog-prod-ordem" /></div>
                <div className="flex items-end gap-2 pb-2"><Switch checked={!!prodForm.data.ativo} onCheckedChange={(v) => setP("ativo", v)} data-testid="catalog-prod-ativo" /><span className="text-sm">{prodForm.data.ativo ? "Ativo" : "Inativo"}</span></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setProdForm(null)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={saving} data-testid="catalog-prod-save" className="rounded-full bg-indigo-600 hover:bg-indigo-700">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid="catalog-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete?.kind === "cat" ? "Excluir categoria?" : "Excluir produto?"}</AlertDialogTitle>
            <AlertDialogDescription><strong>{toDelete?.item?.nome}</strong> será removido do catálogo. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="catalog-delete-confirm" className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CatalogAdmin;
