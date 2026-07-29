import { NotFoundException } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import type { PixooService } from '../pixoo/pixoo.service';
import type { SchedulesService } from '../schedules/schedules.service';
import type { ScenesService } from '../scenes/scenes.service';
import type { Scene } from '../scenes/entities/scene.entity';
import type { Schedule } from '../schedules/entities/schedule.entity';

const NOW = new Date(2026, 6, 27, 9, 0);

describe('SchedulerService', () => {
  let active: { sceneId: number } | null;
  let findActive: jest.Mock;
  let findOne: jest.Mock;
  let push: jest.Mock;
  let service: SchedulerService;

  const scene = (id: number) => ({ id, name: `scene ${id}`, image: null, elements: [] }) as unknown as Scene;

  beforeEach(() => {
    active = { sceneId: 1 };
    findActive = jest.fn(async () => active as Schedule | null);
    findOne = jest.fn(async (id: number) => scene(id));
    push = jest.fn(async () => undefined);

    service = new SchedulerService(
      { findActive } as unknown as SchedulesService,
      { findOne } as unknown as ScenesService,
      { push } as unknown as PixooService,
    );
  });

  it('pushes the active scene on the first tick', async () => {
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith(1);
  });

  it('does not push again while the same scene stays active', async () => {
    await service.applySchedule(NOW);
    await service.applySchedule(NOW);
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('pushes again once the schedule moves to a different scene', async () => {
    await service.applySchedule(NOW);
    active = { sceneId: 2 };
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(2);
    expect(findOne).toHaveBeenLastCalledWith(2);
  });

  it('pushes a scene again if it becomes active a second time', async () => {
    await service.applySchedule(NOW);
    active = { sceneId: 2 };
    await service.applySchedule(NOW);
    active = { sceneId: 1 };
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(3);
  });

  it('leaves the device alone when nothing is scheduled', async () => {
    active = null;
    await service.applySchedule(NOW);
    expect(push).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('retries on the next tick when the push fails', async () => {
    push.mockRejectedValueOnce(new Error('device offline'));

    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(1);

    // Same scene, but the previous attempt never landed, so it must try again.
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('stops retrying once a push finally succeeds', async () => {
    push.mockRejectedValueOnce(new Error('device offline'));
    await service.applySchedule(NOW);
    await service.applySchedule(NOW);
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('survives the active scene having been deleted', async () => {
    findOne.mockRejectedValueOnce(new NotFoundException('gone'));
    await expect(service.applySchedule(NOW)).resolves.toBeUndefined();
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes once the schedule goes from empty to populated', async () => {
    active = null;
    await service.applySchedule(NOW);
    active = { sceneId: 5 };
    await service.applySchedule(NOW);
    expect(push).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith(5);
  });
});
