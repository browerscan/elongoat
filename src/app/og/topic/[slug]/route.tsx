import { ImageResponse } from "next/og";

const isStaticExport = process.env.NEXT_BUILD_TARGET === "export";

export const dynamic = isStaticExport ? "force-static" : "force-dynamic";

// Generate placeholder param for static export
export function generateStaticParams() {
  return isStaticExport ? [{ slug: "__placeholder__" }] : [];
}

function titleize(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const title = titleize(params.slug ?? "Topic");

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px",
        backgroundImage:
          "radial-gradient(circle at top left, rgba(99,102,241,0.45), transparent 55%), radial-gradient(circle at bottom right, rgba(16,185,129,0.35), transparent 55%)",
        backgroundColor: "#040507",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "28px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.65)",
        }}
      >
        ElonGoat
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "26px",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Topic hub • Elon Musk knowledge base
        </div>
      </div>
      <div
        style={{
          fontSize: "20px",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        elongoat.io
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
