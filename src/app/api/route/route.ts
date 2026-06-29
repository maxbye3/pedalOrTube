/**
 * POST /api/route
 *
 * Accepts a JourneySearch payload and returns a JourneyResult.
 * Queries OTP (server-side) and applies discard rules + enrichment.
 */
import { NextRequest, NextResponse } from "next/server";
import type { JourneySearch } from "@/types";
import { computeJourney } from "@/services/JourneyCalculator";

export async function POST(req: NextRequest) {
  try {
    const body: JourneySearch = await req.json();

    if (!body.origin || !body.destination) {
      return NextResponse.json(
        { error: "Missing origin or destination" },
        { status: 400 }
      );
    }

    const result = await computeJourney(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/route error:", err);
    return NextResponse.json(
      { error: "Routing failed" },
      { status: 500 }
    );
  }
}
