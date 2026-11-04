RESTORER_APP := build/TabGroupRestorer.app
RESTORER_SOURCES := $(wildcard restorer/Sources/*.swift)

.PHONY: help
help: ## コマンド一覧
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "%-16s %s\n", $$1, $$2}'

.PHONY: build
build: $(RESTORER_APP) ## 復元ヘルパーをビルド

$(RESTORER_APP): $(RESTORER_SOURCES) restorer/Resources/Info.plist
	rm -rf $@
	mkdir -p $@/Contents/MacOS
	cp restorer/Resources/Info.plist $@/Contents/Info.plist
	swiftc -O -o $@/Contents/MacOS/TabGroupRestorer $(RESTORER_SOURCES)
	codesign --force --sign - $@

.PHONY: install
install: ## 依存関係の導入・ビルド・Native Messaging ホストの登録
	npm ci
	$(MAKE) build
	node bin/install-native-host.js install

.PHONY: uninstall
uninstall: ## Native Messaging ホストの登録を解除
	node bin/install-native-host.js uninstall

.PHONY: test
test: ## ユニットテスト
	node --test 'test/**/*.test.js'
