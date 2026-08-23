import { ImageResponse } from "next/og";
import { getTopicBySlug } from "@/lib/store/json-store";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const graph = await getTopicBySlug(slug);
  const title = graph?.topic.name ?? brand.productName;
  const dek = graph?.topic.description ?? brand.tagline;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafafa",
          color: "#111",
          padding: 72,
        }}
      >
        <div style={{ fontSize: 28 }}>{brand.productName}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 28, color: "#444", maxWidth: 900 }}>{dek}</div>
        </div>
      </div>
    ),
    size,
  );
}
