// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteImage, getImageBlob, putImage } from './image-store';
import {
  DesignConflictError,
  createDesign,
  designStorageKey,
  getDesign,
  importLegacyDesigns,
  legacyImportAvailable,
  listDesigns,
  restoreBackup,
  saveDesign,
} from './local-store';

vi.mock('./image-store', () => ({
  blobToDataUrl: vi.fn(async () => 'data:image/png;base64,AA=='),
  dataUrlToBlob: vi.fn(async () => new Blob([new Uint8Array([0])], { type: 'image/png' })),
  deleteImage: vi.fn(async () => {}),
  getImageBlob: vi.fn(async () => null),
  getLegacyImageBlob: vi.fn(async () => null),
  newImageId: vi.fn(() => 'img_' + Math.random().toString(16).slice(2)),
  putImage: vi.fn(async () => {}),
}));

function fileFrom(value: unknown): File {
  const content = JSON.stringify(value);
  return { size: new TextEncoder().encode(content).length, text: async () => content } as File;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  let counter = 0;
  vi.stubGlobal('crypto', { randomUUID: () => String(++counter) });
});

describe('account-scoped browser designs', () => {
  it('keeps two signed-in accounts separate on one browser', () => {
    const alice = createDesign('alice', 'card');
    expect(listDesigns('alice')).toHaveLength(1);
    expect(listDesigns('bob')).toHaveLength(0);
    expect(getDesign('bob', alice.id)).toBeNull();
    expect(designStorageKey('alice')).not.toBe(designStorageKey('bob'));
  });

  it('blocks a stale tab from replacing a newer save', () => {
    const original = createDesign('alice', 'card');
    const saved = saveDesign('alice', { ...original, title: 'First tab' }, original.updatedAt);
    expect(() => saveDesign('alice', { ...original, title: 'Second tab' }, original.updatedAt))
      .toThrow(DesignConflictError);
    expect(getDesign('alice', original.id)?.title).toBe('First tab');
    expect(saved.updatedAt).toBeGreaterThan(original.updatedAt);
  });

  it('deletes a replaced image only after its reference is saved away', async () => {
    const original = createDesign('alice', 'card');
    const withImage = saveDesign('alice', {
      ...original,
      slides: [{ ...original.slides[0], bgImageId: 'img_old' }],
    }, original.updatedAt);
    saveDesign('alice', {
      ...withImage,
      slides: [{ ...withImage.slides[0], bgImageId: null }],
    }, withImage.updatedAt);
    await vi.waitFor(() => expect(deleteImage).toHaveBeenCalledWith('alice', 'img_old'));
  });
});

describe('backup and legacy import', () => {
  it('rejects malformed design rows before writing anything', async () => {
    await expect(restoreBackup('alice', fileFrom({ app: 'contentpro', version: 1, designs: [{}], images: {} })))
      .rejects.toThrow('Saved designs are invalid');
    expect(listDesigns('alice')).toHaveLength(0);
    expect(putImage).not.toHaveBeenCalled();
  });

  it('remaps imported design and image ids instead of overwriting existing ones', async () => {
    const original = createDesign('alice', 'card');
    const imported = { ...original, slides: [{ ...original.slides[0], bgImageId: 'img_source' }] };
    const count = await restoreBackup('alice', fileFrom({
      app: 'contentpro', version: 1, designs: [imported], images: { img_source: 'data:image/png;base64,AA==' },
    }));
    expect(count).toBe(1);
    expect(listDesigns('alice')).toHaveLength(2);
    const copy = listDesigns('alice').find((design) => design.id !== original.id)!;
    expect(copy.slides[0].bgImageId).not.toBe('img_source');
    expect(putImage).toHaveBeenCalledWith('alice', copy.slides[0].bgImageId, expect.any(Blob));
  });

  it('preserves unowned legacy designs until a user explicitly imports them', async () => {
    const old = createDesign('alice', 'card');
    localStorage.setItem('contentpro.designs.v1', JSON.stringify([old]));
    expect(legacyImportAvailable()).toBe(true);
    expect(listDesigns('bob')).toHaveLength(0);
    expect(await importLegacyDesigns('bob')).toBe(1);
    expect(listDesigns('bob')).toHaveLength(1);
    expect(legacyImportAvailable()).toBe(false);
    expect(localStorage.getItem('contentpro.designs.v1')).not.toBeNull();
  });

  it('does not create an incomplete duplicate when an image cannot be read', async () => {
    const original = createDesign('alice', 'card');
    saveDesign('alice', { ...original, slides: [{ ...original.slides[0], bgImageId: 'img_missing' }] }, original.updatedAt);
    vi.mocked(getImageBlob).mockResolvedValueOnce(null);
    const { duplicateDesign } = await import('./local-store');
    await expect(duplicateDesign('alice', original.id)).rejects.toThrow('images is missing');
    expect(listDesigns('alice')).toHaveLength(1);
  });
});
