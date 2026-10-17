import { supabase } from "./supabase";
import type { UserRole } from "../types";

/*
 * Account management uses a protected Supabase Edge Function.
 * Never use auth.admin or a service-role key in the React application.
 */
export type ManagedRole = Extract<UserRole, "Super Admin" | "Admin" | "Viewer">;

export type ManagedAccount = {
    id: string;
    email: string;
    full_name: string;
    role: ManagedRole;
    grade: string | null;
    section: string | null;
};

export type AccountDetails = {
    full_name: string;
    role: ManagedRole;
    grade: string | null;
    section: string | null;
};

export type CreateAccountInput = AccountDetails & {
    email: string;
    password: string;
};

export type UpdateAccountInput = AccountDetails & {
    id: string;
};

type FunctionResponse = {
    accounts?: ManagedAccount[];
    error?: string;
    message?: string;
    warning?: string;
};

async function callAccountFunction(body: Record<string, unknown>): Promise<FunctionResponse> {
    const { data, error } = await supabase.functions.invoke<FunctionResponse>(
        "manage-accounts",
        { body }
    );

    if (error) {
        // Edge Functions expose a useful JSON message for 4xx/5xx responses.
        let message = error.message;
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
            try {
                const details: unknown = await context.json();
                if (details && typeof details === "object" && "error" in details) {
                    const serverError = (details as { error?: unknown }).error;
                    if (typeof serverError === "string") message = serverError;
                }
            } catch {
                // Keep the original error when response JSON is unavailable.
            }
        }
        throw new Error(message);
    }

    if (!data || data.error) {
        throw new Error(data?.error ?? "The account request returned no data.");
    }
    return data;
}

export async function listManagedAccounts(): Promise<ManagedAccount[]> {
    const result = await callAccountFunction({ action: "list" });
    return result.accounts ?? [];
}

export async function createManagedAccount(input: CreateAccountInput): Promise<string | null> {
    const result = await callAccountFunction({ action: "create", ...input });
    return result.warning ?? null;
}

export async function updateManagedAccount(input: UpdateAccountInput): Promise<string | null> {
    const result = await callAccountFunction({ action: "update", ...input });
    return result.warning ?? null;
}

/** Permanently deletes a managed account through the protected Edge Function. */
export async function deleteManagedAccount(id: string): Promise<string | null> {
    const result = await callAccountFunction({ action: "delete", id });
    return result.warning ?? null;
}
