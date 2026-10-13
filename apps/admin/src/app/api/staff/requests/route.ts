// Approve or decline a studio access request (admin-only, session-cookie gated).
import { NextResponse, type NextRequest } from "next/server";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { requireSession } from "../../../../lib/server-session";
import { StaffError, decideAccessRequest, parseDecideAccess } from "../../../../lib/staff-admin";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireSession(request, ["admin", "superadmin"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await decideAccessRequest(getAdminAuth(), getAdminDb(), user, parseDecideAccess(body), FIRST_STUDIO_ID));
  } catch (err) {
    if (err instanceof StaffError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
