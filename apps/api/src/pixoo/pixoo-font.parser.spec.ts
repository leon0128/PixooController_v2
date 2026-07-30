import { parseFontEntry } from './pixoo-device.client';

describe('parseFontEntry', () => {
  it('reads id, type, width, height and charset', () => {
    expect(
      parseFontEntry('18,1,5,5,group1/M00/C9/09/L1ghbmCDwVqE7433850,0123456789km'),
    ).toEqual({ id: 18, type: 1, width: 5, height: 5, charset: '0123456789km' });
  });

  it('handles the image fonts, which carry no charset', () => {
    expect(
      parseFontEntry('2,0,16,16,group1/M00/D6/80/eEwpPWC4tX6E8710.bin,'),
    ).toEqual({ id: 2, type: 0, width: 16, height: 16, charset: '' });
  });

  it('keeps a charset that itself contains commas', () => {
    // A handful of real entries split into seven fields for this reason.
    expect(parseFontEntry('99,1,6,8,group1/M00/AA/BB/asset,0123,;')).toEqual({
      id: 99,
      type: 1,
      width: 6,
      height: 8,
      charset: '0123,;',
    });
  });

  it('reads the clock font the device was verified with', () => {
    const font = parseFontEntry(
      '232,1,11,20,group1/M00/14/65/eEwpPWMtHhCE7719579,0123456789:',
    );
    // Textheight 20 is what the verified SendHttpItemList request used.
    expect(font).toMatchObject({ id: 232, width: 11, height: 20, charset: '0123456789:' });
  });

  it('rejects entries that are too short or not numeric', () => {
    expect(parseFontEntry('')).toBeNull();
    expect(parseFontEntry('18,1,5')).toBeNull();
    expect(parseFontEntry('18,1,5,5')).toBeNull();
    expect(parseFontEntry('abc,1,5,5,path,0123')).toBeNull();
    expect(parseFontEntry('18,1,x,5,path,0123')).toBeNull();
  });
});
