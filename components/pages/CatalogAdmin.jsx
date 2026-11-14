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
import { catalogAdmin, catalogAccounts, isAccountActive, isReservedCatalogSlug, RESERVED_CATALOG_SLUGS, parsePreco, formatBRL } from "@/lib/catalogApi";

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

const genTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(12);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
};

const CatalogAccountSection = ({ clienteId, onAuthError }) => {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [email, setEmail] = useState("");
  const [temp, setTemp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [delivered, setDelivered] = useState(null); // { email, senha } exibido uma única vez

  useEffect(() => {
    let alive = true;
    setLoading(true); setAccount(null); setDelivered(null); setEmail(""); setTemp(""); setResetOpen(false);
    catalogAccounts.get(clienteId)
      .then((a) => alive && setAccount(a))
      .catch((e) => alive && onAuthError(e, "Não foi possível carregar a conta do cliente."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clienteId, onAuthError]);

  const checkTemp = () => {
    if (temp.length < 8) { toast.error("A senha temporária deve ter pelo menos 8 caracteres."); return false; }
    return true;
  };

  const create = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");
    if (!checkTemp()) return;
    setBusy(true);
    try {
      const a = await catalogAccounts.create(clienteId, email.trim(), temp);
      setAccount({ ...a, email: a?.email || email.trim() });
      setDelivered({ email: a?.email || email.trim(), senha: temp });
      setTemp("");
      toast.success("Conta criada.");
    } catch (e) {
      onAuthError(e, "Não foi possível criar a conta.");
    } finally { setBusy(false); }
  };

  const toggle = async (v) => {
    setBusy(true);
    try {
      const a = await catalogAccounts.update(clienteId, { ativo: v });
      setAccount((old) => ({ ...old, ...a, ativo: a?.ativo ?? v }));
      toast.success(v ? "Conta ativada." : "Conta desativada.");
    } catch (e) {
      onAuthError(e, "Não foi possível atualizar a conta.");
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!checkTemp()) return;
    setBusy(true);
    try {
      await catalogAccounts.resetPassword(clienteId, temp);
      setDelivered({ email: account?.email, senha: temp });
      setTemp(""); setResetOpen(false);
      toast.success("Senha redefinida.");
    } catch (e) {
      onAuthError(e, "Não foi possível redefinir a senha.");
    } finally { setBusy(false); }
  };

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/catalogo/login` : "/catalogo/login";
  const active = account && isAccountActive(account);

  return (
    <Section title="Acesso do cliente" description="Conta para o cliente gerenciar o próprio catálogo." testId="catalog-account-section">
      {loading ? (
        <div className="flex py-4 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !account ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="catalog-account-create">
          <div><Label>E-mail do cliente</Label><Input className="mt-1" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="catalog-account-email" /></div>
          <div>
            <Label>Senha temporária</Label>
            <div className="mt-1 flex gap-2">
              <Input autoComplete="new-password" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="mín. 8 caracteres" data-testid="catalog-account-temp" />
              <Button type="button" variant="outline" onClick={() => setTemp(genTempPassword())} data-testid="catalog-account-gen">Gerar</Button>
            </div>
          </div>
          <Button onClick={create} disabled={busy} className="rounded-full bg-indigo-600 hover:bg-indigo-700" data-testid="catalog-account-create-btn">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta</Button>
        </div>
      ) : (
        <div className="space-y-4" data-testid="catalog-account-info">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-900" data-testid="catalog-account-email-view">{account.email}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`} data-testid="catalog-account-status">{active ? "Ativa" : "Desativada"}</span>
            <div className="ml-auto flex items-center gap-2">
              <Switch checked={!!active} disabled={busy} onCheckedChange={toggle} data-testid="catalog-account-toggle" />
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setResetOpen((o) => !o); setTemp(""); }} data-testid="catalog-account-reset-open">Redefinir senha</Button>
            </div>
          </div>
          {resetOpen && (
            <div className="flex flex-col gap-2 sm:flex-row" data-testid="catalog-account-reset">
              <Input autoComplete="new-password" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="Nova senha temporária (mín. 8)" data-testid="catalog-account-reset-temp" />
              <Button type="button" variant="outline" onClick={() => setTemp(genTempPassword())}>Gerar</Button>
              <Button onClick={reset} disabled={busy} className="rounded-full bg-indigo-600 hover:bg-indigo-700" data-testid="catalog-account-reset-btn">Confirmar</Button>
            </div>
          )}
        </div>
      )}
      {delivered && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="catalog-account-delivery">
          <p className="font-semibold">Entregue estes dados ao cliente por um canal seguro (eles não serão exibidos novamente):</p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            <li>Login: {loginUrl}</li>
            <li>E-mail: {delivered.email}</li>
            <li>Senha temporária: {delivered.senha}</li>
          </ul>
          <p className="mt-2 text-xs">No primeiro acesso, o cliente será obrigado a criar uma nova senha.</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setDelivered(null)} data-testid="catalog-account-delivery-close">Já entreguei, ocultar</Button>
        </div>
      )}
    </Section>
  );
};

