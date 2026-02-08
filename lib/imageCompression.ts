import imageCompression from 'browser-image-compression';

type CompressionOptions = {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  initialQuality?: number;
};

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxSizeMB: 0.7,
  maxWidthOrHeight: 1600,
  initialQuality: 0.8,
};

export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;

  try {
    const compressed = await imageCompression(file, {
      ...DEFAULT_OPTIONS,
      ...options,
      useWebWorker: true,
    });

    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
};
