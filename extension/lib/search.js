// 保存済みグループの検索。純粋関数のみ。

/** 空白区切りの各語を小文字化して返す。 */
export function parseQuery(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesAll(text, terms) {
  const lower = text.toLowerCase();
  return terms.every((term) => lower.includes(term));
}

/**
 * 検索結果を表示順に返す。
 * - クエリが空: 全グループ（名前順）
 * - それ以外: 名前が全語に一致するグループ → 「グループ名＋タブのタイトル・URL」が全語に一致するタブ。
 *   グループ名だけで全語に一致するタブはグループ行に含まれるため、タブ行には出さない。
 * 要素は { kind: 'group', group } または { kind: 'tab', group, tab }。
 */
export function search(groups, query) {
  const sorted = [...groups].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  const terms = parseQuery(query);
  if (terms.length === 0) return sorted.map((group) => ({ kind: 'group', group }));

  const groupHits = [];
  const tabHits = [];
  for (const group of sorted) {
    const groupMatched = matchesAll(group.title, terms);
    if (groupMatched) {
      groupHits.push({ kind: 'group', group });
      continue;
    }
    for (const tab of group.tabs) {
      if (matchesAll(`${group.title} ${tab.displayTitle} ${tab.displayUrl}`, terms)) {
        tabHits.push({ kind: 'tab', group, tab });
      }
    }
  }
  return [...groupHits, ...tabHits];
}
