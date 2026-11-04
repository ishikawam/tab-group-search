# tab-group-search

Chrome の保存済みタブグループを、閉じているものも含めてキーボードで検索・復元する拡張機能です。

- ショートカットで検索ポップアップを開く
- 対象は現在のプロファイルの保存済みタブグループのみ
- グループ名・タブのタイトル・URL で検索する
- Enter で元のグループを復元し、該当タブをアクティブにする。新しいグループは作らない
- Chrome のデータは読み取りのみで、書き換えない

## 構成

| ディレクトリ | 役割 |
| --- | --- |
| `extension/` | 検索ポップアップと復元後のタブ操作を行う Chrome 拡張 |
| `host/` | Native Messaging ホスト。Sync Data の LevelDB から保存済みタブグループを読む |
| `restorer/` | 復元ヘルパー `TabGroupRestorer.app`。Accessibility API で Chrome の「タブグループ」メニューを操作し、閉じたグループを開く |
| `bin/` | ホスト登録と動作確認用の CLI |

## 動作環境

- macOS
- Google Chrome の UI 言語が英語であること。復元ヘルパーがメニュー項目名で操作するため
- nodenv と Xcode Command Line Tools

## 注意事項

- Chrome 内部のデータ形式とメニュー構成に依存しています。Chrome の更新で動かなくなることがあります
- 復元ヘルパーにはアクセシビリティ権限が必要です。この権限があるアプリは、ほかのアプリの UI を操作できます

## セットアップ

```sh
make install
```

依存関係の導入、復元ヘルパーのビルド、Native Messaging ホストの登録を行います。最後に想定する拡張 ID が表示されます。

### 拡張の読み込み

1. 使いたいプロファイルで `chrome://extensions` を開き、デベロッパーモードをオンにする
2. 「パッケージ化されていない拡張機能を読み込む」で `extension/` を選ぶ
3. 表示された ID が `make install` の出力と一致することを確認する

拡張 ID はディレクトリの絶対パスから決まります。リポジトリを移動したら `make install` をやり直してください。

### アクセシビリティ権限

初回の復元時に、`build/TabGroupRestorer.app` へのアクセシビリティ権限を求められます。システム設定 → プライバシーとセキュリティ → アクセシビリティ で許可してください。

`make build` で再ビルドすると権限が無効になります。その場合は一覧から TabGroupRestorer を「−」で削除し、「＋」で `build/TabGroupRestorer.app` を追加し直してください。

## 使い方

- ⌘⇧K でポップアップを開く。変更は `chrome://extensions/shortcuts` で行う
- ↑↓ または Ctrl+N / Ctrl+P で選択し、Enter かクリックで開く
- 開いているグループはそのタブへ移動する
- 閉じているグループは復元してから該当タブへ移動する。復元中は ⋮ メニューが自動で操作されるので、キーボードとマウスに触れないでください

## CLI

```sh
node bin/list-groups.js                    # プロファイル一覧
node bin/list-groups.js <email>            # 保存済みタブグループ一覧
node bin/restore-group.js <email> <guid>   # グループを復元
```

`restore-group.js` は、対象プロファイルの Chrome ウィンドウを前面にした状態で実行してください。

## 開発

```sh
make test
```

## アンインストール

```sh
make uninstall
```

Native Messaging ホストの登録を解除します。拡張は `chrome://extensions` から削除してください。

## ライセンス

MIT
