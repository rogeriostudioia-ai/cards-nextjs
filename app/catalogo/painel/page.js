import { CatalogPanel } from "@/components/pages/CatalogClient";

export const metadata = { title: "Painel · Meu catálogo", robots: { index: false, follow: false } };

export default function Page() {
  return <CatalogPanel />;
}
