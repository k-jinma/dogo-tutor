import * as vscode from "vscode";
import { buildSystemPrompt, Reference } from "./prompt";
import { initLogger, append, extractLevel, readAll, getLogUri, filterRecent } from "./logger";
import { generateReview, deepHintRatio } from "./review";

const SESSION = new Date().toISOString();

/** 直前までのやり取りをモデルに渡す形に変換する */
function toHistory(ctx: vscode.ChatContext): vscode.LanguageModelChatMessage[] {
  const out: vscode.LanguageModelChatMessage[] = [];
  for (const turn of ctx.history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      out.push(vscode.LanguageModelChatMessage.User(turn.prompt));
    } else if (turn instanceof vscode.ChatResponseTurn) {
      const text = turn.response
        .filter((p): p is vscode.ChatResponseMarkdownPart => "value" in p)
        .map((p) => p.value.value)
        .join("");
      if (text) {
        out.push(vscode.LanguageModelChatMessage.Assistant(text));
      }
    }
  }
  return out.slice(-20);
}

/** これ以下の行数なら全文を渡す。演習用のファイルはたいてい収まる */
const WHOLE_FILE_MAX_LINES = 400;
/** 全文が入らないときに、カーソルの前後へ取る行数 */
const WINDOW = 40;

/**
 * チャット入力欄にフォーカスがあると activeTextEditor が外れることがあり、
 * その状態を放置するとコードを一行も見ないまま一般論を答えてしまう。
 * 見えているエディタまで探し、実ファイルのものだけを拾う。
 */
function pickEditor(): vscode.TextEditor | undefined {
  const active = vscode.window.activeTextEditor;
  if (active?.document.uri.scheme === "file") {
    return active;
  }
  return vscode.window.visibleTextEditors.find((e) => e.document.uri.scheme === "file");
}

interface CodeContext {
  uri: vscode.Uri;
  file: string;
  /** 行番号つきの本文。チューターが「12行目の」と指せるようにする */
  snippet: string;
  whole: boolean;
}

/** 学生がいま開いているファイル。短ければ全文、長ければカーソル周辺を添える */
function currentContext(): CodeContext | null {
  const ed = pickEditor();
  if (!ed) {
    return null;
  }
  const doc = ed.document;
  const whole = doc.lineCount <= WHOLE_FILE_MAX_LINES;
  const from = whole ? 0 : Math.max(0, ed.selection.active.line - WINDOW);
  const to = whole
    ? doc.lineCount - 1
    : Math.min(doc.lineCount - 1, ed.selection.active.line + WINDOW);

  const width = String(to + 1).length;
  const lines: string[] = [];
  for (let i = from; i <= to; i++) {
    lines.push(`${String(i + 1).padStart(width)}| ${doc.lineAt(i).text}`);
  }

  return {
    uri: doc.uri,
    file: vscode.workspace.asRelativePath(doc.uri),
    snippet: lines.join("\n"),
    whole,
  };
}

/**
 * これ以下の長さの発話は「一言」とみなし、応答も短く返させる。
 * 「ENAMEです」「できました」に方針や完了条件が付いてくると、くどくて読まれなくなる。
 *
 * かつては「具体的な報告が無ければ段階を1に下げる」という判定も併せて入れていたが、
 * 「input で ename を検索したい」のような具体的で正当な質問まで問いの整理に
 * 突き落としてしまい、作文課題を出す原因になったので撤去した。
 * 段階の判断はモデルに委ねる。
 */
const SHORT_UTTERANCE = 12;

