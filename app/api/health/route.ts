import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "字幕智析工具 API 正常运行",
    timestamp: new Date().toISOString(),
  });
}
