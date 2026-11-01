import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { defaultErrorMap } from "zod";
import type { ZodSchema, ZodError, ZodIssue, ZodTypeAny } from "zod";

// Input resource guardrails: documented TECHNICAL ceilings, not business rules.
// Scope: these checks run inside validate() only. An inventory of the 143
// validate() call sites shows the largest legitimate arrays in the low
// hundreds (inspection photo batches, test-purge ID lists, guest order lines,
// per-category pricing rows); the ceilings sit well above that observed use.
// NOT covered: functions that parse without this wrapper (placeGuestOrder
// calls safeParse directly) - a known residual, tracked separately.
// Why pre-parse checks exist: zod parses every array item even when a .max()
// bound is already violated (installed zod 3.25.76, v3/types.cjs
// ZodArray._parse), so resource checks must run BEFORE schema parsing.
//
// INPUT_CONTENT_BUDGET is an exact UTF-8 CONTENT budget: Buffer.byteLength
// for strings and object keys, plus fixed per-node allowances. Framing bytes
// (quotes, commas, escapes) are not counted, so this is a content-work
// budget, not an exact serialized wire size. Node counting is per VALUE
// visited (array items, object values, top-level); object keys add content
// bytes but are not separate nodes.
const INPUT_CONTENT_BUDGET = 1_000_000;
const MAX_ARRAY_ITEMS = 1000; // per array, anywhere in the payload, pre-parse
const MAX_TOTAL_VALUES = 20_000; // values visited while walking the payload
const MAX_DEPTH = 32; // nesting depth of the payload graph
const MAX_REPORTED_ISSUES = 50; // issue entries considered for diagnostics
const MAX_MESSAGE_CHARS = 300; // per issue message
const MAX_PATH_CHARS = 256;
const RESPONSE_UTF8_BUDGET = 4_000; // hard cap on returned diagnostic text
const LOG_UTF8_BUDGET = 8_000; // hard cap on the serialized warning payload

/**
 * Validates input data against a Zod schema in strict mode.
 * Returns parsed data or throws HttpsError with structured detail.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  assertInputBudget(data);
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Validation failures reject the request with HTTP 400 before any handler
  // code runs - without this log the rejection is invisible in Cloud Logging
  // (the 10 Oct 2026 membership-approval outage was exactly this blind spot).
  // Diagnostics are sanitized and byte-capped: zod's built-in
  // invalid_enum_value message echoes the offending input verbatim, and
  // record keys / custom issue paths can carry attacker strings, so paths
  // are verified against the schema's declared shape (unverifiable segments
  // become "?"), enum messages drop the received value, and both the
  // returned text and the warning payload have hard UTF-8 byte budgets.
  const total = result.error.issues.length;
  const safe = result.error.issues.slice(0, MAX_REPORTED_ISSUES).map((i) => safeIssue(schema, i));
  const logged: Array<{ path: string; code: string; message: string }> = [];
  const payload = () => ({ issues: logged, totalIssues: total, truncated: total > logged.length });
  for (const issue of safe) {
    logged.push(issue);
    if (Buffer.byteLength(JSON.stringify(payload()), "utf8") > LOG_UTF8_BUDGET) {
      logged.pop();
      break;
    }
  }
  logger.warn("Callable request failed input validation", payload());
  throw new HttpsError("invalid-argument", formatIssues(safe, total));
}

/** Rejects oversized or non-plain-JSON input before any schema parsing. */
function assertInputBudget(data: unknown): void {
  const state = { contentBytes: 0, values: 0 };
  // Depth is capped (MAX_DEPTH), so native recursion stays within a bounded
  // number of frames. The ancestor set tracks the CURRENT PATH only, so
  // shared (non-cyclic) references in constructed payloads stay valid while
  // true cycles fail closed.
  const walk = (value: unknown, depth: number, ancestors: WeakSet<object>): void => {
    state.values += 1;
    if (state.values > MAX_TOTAL_VALUES || depth > MAX_DEPTH) {
      throw new HttpsError("invalid-argument", "Request payload exceeds the input resource budget.");
    }
    if (typeof value === "string") {
      state.contentBytes += Buffer.byteLength(value, "utf8");
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      state.contentBytes += 8;
    } else if (typeof value === "object") {
      if (ancestors.has(value)) notPlain();
      ancestors.add(value);
      state.contentBytes += 2;
      if (Array.isArray(value)) {
        if (value.length > MAX_ARRAY_ITEMS) {
          throw new HttpsError("invalid-argument", `Request payload contains an array larger than the ${MAX_ARRAY_ITEMS}-item input budget.`);
        }
        for (const item of value) walk(item, depth + 1, ancestors);
      } else {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) notPlain();
        // for..in with early abort: no full key-array allocation on huge objects
        for (const key in value as Record<string, unknown>) {
          state.contentBytes += Buffer.byteLength(key, "utf8");
          walk((value as Record<string, unknown>)[key], depth + 1, ancestors);
        }
      }
      ancestors.delete(value);
    } else {
      notPlain();
    }
    if (state.contentBytes > INPUT_CONTENT_BUDGET) {
      throw new HttpsError("invalid-argument", "Request payload exceeds the input resource budget.");
    }
  };
  const notPlain = (): never => {
    throw new HttpsError("invalid-argument", "Request payload is not plain JSON.");
  };
  walk(data, 1, new WeakSet());
}

