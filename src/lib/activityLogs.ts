import { supabase } from "./supabase";

/** Phase 11: Super Admin-only, read-only activity history. */
export type ActivityAction = "INSERT" | "UPDATE" | "DELETE";
export type ActivityEntity = "learner" | "health_record" | "section" | "account";

export type ActivityLog = {
    id: string;
    event_at: string;
    actor_id: string | null;
    actor_name: string;
    action: ActivityAction;
    entity_type: ActivityEntity;
    record_id: string | null;
    target_account_id: string | null;
    learner_id: string | null;
    grade: string | null;
    section: string | null;
    changed_fields: string[];
};

export type ActivityFilters = {
    action: "all" | ActivityAction;
    entity: "all" | ActivityEntity;
    learnerId: string;
    fromDate: string;
    toDate: string;
    page: number;
};

export type ActivityPage = {
    records: ActivityLog[];
    total: number;
    pageSize: number;
};

const PAGE_SIZE = 25;

function startOfPhilippineDay(date: string): string {
    const parsed = new Date(`${date}T00:00:00+08:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date filter.");
    return parsed.toISOString();
}

function nextPhilippineDay(date: string): string {
    const parsed = new Date(`${date}T00:00:00+08:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date filter.");
    return new Date(parsed.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export async function fetchActivityLogs(filters: ActivityFilters): Promise<ActivityPage> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in to view activity logs.");

    // Frontend guard for usability; the RLS policy is the actual security boundary.
    const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();
    if (profileError || profile?.role !== "Super Admin") {
        throw new Error("Only Super Admin can view activity logs.");
    }

    const page = Math.max(0, Math.floor(filters.page));
    let query = supabase.from("tdc_activity_logs")
        .select(
            "id, event_at, actor_id, action, entity_type, record_id, target_account_id, learner_id, grade, section, changed_fields",
            { count: "exact" }
        )
        .order("event_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filters.action !== "all") query = query.eq("action", filters.action);
    if (filters.entity !== "all") query = query.eq("entity_type", filters.entity);
    if (filters.learnerId) {
        if (!/^\d+$/.test(filters.learnerId)) throw new Error("Learner ID must contain digits only.");
        query = query.eq("learner_id", filters.learnerId);
    }
    if (filters.fromDate) query = query.gte("event_at", startOfPhilippineDay(filters.fromDate));
    if (filters.toDate) query = query.lt("event_at", nextPhilippineDay(filters.toDate));

    const { data, error, count } = await query;
    if (error) throw new Error(`Activity logs could not be loaded: ${error.message}`);

    const rows = data ?? [];
    const actorIds = Array.from(new Set(
        rows.map(row => row.actor_id).filter((id): id is string => typeof id === "string" && id.length > 0)
    ));
    const actorNames = new Map<string, string>();

    if (actorIds.length > 0) {
        const { data: actors, error: actorsError } = await supabase
            .from("user_profiles")
            .select("id, full_name")
            .in("id", actorIds);
        if (actorsError) throw new Error(`Unable to resolve account names: ${actorsError.message}`);
        for (const actor of actors ?? []) {
            actorNames.set(String(actor.id), String(actor.full_name ?? "Unknown account"));
        }
    }

    return {
        records: rows.map(row => ({
            id: String(row.id),
            event_at: String(row.event_at),
            actor_id: row.actor_id == null ? null : String(row.actor_id),
            actor_name: row.actor_id == null
                ? "System / privileged operation"
                : actorNames.get(String(row.actor_id)) ?? "Former or unknown account",
            action: row.action as ActivityAction,
            entity_type: row.entity_type as ActivityEntity,
            record_id: row.record_id == null ? null : String(row.record_id),
            target_account_id: row.target_account_id == null ? null : String(row.target_account_id),
            learner_id: row.learner_id == null ? null : String(row.learner_id),
            grade: row.grade == null ? null : String(row.grade),
            section: row.section == null ? null : String(row.section),
            changed_fields: Array.isArray(row.changed_fields)
                ? row.changed_fields.filter((field): field is string => typeof field === "string")
                : []
        })),
        total: count ?? 0,
        pageSize: PAGE_SIZE
    };
}
