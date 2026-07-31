# 開発メモ

README.md は Marketplace の紹介ページとしてそのまま表示されるため、利用者向けの
内容だけを書く。開発・配布に関する情報はこのファイルに置く(.vscodeignore で
配布物からは除外している)。設計方針の詳しい文書は HANDOFF_CLAUDE_CODE.md と、
公開前の README(git 履歴)を参照。

## 開発の手順

```bash
npm install
npm run compile
```

VS Code でこのフォルダを開き、F5 を押すと拡張開発ホストが起動する。
そちらのウィンドウでチャットを開き、`@tutor` と入力すれば動作を確認できる。

`npm run watch` を回しておくと、保存のたびに再コンパイルされる。
拡張ホスト側は Cmd+R で再読み込みする。

## Marketplace への公開

- 発行者: `k-jinma`
- 管理ページ: https://marketplace.visualstudio.com/manage/publishers/k-jinma

更新を公開するには:

```bash
npx vsce publish patch --allow-missing-repository   # バージョンを上げて公開
```

`--allow-missing-repository` は、リポジトリ非公開方針のため package.json に
repository フィールドを置いていないことによる確認を飛ばすためのもの。
README にソースへの相対リンクを書くと vsce がエラーで止まるので書かない。

### PAT(Personal Access Token)

- 期限: 2027-07-30。切れると publish が認証エラーになる。
- 再発行: dev.azure.com(組織 `k-jinma`)→ User settings →
  Personal access tokens。Organization は必ず **All accessible
  organizations**、Scopes は **Marketplace: Manage** のみ。
- 再発行後は `npx vsce login k-jinma` でトークンを貼り直す。

## .vsix での手動配布(学内配布・保険)

```bash
npx vsce package --allow-missing-repository   # dogo-tutor-x.y.z.vsix ができる
code --install-extension dogo-tutor-x.y.z.vsix
```

## アイコン

`icon.svg` が編集用の元データ。PNG の作り直しは Chrome のヘッドレスで行う
(qlmanage は角の透明部分を白で塗ってしまうので使わない):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --screenshot=icon.png \
  --default-background-color=00000000 --window-size=512,512 \
  "file://$PWD/icon.svg"
sips -z 128 128 icon.png --out publisher-logo-128.png
```

`publisher-logo-128.png` は Marketplace の発行者プロフィール用で、変更したら
manage ページから手動でアップロードし直す。
