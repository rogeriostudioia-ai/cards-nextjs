"use client";
import CardTemplate from "@/components/CardTemplate";

export default function PublicCardView({ cliente }) {
  const data = {
    ...cliente,
    cover: cliente.headerType === "video" ? "" : (cliente.headerUrl || ""),
    coverVideo: cliente.headerType === "video" ? (cliente.headerUrl || "") : "",
    avatar: cliente.profileUrl || "",
  };
  return <CardTemplate data={data} />;
}
