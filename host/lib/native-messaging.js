// Chrome Native Messaging のフレーミング（4 バイトのネイティブエンディアン長 + UTF-8 JSON）。

const LENGTH_PREFIX_BYTES = 4;

export class NativeMessagingProtocolError extends Error {}

/**
 * ストリームから 1 メッセージを読み取る。sendNativeMessage は 1 往復で終わるため 1 件のみ扱う。
 * Chrome は応答を待つ間 stdin を閉じないので、EOF ではなく長さで読み終わりを判定する。
 */
export async function readMessage(stream) {
  let buf = Buffer.alloc(0);
  for await (const chunk of stream) {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length >= LENGTH_PREFIX_BYTES && buf.length >= LENGTH_PREFIX_BYTES + buf.readUInt32LE(0)) break;
  }
  if (buf.length < LENGTH_PREFIX_BYTES) throw new NativeMessagingProtocolError('メッセージ長が読めません');
  const length = buf.readUInt32LE(0);
  const body = buf.subarray(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + length);
  if (body.length !== length) throw new NativeMessagingProtocolError(`メッセージが途中で終端しました: ${body.length}/${length}`);
  return JSON.parse(body.toString('utf8'));
}

export function encodeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(LENGTH_PREFIX_BYTES);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}
