import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeFields, ProtobufDecodeError } from '../host/lib/protobuf.js';
import { assembleGroups, parseEntity, SavedTabGroupFormatError } from '../host/lib/saved-tab-groups.js';
import { encode } from './helpers/protobuf-encoder.js';

function groupEntity(guid, title, color) {
  const group = encode([[2, title], [3, color]]);
  const specifics = encode([[1, guid], [4, group]]);
  return encode([[1, 1], [2, specifics]]);
}

function tabEntity(guid, groupGuid, position, url, title) {
  const tab = encode([[1, groupGuid], [2, position], [3, url], [4, title]]);
  return encode([[2, encode([[1, guid], [5, tab]])]]);
}

describe('decodeFields', () => {
  it('varint と length-delimited を分解する', () => {
    const fields = decodeFields(encode([[1, 300], [2, 'abc'], [2, 'def']]));
    assert.equal(fields.get(1)[0], 300n);
    assert.deepEqual(fields.get(2).map(String), ['abc', 'def']);
  });

  it('範囲外の長さは ProtobufDecodeError', () => {
    assert.throws(() => decodeFields(Buffer.from([0x12, 0x05, 0x61])), ProtobufDecodeError);
  });
});

describe('parseEntity', () => {
  it('グループを解釈する', () => {
    const e = parseEntity('k', groupEntity('g1', 'MAIN', 4));
    assert.deepEqual(e, {
      kind: 'group',
      guid: 'g1',
      title: 'MAIN',
      color: 'green',
    });
  });

  it('タブを解釈する', () => {
    const e = parseEntity('k', tabEntity('t1', 'g1', 2, 'https://example.com/', '例'));
    assert.deepEqual(e, { kind: 'tab', guid: 't1', groupGuid: 'g1', position: 2, url: 'https://example.com/', title: '例' });
  });

  it('specifics が無ければ SavedTabGroupFormatError', () => {
    assert.throws(() => parseEntity('k', encode([[1, 1]])), SavedTabGroupFormatError);
  });

  it('group / tab のどちらでもなければ SavedTabGroupFormatError', () => {
    assert.throws(() => parseEntity('k', encode([[2, encode([[1, 'x']])]])), SavedTabGroupFormatError);
  });
});

describe('assembleGroups', () => {
  it('タブを所属グループに位置順で入れ、孤立したタブは除外する', () => {
    const entities = [
      { kind: 'tab', guid: 't2', groupGuid: 'g1', position: 1, url: 'b', title: 'B' },
      { kind: 'group', guid: 'g1', title: 'G', color: 'grey' },
      { kind: 'tab', guid: 't1', groupGuid: 'g1', position: 0, url: 'a', title: 'A' },
      { kind: 'tab', guid: 't3', groupGuid: 'missing', position: 0, url: 'c', title: 'C' },
    ];
    const [group, ...rest] = assembleGroups(entities);
    assert.equal(rest.length, 0);
    assert.deepEqual(group.tabs.map((t) => t.guid), ['t1', 't2']);
  });
});
