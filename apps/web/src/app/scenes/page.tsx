import { SceneList } from '@/components/scene-list';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ScenesPage() {
  const scenes = await api.listScenes();
  return <SceneList scenes={scenes} />;
}
