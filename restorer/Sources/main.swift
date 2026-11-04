// 保存済みタブグループ復元ヘルパーのエントリポイント。
// 入力: 第1引数に RestoreRequest の JSON。
// 出力: 標準出力に {"ok":true} または {"ok":false,"code":"...","message":"..."}。終了コードも成否を返す。
import ApplicationServices
import Foundation

struct RestoreResponse: Encodable {
  let ok: Bool
  let code: String?
  let message: String?

  static let success = RestoreResponse(ok: true, code: nil, message: nil)
  static func failure(_ code: String, _ message: String) -> RestoreResponse { RestoreResponse(ok: false, code: code, message: message) }
}

func respond(_ response: RestoreResponse) -> Never {
  FileHandle.standardOutput.write(try! JSONEncoder().encode(response))
  exit(response.ok ? 0 : 1)
}

enum UsageError: Error, CustomStringConvertible {
  case missingRequest
  var description: String { "引数に復元リクエストの JSON を指定してください" }
}

do {
  guard CommandLine.arguments.count == 2 else { throw UsageError.missingRequest }
  let request = try JSONDecoder().decode(RestoreRequest.self, from: Data(CommandLine.arguments[1].utf8))
  // 権限が無ければシステムの許可ダイアログを出したうえで失敗させる。
  guard AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary) else {
    throw RestoreError.accessibilityNotTrusted
  }
  let chrome = try ChromeProcess()
  try GroupRestorer(navigator: ChromeMenuNavigator(chrome: chrome)).restore(request)
  respond(.success)
} catch let error as RestoreError {
  respond(.failure(error.code, error.description))
} catch let error as UsageError {
  respond(.failure("invalid-request", error.description))
} catch let error as DecodingError {
  respond(.failure("invalid-request", "リクエストの JSON が不正です: \(error)"))
} catch {
  // 上記以外を投げる経路は無い。到達した場合は想定外として即停止する。
  fatalError("想定外のエラー: \(error)")
}
