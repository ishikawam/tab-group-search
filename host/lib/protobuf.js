// protobuf wire format の最小デコーダ。
// .proto をバンドルせず、必要なフィールド番号だけを呼び出し側で解釈するために使う。

const WIRE_VARINT = 0;
const WIRE_I64 = 1;
const WIRE_LEN = 2;
const WIRE_I32 = 5;

export class ProtobufDecodeError extends Error {}

function readVarint(buf, offset) {
  let value = 0n;
  let shift = 0n;
  let pos = offset;
  for (;;) {
    if (pos >= buf.length) throw new ProtobufDecodeError(`varint が途中で終端した: offset=${offset}`);
    const byte = buf[pos++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: pos };
    shift += 7n;
    if (shift > 63n) throw new ProtobufDecodeError(`varint が 64bit を超えた: offset=${offset}`);
  }
}

/**
 * メッセージを フィールド番号 → 値の配列 の Map に分解する。
 * varint は BigInt、length-delimited は Buffer、固定長は Buffer で返す。
 * 不正なバイト列は ProtobufDecodeError を投げる。
 */
export function decodeFields(buf) {
  const fields = new Map();
  let pos = 0;
  while (pos < buf.length) {
    const tag = readVarint(buf, pos);
    pos = tag.next;
    const fieldNumber = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);
    let value;
    switch (wireType) {
      case WIRE_VARINT: {
        const v = readVarint(buf, pos);
        value = v.value;
        pos = v.next;
        break;
      }
      case WIRE_I64:
        value = buf.subarray(pos, pos + 8);
        pos += 8;
        break;
      case WIRE_LEN: {
        const len = readVarint(buf, pos);
        const end = len.next + Number(len.value);
        if (end > buf.length) throw new ProtobufDecodeError(`length-delimited が範囲外: field=${fieldNumber}`);
        value = buf.subarray(len.next, end);
        pos = end;
        break;
      }
      case WIRE_I32:
        value = buf.subarray(pos, pos + 4);
        pos += 4;
        break;
      default:
        throw new ProtobufDecodeError(`未対応の wire type: ${wireType} field=${fieldNumber}`);
    }
    if (pos > buf.length) throw new ProtobufDecodeError(`フィールドが範囲外: field=${fieldNumber}`);
    if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
    fields.get(fieldNumber).push(value);
  }
  return fields;
}

/** 単一出現フィールドを取り出す。存在しなければ undefined。 */
export function first(fields, fieldNumber) {
  return fields.get(fieldNumber)?.[0];
}

export function firstString(fields, fieldNumber) {
  return first(fields, fieldNumber)?.toString('utf8');
}

export function firstNumber(fields, fieldNumber) {
  const v = first(fields, fieldNumber);
  return v === undefined ? undefined : Number(BigInt.asIntN(64, v));
}
