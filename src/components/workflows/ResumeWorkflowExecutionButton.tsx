"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resumeWorkflowExecutionAction } from "@/server/actions/workflows";
import { useI18n } from "@/lib/i18n/context";

export function ResumeWorkflowExecutionButton({
  executionId,
}: {
  executionId: string;
}) {
  const router = useRouter();
  const { language, errorMessage } = useI18n();
  const ar = language === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            setMessage("");
            const result = await resumeWorkflowExecutionAction(executionId);
            if (!result.success) {
              setError(
                errorMessage(
                  result.error,
                  text("Unable to resume workflow.", "تعذر استئناف سير العمل."),
                ),
              );
            } else if (result.result.status === "COMPLETED") {
              setMessage(
                text("Workflow execution completed.", "اكتمل تنفيذ سير العمل."),
              );
            } else if (result.result.status === "PAUSED_ENTITLEMENT") {
              setMessage(
                text(
                  "Workflow remains paused because the current plan is read-only or does not include workflows.",
                  "لا يزال سير العمل متوقفًا لأن الخطة الحالية للقراءة فقط أو لا تتضمن سير العمل.",
                ),
              );
            } else if (result.result.status === "IN_PROGRESS") {
              setMessage(
                text(
                  "Another owner is already processing this workflow execution.",
                  "هناك مسؤول آخر يعالج تنفيذ سير العمل حاليًا.",
                ),
              );
            } else if (result.result.status === "BUSY") {
              setMessage(
                text(
                  "Workflow execution is waiting for available capacity.",
                  "ينتظر تنفيذ سير العمل توفر سعة للمعالجة.",
                ),
              );
            } else {
              setMessage(
                text(
                  `Resume result: ${result.result.status}.`,
                  "تمت معالجة طلب الاستئناف.",
                ),
              );
            }
            router.refresh();
          })
        }
        className="rounded border px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {pending
          ? text("Resuming…", "جارٍ الاستئناف…")
          : text("Resume", "استئناف")}
      </button>
      {error ? (
        <p className="mt-1 max-w-56 text-xs text-red-600">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-1 max-w-56 text-xs text-slate-600">{message}</p>
      ) : null}
    </div>
  );
}
