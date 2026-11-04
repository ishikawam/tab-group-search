// AXUIElement の薄いラッパーと、Chrome プロセスへのキー送信。
import AppKit
import ApplicationServices

enum Key: CGKeyCode {
  case enter = 36
  case escape = 53
  case left = 123
  case right = 124
  case down = 125
}

struct AXNode {
  let element: AXUIElement

  func value(_ attribute: String) -> AnyObject? {
    var v: AnyObject?
    AXUIElementCopyAttributeValue(element, attribute as CFString, &v)
    return v
  }

  var role: String { value(kAXRoleAttribute) as? String ?? "" }
  var title: String { value(kAXTitleAttribute) as? String ?? "" }
  var isSelected: Bool { value(kAXSelectedAttribute) as? Bool ?? false }
  var domClasses: [String] { value("AXDOMClassList") as? [String] ?? [] }
  var children: [AXNode] { (value(kAXChildrenAttribute) as? [AXUIElement] ?? []).map(AXNode.init) }

  func press() -> AXError { AXUIElementPerformAction(element, kAXPressAction as CFString) }

  /// 深さ優先で最初に条件を満たす要素を返す。Web コンテンツ内部は探索しない。
  func first(maxDepth: Int = 20, where predicate: (AXNode) -> Bool) -> AXNode? {
    if predicate(self) { return self }
    if maxDepth == 0 || role == "AXWebArea" { return nil }
    for child in children {
      if let found = child.first(maxDepth: maxDepth - 1, where: predicate) { return found }
    }
    return nil
  }
}

struct ChromeProcess {
  static let bundleIdentifier = "com.google.Chrome"

  let pid: pid_t
  let app: AXNode

  init() throws {
    guard let running = NSWorkspace.shared.runningApplications.first(where: { $0.bundleIdentifier == Self.bundleIdentifier }) else {
      throw RestoreError.chromeNotRunning
    }
    pid = running.processIdentifier
    app = AXNode(element: AXUIElementCreateApplication(pid))
  }

  var focusedWindow: AXNode? {
    guard let w = app.value(kAXFocusedWindowAttribute) else { return nil }
    return AXNode(element: w as! AXUIElement)
  }

  /// キーは Chrome プロセス宛てにのみ送る。システム全体に送ると前面アプリや Mission Control が反応するため。
  func send(_ key: Key) {
    for down in [true, false] {
      CGEvent(keyboardEventSource: nil, virtualKey: key.rawValue, keyDown: down)?.postToPid(pid)
    }
  }
}

/// 条件が満たされるまでポーリングする。UI の反映待ちに使う。
func waitUntil<T>(timeout: TimeInterval = 2.0, _ probe: () -> T?) -> T? {
  let deadline = Date().addingTimeInterval(timeout)
  repeat {
    if let v = probe() { return v }
    Thread.sleep(forTimeInterval: 0.03)
  } while Date() < deadline
  return nil
}
