// Chave Pix e Wi-Fi são guardados como entradas especiais dentro de
// botoesPersonalizados (campo já persistido pelo backend), usando os
// prefixos "pix:" e "wifi:" no campo url. Não são URLs e nunca viram links.

export const PIX_LABEL = "Chave Pix";
export const WIFI_LABEL = "Wi-Fi";

export const isSpecialBotao = (b) => /^(pix|wifi):/i.test(String(b?.url || ""));

const dec = (v) => {
  try { return decodeURIComponent(v || ""); } catch { return v || ""; }
};

export const parsePix = (b) => String(b?.url || "").replace(/^pix:/i, "");

export const parseWifi = (b) => {
  const raw = String(b?.url || "").replace(/^wifi:/i, "");
  const m = raw.match(/^S=([^;]*);P=(.*)$/);
  return m ? { ssid: dec(m[1]), senha: dec(m[2]) } : { ssid: "", senha: "" };
};

export const encodePix = (chave) => ({ label: PIX_LABEL, url: `pix:${chave}`, cor: "" });
export const encodeWifi = (ssid, senha) => ({
  label: WIFI_LABEL,
  url: `wifi:S=${encodeURIComponent(ssid)};P=${encodeURIComponent(senha)}`,
  cor: "",
});

/** Separa botões comuns dos dados de Pix/Wi-Fi. */
export const splitSpecial = (botoes) => {
  const list = Array.isArray(botoes) ? botoes : [];
  let pixChave = "";
  let wifiSsid = "";
  let wifiSenha = "";
  const regulares = [];
  for (const b of list) {
    const url = String(b?.url || "");
    if (/^pix:/i.test(url)) pixChave = parsePix(b);
    else if (/^wifi:/i.test(url)) ({ ssid: wifiSsid, senha: wifiSenha } = parseWifi(b));
    else regulares.push(b);
  }
  return { regulares, pixChave, wifiSsid, wifiSenha };
};

/** Recompõe a lista para salvar: comuns (com ordem) + Pix/Wi-Fi quando preenchidos. */
export const joinSpecial = (regulares, { pixChave, wifiSsid, wifiSenha }) => {
  const out = (regulares || []).map((b, i) => ({ ...b, ordem: i }));
  const pix = String(pixChave || "").trim();
  if (pix) out.push({ ...encodePix(pix), ordem: out.length });
  const ssid = String(wifiSsid || "");
  const senha = String(wifiSenha || "");
  if (ssid.trim() || senha) out.push({ ...encodeWifi(ssid, senha), ordem: out.length });
  return out;
};
