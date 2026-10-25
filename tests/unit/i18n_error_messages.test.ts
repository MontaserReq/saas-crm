import { describe, expect, it } from "vitest";
import { localizeErrorMessage } from "@/lib/i18n/errorMessages";
import { translations } from "@/lib/i18n/translations";

describe("localized UI errors", () => {
  it("translates known English service validation into Arabic", () => {
    expect(localizeErrorMessage("Invalid email address", "ar")).toBe(
      "أدخل بريدًا إلكترونيًا صالحًا.",
    );
    expect(
      localizeErrorMessage(
        "Enter a valid international phone number including the country code",
        "ar",
      ),
    ).toContain("رقم هاتف دوليًا صالحًا");
  });

  it("does not expose an unknown English technical error in Arabic UI", () => {
    expect(localizeErrorMessage("Prisma internal failure", "ar")).toBe(
      "تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.",
    );
  });

  it("does not expose Arabic errors in English UI", () => {
    expect(localizeErrorMessage("تعذر الحفظ", "en")).toBe(
      "Unable to complete the operation. Check the details and try again.",
    );
  });
});

describe("translation catalog", () => {
  const flatten = (value: unknown, prefix = ""): string[] =>
    Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return child && typeof child === "object" ? flatten(child, path) : [path];
    });

  it("keeps Arabic and English translation keys in parity", () => {
    expect(flatten(translations.ar).sort()).toEqual(
      flatten(translations.en).sort(),
    );
  });
});
