# dogo-tutor

*English summary is at the bottom of this page.*

答えではなくヒントだけを返す、コーディング学習のための AI チューターです。
詰まったところを質問すると、解き方そのものではなく「次の一手」を返します。
やり取りは学習の記録として残り、あとから復習ノートと確認テストを生成できます。

愛媛・松山道後にある人間環境大学 総合環境学部 環境情報学科の演習のために
作られましたが、プログラミング言語や科目を問わず使えます。

## 必要なもの

- Visual Studio Code(バージョン 1.95 以上)
- GitHub Copilot へのサインイン

チャットを開いたときにサインインを求められたら、画面の案内に従って
GitHub アカウントでサインインしてください。学生の方は GitHub の学生認定
(GitHub Student Developer Pack)で Copilot を無料で使えます。

## 使い方

1. 質問したいコードのファイルをエディタで開く
2. チャットを開く(サイドバーの吹き出しアイコン)
3. 入力欄に `@tutor` と打ち、続けて質問を書く

例:

```text
@tutor 入力した名前で検索したいのですが、実行しても結果が出ません
```

開いているファイルは自動でチューターに渡るので、コードを貼り付ける必要は
ありません。チューターは「12 行目の」のように行番号で場所を指します。

添えられたファイルは応答の上に参照として表示されます。**意図しないファイルが
出ている、あるいは何も出ていないときは、チューターはあなたのコードを見ずに
答えています。** 見せたいファイルをエディタで開き直してから質問してください。

## コマンド

| コマンド | はたらき |
| --- | --- |
| `@tutor /next` | 試したことを伝えて、次の段階のヒントをもらう |
| `@tutor /review` | 直近 24 時間のやり取りから復習ノートと小テストを生成する |
| `@tutor /log` | 記録されている件数と、深いヒントに頼った割合を表示する |

## ヒントの段階

チューターの答えは 4 段階に分かれていて、応答の冒頭に印が付きます。

| 段階 | 内容 |
| --- | --- |
| `[ヒント1｜問いの整理]` | 何が分からないのかをはっきりさせる |
| `[ヒント2｜方針]` | 進め方を日本語で示す |
| `[ヒント3｜組み立て]` | 擬似コードや手順まで示す |
| `[ヒント4｜部分コード]` | 数行の断片を示す(通常は無効) |

段階が上がるのは、**何を試して何が起きたかを自分の言葉で伝えたとき**だけです。
「わかりません」を繰り返しても答えには近づきません。試したこととその結果を
添えて `/next` を使ってください。

参考資料の URL は、実在を確認済みのものだけが案内されます。案内できる資料が
ない話題では、URL の代わりに検索するときの言葉が示されます。

## 復習ノートと小テスト

`@tutor /review` を実行すると、直近 24 時間のやり取りをもとに、つまずいた
論点をまとめた復習ノートと小テストが Markdown で生成されます。ワークスペースを
開いている場合は `review/` フォルダ(設定で変更可)に保存されます。

演習が終わった日にその日の分を生成して見直す、という使い方を想定しています。

## 記録について

`@tutor` とのやり取り(時刻・質問・応答・開いていたファイル名・ヒント段階)は、
学習の記録としてお使いの PC の中に保存されます。**PC の外には送信されません。**
件数は `@tutor /log` でいつでも確認できます。

## 教員向け: 科目ごとの設定

科目のワークスペースの `.vscode/settings.json` で挙動を調整できます。

| 設定 | 既定 | 説明 |
| --- | --- | --- |
| `dogoTutor.subject` | 空 | 科目名。復習ノートのファイル名と見出しに使われます |
| `dogoTutor.maxHintLevel` | 3 | 許可するヒントの最大段階。3 は擬似コードまで、4 は数行の部分コードまで |
| `dogoTutor.reviewOutputDir` | `review` | 復習ノートの出力先(ワークスペースからの相対パス) |
| `dogoTutor.references` | 空 | 科目ごとの参考資料。下記参照 |

チューターは登録済みの URL しか学生に案内しません(生成 AI が作る実在しない
URL を学生に踏ませないためです)。講義資料やシラバスを案内させたい場合は
次のように登録してください。**必ず実在する URL を入れてください。**

```json
{
  "dogoTutor.references": [
    {
      "label": "第5回講義資料 JDBC入門",
      "url": "https://lms.example.ac.jp/course/db2/week05.pdf",
      "topics": "接続文字列の書式と、演習用サーバの接続先"
    }
  ]
}
```

`topics` には「どんなときに見る資料か」を書いてください。チューターが案内先を
選ぶ判断材料になります。

組み込みの参考資料として、Java API 日本語版、JDBC チュートリアル、
Oracle JDBC 開発者ガイド、dev.java、Python ドキュメント日本語版、
MDN 日本語版が登録されています。

学生は普通のチャットもそのまま使えるため、これは強制ではなく自習の枠組みです。
`/log` の「深いヒントに頼った割合」のような指標を学生自身に見せて、理解の
浅い論点に気づかせる使い方を想定しています。

## English

dogo-tutor is a chat-based AI tutor for coding exercises that gives
**hints instead of answers**. It was built for the Department of
Environmental Information, Faculty of Environmental Studies, University of
Human Environments (Matsuyama, Japan), and works with any programming
language.

- Ask `@tutor` in the chat view. The file you have open in the editor is
  attached automatically, and the tutor refers to it by line number.
- Hints are staged in four levels, from clarifying the question up to
  pseudocode. Deeper hints are unlocked only when you describe what you
  tried and what happened (`/next`).
- `/review` generates a Markdown review note and a short quiz from the
  last 24 hours of your conversation. `/log` shows how often you relied
  on deep hints.
- Only URLs from a verified reference list are suggested, so the tutor
  never sends you to a hallucinated link. Instructors can register course
  materials via the `dogoTutor.references` setting.
- Requires a GitHub Copilot sign-in. All conversation logs stay on your
  machine and are never sent anywhere.

Note: the tutor currently responds in **Japanese**.