/** One sanitized issue: schema-verified path, message free of input values. */
function safeIssue(schema: ZodTypeAny, issue: ZodIssue): { path: string; code: string; message: string } {
  const verified = verifyPath(schema, issue.path);
  const path = issue.path
    .map((seg, i) => (verified[i] ? String(seg).slice(0, 64) : "?"))
    .join(".")
    .slice(0, MAX_PATH_CHARS);
  return { path, code: issue.code, message: safeMessage(issue).slice(0, MAX_MESSAGE_CHARS) };
}

/**
 * Walks the zod v3 schema alongside an issue path: a segment is verified only
 * when it is a declared object field or a bounded array/tuple index. Record
 * keys, unknown structures and anything past a leaf are unverified. Unions
 * verify a segment only when EVERY option verifies it at that position.
 * Traversal is fail-closed and bounded: MAX_SCHEMA_HOPS caps total schema
 * steps, and a (schema, path-index) pair already on the visit set stops
 * cyclic lazy/getter chains. Exported for focused unit tests.
 */
const MAX_SCHEMA_HOPS = 500;

export function verifyPath(schema: ZodTypeAny, path: ReadonlyArray<string | number>): boolean[] {
  const hops = { n: 0 };
  const visited = new Map<object, Set<number>>();

  const step = (node: ZodTypeAny, i: number): boolean[] => {
    const rest = path.slice(i).map(() => false);
    if (i >= path.length) return rest;
    if ((hops.n += 1) > MAX_SCHEMA_HOPS) return rest;
    const seen = visited.get(node);
    if (seen?.has(i)) return rest;
    if (seen) seen.add(i); else visited.set(node, new Set([i]));

    const def = (node as { _def?: Record<string, unknown> })._def ?? {};
    const typeName = String(def.typeName ?? "");
    try {
      if (typeName === "ZodOptional" || typeName === "ZodNullable" || typeName === "ZodDefault" || typeName === "ZodCatch" || typeName === "ZodReadonly") {
        return step(def.innerType as ZodTypeAny, i);
      }
      if (typeName === "ZodEffects" || typeName === "ZodBranded" || typeName === "ZodPipeline") {
        return step((def.schema ?? def.type ?? def.in) as ZodTypeAny, i);
      }
      if (typeName === "ZodLazy") {
        return step((def.getter as () => ZodTypeAny)(), i);
      }
      if (typeName === "ZodObject") {
        const shape = (def.shape as () => Record<string, ZodTypeAny>)();
        const seg = String(path[i]);
        if (Object.prototype.hasOwnProperty.call(shape, seg)) {
          const sub = step(shape[seg] as ZodTypeAny, i + 1);
          return [true, ...sub];
        }
        return rest;
      }
      if (typeName === "ZodArray") {
        if (isBoundedIndex(path[i] as string | number)) {
          const sub = step(def.type as ZodTypeAny, i + 1);
          return [true, ...sub];
        }
        return rest;
      }
      if (typeName === "ZodTuple") {
        const items = (def.items as ZodTypeAny[]) ?? [];
        const idx = Number(path[i]);
        if (Number.isInteger(idx) && idx >= 0 && idx < items.length) {
          const sub = step(items[idx] as ZodTypeAny, i + 1);
          return [true, ...sub];
        }
        return rest;
      }
      if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
        const options = (typeName === "ZodUnion"
          ? (def.options as ZodTypeAny[])
          : [...(def.options as Map<string, ZodTypeAny>).values()]) ?? [];
        if (options.length === 0) return rest;
        const perOption = options.map((opt) => step(opt, i));
        // Per-segment AND across ALL options for the ENTIRE remaining path:
        // one lax branch (e.g. a record) must not launder a dynamic segment.
        return rest.map((_, j) => perOption.every((flags) => flags[j] === true));
      }
      return rest; // ZodRecord, ZodMap, leaves, unknown nodes: unverified
    } catch {
      return rest; // a throwing getter or malformed def fails closed
    }
  };
  return step(schema, 0);
}

