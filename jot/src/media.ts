// src/media.ts

/**
 * Downloads an image from Telegram and converts it to a base64 string.
 * @param filePath - The file_path of the photo from the Telegram API.
 * @param botToken - The Telegram bot token.
 * @returns A base64 encoded string of the image.
 */
export const downloadAndConvertImageToBase64 = async (filePath: string, botToken: string): Promise<string> => {
	const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
	const response = await fetch(fileUrl);
	const imageBuffer = await response.arrayBuffer();
	const base64 = Buffer.from(imageBuffer).toString('base64');
	return base64;
};
