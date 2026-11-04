#!/usr/bin/env node
// 保存済みタブグループを Chrome 標準 UI 経由で復元する検証用 CLI。
// 使い方: node bin/restore-group.js <email> <グループGUID>
// 対象プロファイルの Chrome ウィンドウを前面にした状態で実行すること。

import { findProfileByEmail } from '../host/lib/chrome-profiles.js';
import { buildRestoreRequest, runRestorer } from '../host/lib/restorer.js';
import { loadSavedTabGroups } from '../host/lib/saved-tab-groups.js';

const [email, guid] = process.argv.slice(2);
if (!email || !guid) {
  console.error('使い方: node bin/restore-group.js <email> <グループGUID>');
  process.exit(2);
}

const profile = await findProfileByEmail(email);
const group = (await loadSavedTabGroups(profile.dir)).find((g) => g.guid === guid);
if (!group) {
  console.error(`グループが見つかりません: ${guid}`);
  process.exit(1);
}
await runRestorer(buildRestoreRequest(group));
console.log(`復元しました: ${group.title}`);
