import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PixooDeviceClient } from './pixoo-device.client';

const DEVICE = {
  DeviceName: 'Pixoo64',
  DeviceId: 1,
  DevicePrivateIP: '192.168.0.203',
  DeviceMac: 'aa',
};

const answer = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe('PixooDeviceClient.discover', () => {
  let client: PixooDeviceClient;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    client = new PixooDeviceClient({ get: () => undefined } as unknown as ConfigService);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchMock.mockRestore());

  it('returns the device Divoom reports', async () => {
    fetchMock.mockReturnValue(answer({ ReturnCode: 0, DeviceList: [DEVICE] }));
    await expect(client.discover()).resolves.toEqual(DEVICE);
  });

  it('fails when there is no device and nothing to fall back on', async () => {
    fetchMock.mockReturnValue(answer({ ReturnCode: 0, DeviceList: [] }));
    await expect(client.discover()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('falls back to the last known device when the list comes back empty', async () => {
    // Divoom has been seen returning an empty list while the device was healthy.
    fetchMock.mockReturnValueOnce(answer({ ReturnCode: 0, DeviceList: [DEVICE] }));
    await client.discover();

    fetchMock.mockReturnValue(answer({ ReturnCode: 0, DeviceList: [] }));
    await expect(client.discover()).resolves.toEqual(DEVICE);
  });

  it('falls back when the lookup itself fails', async () => {
    fetchMock.mockReturnValueOnce(answer({ ReturnCode: 0, DeviceList: [DEVICE] }));
    await client.discover();

    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(client.discover()).resolves.toEqual(DEVICE);
  });

  it('falls back on a non-zero ReturnCode', async () => {
    fetchMock.mockReturnValueOnce(answer({ ReturnCode: 0, DeviceList: [DEVICE] }));
    await client.discover();

    fetchMock.mockReturnValue(answer({ ReturnCode: 10, ReturnMessage: 'nope' }));
    await expect(client.discover()).resolves.toEqual(DEVICE);
  });

  it('prefers a freshly reported device over the cached one', async () => {
    fetchMock.mockReturnValueOnce(answer({ ReturnCode: 0, DeviceList: [DEVICE] }));
    await client.discover();

    const moved = { ...DEVICE, DevicePrivateIP: '192.168.0.77' };
    fetchMock.mockReturnValue(answer({ ReturnCode: 0, DeviceList: [moved] }));
    await expect(client.discover()).resolves.toEqual(moved);

    // And the newer address becomes what a later failure falls back to.
    fetchMock.mockReturnValue(answer({ ReturnCode: 0, DeviceList: [] }));
    await expect(client.discover()).resolves.toEqual(moved);
  });
});
