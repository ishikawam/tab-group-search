// パッケージ化されていない Chrome 拡張の ID 算出。

import { createHash } from 'node:crypto';

const ID_LENGTH = 32;
const ID_ALPHABET_START = 'a'.charCodeAt(0);

/**
 * Chrome は拡張ディレクトリの絶対パスの SHA-256 先頭 128bit を、16 進の各桁 0-f を a-p に置き換えて ID にする。
 * ディレクトリを移動すると ID も変わる。
 */
export function unpackedExtensionId(extensionDir) {
  const hex = createHash('sha256').update(extensionDir).digest('hex').slice(0, ID_LENGTH);
  return [...hex].map((c) => String.fromCharCode(ID_ALPHABET_START + parseInt(c, 16))).join('');
}
