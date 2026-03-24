/**
 * Media upload and send module for Weixin
 * Handles images, videos, and file attachments
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { apiPost } from "./api.mjs";
import {
  generateAesKey,
  generateFilekey,
  computeMd5,
  aesEcbPaddedSize,
  uploadToCdn,
} from "./cdn.mjs";

/** Media types for upload */
export const MediaType = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
  VOICE: 4,
};

/** Message item types */
export const MessageItemType = {
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
};

/**
 * Get MIME type from file extension
 */
export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    // Videos
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Determine media type from MIME type
 */
export function getMediaTypeFromMime(mimeType) {
  if (mimeType.startsWith("image/")) return MediaType.IMAGE;
  if (mimeType.startsWith("video/")) return MediaType.VIDEO;
  return MediaType.FILE;
}

/**
 * Uploaded file info returned after CDN upload
 */
/**
 * Upload a file to Weixin CDN
 * @param {object} params
 * @param {string} params.filePath - Local file path
 * @param {string} params.toUserId - Target user ID
 * @param {string} params.baseUrl - API base URL
 * @param {string} params.token - Auth token
 * @returns {Promise<UploadedFileInfo>}
 */
export async function uploadFile(params) {
  const { filePath, toUserId, baseUrl, token } = params;

  const plaintext = await fs.readFile(filePath);
  const rawsize = plaintext.length;
  const rawfilemd5 = computeMd5(plaintext);
  const filesize = aesEcbPaddedSize(rawsize);
  const filekey = generateFilekey();
  const aeskey = generateAesKey();

  const mimeType = getMimeType(filePath);
  const mediaType = getMediaTypeFromMime(mimeType);

  // Get upload URL from API
  const uploadResp = await apiPost(baseUrl, "ilink/bot/getuploadurl", {
    filekey,
    media_type: mediaType,
    to_user_id: toUserId,
    rawsize,
    rawfilemd5,
    filesize,
    no_need_thumb: true,
    aeskey: aeskey.toString("hex"),
  }, token);

  const uploadParam = uploadResp.upload_param;
  if (!uploadParam) {
    throw new Error("getUploadUrl returned no upload_param");
  }

  // Upload to CDN
  const { downloadParam } = await uploadToCdn({
    buf: plaintext,
    uploadParam,
    filekey,
    aeskey,
  });

  return {
    filekey,
    downloadEncryptedQueryParam: downloadParam,
    aeskey: aeskey.toString("hex"),
    fileSize: rawsize,
    fileSizeCiphertext: filesize,
    mediaType,
    mimeType,
  };
}

/**
 * Send an image message
 */
export async function sendImageMessage(params) {
  const { baseUrl, token, toUserId, uploaded, contextToken, caption } = params;

  const clientId = `wcb-${crypto.randomUUID()}`;

  // Send caption first if provided
  if (caption) {
    await apiPost(baseUrl, "ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: toUserId,
        client_id: `${clientId}-text`,
        message_type: 2,
        message_state: 2,
        context_token: contextToken,
        item_list: [{ type: 1, text_item: { text: caption } }],
      },
    }, token);
  }

  // Send image
  // Note: aeskey is stored as hex string, and we send it as utf8->base64 (not hex->base64)
  // This matches the official @tencent-weixin/openclaw-weixin implementation
  const aesKeyBase64 = Buffer.from(uploaded.aeskey).toString("base64");
  await apiPost(baseUrl, "ilink/bot/sendmessage", {
    msg: {
      from_user_id: "",
      to_user_id: toUserId,
      client_id: clientId,
      message_type: 2,
      message_state: 2,
      context_token: contextToken,
      item_list: [{
        type: MessageItemType.IMAGE,
        image_item: {
          media: {
            encrypt_query_param: uploaded.downloadEncryptedQueryParam,
            aes_key: aesKeyBase64,
            encrypt_type: 1,
          },
          mid_size: uploaded.fileSizeCiphertext,
        },
      }],
    },
  }, token);

  return clientId;
}

/**
 * Send a video message
 */
export async function sendVideoMessage(params) {
  const { baseUrl, token, toUserId, uploaded, contextToken, caption } = params;

  const clientId = `wcb-${crypto.randomUUID()}`;

  // Send caption first if provided
  if (caption) {
    await apiPost(baseUrl, "ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: toUserId,
        client_id: `${clientId}-text`,
        message_type: 2,
        message_state: 2,
        context_token: contextToken,
        item_list: [{ type: 1, text_item: { text: caption } }],
      },
    }, token);
  }

  // Send video (aeskey as utf8->base64, matching official implementation)
  const aesKeyBase64 = Buffer.from(uploaded.aeskey).toString("base64");
  await apiPost(baseUrl, "ilink/bot/sendmessage", {
    msg: {
      from_user_id: "",
      to_user_id: toUserId,
      client_id: clientId,
      message_type: 2,
      message_state: 2,
      context_token: contextToken,
      item_list: [{
        type: MessageItemType.VIDEO,
        video_item: {
          media: {
            encrypt_query_param: uploaded.downloadEncryptedQueryParam,
            aes_key: aesKeyBase64,
            encrypt_type: 1,
          },
          video_size: uploaded.fileSizeCiphertext,
        },
      }],
    },
  }, token);

  return clientId;
}

/**
 * Send a file attachment
 */
