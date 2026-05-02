/**
 * Minimal magic-number MIME sniffing — no deps. Replaces blind trust
 * in the client-supplied `File.type` for security-sensitive uploads.
 *
 * Photo upload, document upload, drawing upload all go through this.
 * If the actual bytes don't match the claimed type, we either reject
 * the upload or reclassify it.
 *
 * Returns the detected MIME or null if unrecognized. Caller decides
 * whether to allow octet-stream (no magic) or hard-reject.
 */

type Sniffer = { mime: string; magic: number[] | string };

const SIGNATURES: Sniffer[] = [
  { mime: "image/jpeg",       magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png",        magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif",        magic: "GIF87a" },
  { mime: "image/gif",        magic: "GIF89a" },
  { mime: "image/webp",       magic: "RIFF" },   // verify "WEBP" at offset 8 below
  { mime: "image/heic",       magic: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63] },
  { mime: "image/bmp",        magic: [0x42, 0x4d] },
  { mime: "image/tiff",       magic: [0x49, 0x49, 0x2a, 0x00] },
  { mime: "image/tiff",       magic: [0x4d, 0x4d, 0x00, 0x2a] },
  { mime: "application/pdf",  magic: "%PDF-" },
  { mime: "application/zip",  magic: [0x50, 0x4b, 0x03, 0x04] }, // also docx/xlsx/pptx (zip-wrapped)
  { mime: "application/msword", magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];

/**
 * Inspect the leading bytes of a buffer and return the most-likely
 * MIME type, or null if no signature matches.
 */
export function sniffMime(buf: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const bytes = typeof sig.magic === "string"
      ? Array.from(Buffer.from(sig.magic))
      : sig.magic;
    let match = true;
    for (let i = 0; i < bytes.length; i++) {
      if (buf[i] !== bytes[i]) { match = false; break; }
    }
    if (!match) continue;
    if (sig.mime === "image/webp") {
      // RIFF header is shared with WAV/AVI; WEBP marker is at offset 8.
      const marker = buf.subarray(8, 12).toString("ascii");
      if (marker !== "WEBP") continue;
    }
    return sig.mime;
  }
  return null;
}

/** Convenience — return true if the buffer's magic bytes match an
 *  image type, false otherwise. */
export function isImage(buf: Buffer): boolean {
  const m = sniffMime(buf);
  return !!m && m.startsWith("image/");
}
