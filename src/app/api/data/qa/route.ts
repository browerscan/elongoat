import "server-only";

import { NextResponse } from "next/server";

import { getPaaIndex } from "@/lib/indexes";
import { listLatestCustomQas } from "@/lib/customQa";

export const revalidate = 3600;

export async function GET() {
  try {
    const [paaIndex, customQas] = await Promise.all([
      getPaaIndex(),
      listLatestCustomQas(12),
    ]);

    return NextResponse.json({
      paa: {
        generatedAt: paaIndex.generatedAt,
        source: paaIndex.source,
        questions: paaIndex.questions,
      },
      customQas,
    });
  } catch (error) {
    console.error("Error fetching Q&A data:", error);
    return NextResponse.json(
      { error: "Failed to fetch Q&A data" },
      { status: 500 },
    );
  }
}
