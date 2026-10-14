
import { createClient } from "@supabase/supabase-js";

/*
    SYSTEM FUNCTION:
    Retrieves the Supabase project URL
    from the Vite environment variables.
*/
const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL;

/*
    SYSTEM FUNCTION:
    Retrieves the Supabase publishable key
    from the Vite environment variables.
*/
const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/*
    SYSTEM FUNCTION:
    Checks whether the Supabase URL
    and publishable key are available.
*/
if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        "Missing Supabase environment variables."
    );
}

/*
    SYSTEM FUNCTION:
    Creates and exports the Supabase client.

    The export allows other files such as
    App.tsx and pages/login/index.tsx
    to access Supabase Authentication.
*/
export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);
