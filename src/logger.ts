import * as vscode from "vscode";

export interface LogEntry {
  ts: string;
  session: string;
  subject: string;
  level: number | null; // 応答冒頭の [ヒントx｜…] から抽出
  workspace: string;
  file: string | null; // 質問時に開いていたファイル
  prompt: string;
  answer: string;
}

let logUri: vscode.Uri | undefined;

export async function initLogger(ctx: vscode.ExtensionContext): Promise<void> {
  await vscode.workspace.fs.createDirectory(ctx.globalStorageUri);
  logUri = vscode.Uri.joinPath(ctx.globalStorageUri, "tutor-log.jsonl");
  try {
    await vscode.workspace.fs.stat(logUri);
  } catch {
    await vscode.workspace.fs.writeFile(logUri, new Uint8Array());
  }
}

export function getLogUri(): vscode.Uri {
  if (!logUri) {
    throw new Error("logger is not initialized");
  }
  return logUri;
}

/**
 * 応答冒頭の [ヒント2｜方針] のような印から段階を取り出す。
 * NFKC で正規化してから見るので、全角の ［ヒント２｜…］ や半角カナでも拾える。
 * 旧表記の [L2] も引き続き受け付ける。
 */
export function extractLevel(answer: string): number | null {
  const m = answer.normalize("NFKC").match(/\[\s*(?:ヒント|L)\s*([1-4])/);
  return m ? Number(m[1]) : null;
}

export async function append(entry: LogEntry): Promise<void> {
  const uri = getLogUri();
  const prev = await vscode.workspace.fs.readFile(uri);
  const line = new TextEncoder().encode(JSON.stringify(entry) + "\n");
  const next = new Uint8Array(prev.length + line.length);
  next.set(prev, 0);
  next.set(line, prev.length);
  await vscode.workspace.fs.writeFile(uri, next);
}

export async function readAll(): Promise<LogEntry[]> {
  const buf = await vscode.workspace.fs.readFile(getLogUri());
  return new TextDecoder()
    .decode(buf)
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is LogEntry => e !== null);
}

/** 今日ぶんだけ、または直近 n 件 */
export function filterRecent(entries: LogEntry[], sinceHours = 24): LogEntry[] {
  const cutoff = Date.now() - sinceHours * 3600 * 1000;
  return entries.filter((e) => Date.parse(e.ts) >= cutoff);
}
