import CatalogPublic from "@/components/pages/CatalogPublic";

export const metadata = {
  title: "Catálogo",
  robots: { index: true, follow: true },
};

export default async function CatalogoPage({ params }) {
  const { slug } = await params;
  return <CatalogPublic slug={slug} />;
}
