import { SceneEditor } from '@/components/scene-editor';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function NewScenePage() {
  const fonts = await api.listFonts();
  return <SceneEditor fonts={fonts} />;
}
