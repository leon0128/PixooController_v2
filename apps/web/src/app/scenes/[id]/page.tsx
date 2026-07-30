import { SceneEditor } from '@/components/scene-editor';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

// params is a promise in Next.js 16; the server component resolves it and hands
// the loaded scene to the client editor. Typed explicitly rather than via
// PageProps, whose generated types live in .next — a container-local volume the
// host's typechecker cannot see.
export default async function EditScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [scene, fonts] = await Promise.all([
    api.getScene(Number(id)),
    api.listFonts(),
  ]);
  return <SceneEditor scene={scene} fonts={fonts} />;
}
