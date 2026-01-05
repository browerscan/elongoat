import "server-only";

import { checkAdminAuth, unauthorized } from "../../../../lib/adminAuth";
import {
  AdminVariablesUpdateSchema,
  getAdminVariablesSnapshot,
  updateAdminVariables,
} from "../../../../lib/adminVariables";

export async function GET(req: Request) {
  if (!checkAdminAuth(req)) return unauthorized();
  const snapshot = await getAdminVariablesSnapshot();
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}

const BodySchema = AdminVariablesUpdateSchema;

export async function POST(req: Request) {
  if (!checkAdminAuth(req)) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).slice(0, 3);
    return Response.json({ error: "invalid_request", issues }, { status: 400 });
  }

  try {
    const result = await updateAdminVariables(parsed.data);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return Response.json({ error: "update_failed", message }, { status: 500 });
  }
}
