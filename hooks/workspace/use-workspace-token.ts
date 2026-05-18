"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getStoredAuthToken } from "@/lib/auth";

export function useWorkspaceToken() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = getStoredAuthToken();
    if (!storedToken) {
      router.replace("/login");
      return;
    }

    setToken(storedToken);
  }, [router]);

  return token;
}
