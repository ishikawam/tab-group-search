#!/usr/bin/env node
// Native Messaging ホストを Chrome に登録する。
// 使い方: node bin/install-native-host.js [install|uninstall]
//
// - build/native-host: Chrome から起動されるラッパー。Chrome は nodenv の PATH を持たないため node を絶対パスで指定する
// - NativeMessagingHosts/<HOST_NAME>.json: ホストの登録。呼び出しを許可する拡張 ID を含む

import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME_USER_DATA_DIR } from '../host/lib/chrome-profiles.js';
import { unpackedExtensionId } from '../host/lib/extension-id.js';

// extension/lib/native.js の HOST_NAME と一致させること。
const HOST_NAME = 'local.tab_group_search';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXTENSION_DIR = path.join(ROOT, 'extension');
const WRAPPER_PATH = path.join(ROOT, 'build', 'native-host');
const MANIFEST_PATH = path.join(CHROME_USER_DATA_DIR, 'NativeMessagingHosts', `${HOST_NAME}.json`);

async function install() {
  const extensionId = unpackedExtensionId(EXTENSION_DIR);
  await mkdir(path.dirname(WRAPPER_PATH), { recursive: true });
  await writeFile(WRAPPER_PATH, `#!/bin/sh\nexec "${process.execPath}" "${path.join(ROOT, 'host', 'native-host.js')}"\n`);
  await chmod(WRAPPER_PATH, 0o755);

  const manifest = {
    name: HOST_NAME,
    description: 'Tab Group Search',
    path: WRAPPER_PATH,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`登録しました: ${MANIFEST_PATH}`);
  console.log(`拡張ディレクトリ: ${EXTENSION_DIR}`);
  console.log(`想定する拡張 ID: ${extensionId}`);
}

async function uninstall() {
  await rm(MANIFEST_PATH, { force: true });
  console.log(`削除しました: ${MANIFEST_PATH}`);
}

const command = process.argv[2] ?? 'install';
if (command === 'install') await install();
else if (command === 'uninstall') await uninstall();
else {
  console.error('使い方: node bin/install-native-host.js [install|uninstall]');
  process.exit(2);
}
