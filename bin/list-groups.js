#!/usr/bin/env node
// 保存済みタブグループを一覧表示する検証用 CLI。
// 使い方: node bin/list-groups.js            プロファイル一覧
//         node bin/list-groups.js <email>    そのプロファイルのグループとタブ

import { findProfileByEmail, listProfiles } from '../host/lib/chrome-profiles.js';
import { loadSavedTabGroups } from '../host/lib/saved-tab-groups.js';

const email = process.argv[2];

if (!email) {
  for (const p of await listProfiles()) console.log(`${p.email ?? '-'}\t${p.name}\t${p.dir}`);
} else {
  const profile = await findProfileByEmail(email);
  const groups = await loadSavedTabGroups(profile.dir);
  for (const g of groups) {
    console.log(`[${g.color}] ${g.title} (${g.tabs.length})`);
    for (const t of g.tabs) console.log(`    ${t.title}\t${t.url}`);
  }
  const tabCount = groups.reduce((n, g) => n + g.tabs.length, 0);
  console.error(`${groups.length} groups, ${tabCount} tabs`);
}
