// R2 access helpers for the private FILES bucket (spec section 5.6).
//
// Chosen access pattern: stream every private object through an authenticated,
// ownership-checked Worker route (see routes/profile.ts, routes/designs.ts)
// rather than generating presigned URLs. R2 presigned URLs require the
// S3-compatible API signed with a separate R2 Access Key ID/Secret (AWS
// SigV4) provisioned outside the R2Bucket binding used everywhere else in
// this Worker -- extra infra this v1 build doesn't need when the binding can
// already stream bytes directly and cheaply. If a redirect-based,
// CDN-cacheable delivery path is ever wanted instead, swap
// `objectToResponse`'s call sites for a SigV4 presigned-URL generator without
// changing any route's ownership-check contract.

export async function putObject(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | Uint8Array | ReadableStream,
  contentType: string,
): Promise<void> {
  await bucket.put(key, data, { httpMetadata: { contentType } });
}

export async function getObject(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function deleteObject(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export function objectToResponse(
  obj: R2ObjectBody,
  opts: { download?: boolean; filename?: string } = {},
): Response {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  if (opts.download) {
    headers.set("Content-Disposition", `attachment; filename="${opts.filename ?? "download"}"`);
  }
  return new Response(obj.body, { headers });
}
