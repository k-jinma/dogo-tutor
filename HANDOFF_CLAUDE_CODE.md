# Claude Code 向け引き継ぎ書

最終更新日: 2026-07-28
対象プロジェクト: dogo-tutor (VS Code 拡張)

## 1. 目的

- 公開前の最終確認と公開準備を完了する。
- ローカル配布(.vsix)と Marketplace 公開の両方に対応できる状態にする。

## 2. 現在の状態(完了済み)

- 名称を dogo-tutor に統一済み。
- README に大学・学科訴求文言を追加済み。
- 設定キーを dogoTutor.* に統一済み。
- チャット参加者IDを dogo.tutor に統一済み。
- LICENSE を追加済み(MIT, Copyright: kazuhiro jinma)。
- ビルド成功済み (npm run compile)。
- VSIX 生成成功済み (dogo-tutor-0.0.1.vsix)。
- VSIX ローカルインストール成功済み。

## 3. 主要ファイル

- package.json
- package-lock.json
- README.md
- LICENSE
- src/extension.ts
- src/review.ts
- src/prompt.ts
- src/logger.ts
- .vscode/launch.json
- .vscode/tasks.json

## 4. 成果物

- dogo-tutor-0.0.1.vsix がワークスペース直下に存在。

## 5. 既知事項・注意点

- この作業フォルダは現在 Git 管理下ではない( .git が見つからない )ため、ブランチ名・コミット差分による追跡ができない。
- package.json の publisher が CHANGE-ME のまま。Marketplace 公開前に実値へ変更が必要。
- package.json の repository.url が雛形(<https://github.com/CHANGE-ME/dogo-tutor>)のまま。公開前に実URLへ変更が必要。
- Ollama 未起動/未導入時に「Unable to connect to local Ollama instance」の通知が出る。

対処方針:

- 対処A: Ollama を使わない運用なら、実行モデルをクラウド側へ切替。
- 対処B: Ollama を使う運用なら、Ollama 起動 + 対象モデル pull を実施。

## 6. 次タスク(Claude Code に依頼したいこと)

1. 実行テスト(手動)

- F5 で Extension Development Host 起動。
- Copilot Chat で @tutor を選択。
- 通常質問、/next、/log、/review を順に実行。
- 合格基準:
- 応答冒頭に [L1] 〜 [L4] が付く。
- /log で件数と保存先が表示される。
- /review で review フォルダに Markdown が生成される。
- dogoTutor.generateReview / dogoTutor.openLogFolder が実行可能。

1. 公開準備

- package.json の publisher を実値に変更。
- package.json の repository.url を実URLに変更。
- README の配布手順の最終文言を確認。

1. 再パッケージ

- npm run compile
- npx vsce package
- 生成された .vsix で再インストール確認。

## 7. 参考コマンド

- npm install
- npm run compile
- npm run watch
- npx vsce package
- code --install-extension dogo-tutor-0.0.1.vsix --force

## 8. 引き継ぎ時の判断基準

- 公開前OK:
- compile 成功
- VSIX 生成成功
- 手動実行テスト合格
- publisher / repository が実値
- 追加対応が必要:
- @tutor 非表示
- /review 未生成
- Ollama接続エラーで実行不能(利用モデル設定未調整)
