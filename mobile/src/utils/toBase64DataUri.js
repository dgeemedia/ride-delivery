// mobile/src/utils/toBase64DataUri.js
import * as FileSystem from 'expo-file-system/legacy';
/**
 * Reads a local file URI (file:///) and returns a base64 data-URI string
 * that the backend's /upload/base64 endpoint can accept.
 *
 * @param {string} uri   — local file URI from ImagePicker / FileSystem
 * @returns {Promise<string>}  data:<mime>;base64,<data>
 */
export async function toBase64DataUri(uri) {
  const ext  = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime =
    ext === 'png'  ? 'image/png'        :
    ext === 'pdf'  ? 'application/pdf'  :
    ext === 'gif'  ? 'image/gif'        :
                     'image/jpeg';

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return `data:${mime};base64,${base64}`;
}