// Chrome のアプリメニュー（⋮）をキーボード操作で辿る。
// Chrome の公開 API には保存済みタブグループを開く手段が無いため、標準 UI の
// 「Tab groups > グループ > Open group」を操作して、重複を作らずに元のグループを復元する。
import ApplicationServices

/// Chrome の UI 文言。英語 UI を前提とする。
enum ChromeUIText {
  static let tabGroups = "Tab groups"
  static let createNewTabGroupPrefix = "Create new tab group"
  static let openGroup = "Open group"
  /// グループのサブメニューで、この見出しより後ろがタブ一覧。
  static let tabsInGroup = "Tabs in group"
  /// 例: " MAIN group - Opened"
  static let groupItemPattern = try! Regex<(Substring, Substring, Substring)>(#"^\s*(.*) group - (Opened|Closed)$"#)
  static let opened = "Opened"
}

/// 前面ウィンドウの ⋮ ボタンを識別する AXDOMClassList の値。表示名は更新通知などで変わるため使わない。
private let appMenuButtonClass = "BrowserAppMenuButton"

enum RestoreError: Error, CustomStringConvertible {
  case accessibilityNotTrusted
  case chromeNotRunning
  case noFocusedWindow
  case appMenuButtonNotFound
  case menuDidNotOpen(String)
  case itemNotFound(String)
  case selectionDidNotMove(String)
  case groupNotFound(String)
  case groupAlreadyOpen(String)
  case ambiguousGroup(String)
  case unexpectedSelection(expected: String, actual: String)

  /// 呼び出し側が分岐に使う識別子。
  var code: String {
    switch self {
    case .accessibilityNotTrusted: return "accessibility-not-trusted"
    case .chromeNotRunning: return "chrome-not-running"
    case .groupNotFound: return "group-not-found"
    case .groupAlreadyOpen: return "group-already-open"
    case .ambiguousGroup: return "ambiguous-group"
    case .noFocusedWindow, .appMenuButtonNotFound, .menuDidNotOpen, .itemNotFound, .selectionDidNotMove, .unexpectedSelection:
      return "menu-navigation-failed"
    }
  }

  var description: String {
    switch self {
    case .accessibilityNotTrusted: return "アクセシビリティ権限がありません"
    case .chromeNotRunning: return "Chrome が起動していません"
    case .noFocusedWindow: return "Chrome の前面ウィンドウを取得できません"
    case .appMenuButtonNotFound: return "Chrome のメニューボタンが見つかりません"
    case .menuDidNotOpen(let name): return "メニューが開きません: \(name)"
    case .itemNotFound(let name): return "メニュー項目が見つかりません: \(name)"
    case .selectionDidNotMove(let name): return "メニューの選択を移動できません: \(name)"
    case .groupNotFound(let title): return "保存済みグループが見つかりません: \(title)"
    case .groupAlreadyOpen(let title): return "グループは既に開いています: \(title)"
    case .ambiguousGroup(let title): return "同名のグループを特定できません: \(title)"
    case .unexpectedSelection(let expected, let actual): return "想定外の項目が選択されています: expected=\(expected) actual=\(actual)"
    }
  }
}

struct GroupMenuEntry {
  let item: AXNode
  let title: String
  let isOpened: Bool

  init?(_ item: AXNode) {
    guard let m = item.title.wholeMatch(of: ChromeUIText.groupItemPattern) else { return nil }
    self.item = item
    title = String(m.output.1)
    isOpened = m.output.2 == ChromeUIText.opened
  }
}

struct ChromeMenuNavigator {
  let chrome: ChromeProcess

  /// AXMenu 直下の項目を表示順に返す。入れ子のサブメニューには降りない。
  func items(of menu: AXNode) -> [AXNode] {
    var result: [AXNode] = []
    func walk(_ node: AXNode) {
      for child in node.children {
        switch child.role {
        case "AXMenuItem": result.append(child)
        case "AXMenu": continue
        default: walk(child)
        }
      }
    }
    walk(menu)
    return result
  }

  /// 指定条件の項目を含む、表示中のメニューを探す。
  func findMenu(containing predicate: (AXNode) -> Bool) -> AXNode? {
    chrome.app.first { node in node.role == "AXMenu" && items(of: node).contains(where: predicate) }
  }

  func waitMenu(_ name: String, containing predicate: @escaping (AXNode) -> Bool) throws -> AXNode {
    guard let menu = waitUntil({ findMenu(containing: predicate) }) else { throw RestoreError.menuDidNotOpen(name) }
    return menu
  }

  func openAppMenu() throws -> AXNode {
    guard let window = chrome.focusedWindow else { throw RestoreError.noFocusedWindow }
    guard let button = window.first(where: { $0.role == "AXPopUpButton" && $0.domClasses.contains(appMenuButtonClass) }) else {
      throw RestoreError.appMenuButtonNotFound
    }
    // メニュー表示中は AXPress が戻らないため別スレッドで押す。
    DispatchQueue.global().async { _ = button.press() }
    return try waitMenu("app menu") { $0.title == ChromeUIText.tabGroups }
  }

  /// ↓キーで index の項目まで選択を移動する。区切り線は Chrome 側が飛ばす。
  func select(index target: Int, in menu: AXNode, name: String) throws {
    let all = items(of: menu)
    for _ in 0...(all.count * 2) {
      let current = all.firstIndex(where: \.isSelected)
      if current == target { return }
      chrome.send(.down)
      _ = waitUntil(timeout: 0.5) { all.firstIndex(where: \.isSelected) != current ? true : nil }
    }
    throw RestoreError.selectionDidNotMove(name)
  }

  func closeAll() {
    for _ in 0..<4 { chrome.send(.escape); Thread.sleep(forTimeInterval: 0.05) }
  }
}
