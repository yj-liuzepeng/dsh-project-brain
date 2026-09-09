# 5 分钟人工验收操作清单（USER_VERIFICATION）

> 当前状态：**39/39 自动化验收全过 + 0 个 DSH Desktop UI bug 已知**
> 待你做的：AC-12（DSH Web/Desktop Dashboard 实际渲染） + AC-13（非 Web profile 兼容性）
> 预估时间：**5 分钟**

## 前置检查（30 秒）

```bash
# 1. 确认本地 src/ 修改已编译进 lib/
node scripts/dev-reload.mjs
# 或：npm run dev:reload
```

脚本会自动：
1. 跑 `node build.js` → 生成 `dsh-project-brain/lib/{index.js,client.js}`
2. 检查 bundle 大小
3. 检测 DSH Desktop 进程状态

如果 DSH Desktop 在跑（PID 输出有显示），需要**手动重启 DSH Desktop**（cordis-loader 静态 fiber 限制）。

## AC-12：DSH Desktop 真实环境验证（4 分钟）

### 步骤 1：完全退出 DSH Desktop（10 秒）

- 看任务栏右下角 DSH 图标 → **右键 → Quit**（**不要只关窗口**）
- 或：任务管理器 → 结束所有 "DSH Desktop" 进程（应该有 5-6 个）

### 步骤 2：重新启动 DSH Desktop（30 秒）

- 双击桌面图标
- 等待主窗口加载（看到侧边栏 / 输入框 = 已加载完成）
- **首次启动时观察 DSH 终端窗口**（如果有），应该看到一行：
  ```
  [dsh-project-brain] host loaded (runtime RPC, tools registered: 14)
  ```
  说明 14 个工具注册成功 → 通过 ✓

### 步骤 3：打开一个 workspace（30 秒）

- 顶部菜单 → **Open Folder**（或对应中文）
- 选任意一个**已存在的**项目目录（例如 `C:\Users\liuzp16\Desktop\liuzp\plugins\data-analyst-agent`）
- **不要**用 DSH Desktop 自己的安装目录（`AppData\Local\Programs\DSH Desktop\`）—— 那是被沙箱拒绝的

### 步骤 4：启动项目大脑（30 秒）

- 左侧导航 → 找 **「项目」Tab**
- 点击 **「启动项目大脑」按钮**
- 预期效果：
  - 按钮变转圈（CSS conic-gradient）
  - 底部出现 3 阶段步骤条：扫描项目结构 → 写入项目大脑 → 分析技术栈与依赖
  - 完成后 Dashboard 自动展示

**如果失败**：
- 看 DSH Desktop 终端窗口输出，找 `[dsh-project-brain]` 开头的错误信息
- 或：右键 DSH 托盘 → "Open Log Folder" 看最新日志

### 步骤 5：检查 4 个 Dashboard Tab（1 分钟）

顶部 Tab 切换（中文界面，应该是 "概览 / 架构 / 任务动态 / 项目记忆"）：

| Tab | 检查项 |
|---|---|
| **概览** | 项目名 + 技术栈 chip + 4 Quick Actions（重新扫描 / 列出待办 / 整理记忆 / 项目全景）+ 状态统计 |
| **架构** | 分层架构图（蓝色卡片）+ 点击组件展开责任/协作/证据文件 |
| **任务动态** | timeline 事件列表（最近 5 条，含日期 + 事件名） |
| **项目记忆** | memory 卡片列表（按 importance 排序，前 3 条） |

### 步骤 6：检查 TodoStrip（30 秒）

- 在 DSH 主输入框（composer）上方看 **TodoStrip**
- 第一次启动时应该是空的（没 todo）→ 不显示 strip
- 手动调用 `project_todo_add` 加几条 → strip 出现，默认折叠（只有 header）
- 点 header 展开/折叠
- 点 × 关闭 → strip 消失，留 mini-chip `📋 · n 查看全部`

### 步骤 7：新建 Session 验证自动注入（30 秒）

- 顶部 → "New Session"（新建会话）
- 输入框随便问一句：「这个项目用的是什么？」
- 看 LLM 回答时是否引用了：
  - 项目名
  - 关键 memory（如 "采用 Express"）
  - 活跃 TODO 标题
- 如果引用了 → **AC-5（自动注入）+ AC-12（实际 UI）全过**

---

## AC-13：非 Web profile 兼容性（1 分钟）

> **结论先行**：DSH Desktop 0.1.1-rc.2 当前**只支持 `desktop` 和 `web` 两个 profile**，**没有 `cli` / `tui` profile**（已探测确认）。

如果你想进一步确认：

```bash
# 列出 DSH Desktop 当前支持的所有 profile
dsh --help | grep -i profile

# 完整 config dump
dsh --dump-default-config | head -30
```

输出只有 `web` 和 `headless`（headless 不是交互式 profile）。

**AC-13 处理结果**：
- 当前版本：**AC-13 不适用**（DSH Desktop 0.1.1-rc.2 无 cli/tui profile）
- 后续行动：当 DSH Desktop 添加 cli/tui profile 后再补做 Host 工具兼容性测试
- 在 `ACCEPTANCE.md` 标记为：⚠️ 待 DSH profile 扩展后验证

---

## 完成后的反馈模板

如果全过：
```
✅ AC-12 全过：4 Tab 渲染正常，Quick Action 转圈工作，TodoStrip 折叠/展开 ok，
   新 Session 自动注入含项目名+关键 memory+活跃 TODO
✅ AC-13 已知：DSH Desktop 0.1.1-rc.2 无 cli/tui profile，标记为"待 profile 扩展"
```

如果有 bug：
```
❌ AC-12 部分失败：
  - 启动按钮无反应
  - Dashboard 4 Tab 切到第 3 个崩溃
  - Quick Action 点 "整理记忆" 没转圈
  - TodoStrip 不显示
  - 新 Session 回答不含项目名
DSH 终端日志：[粘贴最后 20 行]
```

---

## 配套命令

```bash
# 一键 build + 检查 DSH 进程
npm run dev:reload

# 单跑某个 smoke
npm run test:acceptance   # 39/39 自动化验收
npm test                  # 16/16 smoke

# 发布前自检
npm run verify:release
npm run verify:install
```
