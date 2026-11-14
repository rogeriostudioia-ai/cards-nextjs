import { CatalogChangePassword } from "@/components/pages/CatalogClient";

export const metadata = { title: "Trocar senha · Meu catálogo", robots: { index: false, follow: false } };

export default function Page() {
  return <CatalogChangePassword />;
}