export async function activate(context: vscode.ExtensionContext) {
  await initLogger(context);

  const handler: vscode.ChatRequestHandler = async (request, chatCtx, stream, token) => {
    const cfg = vscode.workspace.getConfiguration("dogoTutor");
    const subject = cfg.get<string>("subject", "");
    const maxLevel = cfg.get<number>("maxHintLevel", 3);
    // 教員が科目資料を足せる。url が無いものはモデルに渡さない（捏造URLと区別できないため）
    const extraRefs = cfg
      .get<Reference[]>("references", [])
      .filter((r) => r && typeof r.url === "string" && /^https?:\/\//.test(r.url))
      .map((r) => ({ label: r.label || r.url, url: r.url, topics: r.topics || "" }));

    // /review と /log は問い合わせを送らずに処理する
    if (request.command === "review") {
      stream.progress("学習ログから復習ノートを作っています…");
      const uri = await generateReview(token);
      if (uri) {
        stream.markdown(`復習ノートを作成しました: \`${vscode.workspace.asRelativePath(uri)}\``);
        stream.button({ command: "vscode.open", title: "開く", arguments: [uri] });
      }
      return {};
    }
    if (request.command === "log") {
      const all = await readAll();
      const today = filterRecent(all);
      stream.markdown(
        `記録件数: 全体 ${all.length} 件 / 直近24時間 ${today.length} 件\n\n` +
          `深いヒント(ヒント3「組み立て」以上)に頼った割合: ${(deepHintRatio(today) * 100).toFixed(0)}%\n\n` +
          `保存先: \`${getLogUri().fsPath}\``
      );
      return {};
    }

    const code = currentContext();
    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(buildSystemPrompt(subject, maxLevel, extraRefs)),
      ...toHistory(chatCtx),
    ];
    if (code) {
      // 何を見て答えたのかを学生にも見せる。的外れなヒントの原因に気づけるようにする
      stream.reference(code.uri);
      const scope = code.whole ? "全文" : "カーソル周辺";
      messages.push(
        vscode.LanguageModelChatMessage.User(
          `学生がいま開いているファイル ${code.file} の${scope}です。行頭の数字は行番号で、` +
            `ファイルの中身ではありません。指摘するときはこの行番号で指してください。\n\n` +
            `\`\`\`\n${code.snippet}\n\`\`\``
        )
      );
    } else {
      messages.push(
        vscode.LanguageModelChatMessage.User(
          "学生のコードは取得できていません。エディタが開かれていないためです。" +
            "コードがある前提で話さず、いまのコードを見せてほしいと頼んでください。"
        )
      );
    }
    // 一般則だけでは守られないので、この回に効かせたいことはその都度明示する
    const notes: string[] = [];
    if (request.prompt.trim().length <= SHORT_UTTERANCE) {
      notes.push(
        `今回の発話はごく短い。応答も短くすること。1〜2文で返し、` +
          `方針の宣言・完了条件・箇条書きを書かないこと。`
      );
    }
    if (notes.length > 0) {
      messages.push(
        vscode.LanguageModelChatMessage.User("この回についての注意:\n- " + notes.join("\n- "))
      );
    }
    messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

    let answer = "";
    try {
      const res = await request.model.sendRequest(messages, {}, token);
      for await (const fragment of res.text) {
        answer += fragment;
        stream.markdown(fragment);
      }
    } catch (err) {
      if (err instanceof vscode.LanguageModelError) {
        stream.markdown(
          `\n\nモデルを呼び出せませんでした (${err.code})。Copilot にサインインしているか、利用上限に達していないか確認してください。`
        );
        return {};
      }
      throw err;
    }

    await append({
      ts: new Date().toISOString(),
      session: SESSION,
      subject,
      level: extractLevel(answer),
      workspace: vscode.workspace.workspaceFolders?.[0]?.name ?? "",
      file: code?.file ?? null,
      prompt: request.prompt,
      answer,
    });

    stream.button({ command: "dogoTutor.generateReview", title: "今日の復習ノートを作る" });
    return {};
  };

  const tutor = vscode.chat.createChatParticipant("dogo.tutor", handler);
  tutor.iconPath = new vscode.ThemeIcon("mortar-board");
  tutor.followupProvider = {
    provideFollowups() {
      return [
        { prompt: "ここまで試したことを説明します", label: "試したことを伝えて次のヒントへ" },
        { prompt: "この考え方で合っていますか", label: "方針を確認する" },
      ];
    },
  };
  context.subscriptions.push(tutor);

  context.subscriptions.push(
    vscode.commands.registerCommand("dogoTutor.generateReview", async () => {
      const src = new vscode.CancellationTokenSource();
      const uri = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "復習ノートを生成中…" },
        () => generateReview(src.token)
      );
      if (uri) {
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
      }
    }),
    vscode.commands.registerCommand("dogoTutor.openLogFolder", async () => {
      await vscode.commands.executeCommand("revealFileInOS", getLogUri());
    })
  );
}

export function deactivate() {}
