import { CatalogProductPage } from "@/components/pages/CatalogPublic";

export const metadata = { title: "Produto" };

export default async function Page({ params }) {
  const { slug, produtoSlug } = await params;
  return <CatalogProductPage slug={slug} produtoSlug={produtoSlug} />;
}
