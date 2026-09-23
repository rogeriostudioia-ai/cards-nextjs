import { notFound } from "next/navigation";
import PublicCardView from "./PublicCardView";

const BACKEND = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const FALLBACK_IMAGE =
  "https://images.pexels.com/photos/13068380/pexels-photo-13068380.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

// Busca o cliente publicado no backend FastAPI (server-side, sem depender de JS do cliente).
async function fetchCliente(slug) {
  if (!BACKEND) return null;
  try {
    const res = await fetch(
      `${BACKEND}/api/public/clientes/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Ordem de imagem: logoUrl -> profileUrl -> headerUrl (somente se não for vídeo) -> fallback.
function pickImage(c) {
  if (c.logoUrl) return c.logoUrl;
  if (c.profileUrl) return c.profileUrl;
  if (c.headerType !== "video" && c.headerUrl) return c.headerUrl;
  return FALLBACK_IMAGE;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const c = await fetchCliente(slug);
  if (!c || c.status !== "Publicado") {
    return { title: "Página não encontrada", robots: { index: false, follow: false } };
  }

  const nome = c.nome || "Cartão digital";
  const title = (c.seoTitle && c.seoTitle.trim()) || `${nome} | Cartão digital`;
  const description =
    (c.seoDesc && c.seoDesc.trim()) ||
    (c.descricao && c.descricao.trim()) ||
    `Cartão digital de ${nome}.`;
  const image = pickImage(c);
  const url = `${SITE_URL}/c/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: nome,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicCardPage({ params }) {
  const { slug } = await params;
  const c = await fetchCliente(slug);
  if (!c || c.status !== "Publicado") notFound();
  return <PublicCardView cliente={c} />;
}
