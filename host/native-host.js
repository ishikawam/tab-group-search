// Chrome 拡張から呼ばれる Native Messaging ホスト。
// リクエスト:
//   { type: 'list', email }          そのプロファイルの保存済みグループ一覧
//   { type: 'restore', email, guid } そのグループを Chrome 標準 UI 経由で復元
// レスポンス:
//   成功 { ok: true, ... } / 失敗 { ok: false, code, message }

import { findProfileByEmail, ProfileNotFoundError } from './lib/chrome-profiles.js';
import { encodeMessage, readMessage } from './lib/native-messaging.js';
import { buildRestoreRequest, RestoreFailedError, runRestorer } from './lib/restorer.js';
import { loadSavedTabGroups, SavedTabGroupFormatError } from './lib/saved-tab-groups.js';
import { displayTab } from './lib/tab-display.js';

class UnknownRequestError extends Error {}
class GroupNotFoundError extends Error {}

async function listGroups(email) {
  const profile = await findProfileByEmail(email);
  const groups = await loadSavedTabGroups(profile.dir);
  return groups.map((g) => ({
    guid: g.guid,
    title: g.title,
    color: g.color,
    tabs: g.tabs.map((t) => {
      const display = displayTab(t);
      // url は復元後のタブ照合用に生の値、display* は検索・表示用。
      return { url: t.url, displayTitle: display.title, displayUrl: display.url };
    }),
  }));
}

async function restoreGroup(email, guid) {
  const profile = await findProfileByEmail(email);
  const group = (await loadSavedTabGroups(profile.dir)).find((g) => g.guid === guid);
  if (!group) throw new GroupNotFoundError(`保存済みグループが見つかりません: ${guid}`);
  await runRestorer(buildRestoreRequest(group));
}

async function handle(request) {
  switch (request.type) {
    case 'list':
      return { ok: true, groups: await listGroups(request.email) };
    case 'restore':
      await restoreGroup(request.email, request.guid);
      return { ok: true };
    default:
      throw new UnknownRequestError(`未知のリクエスト: ${request.type}`);
  }
}

/** 想定済みの失敗を拡張に返す形へ変換する。想定外の例外はそのまま投げてホストを異常終了させる。 */
function toFailure(error) {
  if (error instanceof RestoreFailedError) return { ok: false, code: error.code, message: error.message };
  if (error instanceof ProfileNotFoundError) return { ok: false, code: 'profile-not-found', message: error.message };
  if (error instanceof GroupNotFoundError) return { ok: false, code: 'group-not-found', message: error.message };
  if (error instanceof SavedTabGroupFormatError) return { ok: false, code: 'unsupported-format', message: error.message };
  if (error instanceof UnknownRequestError) return { ok: false, code: 'invalid-request', message: error.message };
  throw error;
}

const request = await readMessage(process.stdin);
let response;
try {
  response = await handle(request);
} catch (error) {
  response = toFailure(error);
}
process.stdout.write(encodeMessage(response), () => process.exit(0));
