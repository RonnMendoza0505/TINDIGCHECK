import HealthRecordsBrowser from "../../components/health-records/HealthRecordsBrowser";
import type { UserProfile } from "../../types";

/* SYSTEM FUNCTION: Displays one learner's health history, read-only. */
export default function HealthRecords({ user }: { user: UserProfile }) {
    return <HealthRecordsBrowser user={user} mode="history" />;
}
