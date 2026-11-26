// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataUrlToBlob, deleteImage, getImageBlob, getImageUrl, putImage, releaseImageUrls } from './image-store';

afterEach(() => vi.unstubAllGlobals());

describe('account-scoped IndexedDB images', () => {
  it('keeps equal image ids isolated across accounts and deletes only the owner copy', async () => {
    // fake-indexeddb cannot structured-clone jsdom's Blob implementation, so
    // plain cloneable fixtures exercise the store's key isolation directly.
    const aliceImage = { marker: 'alice' } as unknown as Blob;
    const bobImage = { marker: 'bob' } as unknown as Blob;

    await putImage('alice', 'img_shared', aliceImage);
    expect(await getImageBlob('alice', 'img_shared')).toMatchObject({ marker: 'alice' });
    expect(await getImageBlob('bob', 'img_shared')).toBeNull();

    await putImage('bob', 'img_shared', bobImage);
    expect(await getImageBlob('bob', 'img_shared')).toMatchObject({ marker: 'bob' });
    await deleteImage('bob', 'img_shared');

    expect(await getImageBlob('bob', 'img_shared')).toBeNull();
    expect(await getImageBlob('alice', 'img_shared')).toMatchObject({ marker: 'alice' });
  });

  it('keeps more than 60 gallery URLs valid until the gallery releases them', async () => {
    let sequence = 0;
    const createObjectURL = vi.fn(() => 'blob:gallery-' + ++sequence);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const fixture = { marker: 'gallery' } as unknown as Blob;
    const urls: string[] = [];

    for (let index = 0; index < 65; index++) {
      const id = 'img_' + index;
      await putImage('gallery', id, fixture);
      urls.push((await getImageUrl('gallery', id))!);
    }
    await putImage('other', 'img_0', fixture);
    const otherUrl = await getImageUrl('other', 'img_0');

    expect(await getImageUrl('gallery', 'img_0')).toBe(urls[0]);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    releaseImageUrls('gallery');
    expect(revokeObjectURL).toHaveBeenCalledTimes(65);
    expect(await getImageUrl('other', 'img_0')).toBe(otherUrl);
    releaseImageUrls('other');
    expect(revokeObjectURL).toHaveBeenCalledTimes(66);
  });
});

describe('dataUrlToBlob (backup restore)', () => {
  it('decodes a base64 image without fetch, which the production CSP blocks for data: URLs', async () => {
    const fetchSpy = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    vi.stubGlobal('fetch', fetchSpy);
    // 1x1 transparent PNG
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const blob = await dataUrlToBlob('data:image/png;base64,' + png);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(blob.type).toBe('image/png');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.length).toBe(atob(png).length);
  });

  it('rejects a value that is not a data URL', async () => {
    await expect(dataUrlToBlob('https://example.test/a.png')).rejects.toThrow();
  });
});
