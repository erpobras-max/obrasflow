import { env } from "cloudflare:workers";

type R2ObjectBodyLike = {
  body: ReadableStream;
  size: number;
  httpEtag?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  writeHttpMetadata?(headers: Headers): void;
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
  };
};

type R2UploadedPartLike = { partNumber: number; etag: string };
type R2MultipartUploadLike = {
  uploadId: string;
  uploadPart(partNumber: number, value: Uint8Array): Promise<R2UploadedPartLike>;
  complete(parts: R2UploadedPartLike[]): Promise<unknown>;
  abort(): Promise<void>;
};

type R2BucketLike = {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  get(
    key: string,
    options: { range: { offset: number; length: number } },
  ): Promise<R2ObjectBodyLike | null>;
  head(key: string): Promise<R2ObjectBodyLike | null>;
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
  createMultipartUpload(
    key: string,
    options?: { httpMetadata?: { contentType?: string; contentDisposition?: string } },
  ): Promise<R2MultipartUploadLike>;
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUploadLike;
};

function getBucket(): R2BucketLike {
  const bucket = (env as unknown as { R2_BUCKET?: R2BucketLike }).R2_BUCKET;

  if (!bucket || typeof bucket.put !== "function" || typeof bucket.delete !== "function") {
    throw new Error("Armazenamento de arquivos indisponível.");
  }

  return bucket;
}

async function mediaSignature(key: string, expires: number) {
  const secret = (env as unknown as { MY_SUPABASE_SERVICE_ROLE_KEY?: string })
    .MY_SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Assinatura de mídia indisponível.");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${key}\n${expires}`)),
  );
  return btoa(String.fromCharCode(...signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createSignedDiarioMediaUrl(key: string) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;
  const signature = await mediaSignature(key, expires);
  const query = new URLSearchParams({ key, expires: String(expires), signature });
  return `/api/diario-media?${query}`;
}

export async function verifySignedDiarioMediaUrl(key: string, expires: number, signature: string) {
  if (!key.startsWith("diario/fotos/") || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = await mediaSignature(key, expires);
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
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

export async function startMultipartUploadServer(
  key: string,
  contentType: string,
  fileName: string,
) {
  const upload = await getBucket().createMultipartUpload(key, {
    httpMetadata: {
      contentType,
      contentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    },
  });
  return upload.uploadId;
}

export async function uploadMultipartPartServer(
  key: string,
  uploadId: string,
  partNumber: number,
  bytes: Uint8Array,
) {
  return getBucket().resumeMultipartUpload(key, uploadId).uploadPart(partNumber, bytes);
}

export async function completeMultipartUploadServer(
  key: string,
  uploadId: string,
  parts: R2UploadedPartLike[],
) {
  await getBucket().resumeMultipartUpload(key, uploadId).complete(parts);
}

export async function abortMultipartUploadServer(key: string, uploadId: string) {
  await getBucket().resumeMultipartUpload(key, uploadId).abort();
}

export async function streamFromR2Server(key: string, request: Request): Promise<Response> {
  const bucket = getBucket();
  const head = await bucket.head(key);
  if (!head) return new Response("Arquivo não encontrado.", { status: 404 });

  const headers = new Headers({ "Accept-Ranges": "bytes" });
  head.writeHttpMetadata?.(headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", head.httpMetadata?.contentType || "application/octet-stream");
  }
  if (head.httpEtag) headers.set("ETag", head.httpEtag);

  const range = request.headers.get("range")?.match(/^bytes=(\d+)-(\d*)$/);
  if (!range) {
    const object = await bucket.get(key);
    if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
    headers.set("Content-Length", String(head.size));
    return new Response(object.body, { headers });
  }

  const start = Number(range[1]);
  const requestedEnd = range[2] ? Number(range[2]) : head.size - 1;
  const end = Math.min(requestedEnd, head.size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
    headers.set("Content-Range", `bytes */${head.size}`);
    return new Response(null, { status: 416, headers });
  }

  const object = await bucket.get(key, { range: { offset: start, length: end - start + 1 } });
  if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${head.size}`);
  return new Response(object.body, { status: 206, headers });
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
