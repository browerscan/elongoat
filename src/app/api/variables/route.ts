import "server-only";

import { getDynamicVariables } from "../../../lib/variables";
import {
  cachedResponse,
  CachePolicies,
  generateSimpleETag,
} from "../../../lib/httpCache";
import { rateLimitApi, rateLimitResponse } from "../../../lib/rateLimit";

export async function GET(request: Request) {
  const { result: rlResult, headers: rlHeaders } = await rateLimitApi(request);
  if (!rlResult.ok) {
    return rateLimitResponse(rlResult);
  }

  const variables = await getDynamicVariables();
  const data = { variables, updatedAt: variables.updatedAt };

  const response = await cachedResponse(data, {
    ...CachePolicies.api,
    maxAge: 0,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400,
    lastModified: variables.updatedAt,
    vary: ["Accept-Encoding"],
    eTag: generateSimpleETag(data),
  });
  for (const [key, value] of Object.entries(rlHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}
