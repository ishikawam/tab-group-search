// 検索・表示用のタブ情報の整形。純粋関数のみ。

// The Marvellous Suspender などの The Great Suspender 系拡張がサスペンド中のタブに付ける URL。
// 例: chrome-extension://<id>/suspended.html#ttl=<エンコード済みタイトル>&pos=0&uri=<元URL>
const SUSPENDED_URL_PATTERN = /^chrome-extension:\/\/[a-p]{32}\/suspended\.html#(?:.*&)?ttl=(.*?)&pos=\d+&uri=(.*)$/;

function decodeTitle(encoded) {
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    // タイトル中の素の "%" などで復号できない場合は、エンコード済み文字列のまま表示する。
    if (error instanceof URIError) return encoded;
    throw error;
  }
}

/** サスペンド用 URL なら { title, url } を返し、そうでなければ null。 */
export function unwrapSuspendedUrl(url) {
  const m = SUSPENDED_URL_PATTERN.exec(url);
  return m ? { title: decodeTitle(m[1]), url: m[2] } : null;
}

/**
 * 検索・表示に使う { title, url } を返す。
 * サスペンド中のタブは元のタイトルと URL を、タイトルが空なら URL をタイトルとして使う。
 */
export function displayTab(tab) {
  const suspended = unwrapSuspendedUrl(tab.url);
  const url = suspended?.url ?? tab.url;
  const title = suspended?.title || tab.title || url;
  return { title, url };
}
