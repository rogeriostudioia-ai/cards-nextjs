import { CatalogLogin } from "@/components/pages/CatalogClient";

export const metadata = { title: "Entrar · Meu catálogo", robots: { index: false, follow: false } };

export default function Page() {
  return <CatalogLogin />;
}
