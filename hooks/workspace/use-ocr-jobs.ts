"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildWebSocketUrl, upsertOcrJobs } from "@/lib/workspace/utils";
import type { OcrJob } from "@/types/workspace";

type RequestFn = <T>(
  path: string,
  token: string,
  init?: RequestInit,
) => Promise<T>;

type UseOcrJobsParams = {
  token: string | null;
  request: RequestFn;
};

export function useOcrJobs({ token, request }: UseOcrJobsParams) {
  const [ocrJobs, setOcrJobs] = useState<OcrJob[]>([]);
  const [isOcrQueueHidden, setIsOcrQueueHidden] = useState(false);

  const activeQueueCount = useMemo(
    () =>
      ocrJobs.filter(
        (job) => job.status === "queued" || job.status === "running",
      ).length,
    [ocrJobs],
  );

  useEffect(() => {
    if (activeQueueCount === 0) {
      setIsOcrQueueHidden(false);
    }
  }, [activeQueueCount]);

  const loadOcrJobs = useCallback(
    async (accessToken: string) => {
      try {
        const rows = await request<OcrJob[]>("/ocr-jobs", accessToken);
        setOcrJobs(rows);
      } catch {
        setOcrJobs([]);
      }
    },
    [request],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadOcrJobs(token);
  }, [loadOcrJobs, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = new WebSocket(buildWebSocketUrl(token));

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          job?: OcrJob;
        };

        if (payload.type === "job_update" && payload.job) {
          setOcrJobs((previous) =>
            upsertOcrJobs(previous, [payload.job as OcrJob]),
          );
        }
      } catch {
        // Ignore non-JSON heartbeat messages.
      }
    };

    return () => {
      socket.close();
    };
  }, [token]);

  return {
    ocrJobs,
    isOcrQueueHidden,
    activeQueueCount,
    setOcrJobs,
    setIsOcrQueueHidden,
  };
}
