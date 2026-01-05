import { getEnv } from "./env";

const env = getEnv();
// ============================================================================
// Environment Validation - P0 Security
// ============================================================================
// This module validates critical security secrets at startup.
// If validation fails, the process will exit with code 1.
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Default values that indicate a secret hasn't been changed
const DEFAULT_SECRETS = new Set<string>([
  "change_me_to_random_string",
  "your_long_random_token_at_least_32_chars",
  "your_session_secret_different_from_admin_token",
  "your_rag_api_key_at_least_32_chars",
  "ve_your_key_here",
  "sk-your_openai_key_here",
  "your_key_here",
  "your_soax_secret",
]);

/**
 * Check if a secret value is a default placeholder
 */
function isDefaultSecret(value: string | undefined): boolean {
  if (!value) return true;
  return DEFAULT_SECRETS.has(value);
}

/**
 * Validate a secret is set and not a default value
 */
function validateSecret(
  name: string,
  value: string | undefined,
  options: { requiredInProduction?: boolean; minLength?: number } = {},
): { valid: boolean; error: string } {
  const { requiredInProduction = true, minLength = 32 } = options;

  if (!value) {
    if (requiredInProduction && env.NODE_ENV === "production") {
      return {
        valid: false,
        error: `${name} is required in production`,
      };
    }
    return { valid: true, error: "" };
  }

  if (isDefaultSecret(value)) {
    return {
      valid: false,
      error: `${name} is set to default placeholder value. Set a strong random value.`,
    };
  }

  if (value.length < minLength) {
    return {
      valid: false,
      error: `${name} must be at least ${minLength} characters (current: ${value.length})`,
    };
  }

  return { valid: true, error: "" };
}

/**
 * Validate all required secrets for production
 * Call this during startup - process will exit if validation fails
 */
export function validateRequiredSecrets(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // P0: Secrets that MUST be set and not default in production
  const criticalSecrets = [
    {
      name: "VECTORENGINE_API_KEY",
      value: env.VECTORENGINE_API_KEY,
      options: { requiredInProduction: true, minLength: 10 },
    },
    {
      name: "ELONGOAT_ADMIN_TOKEN",
      value: env.ELONGOAT_ADMIN_TOKEN,
      options: { requiredInProduction: true, minLength: 32 },
    },
    {
      name: "ELONGOAT_ADMIN_SESSION_SECRET",
      value: env.ELONGOAT_ADMIN_SESSION_SECRET,
      options: { requiredInProduction: true, minLength: 32 },
    },
    {
      name: "RATE_LIMIT_IP_SECRET",
      value: env.RATE_LIMIT_IP_SECRET,
      options: { requiredInProduction: true, minLength: 16 },
    },
    {
      name: "DATABASE_URL",
      value: env.DATABASE_URL,
      options: { requiredInProduction: true, minLength: 20 },
    },
  ];

  for (const { name, value, options } of criticalSecrets) {
    const result = validateSecret(name, value, options);
    if (!result.valid) {
      errors.push(result.error);
    }
  }

  // P1: Optional but recommended secrets
  const optionalSecrets = [
    {
      name: "ELONGOAT_RAG_API_KEY",
      value: env.ELONGOAT_RAG_API_KEY,
      minLength: 32,
    },
    {
      name: "REDIS_URL",
      value: env.REDIS_URL,
      minLength: 10,
    },
  ];

  for (const { name, value, minLength } of optionalSecrets) {
    if (value) {
      if (isDefaultSecret(value)) {
        warnings.push(`${name} is set to default placeholder value`);
      } else if (value.length < minLength) {
        warnings.push(
          `${name} is shorter than recommended ${minLength} characters`,
        );
      }
    } else {
      warnings.push(`${name} is not set (optional but recommended)`);
    }
  }

  // Check for dangerous configurations
  if (env.NODE_ENV === "production") {
    // Ensure HTTPS URLs in production
    const siteUrl = env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && !siteUrl.startsWith("https://")) {
      errors.push(
        `NEXT_PUBLIC_SITE_URL must use HTTPS in production (got: ${siteUrl})`,
      );
    }

    const apiUrl = env.NEXT_PUBLIC_API_URL;
    if (apiUrl && !apiUrl.startsWith("https://")) {
      errors.push(
        `NEXT_PUBLIC_API_URL must use HTTPS in production (got: ${apiUrl})`,
      );
    }

    // Warn about RATE_LIMIT_ENABLED
    if (!env.RATE_LIMIT_ENABLED) {
      warnings.push("RATE_LIMIT_ENABLED is not enabled in production");
    }
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  };

  // Log results
  if (errors.length > 0) {
    console.error("[SECURITY] Critical validation errors:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }

  if (warnings.length > 0) {
    console.warn("[SECURITY] Warnings:");
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (result.valid) {
    console.log("[SECURITY] All critical secrets validated successfully");
  }

  return result;
}

/**
 * Validate secrets and exit if invalid
 * Call this at the top of your entry point
 */
export function validateOrExit(): void {
  const result = validateRequiredSecrets();
  if (!result.valid) {
    console.error(
      "\n[SECURITY] FATAL: Invalid configuration. Fix the errors above and restart.",
    );
    process.exit(1);
  }
}

// Auto-validate on module import in production
if (env.NODE_ENV === "production" && env.VALIDATE_ENV_ON_STARTUP) {
  // Defer to next tick to allow other modules to initialize
  process.nextTick(() => {
    validateOrExit();
  });
}
