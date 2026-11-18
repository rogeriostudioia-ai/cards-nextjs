"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, ShoppingCart, Plus, Minus, Trash2, Store, MessageCircle, ImageOff, X, ChevronLeft, ChevronRight, Share2, Link2, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readableOn, withAlpha } from "@/lib/themeContrast";
import {
  fetchPublicCatalog, fetchPublicCliente, fetchPublicProduct, parsePreco, formatBRL, cleanWhatsapp,
  buildOrderMessage, buildWhatsappLink, productImages, productPath, catalogPath, absoluteUrl, shareOrCopy, copyToClipboard,
} from "@/lib/catalogApi";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const safeHex = (v, fb) => (HEX.test(String(v || "").trim()) ? String(v).trim() : fb);
const SEM_CATEGORIA = "__sem__";

/* ---------- Tema a partir do mini site (corFundo, corBotoes, profileUrl) ---------- */
const useTheme = (cliente) => {
  const bg = safeHex(cliente?.corFundo, "#F8FAFC");
  const fg = readableOn(bg);
  const accent = safeHex(cliente?.corBotoes, "#059669");
  return {
    bg, fg, fgMuted: withAlpha(fg, 0.72), line: withAlpha(fg, 0.14), soft: withAlpha(fg, 0.06),
    accent, accentStyle: { backgroundColor: accent, color: readableOn(accent) },
  };
};

/* ---------- Carrinho: somente no navegador (sessionStorage por catálogo) ---------- */
const useCart = (slug) => {
  const key = `dc_cart_${slug}`;
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { setCart(JSON.parse(window.sessionStorage.getItem(key) || "[]") || []); } catch { setCart([]); }
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.sessionStorage.setItem(key, JSON.stringify(cart)); } catch { /* sem armazenamento */ }
  }, [cart, key, hydrated]);
  const add = (p) => setCart((c) => (c.some((x) => x.id === p.id) ? c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { id: p.id, nome: p.nome, preco: p.preco, sku: p.sku, qty: 1 }]));
  const inc = (id) => setCart((c) => c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x)));
  const dec = (id) => setCart((c) => c.flatMap((x) => (x.id === id ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])));
  const remove = (id) => setCart((c) => c.filter((x) => x.id !== id));
  const count = cart.reduce((s, x) => s + x.qty, 0);
  const total = cart.reduce((s, x) => s + (parsePreco(x.preco) || 0) * x.qty, 0);
  return { cart, add, inc, dec, remove, count, total };
};

/* ---------- Galeria com setas, pontos e deslize ---------- */
export const ProductGallery = ({ images, alt, thumbs = false, className = "aspect-[4/3]", testId = "gallery" }) => {
  const [i, setI] = useState(0);
  const touch = useRef(null);
  const n = images.length;
  useEffect(() => { setI(0); }, [n]);
  if (!n) {
    return <div className={`flex w-full items-center justify-center bg-slate-100 text-slate-300 ${className}`} data-testid={`${testId}-empty`}><ImageOff className="h-8 w-8" /></div>;
  }
  const go = (d) => setI((x) => (x + d + n) % n);
  return (
    <div data-testid={testId}>
      <div
        className={`relative w-full overflow-hidden bg-slate-100 ${className}`}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <img src={images[i]} alt={`${alt} - foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover" data-testid={`${testId}-img`} />
        {n > 1 && (
          <>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(-1); }} aria-label="Foto anterior" data-testid={`${testId}-prev`} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow hover:bg-white"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(1); }} aria-label="Próxima foto" data-testid={`${testId}-next`} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow hover:bg-white"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {images.map((_, k) => (
                <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      {thumbs && n > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((u, k) => (
            <button key={k} type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} data-testid={`${testId}-thumb-${k}`}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${k === i ? "border-slate-900" : "border-transparent opacity-70"}`}>
              <img src={u} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- Compartilhar / copiar link ---------- */
const ShareActions = ({ path, title, labelShare, labelCopy, testId, style, compact = false }) => {
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2000); };
  const share = async () => {
    const r = await shareOrCopy(absoluteUrl(path), title);
    if (r === "copied") flash("Link copiado!");
    else if (r === "failed") flash("Não foi possível compartilhar.");
  };
  const copy = async () => flash((await copyToClipboard(absoluteUrl(path))) ? "Link copiado!" : "Não foi possível copiar.");
  const cls = compact ? "h-8 rounded-full px-3 text-xs" : "h-9 rounded-full px-4 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} data-testid={`${testId}-share`} className={`inline-flex items-center gap-1.5 border font-medium ${cls}`} style={style}>
        <Share2 className="h-3.5 w-3.5" /> {labelShare}
      </button>
      <button type="button" onClick={copy} data-testid={`${testId}-copy`} className={`inline-flex items-center gap-1.5 border font-medium ${cls}`} style={style}>
        {msg === "Link copiado!" ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {labelCopy}
      </button>
      {msg && <span className="text-xs font-medium" style={{ color: style?.color }} role="status" data-testid={`${testId}-msg`}>{msg}</span>}
    </div>
  );
};

