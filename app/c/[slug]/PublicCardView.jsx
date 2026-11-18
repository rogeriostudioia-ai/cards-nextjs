"use client";
import { useEffect, useState } from "react";
import CardTemplate from "@/components/CardTemplate";
import { isPublicCatalogActive } from "@/lib/catalogApi";

export default function PublicCardView({ cliente }) {
  const [catalogUrl, setCatalogUrl] = useState("");

  // Botão "Ver catálogo" somente se o catálogo do cliente estiver ativo.
  // Qualquer erro na consulta apenas oculta o botão.
  useEffect(() => {
    let alive = true;
    const slug = cliente?.slug;
    if (slug) {
      isPublicCatalogActive(slug).then((ok) => alive && ok && setCatalogUrl(`/catalogo/${encodeURIComponent(slug)}`));
    }
    return () => { alive = false; };
  }, [cliente?.slug]);

  const data = {
    ...cliente,
    cover: cliente.headerType === "video" ? "" : (cliente.headerUrl || ""),
    coverVideo: cliente.headerType === "video" ? (cliente.headerUrl || "") : "",
    avatar: cliente.profileUrl || "",
    catalogUrl,
  };
  return <CardTemplate data={data} />;
}
