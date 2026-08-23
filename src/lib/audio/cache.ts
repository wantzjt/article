import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AudioBytes = {
  bytes: Buffer;
  contentType: string;
};

export type AudioCache = {
  get: (key: string) => Promise<AudioBytes | null>;
  put: (key: string, value: AudioBytes) => Promise<void>;
};

export function cacheKey(topicId: string, materialHash: string): string {
  return `audio/${topicId}/${materialHash}.mp3`;
}

export function createMemoryCache(): AudioCache {
  const store = new Map<string, AudioBytes>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

export function createFileCache(root = path.join(process.cwd(), "data", "audio")): AudioCache {
  return {
    async get(key) {
      try {
        const bytes = await readFile(path.join(root, key));
        return { bytes, contentType: "audio/mpeg" };
      } catch {
        return null;
      }
    },
    async put(key, value) {
      const file = path.join(root, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, value.bytes);
    },
  };
}

function blobToken(): string | undefined {
  const raw = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!raw) return undefined;
  return raw.replace(/^["']|["']$/g, "");
}

export function createBlobCache(): AudioCache {
  return {
    async get(key) {
      try {
        const { get } = await import("@vercel/blob");
        const result = await get(key, {
          access: "private",
          token: blobToken(),
        });
        if (!result || result.statusCode !== 200 || !result.stream) return null;
        const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
        return {
          bytes,
          contentType: result.blob.contentType || "audio/mpeg",
        };
      } catch {
        return null;
      }
    },
    async put(key, value) {
      const { put } = await import("@vercel/blob");
      await put(key, value.bytes, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: value.contentType,
        token: blobToken(),
      });
    },
  };
}

export function defaultAudioCache(): AudioCache {
  const file = createFileCache();
  if (!blobToken()) return file;
  const blob = createBlobCache();
  return {
    async get(key) {
      const fromBlob = await blob.get(key);
      if (fromBlob) return fromBlob;
      return file.get(key);
    },
    async put(key, value) {
      await file.put(key, value);
      try {
        await blob.put(key, value);
      } catch {
        // Local file cache still holds the brief.
      }
    },
  };
}
