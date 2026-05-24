"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { RequestFn } from "@/lib/http";
import { appToast } from "@/lib/toast";
import { type UserFormValues, userSchema } from "@/lib/workspace/schemas";
import type { User } from "@/types/workspace";

type UseUserActionsParams = {
  token: string | null;
  request: RequestFn;
  userForm: UseFormReturn<UserFormValues>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
};

export function useUserActions({
  token,
  request,
  userForm,
  setUsers,
}: UseUserActionsParams) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  function openUserCreateModal() {
    setSelectedUser(null);
    setUserFormError(null);
    userForm.reset({
      email: "",
      password: "",
      is_admin: false,
      is_active: true,
    });
    setIsUserModalOpen(true);
  }

  function openUserEditModal(nextUser: User) {
    setSelectedUser(nextUser);
    setUserFormError(null);
    userForm.reset({
      email: nextUser.email,
      password: "",
      is_admin: nextUser.is_admin,
      is_active: nextUser.is_active,
    });
    setIsUserModalOpen(true);
  }

  async function submitUserForm(values: UserFormValues) {
    if (!token) {
      return;
    }

    setUserFormError(null);

    if (!selectedUser && !values.password) {
      userForm.setError("password", {
        message: "Password is required for new users",
      });
      return;
    }

    const parsed = userSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof UserFormValues;
        userForm.setError(field, { message: issue.message });
      }
      return;
    }

    setIsSavingUser(true);

    try {
      if (selectedUser) {
        const updated = await request<User>(
          `/users/${selectedUser.id}`,
          token,
          {
            method: "PUT",
            body: JSON.stringify({
              email: parsed.data.email,
              is_admin: parsed.data.is_admin,
              is_active: parsed.data.is_active ?? true,
            }),
          },
        );

        setUsers((previous) =>
          previous.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      } else {
        const created = await request<User>("/users", token, {
          method: "POST",
          body: JSON.stringify({
            email: parsed.data.email,
            password: parsed.data.password,
            is_admin: parsed.data.is_admin,
          }),
        });

        setUsers((previous) => [created, ...previous]);
      }

      setIsUserModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save user";
      setUserFormError(message);
      appToast.error({
        title: "Unable to save user",
        description: message,
      });
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!token) {
      return;
    }

    try {
      await request<void>(`/users/${userId}`, token, { method: "DELETE" });
      setUsers((previous) => previous.filter((entry) => entry.id !== userId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete user";
      appToast.error({
        title: "Unable to delete user",
        description: message,
      });
    }
  }

  async function handleActivateUser(userId: string) {
    if (!token) {
      return;
    }

    try {
      const updated = await request<User>(`/users/${userId}/activate`, token, {
        method: "POST",
      });

      setUsers((previous) =>
        previous.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to activate user";
      appToast.error({
        title: "Unable to activate user",
        description: message,
      });
    }
  }

  return {
    selectedUser,
    isUserModalOpen,
    isSavingUser,
    userFormError,
    setSelectedUser,
    setIsUserModalOpen,
    setUserFormError,
    openUserCreateModal,
    openUserEditModal,
    submitUserForm,
    handleDeleteUser,
    handleActivateUser,
  };
}
