/**
 * CDN utilities for Weixin media upload/download
 * AES-128-ECB encryption and CDN URL building
 */
import crypto from "node:crypto";

/** CDN base URL */
export const CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";

/** Encrypt buffer with AES-128-ECB (PKCS7 padding is default) */
export function encryptAesEcb(plaintext, key) {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

/** Decrypt buffer with AES-128-ECB (PKCS7 padding) */
export function decryptAesEcb(ciphertext, key) {
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Compute AES-128-ECB ciphertext size (PKCS7 padding to 16-byte boundary) */
export function aesEcbPaddedSize(plaintextSize) {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}

/** Generate random AES-128 key (16 bytes) */
export function generateAesKey() {
  return crypto.randomBytes(16);
}

/** Generate random filekey (32 hex chars = 16 bytes) */
export function generateFilekey() {
  return crypto.randomBytes(16).toString("hex");
}

/** Compute MD5 hash of buffer (hex string) */
export function computeMd5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

/** Build CDN upload URL from upload_param and filekey */
export function buildCdnUploadUrl(uploadParam, filekey) {
  return `${CDN_BASE_URL}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(filekey)}`;
}

/** Build CDN download URL from encrypt_query_param */
export function buildCdnDownloadUrl(encryptedQueryParam) {
  return `${CDN_BASE_URL}/download?encrypted_query_param=${encodeURIComponent(encryptedQueryParam)}`;
}

/**
 * Download and decrypt buffer from CDN
 * @param {object} params
 * @param {string} params.encryptedQueryParam - The encrypt_query_param from message
 * @param {string} params.aesKey - AES key (hex string or buffer)
 * @returns {Promise<Buffer>} - Decrypted plaintext buffer
 */
export async function downloadFromCdn(params) {
  const { encryptedQueryParam, aesKey } = params;

  const cdnUrl = buildCdnDownloadUrl(encryptedQueryParam);

  const res = await fetch(cdnUrl, {
    method: "GET",
  });

  if (res.status !== 200) {
    throw new Error(`CDN download failed: status ${res.status}`);
  }

  const ciphertext = Buffer.from(await res.arrayBuffer());

  // Convert hex string to buffer if needed
  const keyBuffer = Buffer.isBuffer(aesKey) ? aesKey : Buffer.from(aesKey, "hex");

  return decryptAesEcb(ciphertext, keyBuffer);
}

/**
 * Upload encrypted buffer to CDN
 * @returns {Promise<{downloadParam: string}>} - The x-encrypted-param header for downloading
 */
export async function uploadToCdn(params) {
  const { buf, uploadParam, filekey, aeskey, maxRetries = 3 } = params;

  const ciphertext = encryptAesEcb(buf, aeskey);
  const cdnUrl = buildCdnUploadUrl(uploadParam, filekey);

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(cdnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(ciphertext),
      });

      // Client errors (4xx) should not retry
      if (res.status >= 400 && res.status < 500) {
        const errMsg = res.headers.get("x-error-message") ?? (await res.text());
        throw new Error(`CDN client error ${res.status}: ${errMsg}`);
      }

      // Server errors (5xx) can retry
      if (res.status !== 200) {
        const errMsg = res.headers.get("x-error-message") ?? `status ${res.status}`;
        throw new Error(`CDN server error: ${errMsg}`);
      }

      const downloadParam = res.headers.get("x-encrypted-param");
      if (!downloadParam) {
        throw new Error("CDN response missing x-encrypted-param header");
      }

      return { downloadParam };
    } catch (err) {
      lastError = err;
      if (err.message?.includes("client error")) {
        throw err;
      }
      if (attempt < maxRetries) {
        console.error(`[cdn] upload attempt ${attempt} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("CDN upload failed");
}
