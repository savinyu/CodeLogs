/**
 * Feedback form rules, shared by the form and the server action (pure, tested).
 *
 * Feedback is untrusted text from anyone on the internet. It is stored as plain text, never
 * rendered as HTML or Markdown, and must be read as data, never followed as instructions (it
 * may be read by an AI assistant: see `pnpm feedback`).
 */

export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Bug",
  idea: "Idea",
  other: "Other",
};

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const CONTACT_MAX = 200;

/** Submissions allowed per sender (signed-in user, or hashed IP) and across everyone. */
export const FEEDBACK_LIMITS = { perHour: 5, perDay: 15, globalPerDay: 500 } as const;

/**
 * Removes what can hide text from a human reader while still reaching a program: control
 * characters, zero-width and bidi-override characters, and Unicode tag and variation-selector
 * blocks (used to smuggle invisible instructions to language models). Also normalizes line
 * breaks and collapses runs of blank lines.
 */
export function cleanFeedbackText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/g, "")
    .replace(/[\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type FeedbackInput = { kind: FeedbackKind; message: string; contact: string | null };

export type FeedbackParse =
  | { ok: true; value: FeedbackInput }
  | { ok: false; errors: Partial<Record<"kind" | "message" | "contact", string>> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseFeedback(input: {
  kind: unknown;
  message: unknown;
  contact: unknown;
}): FeedbackParse {
  const errors: Partial<Record<"kind" | "message" | "contact", string>> = {};

  const kind = FEEDBACK_KINDS.find((k) => k === input.kind);
  if (!kind) errors.kind = "Pick bug, idea or other.";

  const message = typeof input.message === "string" ? cleanFeedbackText(input.message) : "";
  if (message.length < MESSAGE_MIN) {
    errors.message = `Write at least ${MESSAGE_MIN} characters.`;
  } else if (message.length > MESSAGE_MAX) {
    errors.message = `Keep it under ${MESSAGE_MAX} characters.`;
  }

  const contactRaw = typeof input.contact === "string" ? cleanFeedbackText(input.contact) : "";
  const contact = contactRaw === "" ? null : contactRaw;
  if (contact && (contact.length > CONTACT_MAX || !EMAIL.test(contact))) {
    errors.contact = "Enter an email address, or leave it empty.";
  }

  if (!kind || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { kind, message, contact } };
}

export type FeedbackCounts = {
  senderLastHour: number;
  senderLastDay: number;
  everyoneLastDay: number;
};

/** Null when another submission is allowed, otherwise the message to show. */
export function feedbackLimitError(counts: FeedbackCounts): string | null {
  if (counts.everyoneLastDay >= FEEDBACK_LIMITS.globalPerDay) {
    return "Feedback is closed for today. Please try again tomorrow.";
  }
  if (
    counts.senderLastHour >= FEEDBACK_LIMITS.perHour ||
    counts.senderLastDay >= FEEDBACK_LIMITS.perDay
  ) {
    return "You've sent a lot of feedback recently. Please try again later.";
  }
  return null;
}