const CatalogAdmin = ({ onLogout, api = catalogAdmin, fixedClienteId = "", slug = "", mode = "admin" }) => {
  const isClient = mode === "client";
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState(fixedClienteId);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState(SETTINGS_EMPTY);
  const [savingSettings, setSavingSettings] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [catForm, setCatForm] = useState(null); // { editing, data }
  const [prodForm, setProdForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null); // { kind, item }

  const handleErr = useCallback((e, fb) => {
    const st = e?.response?.status;
    if (st === 401) return onLogout?.();
    if (st === 403) return toast.error("Você não tem permissão para esta ação.");
    toast.error(errMsg(e, fb));
  }, [onLogout]);

  useEffect(() => {
    if (isClient) return;
    axios.get("/api/clientes")
      .then((r) => setClientes(Array.isArray(r.data) ? r.data : []))
      .catch((e) => handleErr(e, "Não foi possível carregar os clientes."));
  }, [handleErr, isClient]);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    try {
      const [s, c, p] = await Promise.all([api.getSettings(id), api.listCategories(id), api.listProducts(id)]);
      setSettings({ ...SETTINGS_EMPTY, ...s });
      setCategories(c);
      setProducts(p);
    } catch (e) {
      const st = e?.response?.status;
      // Nunca manter dados anteriores em caso de erro
      setSettings(SETTINGS_EMPTY); setCategories([]); setProducts([]);
      if (st === 401) return onLogout?.();
      setLoadError(st === 403 || st === 404 ? "Catálogo não encontrado ou sem permissão de acesso." : "Não foi possível carregar o catálogo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [api, onLogout]);
  useEffect(() => { load(clienteId); }, [clienteId, load]);

  const cliente = isClient ? { slug } : clientes.find((c) => c.id === clienteId);
  const slugReserved = isReservedCatalogSlug(cliente?.slug);
  const catalogId = settings.catalogId || settings.id;
  const catName = (id) => categories.find((c) => c.id === id)?.nome;

  const saveSettings = async () => {
    if (slugReserved && settings.ativo) return toast.error(`O endereço "${cliente?.slug}" é reservado pelo sistema. O catálogo não pode ser ativado com este slug.`);
    setSavingSettings(true);
    try {
      const payload = {
        ativo: !!settings.ativo,
        titulo: settings.titulo,
        descricao: settings.descricao,
        whatsapp: (settings.whatsapp || "").trim(),
        mensagemInicial: settings.mensagemInicial,
      };
      const data = await api.saveSettings(clienteId, payload);
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
      if (catForm.editing) await api.updateCategory(catForm.editing.id, payload);
      else await api.createCategory({ ...payload, clienteId, ...(catalogId ? { catalogId } : {}) });
      toast.success(catForm.editing ? "Categoria atualizada." : "Categoria criada.");
      setCatForm(null);
      setCategories(await api.listCategories(clienteId));
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
      if (prodForm.editing) await api.updateProduct(prodForm.editing.id, payload);
      else await api.createProduct({ ...payload, clienteId, ...(catalogId ? { catalogId } : {}) });
      toast.success(prodForm.editing ? "Produto atualizado." : "Produto criado.");
      setProdForm(null);
      setProducts(await api.listProducts(clienteId));
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
        await api.deleteCategory(item.id);
        setCategories((l) => l.filter((x) => x.id !== item.id));
      } else {
        await api.deleteProduct(item.id);
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
  const publicUrl = cliente?.slug && !slugReserved && typeof window !== "undefined" ? `${window.location.origin}/catalogo/${cliente.slug}` : "";

  return (
    <div data-testid="catalog-admin-view">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900">{isClient ? "Meu catálogo" : "Catálogo WhatsApp"}</h1>
        <p className="mt-1 text-sm text-slate-500">Produtos com carrinho simples; o pedido é finalizado pelo WhatsApp da loja.</p>
      </div>

      {!isClient && (
      <div className="mb-6 max-w-md">
        <Label>Cliente</Label>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="mt-1 bg-white" data-testid="catalog-client-select"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}{isReservedCatalogSlug(c.slug) ? " — slug reservado" : ""}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      )}

      {!clienteId ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400" data-testid="catalog-no-client">
          <Store className="mx-auto mb-2 h-6 w-6" /> {isClient ? "Conta sem catálogo vinculado. Fale com o administrador." : "Selecione um cliente para configurar o catálogo."}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : loadError ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500" data-testid="catalog-load-error">{loadError}</div>
      ) : (
        <>
          {!isClient && <CatalogAccountSection clienteId={clienteId} onAuthError={handleErr} />}
          {slugReserved && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" data-testid="catalog-slug-conflict">
              <p className="font-semibold">Conflito de endereço: o slug &quot;{cliente?.slug}&quot; é reservado pelo sistema.</p>
              <p className="mt-1">
                Os endereços /catalogo/{RESERVED_CATALOG_SLUGS.join(", /catalogo/")} são usados pelo acesso do cliente, então o catálogo público deste cliente não pode ser ativado.
                {isClient ? " Fale com o administrador." : " Altere o slug do cliente na aba Clientes para liberar o catálogo. O mini site não é afetado."}
              </p>
            </div>
          )}
          <Section title="Configurações" description="Ative o catálogo e defina os dados da loja." testId="catalog-settings"
            action={publicUrl && (
              <a href={`/catalogo/${cliente.slug}`} target="_blank" rel="noreferrer" data-testid="catalog-public-link" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
                <ExternalLink className="h-4 w-4" /> Ver catálogo público
              </a>
            )}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch checked={!!settings.ativo} disabled={slugReserved && !settings.ativo} onCheckedChange={(v) => setSettings((s) => ({ ...s, ativo: v }))} data-testid="catalog-settings-ativo" id="catAtivo" />
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
