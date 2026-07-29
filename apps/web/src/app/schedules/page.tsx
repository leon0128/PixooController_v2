import { ScheduleGrid } from '@/components/schedule-grid';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage() {
  const [scenes, entries] = await Promise.all([api.listScenes(), api.listSchedules()]);
  return <ScheduleGrid scenes={scenes} initialEntries={entries} />;
}
