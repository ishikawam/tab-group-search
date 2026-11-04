import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { search } from '../extension/lib/search.js';

const tab = (displayTitle, displayUrl) => ({ url: displayUrl, displayTitle, displayUrl });
const groups = [
  { guid: '2', title: 'widget リリース', tabs: [tab('Release Notes', 'https://example.com/widget/releases')] },
  { guid: '1', title: 'Cloud 調査', tabs: [tab('Cloud SQL', 'https://cloud.google.com/sql'), tab('Cloud Run', 'https://cloud.google.com/run')] },
];

const summary = (results) => results.map((r) => (r.kind === 'group' ? `G:${r.group.title}` : `T:${r.tab.displayTitle}`));

describe('search', () => {
  it('空クエリは全グループを名前順で返す', () => {
    assert.deepEqual(summary(search(groups, '  ')), ['G:Cloud 調査', 'G:widget リリース']);
  });

  it('タイトル・URL に一致するタブを返す（大文字小文字を区別しない）', () => {
    assert.deepEqual(summary(search(groups, 'cloud SQL')), ['T:Cloud SQL']);
  });

  it('グループ名とタブ内容をまたいだ AND 検索ができる', () => {
    assert.deepEqual(summary(search(groups, '調査 run')), ['T:Cloud Run']);
  });

  it('グループ名だけで一致する場合はグループ行のみ返す', () => {
    assert.deepEqual(summary(search(groups, 'widget')), ['G:widget リリース']);
  });
});
