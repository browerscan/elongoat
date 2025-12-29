import "server-only";

import { getDynamicVariables } from "@/lib/variables";
import {
  cachedResponse,
  CachePolicies,
  generateSimpleETag,
} from "@/lib/httpCache";

export async function GET() {
  const variables = await getDynamicVariables();
  const data = { variables, updatedAt: variables.updatedAt };

  return cachedResponse(data, {
    ...CachePolicies.api,
    maxAge: 0,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
    lastModified: variables.updatedAt,
    vary: ["Accept-Encoding"],
    eTag: generateSimpleETag(data),
  });
}
