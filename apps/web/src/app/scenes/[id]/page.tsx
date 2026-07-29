import { notFound } from 'next/navigation';
import { SceneEditor } from '@/components/scene-editor';
import { ApiError, api } from '@/lib/api';

export const dynamic = 'force-dynamic';

// params is a promise in Next.js 16.
export default async function EditScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch outside the JSX: errors thrown while React renders a child would escape
  // a try/catch here, so only the data call is guarded.
  const scene = await api.getScene(Number(id)).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  });

  return <SceneEditor scene={scene} />;
}
