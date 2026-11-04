// テストデータ生成用の最小 protobuf エンコーダ。

function varint(value) {
  let v = BigInt(value);
  const bytes = [];
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (v > 0n);
  return Buffer.from(bytes);
}

/** fields: [フィールド番号, 値] の配列。値は number/bigint なら varint、string/Buffer なら length-delimited。 */
export function encode(fields) {
  return Buffer.concat(
    fields.map(([number, value]) => {
      if (typeof value === 'number' || typeof value === 'bigint') {
        return Buffer.concat([varint((BigInt(number) << 3n) | 0n), varint(value)]);
      }
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
      return Buffer.concat([varint((BigInt(number) << 3n) | 2n), varint(buf.length), buf]);
    }),
  );
}
