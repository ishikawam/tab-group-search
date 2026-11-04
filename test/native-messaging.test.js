import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import { encodeMessage, NativeMessagingProtocolError, readMessage } from '../host/lib/native-messaging.js';

describe('native messaging', () => {
  it('ストリームを閉じなくても 1 メッセージ分で読み終わる', async () => {
    const stream = new PassThrough();
    const encoded = encodeMessage({ type: 'list', email: 'a@example.com' });
    // 分割して届くケース
    stream.write(encoded.subarray(0, 3));
    stream.write(encoded.subarray(3));
    assert.deepEqual(await readMessage(stream), { type: 'list', email: 'a@example.com' });
  });

  it('途中で終端したら NativeMessagingProtocolError', async () => {
    const stream = new PassThrough();
    stream.end(encodeMessage({ a: 1 }).subarray(0, 6));
    await assert.rejects(readMessage(stream), NativeMessagingProtocolError);
  });
});
