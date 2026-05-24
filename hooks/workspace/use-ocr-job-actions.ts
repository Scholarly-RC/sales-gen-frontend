"use client";

import type { RequestFn } from "@/lib/http";
import { appToast } from "@/lib/toast";
import { upsertOcrJobs } from "@/lib/workspace/utils";
import type { OcrJob } from "@/types/workspace";

type UseOcrJobActionsParams = {
  token: string | null;
  request: RequestFn;
  setOcrJobs: React.Dispatch<React.SetStateAction<OcrJob[]>>;
};

export function useOcrJobActions({
  token,
  request,
  setOcrJobs,
}: UseOcrJobActionsParams) {
  async function handleRetryFailedOcrJob(jobId: string) {
    if (!token) {
      return;
    }

    try {
      const updated = await request<OcrJob>(`/ocr-jobs/${jobId}/retry`, token, {
        method: "POST",
      });
      setOcrJobs((previous) => upsertOcrJobs(previous, [updated]));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to retry OCR task";
      appToast.error({
        title: "OCR retry failed",
        description: message,
      });
    }
  }

  async function handleStopQueuedOcrJob(jobId: string) {
    if (!token) {
      return;
    }

    try {
      const updated = await request<OcrJob>(`/ocr-jobs/${jobId}/stop`, token, {
        method: "POST",
      });
      setOcrJobs((previous) => upsertOcrJobs(previous, [updated]));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to stop OCR job";
      appToast.error({
        title: "Stop OCR job failed",
        description: message,
      });
    }
  }

  async function handleRemoveFinishedOcrJobs() {
    if (!token) {
      return;
    }

    try {
      await request<void>("/ocr-jobs/finished", token, {
        method: "DELETE",
      });
      setOcrJobs((previous) =>
        previous.filter(
          (entry) => entry.status === "queued" || entry.status === "running",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to remove finished OCR jobs";
      appToast.error({
        title: "Remove finished failed",
        description: message,
      });
    }
  }

  return {
    handleRetryFailedOcrJob,
    handleStopQueuedOcrJob,
    handleRemoveFinishedOcrJobs,
  };
}
