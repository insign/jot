/**
 * Image utilities for downloading and converting Telegram images
 */

/**
 * Download image from Telegram and convert to base64
 * Used when users send images to Jules
 */
export async function downloadAndConvertImageToBase64(
  filePath: string,
  botToken: string
): Promise<{ data: string; mediaType: string } | null> {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

  try {
    // Download image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to download image: ${response.status} ${response.statusText}`);
      return null;
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Validate content type
    if (!contentType.startsWith('image/')) {
      console.error(`Invalid content type: ${contentType}`);
      return null;
    }

    // Convert to array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Check size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (arrayBuffer.byteLength > maxSize) {
      console.error(`Image too large: ${arrayBuffer.byteLength} bytes (max ${maxSize})`);
      return null;
    }

    // Convert to base64
    const base64 = arrayBufferToBase64(arrayBuffer);

    return {
      data: base64,
      mediaType: contentType,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Image download timeout (30s)');
      } else {
        console.error(`Error downloading image: ${error.message}`);
      }
    }
    return null;
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 * Used when receiving images from Jules API
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validate image format
 * Returns true if format is supported
 */
export function isValidImageFormat(contentType: string): boolean {
  const supportedFormats = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  return supportedFormats.includes(contentType.toLowerCase());
}

/**
 * Get media type from file extension
 */
export function getMediaTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg'; // Default fallback
  }
}
