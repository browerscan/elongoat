export function parseLoosePairs(
  raw: string | null | undefined,
): Record<string, string> | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const out: Record<string, string> = {};
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line0 of lines) {
    const line = line0.replaceAll('""', '"').replace(/^"+|"+$/g, "");
    const m = line.match(/^([^"]+)"\s*:\s*"([^"]+)$/);
    if (m) {
      out[m[1]] = m[2];
      continue;
    }

    const m2 = line.match(/^([^:]+):(.+)$/);
    if (m2) {
      out[m2[1].trim().replaceAll('"', "")] = m2[2].trim().replaceAll('"', "");
    }
  }

  return Object.keys(out).length ? out : null;
}
