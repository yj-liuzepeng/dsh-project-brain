// rpc-payload.js — Dashboard 导入/回滚预览的扁平 RPC 载荷
//
// DSH Connection 的 schemastery 可能丢掉嵌套对象（impact / manifest / sourceBackup）。
// 因此把 UI 需要的字段全部摊成顶层原始类型，并保留一份嵌套结构给能收到的客户端。

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v) {
  return v == null ? "" : String(v);
}

export function shapeImportPreviewData(preview, bundlePath, confirmToken) {
  const current = (preview && preview.currentBrain) || {};
  const incoming = (preview && preview.incoming) || {};
  const rewrite = (preview && preview.rootPathRewrite) || {};
  const manifest = (preview && preview.manifest) || {};
  const sourceProject = manifest.sourceProject || {};
  const currentExists = !!current.exists;
  const backupWillCreateAt = str(preview && preview.backupWillCreateAt);
  const sourceProjectRoot = str(sourceProject.rootPath || sourceProject.name);
  const rootPathFrom = str(rewrite.from);
  const rootPathTo = str(rewrite.to);
  const warning = currentExists
    ? "导入将覆盖当前脑，旧脑会自动备份到 " + (backupWillCreateAt || "本地备份目录")
    : "这是该项目首次导入，无旧脑可备份。";

  const impact = {
    currentBrainExists: currentExists,
    currentProjectId: str(current.projectId),
    currentMemories: num(current.memCount),
    currentTodos: num(current.todoCount),
    currentTimeline: num(current.timelineCount),
    currentArchitecture: !!current.archExists,
    incomingMemories: num(incoming.memCount),
    incomingTodos: num(incoming.todoCount),
    incomingTimeline: num(incoming.timelineCount),
    incomingProjectId: str(incoming.projectId),
    backupWillCreateAt,
    rootPathFrom,
    rootPathTo,
  };

  return {
    mode: "preview",
    bundlePath: str(bundlePath),
    confirmToken: str(confirmToken),
    sourceProjectRoot,
    warning,
    currentBrainExists: impact.currentBrainExists,
    currentProjectId: impact.currentProjectId,
    currentMemories: impact.currentMemories,
    currentTodos: impact.currentTodos,
    currentTimeline: impact.currentTimeline,
    currentArchitecture: impact.currentArchitecture,
    incomingMemories: impact.incomingMemories,
    incomingTodos: impact.incomingTodos,
    incomingTimeline: impact.incomingTimeline,
    incomingProjectId: impact.incomingProjectId,
    backupWillCreateAt,
    rootPathFrom,
    rootPathTo,
    manifest: {
      schemaVersion: str(manifest.schemaVersion),
      pluginVersion: str(manifest.pluginVersion),
      exportedAt: str(manifest.exportedAt),
      sourceProjectRoot,
    },
    impact,
  };
}

export function shapeRollbackPreviewData(preview, backupTimestamp, confirmToken) {
  const source = (preview && preview.sourceBackup) || {};
  const current = (preview && preview.currentBrain) || {};
  const currentExists = !!current.exists;
  const willBackupCurrentTo = str(preview && preview.willBackupCurrentTo);
  const warning = currentExists
    ? "回滚前会先把当前脑备份到 " + (willBackupCurrentTo || "本地备份目录") + "，可继续回滚。"
    : "当前脑不存在，回滚后会成为当前脑。";

  return {
    mode: "preview",
    confirmToken: str(confirmToken),
    backupTimestamp: str(backupTimestamp),
    sourceBackupName: str(source.backupName),
    sourceBackupTs: str(source.ts || backupTimestamp),
    sourceMemCount: num(source.memCount),
    sourceTodoCount: num(source.todoCount),
    sourceTimelineCount: num(source.timelineCount),
    currentBrainExists: currentExists,
    currentMemories: num(current.memCount),
    currentTodos: num(current.todoCount),
    currentTimeline: num(current.timelineCount),
    willBackupCurrentTo,
    warning,
    sourceBackup: {
      ts: str(source.ts || backupTimestamp),
      backupName: str(source.backupName),
      backupPath: str(source.backupPath),
      memCount: num(source.memCount),
      todoCount: num(source.todoCount),
      timelineCount: num(source.timelineCount),
    },
    currentBrain: {
      exists: currentExists,
      memCount: num(current.memCount),
      todoCount: num(current.todoCount),
      timelineCount: num(current.timelineCount),
    },
  };
}
