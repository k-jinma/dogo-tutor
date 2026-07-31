import * as vscode from "vscode";
import { REVIEW_PROMPT, levelTag } from "./prompt";
import { LogEntry, readAll, filterRecent } from "./logger";

function render(entries: LogEntry[]): string {
  return entries
    .map(
      (e, i) =>
        `--- ${i + 1} (${e.ts}, ${e.level ? levelTag(e.level) : "段階不明"}, ${e.file ?? "no file"})\n` +
        `学生: ${e.prompt}\nチューター: ${e.answer}`
    )
    .join("\n\n");
}

/** ヒント3 以上まで行った＝理解が浅かった論点の目安 */
export function deepHintRatio(entries: LogEntry[]): number {
  const withLevel = entries.filter((e) => e.level !== null);
  if (withLevel.length === 0) {
    return 0;
  }
  return withLevel.filter((e) => (e.level ?? 0) >= 3).length / withLevel.length;
}

/** Copilot のモデルを取得する。見つからなければ GitHub サインインへ誘導し、成功後に取り直す */
async function pickModel(): Promise<vscode.LanguageModelChat | undefined> {
  let [model] = await vscode.lm.selectChatModels({ vendor: "copilot" });
  if (model) {
    return model;
  }

  const signIn = "GitHub にサインイン";
  const choice = await vscode.window.showErrorMessage(
    "利用できる言語モデルがありません。GitHub Copilot へのサインインが必要です。",
    signIn
  );
  if (choice !== signIn) {
    return;
  }

  try {
    await vscode.authentication.getSession("github", [], { createIfNone: true });
  } catch {
    return; // サインインがキャンセルされた
  }

  // サインイン直後は Copilot 側の準備が終わるまでモデルが見えないことがあるので、少し待ちながら取り直す
  for (let i = 0; i < 10 && !model; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    [model] = await vscode.lm.selectChatModels({ vendor: "copilot" });
  }
  if (!model) {
    vscode.window.showErrorMessage(
      "サインイン後もモデルを取得できませんでした。GitHub Copilot が利用できるアカウントか確認してください。"
    );
  }
  return model;
}

export async function generateReview(
  token: vscode.CancellationToken,
  onFragment?: (s: string) => void
): Promise<vscode.Uri | undefined> {
  const cfg = vscode.workspace.getConfiguration("dogoTutor");
  const subject = cfg.get<string>("subject", "");
  const outDir = cfg.get<string>("reviewOutputDir", "review");

  const entries = filterRecent(await readAll());
  if (entries.length === 0) {
    vscode.window.showInformationMessage(
      "直近24時間の学習ログがありません。@tutor に質問してから実行してください。"
    );
    return;
  }

  const model = await pickModel();
  if (!model) {
    return;
  }

  const messages = [
    vscode.LanguageModelChatMessage.User(REVIEW_PROMPT),
    vscode.LanguageModelChatMessage.User(
      `科目: ${subject || "未設定"}\n深いヒントに頼った割合: ${(deepHintRatio(entries) * 100).toFixed(0)}%\n\n${render(entries)}`
    ),
  ];

  let md = "";
  try {
    const res = await model.sendRequest(messages, {}, token);
    for await (const f of res.text) {
      md += f;
      onFragment?.(f);
    }
  } catch (err) {
    if (err instanceof vscode.LanguageModelError) {
      vscode.window.showErrorMessage(`モデル呼び出しに失敗しました: ${err.message} (${err.code})`);
      return;
    }
    throw err;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
    await vscode.window.showTextDocument(doc);
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const name = subject ? `${date}-${subject}.md` : `${date}.md`;
  const dest = vscode.Uri.joinPath(folder.uri, outDir, name);
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, outDir));
  await vscode.workspace.fs.writeFile(dest, new TextEncoder().encode(md));
  return dest;
}
