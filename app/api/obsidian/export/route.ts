import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json({
    ok: true,
    message: "Obsidian export worker placeholder. V12 foundation created the route; V12.4 will generate Markdown and push to GitHub Vault."
  });
}
