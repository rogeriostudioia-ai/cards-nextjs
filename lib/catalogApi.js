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

/* ---------- Administrativo (JWT já configurado no axios pelo painel) ---------- */
export const catalogAdmin = {
  getSettings: async (clienteId) => {
    try {
      const { data } = await axios.get(`${API}/catalog/settings/${clienteId}`);
      return data?.settings || data || {};
    } catch (e) {
      if (e?.response?.status === 404) return {};
      throw e;
    }
  },
  saveSettings: async (clienteId, settings) => (await axios.put(`${API}/catalog/settings/${clienteId}`, settings)).data,

  listCategories: async (clienteId) => asList((await axios.get(`${API}/catalog/categories`, { params: { clienteId } })).data, "categories", "categorias").sort(byOrdem),
  createCategory: async (payload) => (await axios.post(`${API}/catalog/categories`, payload)).data,
  updateCategory: async (id, payload) => (await axios.put(`${API}/catalog/categories/${id}`, payload)).data,
  deleteCategory: async (id) => (await axios.delete(`${API}/catalog/categories/${id}`)).data,

  listProducts: async (clienteId) => asList((await axios.get(`${API}/catalog/products`, { params: { clienteId } })).data, "products", "produtos").sort(byOrdem),
  createProduct: async (payload) => (await axios.post(`${API}/catalog/products`, payload)).data,
  updateProduct: async (id, payload) => (await axios.put(`${API}/catalog/products/${id}`, payload)).data,
  deleteProduct: async (id) => (await axios.delete(`${API}/catalog/products/${id}`)).data,
};

/* ---------- Público ---------- */
// Retorna { status: "ok" | "unavailable" | "error", catalog, categories, products }
export const fetchPublicCatalog = async (slug) => {
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