export async function sendFileMessage(params) {
  const { baseUrl, token, toUserId, uploaded, contextToken, caption, fileName } = params;

  const clientId = `wcb-${crypto.randomUUID()}`;

  // Send caption first if provided
  if (caption) {
    await apiPost(baseUrl, "ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: toUserId,
        client_id: `${clientId}-text`,
        message_type: 2,
        message_state: 2,
        context_token: contextToken,
        item_list: [{ type: 1, text_item: { text: caption } }],
      },
    }, token);
  }

  // Send file
  const aesKeyBase64 = Buffer.from(uploaded.aeskey).toString("base64");
  await apiPost(baseUrl, "ilink/bot/sendmessage", {
    msg: {
      from_user_id: "",
      to_user_id: toUserId,
      client_id: clientId,
      message_type: 2,
      message_state: 2,
      context_token: contextToken,
      item_list: [{
        type: MessageItemType.FILE,
        file_item: {
          media: {
            encrypt_query_param: uploaded.downloadEncryptedQueryParam,
            aes_key: aesKeyBase64,
            encrypt_type: 1,
          },
          file_name: fileName,
          len: String(uploaded.fileSize),
        },
      }],
    },
  }, token);

  return clientId;
}

/**
 * Download and decrypt a media file from a received message
 * @param {object} params
 * @param {object} params.item - Message item containing media (file_item, image_item, voice_item, or video_item)
 * @param {string} [params.outputDir] - Directory to save downloaded files (default: ./downloads)
 * @returns {Promise<{filePath: string, fileName: string, mediaType: string} | null>}
 */
export async function downloadMediaFile(params) {
  const { item, outputDir = "./downloads" } = params;

  let mediaItem, fileName, mediaType;

  // Determine media type and get media info
  if (item.type === MessageItemType.FILE && item.file_item?.media) {
    mediaItem = item.file_item;
    fileName = item.file_item.file_name ?? `file_${Date.now()}`;
    mediaType = "file";
  } else if (item.type === MessageItemType.IMAGE && item.image_item?.media) {
    mediaItem = item.image_item;
    fileName = `image_${Date.now()}.jpg`;
    mediaType = "image";
  } else if (item.type === MessageItemType.VOICE && item.voice_item?.media) {
    mediaItem = item.voice_item;
    const ext = mediaItem.encode_type === 6 ? "silk" : "mp3";
    fileName = `voice_${Date.now()}.${ext}`;
    mediaType = "voice";
  } else if (item.type === MessageItemType.VIDEO && item.video_item?.media) {
    mediaItem = item.video_item;
    fileName = `video_${Date.now()}.mp4`;
    mediaType = "video";
  } else {
    return null;
  }

  const { encrypt_query_param, aes_key } = mediaItem.media;
  if (!encrypt_query_param || !aes_key) {
    return null;
  }

  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });

    // Parse AES key - supports two formats:
    // - Images: base64(raw 16 bytes)
    // - Files/Voice/Video: base64(hex string of 16 bytes)
    const keyDecoded = Buffer.from(aes_key, "base64");
    let aesKeyBuffer;
    if (keyDecoded.length === 16) {
      aesKeyBuffer = keyDecoded;
    } else if (keyDecoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(keyDecoded.toString("ascii"))) {
      aesKeyBuffer = Buffer.from(keyDecoded.toString("ascii"), "hex");
    } else {
      throw new Error(`Invalid AES key length: ${keyDecoded.length} bytes`);
    }

    // Download and decrypt
    const { downloadFromCdn } = await import("./cdn.mjs");
    const plaintext = await downloadFromCdn({
      encryptedQueryParam: encrypt_query_param,
      aesKey: aesKeyBuffer,
    });

    // Save to file
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, plaintext);

    return { filePath, fileName, mediaType };
  } catch (err) {
    console.error(`Failed to download media: ${err.message}`);
    return null;
  }
}

/**
 * Upload and send a media file (auto-detect type)
 * @param {object} params
 * @param {string} params.filePath - Local file path
 * @param {string} params.toUserId - Target user ID
 * @param {string} params.baseUrl - API base URL
 * @param {string} params.token - Auth token
 * @param {string} params.contextToken - Context token from received message
 * @param {string} [params.caption] - Optional text caption
 * @returns {Promise<{messageId: string, mediaType: string}>}
 */
export async function sendMediaFile(params) {
  const { filePath, toUserId, baseUrl, token, contextToken, caption } = params;

  if (!contextToken) {
    throw new Error("contextToken is required for sending media");
  }

  const fileName = path.basename(filePath);
  const uploaded = await uploadFile({ filePath, toUserId, baseUrl, token });

  let messageId;

  if (uploaded.mediaType === MediaType.IMAGE) {
    messageId = await sendImageMessage({
      baseUrl, token, toUserId, uploaded, contextToken, caption,
    });
    return { messageId, mediaType: "image" };
  }

  if (uploaded.mediaType === MediaType.VIDEO) {
    messageId = await sendVideoMessage({
      baseUrl, token, toUserId, uploaded, contextToken, caption,
    });
    return { messageId, mediaType: "video" };
  }

  // File attachment
  messageId = await sendFileMessage({
    baseUrl, token, toUserId, uploaded, contextToken, caption, fileName,
  });
  return { messageId, mediaType: "file" };
}
