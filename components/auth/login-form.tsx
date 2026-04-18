"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { appToast } from "@/lib/toast";

type LoginResponse = {
  access_token: string;
};

function formatApiError(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    Array.isArray(body.detail)
  ) {
    const first = body.detail[0];
    if (first && typeof first === "object" && "msg" in first) {
      const message = first.msg;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string" &&
    body.detail.trim()
  ) {
    return body.detail;
  }

  return fallback;
}

async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "Unable to sign in";

    try {
      const body = await response.json();
      detail = formatApiError(body, detail);
    } catch {
      detail = `${response.status} ${response.statusText}`;
    }

    throw new Error(detail);
  }

  return response.json() as Promise<LoginResponse>;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email.trim(), password);
      setAuthToken(result.access_token);
      router.replace("/workspace");
      router.refresh();
    } catch (submitError) {
      appToast.error({
        title: "Unable to sign in",
        description:
          submitError instanceof Error
            ? submitError.message
            : "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="email">Admin email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <LogIn className="size-4" />
        )}
        Sign in
      </Button>
    </form>
  );
}
