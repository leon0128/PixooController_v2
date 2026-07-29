'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Monitor, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FrameThumbnail } from '@/components/frame-thumbnail';
import { ApiError, api } from '@/lib/api';
import { SCENE_ELEMENT_LABELS, type Scene } from '@/lib/api-types';

export function SceneList({ scenes }: { scenes: Scene[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Scene | null>(null);

  async function push(scene: Scene) {
    setBusyId(scene.id);
    try {
      await api.pushScene(scene.id);
      toast.success(`Showing "${scene.name}" on the device`);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(scene: Scene) {
    setPendingDelete(null);
    setBusyId(scene.id);
    try {
      await api.deleteScene(scene.id);
      toast.success(`Deleted "${scene.name}"`);
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scenes</h1>
          <p className="text-muted-foreground text-sm">
            A background image plus the date, weekday, temperature and time to show.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/scenes/new" />}>
          <Plus className="size-4" />
          New scene
        </Button>
      </div>

      {scenes.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No scenes yet. Use “New scene” to add one.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {scenes.map((scene) => (
          <Card key={scene.id}>
            <CardContent className="flex items-center gap-4 py-4">
              {scene.image?.details[0] ? (
                <FrameThumbnail
                  picData={scene.image.details[0].imageData}
                  className="size-16 shrink-0"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-sm border text-[10px]">
                  No image
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{scene.name}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {scene.image && (
                    <Badge variant="secondary">
                      {scene.image.details.length} frames / {scene.image.picSpeed}ms
                    </Badge>
                  )}
                  {scene.elements.map((element) => (
                    <Badge key={element.id} variant="outline">
                      {SCENE_ELEMENT_LABELS[element.type] ?? element.type}
                    </Badge>
                  ))}
                  {scene.elements.length === 0 && !scene.image && (
                    <span className="text-muted-foreground text-xs">Empty scene</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === scene.id}
                  onClick={() => void push(scene)}
                >
                  {busyId === scene.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Monitor className="size-4" />
                  )}
                  Show on device
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit"
                  nativeButton={false}
                  render={<Link href={`/scenes/${scene.id}`} />}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete"
                  onClick={() => setPendingDelete(scene)}
                >
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this scene?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.name}” will be removed along with its background image,
              display elements and schedule entries. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && void remove(pendingDelete)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
