# Technical Specification: 完整 v5 原生適配

> **Doc class**: Lifecycle — Phase 2
> **Created**: 2026-10-03
> **Status**: In Progress

範圍以 [requirements](1-requirements.md) 的 2026-10-03 擴充為準。保留既有 86 個入口與 95 個 canonical migration units 的 owner；新增能力優先使用既有 owner 的 mode/reference，確實無合適入口才增加 curated skill。來源只讀，來源 inventory 與目標 delivery ledger 分開。

## 執行批次與責任

1. Repository tools：固定來源 inventory、CLI capability successor、分載體載入報表與可觀察讀取 evidence。靜態字元不是 tokens，成功讀取不是模型理解。
2. Runtime：必要契約 locator/read failure、Anchor-first Git 設定與 offer 決策。事件轉接留在 hook，狀態只由 state owner 改動。
3. Skill workflow：scope/stall、test/doc/override 契約；Git goal/stack/deploy 原生適配。每次 mutation 前重新驗證操作、目標、payload 與既有授權。
4. Delivery：focused tests → configured read-only primary → deterministic verify（完整 npm run check）→ canonical closure/promotion → 新 fingerprint gates。最後依 reload matrix 重新載入並觀察新 session。

## 驗證原則

測試直接 import distributable implementation。只用隔離 repository/fixture 驗證 commit/merge/run/remote races；不使用本 repo 或外部環境實際發布。讀取觀察至少區分 missing、unreadable、wrong-version、partial、success；模型自行列出的 evidence paths 不作成功讀取證據。Session 載入未知內容與 token attribution 報 unknown。不得用 source canary 當 Codex 實測。

平台差異只排除具體 transport：Claude hook payload、TTY approval protocol、fallback reviewer 的 gate authority。對應使用 Codex lifecycle、既有授權延續、configured primary。Source 50,000 字元上限與 Claude 模型推薦不套用本專案；Codex 預算從同口徑量測建立。

## 執行 request

- [完整 v5 原生升級](requests/2026-10-03-complete-v5-native-alignment.md)

## 續接

2026-10-03 初始 doctor ok，SessionStart 已啟用，CLI transport ready，review context available。本次 host 0.160.0；shell PATH 的 codex 為 0.156.1，檢查需前置本專案 `packages/standalone/releases/0.160.0-aarch64-apple-darwin/bin`。Canonical alias probe 已真實執行成功並建立 successor；既有 22 技能／23 模式變更保留。


### 2026-10-03 批次續接紀錄

第一批 fingerprint `ebdea9023455073ceb6eb0d98fec504cbf304c650e5d87b5f7e3426aeadac0be` 的 configured primary（round `97f80683-cbec-49a8-a9f0-f9297998b694`）正式 pass。隨後 deterministic verifier 實際執行完整 npm run check：1207 pass／1 fail／3 skip；失敗是新版 alias owner 缺少四個既有摘要欄位，已補齊且 R4 focused regression pass。該 fingerprint 的 verify **fail**，不得引用成通過。完整輸出暫存 `/tmp/sd0x-v5-batch1-verify.json`。

第二批實作見 coverage 的候選列表。Canonical restage 保留三個 target 的完整 accepted bytes，後續 owners/preflight/move/closure 由 `.sd0x/v5-native-delivery/integrate.cjs` 與 canonical scripts 處理；此前 `.sd0x/autonomous-skill-delivery` 的 22/23 delivery 不修改。新 driver 保留 previous owner hash 與 previous promotion record。當 preflight 正在執行時，不得同時編輯 worktree，否則 source-identity transaction 會正確拒絕；這是當前幾次 retry 的原因，非 gate 降級理由。

新的 description 以 scripts/skill-discovery-catalog.json 為 owner 同步；prose-only native mutation 以既有 sensitive-operations 宣告機制擴充閉集，不捏造 shell placeholders，且新增漏宣告 push/history-rewrite 負例。SKILL entrypoints 與新 payload 尚待完整 overlay reload；目前 source 生效不代表 install/Session registry 生效。

## 擴充實作續接（2026-10-03）

Native runtime 新增 doc-metadata/doc-classifier/feature-docs、manifest-map、readonly-proof 與 reference-stability。來源 portable 演算法保留 MIT notice，platform root 被固定 native payload 取代；Git enumeration 使用 closed env、禁止 fsmonitor、timeout，失敗不降為 empty。Feature context 保留既有 canonical_docs 两個 string/null 欄位與 request item schema，新增角色集合與 intent，並保留 stricter symlink refusal。

Readonly proof 不執行 repository helper，不持久化 baseline；排除僅限 dependency directories、repository-local Codex host home、Git object store 和 runtime-owned metadata。排除是觀察限制，不是 worker 可寫授權。新 runtime 的 manifest-bound contracts 與所有候選 skill consumer 必須在最終 overlay rebuild／new task 後分別核對 source/install/session。

目前 `.sd0x/v5-native-delivery/units.json` 已擴為 30 targets／38 units。canonical restage/preflight/owners/move/audit 與 closure 尚在進行；不以舊 batch1 review pass 取代本 fingerprint。獨立調查確認並修正 intent key grammar、split path round-trip、canonical 階層、Git EIO unknown、manifest exports、URL credentials、fsmonitor、locale 及 whitespace script fallback。沒有執行外部 Stack/PR/push/deploy。

### Git hook 原生等價與額外意見

Git hooks 由獨立 git-hooks runtime 負責，native runner 提供 install/doctor/remove-push actions。狀態只在 Git metadata；不混入受保護 review/verify ledger。Husky 僅修改完整可驗證 owned block，保留其餘 bytes；pre-push 的一次性 stdin 被保留交回 downstream。Default message guard 非互動拒絕 attribution；明確選用的 push gate 顯示精確 ref/OID 與 digest，protected/history-changing update 沒有非互動旁路。Doctor 靜態路由與实际執行觀察分層，不把 fallback 寫檔當作 installed。外部 hooksPath 保留 owner 邊界。

branch dual 與 debug confirmation 都以 fresh read-only Codex context 提供額外意見，继承 parent settings 且不提供原分析結論。預設 required gate 仍只接受 configured primary 的 authenticated terminal evidence。
