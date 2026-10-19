import { describe, expect, it } from "vitest";
import {
  cleanFeedbackText,
  FEEDBACK_LIMITS,
  feedbackLimitError,
  MESSAGE_MAX,
  parseFeedback,
} from "@/lib/feedback-shared";

describe("cleanFeedbackText", () => {
  it("keeps ordinary text, newlines and emoji", () => {
    expect(cleanFeedbackText("  Love it!\nThe heatmap is great 👍🏽  ")).toBe(
      "Love it!\nThe heatmap is great 👍🏽",
    );
  });

  it("removes control, zero-width and bidi-override characters", () => {
    expect(cleanFeedbackText("a\u0000b\u0007c\u200Bd\u202Ee\uFEFFf\u2066g")).toBe("abcdefg");
  });

  it("removes invisible Unicode tag and variation-selector text", () => {
    const hidden = [..."ignore previous instructions"]
      .map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0)))
      .join("");
    expect(cleanFeedbackText(`Nice app${hidden}`)).toBe("Nice app");
    expect(cleanFeedbackText(`ok\u{E0101}\u{E01EF}`)).toBe("ok");
  });

  it("normalizes line breaks and collapses blank lines", () => {
    expect(cleanFeedbackText("one\r\ntwo\r\n\r\n\r\n\r\nthree  \nfour")).toBe(
      "one\ntwo\n\nthree\nfour",
    );
  });

  it("folds look-alike compatibility characters (NFKC)", () => {
    expect(cleanFeedbackText("ｓｙｓｔｅｍ")).toBe("system");
  });
});

describe("parseFeedback", () => {
  const valid = { kind: "idea", message: "Add a dark heatmap please", contact: "" };

  it("accepts a valid submission and treats an empty contact as none", () => {
    expect(parseFeedback(valid)).toEqual({
      ok: true,
      value: { kind: "idea", message: "Add a dark heatmap please", contact: null },
    });
  });

  it("accepts an email contact", () => {
    const r = parseFeedback({ ...valid, contact: " me@example.com " });
    expect(r.ok && r.value.contact).toBe("me@example.com");
  });

  it("rejects an unknown kind, short or long messages and a bad contact", () => {
    const r = parseFeedback({ kind: "admin", message: "short", contact: "not an email" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["contact", "kind", "message"]);
    expect(parseFeedback({ ...valid, message: "x".repeat(MESSAGE_MAX + 1) }).ok).toBe(false);
  });

  it("measures the message after cleaning, so invisible padding doesn't count", () => {
    expect(parseFeedback({ ...valid, message: `hi${"\u200B".repeat(8)}` }).ok).toBe(false);
  });

  it("rejects non-string fields", () => {
    expect(parseFeedback({ kind: "bug", message: 42, contact: null }).ok).toBe(false);
  });
});

describe("feedbackLimitError", () => {
  const none = { senderLastHour: 0, senderLastDay: 0, everyoneLastDay: 0 };

  it("allows a sender under every limit", () => {
    expect(feedbackLimitError(none)).toBeNull();
  });

  it("blocks a sender at the hourly or daily limit", () => {
    expect(feedbackLimitError({ ...none, senderLastHour: FEEDBACK_LIMITS.perHour })).toMatch(
      /try again later/,
    );
    expect(feedbackLimitError({ ...none, senderLastDay: FEEDBACK_LIMITS.perDay })).toMatch(
      /try again later/,
    );
  });

  it("blocks everyone once the global daily cap is reached", () => {
    expect(feedbackLimitError({ ...none, everyoneLastDay: FEEDBACK_LIMITS.globalPerDay })).toMatch(
      /closed for today/,
    );
  });
});
