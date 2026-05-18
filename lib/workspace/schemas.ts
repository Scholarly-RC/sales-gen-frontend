import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const userSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
  is_admin: z.boolean(),
  is_active: z.boolean().optional(),
});

export type UserFormValues = z.infer<typeof userSchema>;
