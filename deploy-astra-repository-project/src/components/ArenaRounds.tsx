"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Loader2, MessagesSquare, Send } from "lucide-react";
import { subscribeAiStatus, type AiStatus } from "@/ai/client";
import { remainingBacklog, ROUND_KINDS, ROUND_LABELS, suggestNextKind, type ArenaRound, type RoundKind } from "@/ai/arena-rounds";
import type { ArenaSpec } from "@/ai/arena";
import type { ArenaScope } from "@/ai/targets";
import type { ModelConfig } from "@/lib/optimizer";

const KIND_HINTS: Record<RoundKind, string> = {
  fix: "把你在两边看到的问题写下来，左右可以混写；会整理成对两边都成立的「若出现…就修复」清单。不写就做一次整体排查。",
  polish: "统一间距与字号、悬停和焦点态、过渡动画与移动端细节；也可以补充你注意到的细节问题。",
  robust: "按应用类型检查边界情况：刷新恢复、快速连点、计时器清理、窗口缩放、极端输入等。",
  extend: "从待办里取下一两项功能加入；也可以直接写你想加的功能。",
};

const PLACEHOLDERS: Record<RoundKind, string> = {
  fix: "例如：左边暂停后无法继续；右边刷新后最高分丢失；两边手机上按钮都太小",
  polish: "可选，例如：两边按钮悬停都没反馈，标题字号太大",
  robust: "可选，例如：连续点两次开始会出现两条蛇",
  extend: "可选，例如：加入双人模式；留空则取待办里的下一项",
};

export default function ArenaRounds({ historyId, spec, scope, rounds, modelConfig, onChange }: {
  historyId?: number;
  spec: ArenaSpec;
  scope: ArenaScope;
  rounds: ArenaRound[];
  modelConfig: ModelConfig | null;
  onChange: (rounds: ArenaRound[]) => void;
}) {
  const suggested = suggestNextKind(spec, rounds, scope);
  const [kind, setKind] = useState<RoundKind>(suggested);
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>({ phase: "idle" });
  useEffect(() => subscribeAiStatus(setAiStatus), []);
  // After each new round, move the selection to the suggested next step.
  useEffect(() => { setKind(suggested); }, [rounds.length, suggested]);

  const backlog = useMemo(() => remainingBacklog(spec, rounds, scope), [spec, rounds, scope]);
  const added = useMemo(() => new Set(rounds.flatMap(round => round.added)), [rounds]);
  const nextIndex = rounds.length + 2;
  const nothingToAdd = kind === "extend" && !backlog.length && !observations.trim();

  const generate = async () => {
    if (!historyId || loading || nothingToAdd) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/arena/round", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyId, kind, observations, mode: modelConfig ? "ai" : "local", modelConfig: modelConfig || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成下一轮失败");
      onChange(data.rounds as ArenaRound[]);
      setObservations("");
    } catch (e) { setError(e instanceof Error ? e.message : "生成下一轮失败"); }
    finally { setLoading(false); }
  };

  const copy = async (round: ArenaRound) => {
    try { await navigator.clipboard.writeText(round.prompt); setCopied(round.index); window.setTimeout(() => setCopied(null), 2000); }
    catch { setError("复制失败，请展开后手动选择文本"); }
  };

  const busyText = aiStatus.phase === "waiting" ? `免费通道排队中，约 ${aiStatus.seconds} 秒` : "正在生成…";

  return (
    <section className="arena-rounds" aria-label="多轮迭代">
      <div className="arena-rounds-head">
        <strong><MessagesSquare size={15} /> 多轮迭代</strong>
        <small>在 Arena 里发完第 1 轮后，用这里生成后续每一轮。对战中一条消息会同时发给两个模型，所以问题都写成对两边都成立的检查清单，并附带「保持可用」回归项。</small>
      </div>

      {rounds.length > 0 && <ol className="arena-round-list">
        {rounds.map(round => (
          <li key={round.index}>
            <details>
              <summary>
                <span className="arena-round-title">第 {round.index} 轮 · {ROUND_LABELS[round.kind].zh}</span>
                {round.issues.length > 0 && <small>{round.issues.length} 个问题</small>}
                {round.added.length > 0 && <small>新增 {round.added.length} 项</small>}
                <ChevronDown size={14} />
                <button type="button" onClick={event => { event.preventDefault(); void copy(round); }}>{copied === round.index ? <Check size={13} /> : <Copy size={13} />}{copied === round.index ? "已复制" : "复制"}</button>
              </summary>
              <pre>{round.prompt}</pre>
            </details>
          </li>
        ))}
      </ol>}

      <div className="arena-round-composer">
        <div className="arena-round-kinds" role="radiogroup" aria-label="下一轮要做什么">
          {ROUND_KINDS.map(item => (
            <button type="button" key={item} role="radio" aria-checked={kind === item} className={kind === item ? "active" : ""} onClick={() => setKind(item)}>
              {ROUND_LABELS[item].zh}{item === suggested && <em>建议</em>}
            </button>
          ))}
        </div>
        <p className="arena-round-hint">{KIND_HINTS[kind]}</p>
        <textarea className="form-input" value={observations} onChange={event => setObservations(event.target.value)} placeholder={PLACEHOLDERS[kind]} maxLength={2000} rows={3} aria-label="你在两边看到的问题" />
        {kind === "extend" && <p className="arena-round-hint">{backlog.length ? `下一轮会加入：${backlog.slice(0, 2).join("；")}` : "待办已经全部加入；写下想加的功能即可。"}</p>}
        <div className="arena-round-actions">
          <button type="button" className="flow-small-action" onClick={() => void generate()} disabled={loading || !historyId || nothingToAdd}>
            {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}{loading ? busyText : `生成第 ${nextIndex} 轮提示词`}
          </button>
          {!historyId && <small>这条结果没有保存到历史，无法继续迭代，请重新生成首轮。</small>}
        </div>
        {error && <p className="flow-try-error">{error}</p>}
      </div>

      {scope === "core" && spec.backlog.length > 0 && <div className="arena-backlog">
        <strong>待办（首轮没做的功能）</strong>
        <ul>{spec.backlog.map(item => <li key={item} className={added.has(item) ? "done" : ""}>{added.has(item) ? <Check size={12} /> : <i />}{item}</li>)}</ul>
      </div>}
    </section>
  );
}
