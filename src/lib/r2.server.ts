import { env } from "cloudflare:workers";

type R2ObjectBodyLike = {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
  };
};

type R2BucketLike = {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: Uint8Array,
    options?: {
      httpMetadata?: {
        contentType?: string;
        contentDisposition?: string;
      };
    },
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
};

function getBucket(): R2BucketLike {
  const bucket = (env as unknown as { R2_BUCKET?: R2BucketLike }).R2_BUCKET;

  if (!bucket || typeof bucket.put !== "function" || typeof bucket.delete !== "function") {
    throw new Error("Armazenamento de arquivos indisponível.");
  }

  return bucket;
}

export async function uploadToR2Server(
  key: string,
  body: Uint8Array,
  contentType: string,
  fileName: string,
): Promise<string> {
  await getBucket().put(key, body, {
    httpMetadata: {
      contentType,
      contentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });

  return key;
}

export async function deleteFromR2Server(key: string): Promise<void> {
  await getBucket().delete(key);
}

export async function deleteManyFromR2Server(keys: string[]): Promise<void> {
  await getBucket().delete(keys);
}

export async function readFromR2Server(key: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  const object = await getBucket().get(key);
  if (!object) throw new Error("Arquivo não encontrado no armazenamento.");

  return {
    bytes: new Uint8Array(await object.arrayBuffer()),
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
  };
}
