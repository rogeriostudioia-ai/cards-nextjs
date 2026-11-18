// Serviço central do Catálogo WhatsApp.
// Todas as chamadas passam pelo proxy same-origin /api (nunca pelo domínio externo).
// Nomes de endpoints e campos preservados exatamente como no backend.
import axios from "axios";

const API = "/api";

// Aceita respostas em lista simples ou envelopadas ({ items: [...] }, { products: [...] }...)
const asList = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const k of [...keys, "items", "data", "results"]) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
};

const byOrdem = (a, b) => (Number(a?.ordem) || 0) - (Number(b?.ordem) || 0) || String(a?.nome || "").localeCompare(String(b?.nome || ""));

/* ---------- CRUD do catálogo (mesmas rotas para admin e cliente) ---------- */
const makeCatalogCrud = (http) => ({
  getSettings: async (clienteId) => {
    try {
      const { data } = await http.get(`${API}/catalog/settings/${clienteId}`);
      return data?.settings || data || {};
    } catch (e) {
      if (e?.response?.status === 404) return {};
      throw e;
    }
  },
  saveSettings: async (clienteId, settings) => (await http.put(`${API}/catalog/settings/${clienteId}`, settings)).data,

  listCategories: async (clienteId) => asList((await http.get(`${API}/catalog/categories`, { params: { clienteId } })).data, "categories", "categorias").sort(byOrdem),
  createCategory: async (payload) => (await http.post(`${API}/catalog/categories`, payload)).data,
  updateCategory: async (id, payload) => (await http.put(`${API}/catalog/categories/${id}`, payload)).data,
  deleteCategory: async (id) => (await http.delete(`${API}/catalog/categories/${id}`)).data,

  listProducts: async (clienteId) => asList((await http.get(`${API}/catalog/products`, { params: { clienteId } })).data, "products", "produtos").sort(byOrdem),
  createProduct: async (payload) => (await http.post(`${API}/catalog/products`, payload)).data,
  updateProduct: async (id, payload) => (await http.put(`${API}/catalog/products/${id}`, payload)).data,
  deleteProduct: async (id) => (await http.delete(`${API}/catalog/products/${id}`)).data,

  // Upload de fotos do catálogo (cliente ou admin, com a autenticação atual de cada um).
  // Nunca base64: retorna a URL pública devolvida pelo backend.
  uploadImage: async (file, clienteId) => {
    const fd = new FormData();
    fd.append("file", file, file.name);
    if (clienteId) fd.append("clienteId", clienteId);
    const { data } = await http.post(`${API}/catalog/media/upload`, fd, { params: clienteId ? { clienteId } : undefined });
    return resolveUploadUrl(data);
  },
});

export const PRODUCT_IMG_EXT = ["jpg", "jpeg", "png", "webp"];
export const PRODUCT_IMG_MAX_MB = 5;
export const PRODUCT_IMG_MAX = 8;

