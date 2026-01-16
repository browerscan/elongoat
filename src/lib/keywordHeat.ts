export type HeatTier = "low" | "medium" | "high" | "very_high" | "extreme";
export type HeatLocale = "en" | "zh";

const HEAT_THRESHOLDS: Array<{ min: number; tier: HeatTier }> = [
  { min: 0.6, tier: "extreme" },
  { min: 0.4, tier: "very_high" },
  { min: 0.25, tier: "high" },
  { min: 0.12, tier: "medium" },
  { min: 0, tier: "low" },
];

const HEAT_LABELS: Record<HeatLocale, Record<HeatTier, string>> = {
  en: {
    extreme: "very high",
    very_high: "high",
    high: "medium",
    medium: "low",
    low: "very low",
  },
  zh: {
    extreme: "爆热",
    very_high: "很热",
    high: "热",
    medium: "温",
    low: "冷",
  },
};

function normalizeVolume(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

export function getHeatRatio(volume: number, maxVolume?: number): number {
  const safeVolume = normalizeVolume(volume);
  const safeMax = normalizeVolume(maxVolume ?? safeVolume);
  if (safeMax <= 0) return 0;
  return Math.min(1, safeVolume / safeMax);
}

export function getHeatTier(volume: number, maxVolume?: number): HeatTier {
  const ratio = getHeatRatio(volume, maxVolume);
  for (const threshold of HEAT_THRESHOLDS) {
    if (ratio >= threshold.min) return threshold.tier;
  }
  return "low";
}

export function formatHeatLabel(
  tier: HeatTier,
  locale: HeatLocale = "en",
): string {
  return HEAT_LABELS[locale][tier];
}

export function getHeatData(
  volume: number,
  maxVolume?: number,
  locale: HeatLocale = "en",
): { ratio: number; tier: HeatTier; label: string } {
  const ratio = getHeatRatio(volume, maxVolume);
  const tier = getHeatTier(volume, maxVolume);
  return { ratio, tier, label: formatHeatLabel(tier, locale) };
}
