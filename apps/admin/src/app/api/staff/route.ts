// Staff roster management (admin-only), Spark-plan path. See
// lib/staff-admin.ts. Session cookie is httpOnly + SameSite=Strict and is
// verified with revocation checks on every call.
import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../lib/firebase-admin";
import { requireSession } from "../../../lib/server-session";
import {
  StaffError,
  addStaff,
  changeRole,
  deactivate,
  parseAddStaff,
  parseRoleChange,
} from "../../../lib/staff-admin";

type Caller = NonNullable<Awaited<ReturnType<typeof requireSession>>>;

async function run(
  request: NextRequest,
  fn: (user: Caller, body: unknown) => Promise<unknown>,
): Promise<NextResponse> {
  const user = await requireSession(request, ["admin", "superadmin"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await fn(user, body));
  } catch (err) {
    if (err instanceof StaffError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return run(request, (user, body) => addStaff(getAdminAuth(), getAdminDb(), user, parseAddStaff(body)));
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return run(request, (user, body) => changeRole(getAdminAuth(), getAdminDb(), user, parseRoleChange(body)));
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  return run(request, (user, body) => {
    const id = (body as { employeeId?: unknown } | null)?.employeeId;
    if (typeof id !== "string" || !id) throw new StaffError(400, "invalid-argument", "employeeId is required.");
    return deactivate(getAdminAuth(), getAdminDb(), user, id);
  });
}
