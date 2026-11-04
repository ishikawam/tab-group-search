// 検索ポップアップ。入力に応じて絞り込み、↑↓（Ctrl+P/N）で選択、Enter で開く。

import { callHost, profileEmail } from './lib/native.js';
import { search } from './lib/search.js';

// 描画件数の上限。全件描画するとキー入力ごとの再描画が重くなるため。
const MAX_RENDERED_RESULTS = 200;

const queryInput = document.getElementById('query');
const statusLine = document.getElementById('status');
const resultList = document.getElementById('results');

const state = {
  email: null,
  groups: [],
  openGroupTitles: new Set(),
  results: [],
  selected: 0,
};

function showStatus(text, { error = false } = {}) {
  statusLine.textContent = text;
  statusLine.classList.toggle('error', error);
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function groupLabel(group, { withName }) {
  const label = element('span', 'group');
  label.append(element('span', `dot ${group.color}`));
  if (withName) label.append(element('span', 'group-name', group.title));
  if (state.openGroupTitles.has(group.title)) label.append(element('span', 'badge', '開いている'));
  return label;
}

function renderItem(result, index) {
  const li = element('li');
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', String(index === state.selected));
  if (result.kind === 'group') {
    li.append(element('span', 'title', result.group.title), element('span', 'url', `${result.group.tabs.length} タブ`));
    li.append(groupLabel(result.group, { withName: false }));
  } else {
    li.append(element('span', 'title', result.tab.displayTitle), element('span', 'url', result.tab.displayUrl));
    li.append(groupLabel(result.group, { withName: true }));
  }
  li.addEventListener('click', () => openResult(result));
  return li;
}

function render() {
  const visible = state.results.slice(0, MAX_RENDERED_RESULTS);
  resultList.replaceChildren(...visible.map(renderItem));
  const total = state.results.length;
  showStatus(total > visible.length ? `${total} 件中 ${visible.length} 件を表示` : `${total} 件`);
  resultList.children[state.selected]?.scrollIntoView({ block: 'nearest' });
}

function updateResults() {
  state.results = search(state.groups, queryInput.value);
  state.selected = 0;
  render();
}

function moveSelection(delta) {
  const count = Math.min(state.results.length, MAX_RENDERED_RESULTS);
  if (count === 0) return;
  state.selected = (state.selected + delta + count) % count;
  render();
}

function openResult(result) {
  chrome.runtime.sendMessage({
    type: 'open',
    email: state.email,
    groupGuid: result.group.guid,
    groupTitle: result.group.title,
    url: result.kind === 'tab' ? result.tab.url : null,
  });
  window.close();
}

queryInput.addEventListener('input', updateResults);
queryInput.addEventListener('keydown', (event) => {
  const ctrl = event.ctrlKey && !event.metaKey && !event.altKey;
  if (event.key === 'ArrowDown' || (ctrl && event.key === 'n')) {
    moveSelection(1);
  } else if (event.key === 'ArrowUp' || (ctrl && event.key === 'p')) {
    moveSelection(-1);
  } else if (event.key === 'Enter' && !event.isComposing) {
    const result = state.results[state.selected];
    if (result) openResult(result);
  } else {
    return;
  }
  event.preventDefault();
});

async function load() {
  showStatus('読み込み中…');
  state.email = await profileEmail();
  const [{ groups }, openGroups] = await Promise.all([callHost({ type: 'list', email: state.email }), chrome.tabGroups.query({})]);
  state.groups = groups;
  state.openGroupTitles = new Set(openGroups.map((g) => g.title));
  updateResults();
}

load().catch((error) => {
  showStatus(error.message, { error: true });
  throw error;
});
