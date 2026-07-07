// Small helper for multipart/form-data uploads. The installed
// @cloudflare/workers-types version types FormData#get/getAll as returning
// only `string | null`, even though the Workers runtime genuinely returns
// File instances for file fields -- so `instanceof File` on that return
// value is a TS2358 compile error (LHS statically typed as `string | null`).
// This duck-types instead of relying on those (incomplete) ambient types.
export function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer: unknown }).arrayBuffer === "function" &&
    "size" in value &&
    "type" in value
  );
}
