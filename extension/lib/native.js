// Native Messaging ホストとの通信。

// bin/install-native-host.js の HOST_NAME と一致させること。
const HOST_NAME = 'local.tab_group_search';

export class HostError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** このプロファイルにログインしている Google アカウントのメールアドレス。ホスト側でプロファイルの特定に使う。 */
export async function profileEmail() {
  const { email } = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
  if (!email) throw new HostError('profile-not-signed-in', 'このプロファイルは Google アカウントにログインしていないため特定できません');
  return email;
}

/** ホストに 1 リクエストを送り、失敗応答は HostError として投げる。 */
export async function callHost(request) {
  const response = await chrome.runtime.sendNativeMessage(HOST_NAME, request);
  if (!response.ok) throw new HostError(response.code, response.message);
  return response;
}
