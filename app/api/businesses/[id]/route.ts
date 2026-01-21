import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Next.js 15 route handler typing: `params` is treated as async in generated types
type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: business, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching business:", error);
      return NextResponse.json(
        { error: "Failed to fetch business data" },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
