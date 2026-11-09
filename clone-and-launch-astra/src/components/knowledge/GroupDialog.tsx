"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, FolderPlus, Pencil, Trash2 } from "lucide-react";
import Dialog from "@/components/knowledge/Dialog";
import { LIBRARIES } from "@/lib/knowledge-library";
import { PALETTES } from "@/lib/knowledge-palette";
import { MAX_GROUP_NAME, type KnowledgeGroupView } from "@/lib/knowledge-groups";

export type GroupDialogRequest =
  | { mode: "create"; library: string }
  | { mode: "rename"; group: KnowledgeGroupView }
  | { mode: "delete"; group: KnowledgeGroupView };

/**
 * One dialog for the whole group lifecycle: create, rename, delete.
 * Deleting a non-empty group never destroys knowledge — the entries are moved
 * to another group of the same 知识域 (or 通用).
 */
export default function GroupDialog({ request, entries, busy, onClose, onCreate, onRename, onDelete }: {
  request: GroupDialogRequest;
  entries: { id: number; name: string; category: string; isBuiltin?: boolean; library?: string }[];
  busy: boolean;
  onClose: () => void;
  onCreate: (draft: { name: string; library: string; accent: string }) => void;
  onRename: (name: string) => void;
  onDelete: (moveTo: string) => void;
}) {
  const group = request.mode === "create" ? null : request.group;
  const [name, setName] = useState(group?.name || "");
  const [library, setLibrary] = useState(request.mode === "create" ? request.library : group?.library || "center");
  const [accent, setAccent] = useState(group?.accent || PALETTES[0].colors.accent);
  const [moveTo, setMoveTo] = useState("通用");
  const [error, setError] = useState("");
  useEffect(() => { setError(""); }, [request]);

  const used = group
    ? entries.filter(item => !item.isBuiltin && (item.category || "通用") === group.name && (item.library || "center") === group.library).length
    : 0;
  const libraryName = LIBRARIES.find(item => item.id === library)?.name || "中心";
  const moveOptions = LIBRARIES.find(item => item.id === group?.library)?.categories || [];
  const existingNames = entries
    .filter(item => !item.isBuiltin && (item.category || "通用") !== (group?.name || ""))
    .map(item => item.category || "通用");
  const options = [...new Set([...moveOptions, ...existingNames, "通用"])].filter(Boolean);

  const submit = () => {
    const trimmed = name.trim();
    if (request.mode !== "delete" && !trimmed) { setError("请填写分组名称。"); return; }
    if (request.mode !== "delete" && trimmed.length > MAX_GROUP_NAME) { setError(`分组名称请控制在 ${MAX_GROUP_NAME} 字以内。`); return; }
    if (request.mode === "create") onCreate({ name: trimmed, library, accent });
    else if (request.mode === "rename") onRename(trimmed);
    else onDelete(moveTo);
  };

  const title = request.mode === "create" ? "新建分组" : request.mode === "rename" ? "重命名分组" : "删除分组";
  const subtitle = request.mode === "create"
    ? "分组是知识域下的第二层，可先建好空分组，再往里写知识。"
    : request.mode === "rename"
      ? "重命名后，分组内的知识会自动移到新名称下，内容不会丢失。"
      : used > 0
        ? "删除前请选择分组内知识的去向，知识本身不会被删除。"
        : "该分组暂时是空的，删除后不影响任何知识。";

  return <Dialog title={title} subtitle={subtitle} onClose={onClose} busy={busy}>
    <div className="kg-group-form">
      {request.mode === "delete" ? <>
        <div className="kg-group-delete-card"><AlertTriangle size={20} /><div><strong>{group?.name}</strong><p>{used > 0 ? `分组内有 ${used} 条知识，将移动到下方所选分组。` : "空分组，可直接删除。"}</p></div></div>
        {used > 0 && <label className="kg-field">移动到分组<select aria-label="移动到分组" value={moveTo} onChange={event => setMoveTo(event.target.value)}>
          <option value="通用">通用（不进入任何子分组）</option>
          {options.filter(option => option !== "通用" && option !== group?.name).map(option => <option key={option} value={option}>{option}</option>)}
        </select></label>}
      </> : <>
        <label className="kg-field">分组名称 <span>*</span>
          <input autoFocus value={name} maxLength={MAX_GROUP_NAME} placeholder="例如：验收标准" onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} />
          <small>{name.length} / {MAX_GROUP_NAME}</small>
        </label>
        {request.mode === "create" && <label className="kg-field">所属知识域<select aria-label="所属知识域" value={library} onChange={event => setLibrary(event.target.value)}>
          {LIBRARIES.map(item => <option key={item.id} value={item.id}>{item.name} · {item.tagline}</option>)}
        </select></label>}
        <div className="kg-field"><span>分组颜色</span></div>
        <div className="kg-swatches" role="radiogroup" aria-label="分组颜色">
          {PALETTES.map(palette => <button key={palette.id} type="button" role="radio" aria-checked={accent === palette.colors.accent} aria-label={palette.label} title={palette.label} className={`kg-swatch ${accent === palette.colors.accent ? "active" : ""}`} style={{ background: palette.colors.accent }} onClick={() => setAccent(palette.colors.accent)} />)}
        </div>
        <div className="kg-group-preview" aria-label="分组预览"><span className="kg-group-dot" style={{ background: accent }} /><span>{libraryName} / {name.trim() || "新分组"}</span><small>{request.mode === "rename" && used > 0 ? `${used} 条知识会跟随改名` : "保存后出现在左侧标签树"}</small></div>
      </>}
      {error && <p className="kg-form-error" role="alert">{error}</p>}
    </div>
    <footer className="kg-dialog-footer">
      <span className="kg-group-footer-hint">{request.mode === "delete" ? <><Trash2 size={13} />知识会保留</> : request.mode === "rename" ? <><Pencil size={13} />仅改分组名</> : <><FolderPlus size={13} />可创建空分组</>}</span>
      <div><button className="kg-button" onClick={onClose} disabled={busy}>取消</button><button className={`kg-button ${request.mode === "delete" ? "kg-danger" : "kg-primary"}`} onClick={submit} disabled={busy}>{busy ? "处理中…" : request.mode === "delete" ? "确认删除" : request.mode === "rename" ? "保存新名称" : "创建分组"}</button></div>
    </footer>
  </Dialog>;
}
