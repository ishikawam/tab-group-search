// Chrome のプロファイルディレクトリを解決する。

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const CHROME_USER_DATA_DIR = path.join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');

export class ProfileNotFoundError extends Error {}

/** Local State の info_cache から { dir, name, email } の一覧を返す。 */
export async function listProfiles(userDataDir = CHROME_USER_DATA_DIR) {
  const localState = JSON.parse(await readFile(path.join(userDataDir, 'Local State'), 'utf8'));
  return Object.entries(localState.profile.info_cache).map(([dir, info]) => ({
    dir: path.join(userDataDir, dir),
    name: info.name,
    email: info.user_name,
  }));
}

/**
 * ログイン中の Google アカウントのメールアドレスからプロファイルを特定する。
 * 拡張機能は chrome.identity.getProfileUserInfo() で自プロファイルのメールを取得できるため、
 * それを Native Messaging ホスト側でディレクトリに対応付ける。
 */
export async function findProfileByEmail(email, userDataDir = CHROME_USER_DATA_DIR) {
  const matches = (await listProfiles(userDataDir)).filter((p) => p.email && p.email === email);
  if (matches.length !== 1) {
    throw new ProfileNotFoundError(`メールアドレスに対応するプロファイルが ${matches.length} 件: ${email}`);
  }
  return matches[0];
}
