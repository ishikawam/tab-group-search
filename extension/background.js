// 検索結果を開く処理。ポップアップは開く直前に閉じるため、処理はサービスワーカーで行う。
// ポップアップが残っていると、復元ヘルパーが操作する前面ウィンドウのメニューと干渉する。

import { callHost, HostError } from './lib/native.js';

const RESTORED_GROUP_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 100;
const GROUP_ALREADY_OPEN = 'group-already-open';

/** このプロファイルで開いている、指定名のタブグループ内のタブ。 */
async function openTabsInGroupsTitled(title) {
  const groups = (await chrome.tabGroups.query({})).filter((g) => g.title === title);
  const tabs = await Promise.all(groups.map((g) => chrome.tabs.query({ groupId: g.id })));
  return tabs.flat();
}

async function focusTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

/**
 * 開いているグループから対象タブを探してアクティブにする。
 * url が null（グループ行を選択）なら、そのグループの先頭タブを対象にする。見つかれば true。
 */
async function focusOpenTab(groupTitle, url) {
  const tabs = await openTabsInGroupsTitled(groupTitle);
  const target = url === null ? tabs[0] : tabs.find((t) => t.url === url || t.pendingUrl === url);
  if (!target) return false;
  await focusTab(target);
  return true;
}

async function waitFor(probe, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

function notifyError(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '保存済みタブグループを開けませんでした',
    message,
  });
}

/**
 * 検索結果を開く。
 * 1. 既に開いているグループに対象タブがあればそれをアクティブにする
 * 2. なければ Chrome 標準 UI 経由で元の保存済みグループを復元し、復元されたタブをアクティブにする
 * 新しいタブグループを作る経路は持たない（保存済みグループの重複を作らないため）。
 */
async function open({ email, groupGuid, groupTitle, url }) {
  if (await focusOpenTab(groupTitle, url)) return;
  try {
    await callHost({ type: 'restore', email, guid: groupGuid });
  } catch (error) {
    // URL が一致するタブは無いがグループ自体は開いている場合（タブが別ページへ遷移した等）。
    if (error instanceof HostError && error.code === GROUP_ALREADY_OPEN && (await focusOpenTab(groupTitle, null))) return;
    throw error;
  }
  // 復元自体は完了している。タブのアクティブ化は付加機能のため、見つからなくてもエラーにしない。
  await waitFor(() => focusOpenTab(groupTitle, url), RESTORED_GROUP_WAIT_MS);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'open') return;
  open(message).catch((error) => {
    notifyError(error.message);
    throw error;
  });
});
