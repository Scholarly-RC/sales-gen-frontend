"use client";

import { toast } from "sonner";

type ToastMessage = {
  title: string;
  description?: string;
};

export const appToast = {
  success: ({ title, description }: ToastMessage) =>
    toast.success(title, { description }),
  error: ({ title, description }: ToastMessage) =>
    toast.error(title, { description }),
  info: ({ title, description }: ToastMessage) =>
    toast.info(title, { description }),
  warning: ({ title, description }: ToastMessage) =>
    toast.warning(title, { description }),
  loading: ({ title, description }: ToastMessage) =>
    toast.loading(title, { description }),
  dismiss: (toastId?: string | number) => toast.dismiss(toastId),
};