function resolveUploadUrl(data) {
  const u = data?.url || data?.imagemUrl || data?.imageUrl || data?.publicUrl;
  if (u) return /^https?:\/\//i.test(u) || u.startsWith("/") ? u : `/${u}`;
  if (data?.path) return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/files/${String(data.path).replace(/^\/+/, "")}`;
  throw new Error("upload sem URL");
}

/* ---------- Galeria, links e compartilhamento ---------- */
// Produtos antigos têm só imagemUrl; novos têm imageUrls (primeira = imagemUrl).
export const productImages = (p) => {
  const list = (Array.isArray(p?.imageUrls) ? p.imageUrls : []).filter((u) => typeof u === "string" && u.trim());
  if (list.length) return list;
  return p?.imagemUrl ? [p.imagemUrl] : [];
};

export const catalogPath = (slug) => `/catalogo/${encodeURIComponent(slug)}`;
export const productPath = (slug, p) =>
  p?.path || (p?.slug ? `/catalogo/${encodeURIComponent(slug)}/produto/${encodeURIComponent(p.slug)}` : "");
export const absoluteUrl = (path) => (typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path);

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(t);
    return ok;
  }
};

// Web Share API quando disponível; senão copia o link. Retorna "shared" | "copied" | "cancelled" | "failed".
export const shareOrCopy = async (url, title) => {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  return (await copyToClipboard(url)) ? "copied" : "failed";
};

// Administrador: usa o axios global (JWT admin já configurado pelo painel /admin)
export const catalogAdmin = makeCatalogCrud(axios);

/* ---------- Sessão do cliente do catálogo (separada da sessão admin) ---------- */
const CLIENT_TOKEN_KEY = "dc_catalog_token";
export const catalogSession = {
  get: () => (typeof window !== "undefined" ? window.localStorage.getItem(CLIENT_TOKEN_KEY) : null),
  set: (t) => window.localStorage.setItem(CLIENT_TOKEN_KEY, t),
  clear: () => typeof window !== "undefined" && window.localStorage.removeItem(CLIENT_TOKEN_KEY),
};

// Instância própria: envia SOMENTE o token do cliente (nunca o token admin)
const clientHttp = axios.create();
clientHttp.interceptors.request.use((cfg) => {
  const t = catalogSession.get();
  cfg.headers = cfg.headers || {};
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  else delete cfg.headers.Authorization;
  return cfg;
});

export const catalogClient = makeCatalogCrud(clientHttp);

const unwrapAccount = (d) => d?.account || d?.user || d?.conta || d || {};
export const isAccountActive = (a) => (a?.ativo ?? a?.active ?? (a?.status ? a.status === "ativo" || a.status === "active" : true)) !== false;

export const catalogAuth = {
  // Retorna { token, mustChangePassword, account }
  login: async (email, password) => {
    const { data } = await clientHttp.post(`${API}/catalog/auth/login`, { email, password });
    const token = data?.access_token || data?.token || data?.accessToken;
    if (!token) throw Object.assign(new Error("no token"), { noToken: true });
    catalogSession.set(token);
    const account = unwrapAccount(data);
    const mustChangePassword = Boolean(data?.mustChangePassword ?? account?.mustChangePassword);
    return { token, mustChangePassword, account };
  },
  me: async () => unwrapAccount((await clientHttp.get(`${API}/catalog/auth/me`)).data),
  logout: async () => {
    try { await clientHttp.post(`${API}/catalog/auth/logout`); } catch { /* sessão já inválida */ }
    catalogSession.clear();
  },
  changePassword: async (current, next) =>
    (await clientHttp.post(`${API}/catalog/auth/change-password`, {
      current_password: current, new_password: next, confirm_password: next,
      currentPassword: current, newPassword: next, confirmPassword: next,
    })).data,
};

const detailText = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join(" ");
  return "";
};

export const loginErrorMessage = (e) => {
  if (!e?.response) return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  const st = e.response.status;
  const d = detailText(e).toLowerCase();
  if (st === 423 || st === 429 || /bloque|tentativas|locked/.test(d)) return "Conta temporariamente bloqueada por excesso de tentativas. Aguarde alguns minutos e tente novamente.";
  if (/desativ|inativ|disabled|inactive/.test(d) || st === 403) return "Esta conta está desativada. Fale com o administrador.";
  if (st === 401 || st === 400 || st === 404 || st === 422) return "E-mail ou senha incorretos.";
  return "Não foi possível entrar agora. Tente novamente em instantes.";
};

/* ---------- Contas de clientes (somente administrador) ---------- */
export const catalogAccounts = {
  get: async (clienteId) => {
    try {
      return unwrapAccount((await axios.get(`${API}/catalog/accounts/${clienteId}`)).data);
    } catch (e) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  },
  create: async (clienteId, email, password) =>
    unwrapAccount((await axios.post(`${API}/catalog/accounts`, { clienteId, email, password, ativo: true })).data),
  update: async (clienteId, payload) => unwrapAccount((await axios.put(`${API}/catalog/accounts/${clienteId}`, payload)).data),
  resetPassword: async (clienteId, password) =>
    (await axios.post(`${API}/catalog/accounts/${clienteId}/reset-password`, { password, newPassword: password, new_password: password })).data,
};

/* ---------- Slugs reservados pelo sistema (rotas /catalogo/login, /painel, /trocar-senha) ---------- */
export const RESERVED_CATALOG_SLUGS = ["login", "painel", "trocar-senha"];
export const isReservedCatalogSlug = (slug) => {
  let s = String(slug || "");
  try { s = decodeURIComponent(s); } catch { /* mantém */ }
  return RESERVED_CATALOG_SLUGS.includes(s.trim().toLowerCase());
};

/* ---------- Público ---------- */
// Dados públicos do mini site (nome, logo e cores). Erro => null (catálogo segue sem personalização).
export const fetchPublicCliente = async (slug) => {
  try {
    return (await axios.get(`${API}/public/clientes/${encodeURIComponent(slug)}`)).data || null;
  } catch {
    return null;
  }
};

export const fetchPublicProduct = async (slug, produtoSlug) => {
  try {
    const { data } = await axios.get(`${API}/public/catalog/${encodeURIComponent(slug)}/products/${encodeURIComponent(produtoSlug)}`);
    const p = data?.product || data?.produto || data;
    if (!p || p.ativo === false) return { status: "unavailable" };
    return { status: "ok", product: p };
  } catch (e) {
    const st = e?.response?.status;
    return { status: st === 404 || st === 403 || st === 410 ? "unavailable" : "error" };
  }
};

// Usado pelo mini site: true somente se o catálogo existir e estiver ativo.
export const isPublicCatalogActive = async (slug) => {
  if (!slug || isReservedCatalogSlug(slug)) return false;
  try {
    const { data } = await axios.get(`${API}/public/catalog/${encodeURIComponent(slug)}`);
    const cat = data?.catalog || data?.settings || data;
    return Boolean(cat) && cat.ativo !== false;
  } catch {
    return false;
  }
};

// Retorna { status: "ok" | "unavailable" | "error", catalog, categories, products }
export const fetchPublicCatalog = async (slug) => {
  if (isReservedCatalogSlug(slug)) return { status: "unavailable" };
  const s = encodeURIComponent(slug);
  let base;
  try {
    base = (await axios.get(`${API}/public/catalog/${s}`)).data || {};
  } catch (e) {
    const st = e?.response?.status;
    return { status: st === 404 || st === 403 || st === 410 ? "unavailable" : "error" };
  }
  const catalog = base.catalog || base.settings || base;
  if (catalog?.ativo === false) return { status: "unavailable" };

  let categories = asList(base, "categories", "categorias");
  let products = asList(base, "products", "produtos");
  const hasCats = Array.isArray(base.categories) || Array.isArray(base.categorias);
  const hasProds = Array.isArray(base.products) || Array.isArray(base.produtos);
  const [c, p] = await Promise.all([
    hasCats ? null : axios.get(`${API}/public/catalog/${s}/categories`).then((r) => r.data).catch(() => []),
    hasProds ? null : axios.get(`${API}/public/catalog/${s}/products`).then((r) => r.data).catch(() => []),
  ]);
  if (!hasCats) categories = asList(c, "categories", "categorias");
  if (!hasProds) products = asList(p, "products", "produtos");

  return {
    status: "ok",
    catalog,
    categories: categories.filter((x) => x && x.ativo !== false).sort(byOrdem),
    products: products.filter((x) => x && x.ativo !== false).sort(byOrdem),
  };
};

/* ---------- Utilidades ---------- */
// "12,50" | "1.234,50" | "12.5" | 12.5 -> 12.5 ; vazio -> null
export const parsePreco = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const formatBRL = (n) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const cleanWhatsapp = (n) => String(n || "").replace(/\D/g, "");

export const buildOrderMessage = (mensagemInicial, items) => {
  const header = String(mensagemInicial || "").trim() || "Olá! Gostaria de fazer este pedido:";
  const lines = [header, ""];
  let total = 0;
  let semPreco = false;
  for (const it of items) {
    const preco = parsePreco(it.preco);
    lines.push(`- ${it.nome}${it.sku ? ` (SKU ${it.sku})` : ""}`);
    lines.push(`  Quantidade: ${it.qty}`);
    if (preco !== null) {
      lines.push(`  Preço: ${formatBRL(preco)}`);
      total += preco * it.qty;
    } else {
      lines.push("  Preço: a consultar");
      semPreco = true;
    }
  }
  lines.push("");
  lines.push(`Total aproximado: ${formatBRL(total)}${semPreco ? " (itens sem preço a consultar)" : ""}`);
  lines.push("Aguardo informações sobre pagamento e entrega.");
  return lines.join("\n");
};

export const buildWhatsappLink = (numero, mensagem) => {
  const n = cleanWhatsapp(numero);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}` : "";
};
