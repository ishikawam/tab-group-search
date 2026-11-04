// Chrome の Sync Data LevelDB から保存済みタブグループを読み出す。
// Chrome 本体のデータは一切変更しない。起動中の Chrome がロックを持つため、
// 一時ディレクトリへスナップショットをコピーしてから開く。

import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClassicLevel } from 'classic-level';
import { decodeFields, first, firstNumber, firstString } from './protobuf.js';

// DataTypeStore のキー接頭辞。"-dt-" がエンティティ本体、"-md-" は sync メタデータ。
const ENTITY_KEY_PREFIX = 'saved_tab_group-dt-';
const LEVELDB_LOCK_FILE = 'LOCK';

// components/sync/protocol/saved_tab_group_specifics.proto のフィールド番号。
const DATA_FIELD_SPECIFICS = 2;
const SPECIFICS_FIELD_GUID = 1;
const SPECIFICS_FIELD_GROUP = 4;
const SPECIFICS_FIELD_TAB = 5;
const GROUP_FIELD_TITLE = 2;
const GROUP_FIELD_COLOR = 3;
const TAB_FIELD_GROUP_GUID = 1;
const TAB_FIELD_POSITION = 2;
const TAB_FIELD_URL = 3;
const TAB_FIELD_TITLE = 4;

// tab_groups::TabGroupColorId の並び。
const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

export class SavedTabGroupFormatError extends Error {}

export function syncDataDir(profileDir) {
  return path.join(profileDir, 'Sync Data', 'LevelDB');
}

/**
 * 1 エンティティの値を解釈する。グループなら { kind: 'group' }、タブなら { kind: 'tab' }。
 * 想定外の構造は SavedTabGroupFormatError を投げる。Chrome 側の形式変更を黙って見逃さないため。
 */
export function parseEntity(key, value) {
  const specificsBuf = first(decodeFields(value), DATA_FIELD_SPECIFICS);
  if (!specificsBuf) throw new SavedTabGroupFormatError(`specifics が無い: ${key}`);
  const specifics = decodeFields(specificsBuf);
  const guid = firstString(specifics, SPECIFICS_FIELD_GUID);

  const groupBuf = first(specifics, SPECIFICS_FIELD_GROUP);
  if (groupBuf) {
    const g = decodeFields(groupBuf);
    const colorId = firstNumber(g, GROUP_FIELD_COLOR);
    return {
      kind: 'group',
      guid,
      title: firstString(g, GROUP_FIELD_TITLE) ?? '',
      color: COLORS[colorId] ?? 'grey',
    };
  }

  const tabBuf = first(specifics, SPECIFICS_FIELD_TAB);
  if (tabBuf) {
    const t = decodeFields(tabBuf);
    return {
      kind: 'tab',
      guid,
      groupGuid: firstString(t, TAB_FIELD_GROUP_GUID),
      position: firstNumber(t, TAB_FIELD_POSITION) ?? 0,
      url: firstString(t, TAB_FIELD_URL) ?? '',
      title: firstString(t, TAB_FIELD_TITLE) ?? '',
    };
  }

  throw new SavedTabGroupFormatError(`group / tab のどちらでもない: ${key}`);
}

/**
 * パース済みエンティティをグループ単位にまとめる。純粋関数。
 * 所属グループが存在しないタブは、Chrome 側で削除途中のデータとして除外する。
 */
export function assembleGroups(entities) {
  const groups = new Map();
  for (const e of entities) {
    if (e.kind === 'group') groups.set(e.guid, { ...e, tabs: [] });
  }
  for (const e of entities) {
    if (e.kind === 'tab') groups.get(e.groupGuid)?.tabs.push(e);
  }
  const result = [...groups.values()];
  for (const g of result) g.tabs.sort((a, b) => a.position - b.position);
  return result;
}

async function readEntities(dbDir) {
  const db = new ClassicLevel(dbDir, { keyEncoding: 'utf8', valueEncoding: 'buffer' });
  try {
    const entities = [];
    for await (const [key, value] of db.iterator({ gte: ENTITY_KEY_PREFIX, lt: `${ENTITY_KEY_PREFIX}￿` })) {
      entities.push(parseEntity(key, value));
    }
    return entities;
  } finally {
    await db.close();
  }
}

/**
 * 指定プロファイルの保存済みタブグループを全件返す。開いている／閉じているは区別しない。
 * スナップショットは処理後に必ず削除する。
 */
export async function loadSavedTabGroups(profileDir) {
  const snapshotDir = await mkdtemp(path.join(tmpdir(), 'tab-group-search-'));
  try {
    await cp(syncDataDir(profileDir), snapshotDir, {
      recursive: true,
      filter: (src) => path.basename(src) !== LEVELDB_LOCK_FILE,
    });
    return assembleGroups(await readEntities(snapshotDir));
  } finally {
    await rm(snapshotDir, { recursive: true, force: true });
  }
}
