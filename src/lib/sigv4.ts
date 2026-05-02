/**
 * Minimal AWS SigV4 implementation for S3 / R2 / MinIO uploads
 * without taking a hard dep on @aws-sdk. Pure node:crypto.
 *
 * Used by src/lib/storage.ts S3Storage class. Tested in
 * tests/sigv4.test.ts against AWS-documented derivation steps.
 *
 * Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
 */

import crypto from "node:crypto";

/**
 * Build the AWS4-HMAC-SHA256 Authorization header + companion request
 * headers for an S3-compatible request.
 *
 * Returns:
 *   {
 *     "x-amz-date": "20250101T120000Z",
 *     "x-amz-content-sha256": "<sha256 of body>",
 *     "Authorization": "AWS4-HMAC-SHA256 Credential=...",
 *     ["content-type": "..."]?
 *   }
 */
export async function sigV4(
  method: string,
  host: string,
  pathname: string,
  search: string,
  body: Buffer,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  contentType?: string,
  now: Date = new Date(),
): Promise<Record<string, string>> {
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    pathname,
    search.startsWith("?") ? search.slice(1) : search,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest)),
  ].join("\n");

  const signingKey = deriveSigningKey(secretKey, dateStamp, region, service);
  const signature = hmacHex(signingKey, stringToSign);

  const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: Record<string, string> = {
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Authorization: auth,
  };
  if (contentType) headers["content-type"] = contentType;
  return headers;
}

/**
 * Build a presigned GET URL with the SigV4 signature in query
 * params. TTL in seconds determines how long the URL is valid.
 */
export async function sigV4PresignGet(
  endpoint: string,
  key: string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<string> {
  const url = new URL(`${endpoint}/${encodeURIComponent(key)}`);
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${accessKey}/${credentialScope}`);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
  url.searchParams.set("X-Amz-SignedHeaders", "host");

  const canonicalRequest = [
    "GET",
    url.pathname,
    url.searchParams.toString(),
    `host:${url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest)),
  ].join("\n");

  const signingKey = deriveSigningKey(secretKey, dateStamp, region, service);
  url.searchParams.set("X-Amz-Signature", hmacHex(signingKey, stringToSign));
  return url.toString();
}

/**
 * Derive the SigV4 signing key from the secret access key + date +
 * region + service. Exposed for direct testing against AWS-documented
 * test vectors.
 */
export function deriveSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = crypto.createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
  return crypto.createHmac("sha256", kService).update("aws4_request").digest();
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function hmacHex(key: Buffer, data: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

function formatAmzDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ (ISO without separators)
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
