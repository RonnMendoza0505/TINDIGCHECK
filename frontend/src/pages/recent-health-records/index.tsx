import HealthRecordsBrowser from "../../components/health-records/HealthRecordsBrowser";
import type { UserProfile } from "../../types";

/* SYSTEM FUNCTION: Displays newest saved health measurements, read-only. */
export default function RecentHealthRecords({ user }: { user: UserProfile }) {
    return <HealthRecordsBrowser user={user} mode="recent" />;
}