/* ---------- Carrinho (barra + painel) ---------- */
const CartUI = ({ cartApi, catalog, accentStyle }) => {
  const { cart, inc, dec, remove, count, total } = cartApi;
  const [open, setOpen] = useState(false);
  const whats = cleanWhatsapp(catalog.whatsapp);
  const finish = () => {
    const link = buildWhatsappLink(whats, buildOrderMessage(catalog.mensagemInicial, cart));
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };
  return (
    <>
      {count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-sm text-slate-600"><strong className="text-slate-900">{count}</strong> {count === 1 ? "item" : "itens"} · {formatBRL(total)}</span>
            <Button onClick={() => setOpen(true)} data-testid="catalog-cart-open" className="rounded-full bg-slate-900 hover:bg-slate-800"><ShoppingCart className="mr-2 h-4 w-4" /> Ver carrinho</Button>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()} data-testid="catalog-cart">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-heading text-lg font-bold text-slate-900">Seu pedido</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" data-testid="catalog-cart-close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
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
              <Button onClick={finish} disabled={!whats || cart.length === 0} data-testid="catalog-finish" style={accentStyle} className="h-12 w-full rounded-full text-base hover:opacity-90">
                <MessageCircle className="mr-2 h-5 w-5" /> Finalizar pelo WhatsApp
              </Button>
              {!whats && <p className="text-center text-xs text-amber-700" data-testid="catalog-no-whatsapp">O WhatsApp da loja ainda não foi configurado. Entre em contato com a loja.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Loading = () => <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
const Unavailable = ({ error, what = "catálogo", backHref }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6" data-testid="catalog-unavailable">
    <div className="max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><Store className="h-7 w-7 text-slate-400" /></div>
      <h1 className="font-heading text-xl font-bold text-slate-900">{what === "produto" ? "Produto indisponível" : "Catálogo indisponível"}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {error ? `Não conseguimos carregar o ${what} agora. Tente novamente em alguns instantes.` : `Este ${what} não está disponível no momento.`}
      </p>
      {backHref && <Link href={backHref} className="mt-4 inline-block text-sm font-medium text-slate-700 underline">Voltar ao catálogo</Link>}
    </div>
  </div>
);

const StoreHeader = ({ cliente, catalog, theme, slug }) => {
  const [logoOk, setLogoOk] = useState(true);
  const storeName = (cliente?.nome || "").trim();
  const titulo = (catalog.titulo || "").trim();
  const heading = storeName || titulo || "Catálogo";
  const logo = cliente?.profileUrl || "";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex items-center gap-4">
        {logo && logoOk && (
          <img src={logo} alt={heading} onError={() => setLogoOk(false)} className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover" style={{ boxShadow: `0 0 0 1px ${theme.line}` }} data-testid="catalog-logo" />
        )}
        <div className="min-w-0">
          <h1 className="break-words font-heading text-2xl font-bold tracking-tight" style={{ color: theme.fg }} data-testid="catalog-store-name">{heading}</h1>
          {storeName && titulo && titulo !== storeName && (
            <p className="mt-0.5 break-words text-base font-semibold" style={{ color: theme.fgMuted }} data-testid="catalog-title">{titulo}</p>
          )}
        </div>
      </div>
      {catalog.descricao && <p className="mt-3 whitespace-pre-line text-sm" style={{ color: theme.fgMuted }} data-testid="catalog-description">{catalog.descricao}</p>}
      <div className="mt-4">
        <ShareActions path={catalogPath(slug)} title={heading} labelShare="Compartilhar catálogo" labelCopy="Copiar link do catálogo" testId="catalog-header"
          style={{ backgroundColor: theme.soft, color: theme.fg, borderColor: theme.line }} />
      </div>
    </div>
  );
};

/* ---------- /catalogo/{slug} ---------- */
const CatalogPublic = ({ slug }) => {
  const [state, setState] = useState({ status: "loading" });
  const [cat, setCat] = useState("all");
  const cartApi = useCart(slug);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPublicCatalog(slug), fetchPublicCliente(slug)]).then(([r, cli]) => alive && setState({ ...r, cliente: cli }));
    return () => { alive = false; };
  }, [slug]);

  const { catalog = {}, categories = [], products = [], cliente = null } = state;
  const theme = useTheme(cliente);
  const catIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const hasUncategorized = products.some((p) => !p.categoriaId || !catIds.has(p.categoriaId));
  const visible = products.filter((p) =>
    cat === "all" ? true : cat === SEM_CATEGORIA ? !p.categoriaId || !catIds.has(p.categoriaId) : p.categoriaId === cat
  );

  if (state.status === "loading") return <Loading />;
  if (state.status !== "ok") return <Unavailable error={state.status === "error"} />;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: theme.bg }} data-testid="catalog-page">
      <header className="border-b" style={{ borderColor: theme.line }}>
        <StoreHeader cliente={cliente} catalog={catalog} theme={theme} slug={slug} />
        {(categories.length > 0 || hasUncategorized) && products.length > 0 && (
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6" data-testid="catalog-categories">
            {[{ id: "all", nome: "Todos" }, ...categories, ...(hasUncategorized && categories.length > 0 ? [{ id: SEM_CATEGORIA, nome: "Outros" }] : [])].map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)} data-testid={`catalog-cat-${c.id}`}
                className="flex-shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition hover:opacity-90"
                style={cat === c.id ? { ...theme.accentStyle, borderColor: theme.accent } : { backgroundColor: theme.soft, color: theme.fg, borderColor: theme.line }}>
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
              const inCart = cartApi.cart.find((x) => x.id === p.id);
              const href = productPath(slug, p);
              return (
                <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid={`catalog-product-${p.id}`}>
                  <ProductGallery images={productImages(p)} alt={p.nome} testId={`catalog-gallery-${p.id}`} />
                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="font-semibold text-slate-900">
                      {href ? <Link href={href} className="hover:underline" data-testid={`catalog-product-link-${p.id}`}>{p.nome}</Link> : p.nome}
                    </h2>
                    {p.descricao && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-500">{p.descricao}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="font-heading text-lg font-bold text-slate-900" data-testid={`catalog-price-${p.id}`}>{preco !== null ? formatBRL(preco) : <span className="text-sm font-medium text-slate-400">Preço a consultar</span>}</span>
                      <Button size="sm" onClick={() => cartApi.add(p)} data-testid={`catalog-add-${p.id}`} style={theme.accentStyle} className="rounded-full hover:opacity-90">
                        <Plus className="mr-1 h-4 w-4" /> {inCart ? `No carrinho (${inCart.qty})` : "Adicionar ao carrinho"}
                      </Button>
                    </div>
                    {href && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <ShareActions path={href} title={p.nome} labelShare="Compartilhar produto" labelCopy="Copiar link do produto" testId={`catalog-product-${p.id}`} compact
                          style={{ backgroundColor: "#F8FAFC", color: "#334155", borderColor: "#E2E8F0" }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <CartUI cartApi={cartApi} catalog={catalog} accentStyle={theme.accentStyle} />
    </div>
  );
};

/* ---------- /catalogo/{slug}/produto/{produtoSlug} ---------- */
export const CatalogProductPage = ({ slug, produtoSlug }) => {
  const [state, setState] = useState({ status: "loading" });
  const cartApi = useCart(slug);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPublicCatalog(slug), fetchPublicCliente(slug), fetchPublicProduct(slug, produtoSlug)]).then(([c, cli, p]) => {
      if (!alive) return;
      if (c.status !== "ok") return setState({ status: c.status });
      if (p.status !== "ok") return setState({ status: p.status, catalogOk: true });
      setState({ status: "ok", catalog: c.catalog || {}, cliente: cli, product: p.product });
    });
    return () => { alive = false; };
  }, [slug, produtoSlug]);

  const theme = useTheme(state.cliente);
  if (state.status === "loading") return <Loading />;
  if (state.status !== "ok") {
    return <Unavailable error={state.status === "error"} what={state.catalogOk ? "produto" : "catálogo"} backHref={state.catalogOk ? catalogPath(slug) : undefined} />;
  }

  const { catalog, cliente, product: p } = state;
  const preco = parsePreco(p.preco);
  const inCart = cartApi.cart.find((x) => x.id === p.id);
  const storeName = (cliente?.nome || "").trim() || (catalog.titulo || "").trim() || "Catálogo";
  const href = productPath(slug, { ...p, slug: p.slug || produtoSlug });

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: theme.bg }} data-testid="catalog-product-page">
      <header className="border-b" style={{ borderColor: theme.line }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link href={catalogPath(slug)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: theme.soft, color: theme.fg, borderColor: theme.line }} data-testid="catalog-product-back">
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Link>
          <span className="truncate text-sm font-semibold" style={{ color: theme.fgMuted }}>{storeName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ProductGallery images={productImages(p)} alt={p.nome} thumbs className="aspect-square sm:aspect-[4/3]" testId="catalog-product-gallery" />
          <div className="p-5">
            <h1 className="font-heading text-2xl font-bold text-slate-900" data-testid="catalog-product-name">{p.nome}</h1>
            <p className="mt-2 font-heading text-xl font-bold text-slate-900" data-testid="catalog-product-price">{preco !== null ? formatBRL(preco) : <span className="text-base font-medium text-slate-400">Preço a consultar</span>}</p>
            {p.descricao && <p className="mt-3 whitespace-pre-line text-sm text-slate-600" data-testid="catalog-product-description">{p.descricao}</p>}
            <Button onClick={() => cartApi.add(p)} data-testid="catalog-product-add" style={theme.accentStyle} className="mt-5 h-11 w-full rounded-full text-base hover:opacity-90">
              <Plus className="mr-1 h-4 w-4" /> {inCart ? `No carrinho (${inCart.qty}) · adicionar mais` : "Adicionar ao carrinho"}
            </Button>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ShareActions path={href} title={p.nome} labelShare="Compartilhar" labelCopy="Copiar link" testId="catalog-product-page"
                style={{ backgroundColor: "#F8FAFC", color: "#334155", borderColor: "#E2E8F0" }} />
            </div>
          </div>
        </div>
      </main>
      <CartUI cartApi={cartApi} catalog={catalog} accentStyle={theme.accentStyle} />
    </div>
  );
};

export default CatalogPublic;
