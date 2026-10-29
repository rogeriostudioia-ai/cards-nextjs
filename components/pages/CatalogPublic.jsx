"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart, Plus, Minus, Trash2, Store, MessageCircle, ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPublicCatalog, parsePreco, formatBRL, cleanWhatsapp, buildOrderMessage, buildWhatsappLink } from "@/lib/catalogApi";

const SEM_CATEGORIA = "__sem__";

const CatalogPublic = ({ slug }) => {
  const [state, setState] = useState({ status: "loading" });
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState([]); // somente em memória do navegador
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPublicCatalog(slug).then((r) => alive && setState(r));
    return () => { alive = false; };
  }, [slug]);

  const { catalog = {}, categories = [], products = [] } = state;
  const catIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const hasUncategorized = products.some((p) => !p.categoriaId || !catIds.has(p.categoriaId));
  const visible = products.filter((p) =>
    cat === "all" ? true : cat === SEM_CATEGORIA ? !p.categoriaId || !catIds.has(p.categoriaId) : p.categoriaId === cat
  );

  const add = (p) => setCart((c) => (c.some((x) => x.id === p.id) ? c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { id: p.id, nome: p.nome, preco: p.preco, sku: p.sku, qty: 1 }]));
  const inc = (id) => setCart((c) => c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x)));
  const dec = (id) => setCart((c) => c.flatMap((x) => (x.id === id ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])));
  const remove = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const count = cart.reduce((s, x) => s + x.qty, 0);
  const total = cart.reduce((s, x) => s + (parsePreco(x.preco) || 0) * x.qty, 0);
  const whats = cleanWhatsapp(catalog.whatsapp);
  const finish = () => {
    const link = buildWhatsappLink(whats, buildOrderMessage(catalog.mensagemInicial, cart));
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  if (state.status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (state.status !== "ok") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6" data-testid="catalog-unavailable">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Store className="h-7 w-7 text-slate-400" /></div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Catálogo indisponível</h1>
          <p className="mt-2 text-sm text-slate-500">
            {state.status === "error" ? "Não conseguimos carregar o catálogo agora. Tente novamente em alguns instantes." : "Este catálogo não está disponível no momento."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28" data-testid="catalog-page">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900" data-testid="catalog-title">{catalog.titulo || "Catálogo"}</h1>
          {catalog.descricao && <p className="mt-1 whitespace-pre-line text-sm text-slate-500" data-testid="catalog-description">{catalog.descricao}</p>}
        </div>
        {(categories.length > 0 || hasUncategorized) && products.length > 0 && (
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6" data-testid="catalog-categories">
            {[{ id: "all", nome: "Todos" }, ...categories, ...(hasUncategorized && categories.length > 0 ? [{ id: SEM_CATEGORIA, nome: "Outros" }] : [])].map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)} data-testid={`catalog-cat-${c.id}`}
                className={`flex-shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${cat === c.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                {c.nome}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400" data-testid="catalog-empty">Nenhum produto disponível no momento.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const preco = parsePreco(p.preco);
              const inCart = cart.find((x) => x.id === p.id);
              return (
                <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid={`catalog-product-${p.id}`}>
                  <div className="aspect-[4/3] w-full bg-slate-100">
                    {p.imagemUrl ? (
                      <img src={p.imagemUrl} alt={p.nome} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageOff className="h-8 w-8" /></div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="font-semibold text-slate-900">{p.nome}</h2>
                    {p.descricao && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-500">{p.descricao}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="font-heading text-lg font-bold text-slate-900" data-testid={`catalog-price-${p.id}`}>{preco !== null ? formatBRL(preco) : <span className="text-sm font-medium text-slate-400">Preço a consultar</span>}</span>
                      <Button size="sm" onClick={() => add(p)} data-testid={`catalog-add-${p.id}`} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-1 h-4 w-4" /> {inCart ? `No carrinho (${inCart.qty})` : "Adicionar ao carrinho"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-sm text-slate-600"><strong className="text-slate-900">{count}</strong> {count === 1 ? "item" : "itens"} · {formatBRL(total)}</span>
            <Button onClick={() => setCartOpen(true)} data-testid="catalog-cart-open" className="rounded-full bg-slate-900 hover:bg-slate-800"><ShoppingCart className="mr-2 h-4 w-4" /> Ver carrinho</Button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setCartOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()} data-testid="catalog-cart">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-heading text-lg font-bold text-slate-900">Seu pedido</h2>
              <button type="button" onClick={() => setCartOpen(false)} aria-label="Fechar" data-testid="catalog-cart-close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {cart.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Carrinho vazio.</p>}
              {cart.map((x) => {
                const preco = parsePreco(x.preco);
                return (
                  <div key={x.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3" data-testid={`catalog-cart-item-${x.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{x.nome}</p>
                      <p className="text-xs text-slate-500">{preco !== null ? `${formatBRL(preco)} cada · ${formatBRL(preco * x.qty)}` : "Preço a consultar"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => dec(x.id)} aria-label="Diminuir" data-testid={`catalog-dec-${x.id}`}><Minus className="h-3.5 w-3.5" /></Button>
                      <span className="w-7 text-center text-sm font-semibold" data-testid={`catalog-qty-${x.id}`}>{x.qty}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => inc(x.id)} aria-label="Aumentar" data-testid={`catalog-inc-${x.id}`}><Plus className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => remove(x.id)} aria-label="Remover" data-testid={`catalog-remove-${x.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-3 border-t border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total aproximado</span>
                <span className="font-heading text-xl font-bold text-slate-900" data-testid="catalog-total">{formatBRL(total)}</span>
              </div>
              <p className="text-xs text-slate-400">Pagamento e entrega serão combinados pelo WhatsApp.</p>
              <Button onClick={finish} disabled={!whats || cart.length === 0} data-testid="catalog-finish" className="h-12 w-full rounded-full bg-emerald-600 text-base hover:bg-emerald-700">
                <MessageCircle className="mr-2 h-5 w-5" /> Finalizar pelo WhatsApp
              </Button>
              {!whats && <p className="text-center text-xs text-amber-700" data-testid="catalog-no-whatsapp">O WhatsApp da loja ainda não foi configurado. Entre em contato com a loja.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPublic;
