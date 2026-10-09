import { z } from "zod";

// ── ID schemas ────────────────────────────────────────────────────────────────
export const riskIdSchema = z.string().regex(/^R\d{3,}$/, "Invalid risk ID format");
export const controlKeySchema = z.string().regex(/^ctl_[a-z0-9_]{1,60}$/, "Invalid control key");

// ── Helpers ───────────────────────────────────────────────────────────────────
const likelihoodImpact = z.number().int().min(1).max(5);

/** Validates "YYYY-MM-DD" and that the date actually exists on the calendar. */
function dueDateString() {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .refine((v) => {
      const [year, month, day] = v.split("-").map(Number);
      if (year < 2000 || year > 2100) return false;
      const d = new Date(Date.UTC(year, month - 1, day));
      return (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
      );
    }, "dueDate is not a valid calendar date (must be 2000-01-01 to 2100-12-31)");
}

/**
 * Validates reviewDate is "YYYY-MM-DD", a real calendar date,
 * strictly AFTER today and at most 730 days from today.
 * Computes "today" using new Date() at validation time to support fake timers in tests.
 */
function reviewDateString() {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "reviewDate must be YYYY-MM-DD")
    .superRefine((v, ctx) => {
      const [year, month, day] = v.split("-").map(Number);
      if (year < 2000 || year > 2100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reviewDate year out of bounds (2000-2100)",
        });
        return;
      }
      const targetDate = new Date(Date.UTC(year, month - 1, day));
      if (
        targetDate.getUTCFullYear() !== year ||
        targetDate.getUTCMonth() !== month - 1 ||
        targetDate.getUTCDate() !== day
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reviewDate is not a valid calendar date",
        });
        return;
      }

      const now = new Date();
      const todayUtc = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      );
      const targetUtc = targetDate.getTime();

      if (targetUtc <= todayUtc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reviewDate must be strictly in the future (after today)",
        });
        return;
      }

      const maxUtc = todayUtc + 730 * 24 * 60 * 60 * 1000;
      if (targetUtc > maxUtc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "reviewDate cannot be more than 730 days (2 years) from today",
        });
      }
    });
}

// ── Body schemas ──────────────────────────────────────────────────────────────

/** Schema for POST /api/risks — Phase 5 creation. Strict: no status/treatment/controls. */
export const riskCreateSchema = z
  .object({
    assetId: z
      .string()
      .regex(/^[0-9a-f]{24}$/, "assetId must be a 24-hex ObjectId string"),
    threatKey: z
      .string()
      .regex(/^thr_[a-z0-9_]{1,60}$/, "Invalid threat key"),
    vulnerabilityKey: z
      .string()
      .regex(/^vul_[a-z0-9_]{1,60}$/, "Invalid vulnerability key"),
    likelihood: likelihoodImpact,
    impact: likelihoodImpact,
    owner: z.string().trim().min(1).max(120),
    dueDate: dueDateString().optional(),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict();

/**
 * Schema for PUT /api/risks/[riskId] — Phase 5 updates.
 * Identity fields (assetId, threatKey, vulnerabilityKey) are NOT allowed.
 * status/treatment/controls are NOT allowed (Phase 6 owns them).
 * expectedUpdatedAt is REQUIRED for optimistic-concurrency.
 */
export const riskUpdateSchema = z
  .object({
    likelihood: likelihoodImpact,
    impact: likelihoodImpact,
    owner: z.string().trim().min(1).max(120),
    dueDate: dueDateString().nullable().optional(),
    notes: z.string().trim().max(2000),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

// ── Phase 6 Mutation Schemas ──────────────────────────────────────────────────

/**
 * Schema for PUT /api/risks/[riskId]/controls
 * Max 20 controls, no duplicate control keys.
 */
export const controlsReplaceSchema = z
  .object({
    controls: z
      .array(
        z
          .object({
            controlKey: controlKeySchema,
            status: z.enum(["planned", "implemented"]),
          })
          .strict()
      )
      .max(20, "A risk can have at most 20 controls attached")
      .refine(
        (arr) => new Set(arr.map((c) => c.controlKey)).size === arr.length,
        "Duplicate control keys are not allowed"
      ),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

/**
 * Schema for PUT /api/risks/[riskId]/treatment
 * Discriminated union on "treatment".
 */
export const treatmentMitigateSchema = z
  .object({
    treatment: z.literal("mitigate"),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

export const treatmentAcceptSchema = z
  .object({
    treatment: z.literal("accept"),
    justification: z.string().trim().min(10).max(1000),
    approver: z.string().trim().min(1).max(120),
    reviewDate: reviewDateString(),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

export const treatmentTransferSchema = z
  .object({
    treatment: z.literal("transfer"),
    justification: z.string().trim().min(10).max(1000),
    transferFactor: z
      .number()
      .min(0.05, "transferFactor must be at least 0.05")
      .max(0.9, "transferFactor must be at most 0.90"),
    reviewDate: reviewDateString().optional(),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

export const treatmentAvoidSchema = z
  .object({
    treatment: z.literal("avoid"),
    avoidReason: z.string().trim().min(10).max(500),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

export const treatmentSchema = z.discriminatedUnion("treatment", [
  treatmentMitigateSchema,
  treatmentAcceptSchema,
  treatmentTransferSchema,
  treatmentAvoidSchema,
]);

/** Schema for POST /api/risks/[riskId]/close */
export const closeSchema = z
  .object({
    reason: z.string().trim().min(10).max(500),
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

/** Schema for POST /api/risks/[riskId]/reopen */
export const reopenSchema = z
  .object({
    expectedUpdatedAt: z
      .string()
      .datetime({ message: "expectedUpdatedAt must be an ISO datetime string" }),
  })
  .strict();

/**
 * Schema for POST /api/risks/[riskId]/simulate
 * Ordered list of 0-20 unique control keys.
 */
export const simulateSchema = z
  .object({
    controlKeys: z
      .array(controlKeySchema)
      .max(20, "At most 20 control keys can be simulated")
      .refine(
        (arr) => new Set(arr).size === arr.length,
        "Duplicate control keys are not allowed"
      ),
  })
  .strict();

/** Schema for POST /api/assessments */
export const assessmentCreateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

/** Schema for GET /api/assessments */
export const assessmentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

/** Schema for GET /api/assessments/trend */
export const trendQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(60).default(24),
  })
  .strict();

// ── List / filter schemas ─────────────────────────────────────────────────────

export const riskListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    level: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
    basis: z.enum(["inherent", "residual"]).default("residual"),
    status: z
      .enum(["Open", "In Treatment", "Mitigated", "Accepted", "Closed"])
      .optional(),
    owner: z.string().trim().max(120).optional(),
    assetId: z
      .string()
      .regex(/^[0-9a-f]{24}$/, "Invalid assetId")
      .optional(),
    sort: z
      .enum(["riskId", "inherentScore", "residualScore", "dueDate", "updatedAt"])
      .default("riskId"),
    order: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const matrixQuerySchema = z
  .object({
    basis: z.enum(["inherent", "residual"]).default("residual"),
    assetId: z
      .string()
      .regex(/^[0-9a-f]{24}$/, "Invalid assetId")
      .optional(),
    includeClosed: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .strict();