function isBoundedIndex(seg: string | number): boolean {
  const n = typeof seg === "number" ? seg : Number(seg);
  return Number.isInteger(n) && n >= 0 && n <= MAX_ARRAY_ITEMS;
}

/**
 * Message provenance ladder, strictest safe tier wins:
 *  1. invalid_enum_value and unrecognized_keys ALWAYS become generics: zod's
 *     built-ins embed the received value / attacker key names verbatim.
 *  2. A message identical to what zod's defaultErrorMap regenerates for the
 *     same issue is a zod default: it carries schema-side constraints only.
 *  3. Otherwise the message is custom text: kept only when it appears in the
 *     explicit VETTED_STATIC_MESSAGES allowlist (static business copy
 *     inventoried from src/schemas, verified free of input interpolation).
 *  4. Everything else (dynamic refine/superRefine/errorMap output) becomes a
 *     generic per-code string. Custom text is never trusted by provenance
 *     claims alone - ctx.addIssue and error maps can interpolate input.
 */
const VETTED_STATIC_MESSAGES: ReadonlySet<string> = new Set([
  "Price must be non-negative paise",
  "Base price must be a non-negative integer (paise)",
  "The end must be after the start.",
  "An offer can run up to 120 days.",
  "Phone number is required for an enquiry.",
  "Give this document a name",
  "RC number must look like GJ01AB1234 (state, RTO, series, number)",
]);

const GENERIC_BY_CODE: Readonly<Record<string, string>> = {
  custom: "Invalid input.",
};

function safeMessage(issue: ZodIssue): string {
  if (issue.code === "invalid_enum_value") return "Invalid enum value.";
  if (issue.code === "unrecognized_keys") return "Unrecognized key(s) in object.";
  let regenerated: string | undefined;
  try {
    regenerated = defaultErrorMap(issue, { defaultError: "Invalid input.", data: undefined }).message;
  } catch {
    regenerated = undefined;
  }
  if (regenerated !== undefined && issue.message === regenerated) return issue.message;
  if (VETTED_STATIC_MESSAGES.has(issue.message)) return issue.message;
  return GENERIC_BY_CODE[issue.code] ?? "Invalid input.";
}

function formatIssues(safe: Array<{ path: string; code: string; message: string }>, total: number): string {
  let out = "";
  let bytes = 0;
  let shown = 0;
  for (const issue of safe) {
    const entry = `${issue.path}: ${issue.message}`;
    const entryBytes = Buffer.byteLength(entry, "utf8") + 2;
    // Reserve room for the truncation marker so the TOTAL stays in budget.
    if (bytes + entryBytes > RESPONSE_UTF8_BUDGET - 80) break;
    out += (shown > 0 ? "; " : "") + entry;
    bytes += entryBytes;
    shown += 1;
  }
  const remaining = total - shown;
  if (remaining > 0) out += `; ... and ${remaining} more issue(s) (${total} total)`;
  return out;
}
