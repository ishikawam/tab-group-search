// 保存済みタブグループを Chrome 標準 UI 経由で復元する。
import ApplicationServices

struct RestoreRequest: Decodable {
  struct Tab: Decodable {
    let title: String
    let url: String
  }

  /// グループ名。メニュー項目との照合に使う。
  let title: String
  /// LevelDB 上のタブ一覧。同名グループの判別にのみ使う。
  let tabs: [Tab]
}

/// メニュー上のタブラベル集合と期待するタブ一覧の一致数。Chrome はタイトルが空のタブを URL で表示する。
func matchScore(menuLabels: [String], expected: [RestoreRequest.Tab]) -> Int {
  let candidates = Set(expected.flatMap { [$0.title, $0.url, $0.url.replacing(#/^https?:\/\//#, with: "")] })
  return menuLabels.filter { candidates.contains($0) }.count
}

struct GroupRestorer {
  let navigator: ChromeMenuNavigator

  /// メニューを辿って対象グループの「Open group」を押す。
  /// 押す直前に選択項目が「Open group」であることを必ず確認し、それ以外の項目は押さない。
  func restore(_ request: RestoreRequest) throws {
    do {
      try perform(request)
    } catch {
      navigator.closeAll()
      throw error
    }
  }

  private func perform(_ request: RestoreRequest) throws {
    let chrome = navigator.chrome
    let appMenu = try navigator.openAppMenu()
    guard let tabGroupsIndex = navigator.items(of: appMenu).firstIndex(where: { $0.title == ChromeUIText.tabGroups }) else {
      throw RestoreError.itemNotFound(ChromeUIText.tabGroups)
    }
    try navigator.select(index: tabGroupsIndex, in: appMenu, name: ChromeUIText.tabGroups)
    chrome.send(.right)
    let groupsMenu = try navigator.waitMenu(ChromeUIText.tabGroups) { $0.title.hasPrefix(ChromeUIText.createNewTabGroupPrefix) }

    let candidates = navigator.items(of: groupsMenu).enumerated().compactMap { index, item -> (Int, GroupMenuEntry)? in
      guard let entry = GroupMenuEntry(item), entry.title == request.title else { return nil }
      return (index, entry)
    }
    guard !candidates.isEmpty else { throw RestoreError.groupNotFound(request.title) }

    let (index, entry) = candidates.count == 1 ? candidates[0] : try chooseByTabs(candidates, in: groupsMenu, request: request)
    if entry.isOpened { throw RestoreError.groupAlreadyOpen(request.title) }

    try navigator.select(index: index, in: groupsMenu, name: request.title)
    chrome.send(.right)
    let groupMenu = try navigator.waitMenu(request.title) { $0.title == ChromeUIText.openGroup }
    let selected = navigator.items(of: groupMenu).first(where: \.isSelected)?.title ?? ""
    guard selected == ChromeUIText.openGroup else {
      throw RestoreError.unexpectedSelection(expected: ChromeUIText.openGroup, actual: selected)
    }
    chrome.send(.enter)
  }

  /// 同名グループが複数あるとき、各候補のサブメニューに並ぶタブを照合して一意に決める。
  private func chooseByTabs(_ candidates: [(Int, GroupMenuEntry)], in groupsMenu: AXNode, request: RestoreRequest) throws -> (Int, GroupMenuEntry) {
    var scored: [(score: Int, candidate: (Int, GroupMenuEntry))] = []
    for candidate in candidates {
      try navigator.select(index: candidate.0, in: groupsMenu, name: request.title)
      navigator.chrome.send(.right)
      let groupMenu = try navigator.waitMenu(request.title) { $0.title == ChromeUIText.tabsInGroup }
      let labels = navigator.items(of: groupMenu).map(\.title).drop { $0 != ChromeUIText.tabsInGroup }.dropFirst()
      scored.append((matchScore(menuLabels: Array(labels), expected: request.tabs), candidate))
      navigator.chrome.send(.left)
      _ = waitUntil { navigator.findMenu { $0.title == ChromeUIText.tabsInGroup } == nil ? true : nil }
    }
    let best = scored.map(\.score).max() ?? 0
    let winners = scored.filter { $0.score == best }
    guard best > 0, winners.count == 1 else { throw RestoreError.ambiguousGroup(request.title) }
    return winners[0].candidate
  }
}
