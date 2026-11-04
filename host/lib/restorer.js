// 復元ヘルパー（TabGroupRestorer.app）の呼び出し。
// アクセシビリティ権限をヘルパー自身に付与するため、Chrome の子プロセスとしてではなく
// LaunchServices (open) 経由で独立したアプリとして起動する。

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const RESTORER_APP = fileURLToPath(new URL('../../build/TabGroupRestorer.app', import.meta.url));
const OPEN_COMMAND = '/usr/bin/open';
const RESTORE_TIMEOUT_MS = 20000;

/** code はヘルパーが返す識別子（例: group-already-open）。 */
export class RestoreFailedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const NO_RESPONSE_CODE = 'no-response';

/** 保存済みグループからヘルパーへの入力を組み立てる。純粋関数。 */
export function buildRestoreRequest(group) {
  return {
    title: group.title,
    tabs: group.tabs.map((t) => ({ title: t.title, url: t.url })),
  };
}

/**
 * ヘルパーを起動し、Chrome 前面ウィンドウで対象グループの「Open group」を実行させる。
 * 失敗時は RestoreFailedError を投げる。
 */
export async function runRestorer(request) {
  const workDir = await mkdtemp(path.join(tmpdir(), 'tab-group-restorer-'));
  const stdoutPath = path.join(workDir, 'stdout.json');
  try {
    // -g: ヘルパーを前面に出さない（Chrome を前面のまま操作するため）
    // -n: 毎回新しいインスタンスで起動する
    // -W: 終了まで待つ。ヘルパーの終了コードがそのまま返る
    try {
      await execFileAsync(
        OPEN_COMMAND,
        ['-g', '-n', '-W', '--stdout', stdoutPath, RESTORER_APP, '--args', JSON.stringify(request)],
        { timeout: RESTORE_TIMEOUT_MS },
      );
    } catch (error) {
      // 非ゼロ終了はヘルパーが失敗応答を書いたケース。応答は下で読む。それ以外は起動自体の失敗。
      if (typeof error.code !== 'number') throw error;
    }
    const output = await readFile(stdoutPath, 'utf8');
    if (output === '') throw new RestoreFailedError(NO_RESPONSE_CODE, '復元ヘルパーが応答を返しませんでした');
    const response = JSON.parse(output);
    if (!response.ok) throw new RestoreFailedError(response.code, response.message);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
