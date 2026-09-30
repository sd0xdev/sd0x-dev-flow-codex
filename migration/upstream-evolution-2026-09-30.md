# 來源更新盤點與跟進順序（2026-09-30）

本次盤點 `sd0x-harness` v4.6.2 → v5.0.0。建議先補 **Codex 原生載入量測與契約可達性驗證**，再依需求擴充 Git 工作流。v5 的按需載入方向與本專案既有設計一致；來源新增技能、授權方式與 gate 政策則須各自判斷。本文件是候選工作清單，沒有交付下列 runtime／skill 變更。

## 1. 固定比較基準

| 項目 | 本次證據 |
|---|---|
| 來源 repository | `../sd0x-harness`，remote `git@github.com:sd0xdev/sd0x-harness.git` |
| 已執行更新 | `git -C ../sd0x-harness fetch origin` 成功；`HEAD...origin/main` 的 ahead／behind 都為 0，無需移動本機分支 |
| 來源最新盤點 | `7805e98510943f45e57f9856966172401cff0c40`，v5.0.0，最後 commit 日期 2026-09-26；worktree clean |
| 前次盤點 | `04e8a5e3f5d9c482937c2ad2170fab5fbd02b630`，v4.6.2，已確認是新 HEAD 的 ancestor |
| Codex 目標起點 | `ef87084bb820cfd036b1537e685b436ea339d860`，v0.5.3；盤點前 worktree clean |
| 差異規模 | 34 commits（32 個非 merge commits）；164 files，13,506 insertions、1,575 deletions |
| 技能變化 | 來源頂層 `skills/*/SKILL.md` 99 → 101；17 個既有入口修改，新增 `gh-stack` 與 `deploy-flow`。Codex 正式 payload 仍為 86 skills |

保留[前次盤點](upstream-evolution-2026-09-05.md)及兩份 JSON 快照。歷史 `source-inventory.generated.json`、100-row disposition、owner／promotion evidence 不是本次 34 commits 的交付清單，不更新它們來表示「已跟上」。

重現比較（用固定 OID，不依賴日後移動的 branch）：

```sh
git -C ../sd0x-harness log --reverse --format='%H %as %s' 04e8a5e3f5d9c482937c2ad2170fab5fbd02b630..7805e98510943f45e57f9856966172401cff0c40
git -C ../sd0x-harness diff --stat 04e8a5e3f5d9c482937c2ad2170fab5fbd02b630..7805e98510943f45e57f9856966172401cff0c40
git -C ../sd0x-harness diff --name-status 04e8a5e3f5d9c482937c2ad2170fab5fbd02b630..7805e98510943f45e57f9856966172401cff0c40
```

## 2. 值得跟進的變化

下表的「已有」表示目前檔案可證明的等價能力，並非聲稱移植了來源 commit；「候選」尚未實作或驗收。

| 來源變化／代表 commit | Codex 現況與差異 | 建議 |
|---|---|---|
| **常駐核心與按需契約**：`36605a1`、`525302d`、`c404c0b` 將 testing、docs、push、review 程序移出 resident rules，增加 Contract Triggers | [`workflow-contract.js`](../plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract.js) 已集中 7 個 Anchors；[`review`](../plugin/sd0x-dev-flow-codex/skills/review/SKILL.md) 按需讀 default protocol／theory。來源的主要方向已有原生等價設計 | **優先補量測與觸發證據**；先找真正重複或未被讀到的內容，再精簡，不以搬出檔案數為目標 |
| **Instruction budget／residency manifest**：v4.7 的 `3600370` 與 v5 的 `c9dac61` | 有[歷史 instruction inventory](instruction-system-inventory-2026-09-06.json)與 [`skill-health-check`](../plugin/sd0x-dev-flow-codex/skills/skill-health-check/SKILL.md)，尚無相同的持續載入成本報表 | **優先候選**：用 Codex 實際載體量測。來源腳本重現 Claude Code 2.1.281 的 `.claude`、`@import`、`paths:` 與估算上限，不能直接當 Codex 規則 |
| **契約讀取失敗即停止相關動作**：`f0c44ef`、`6d7dbe7`；**plugin root 定位**：`dd41be2` | MCP entrypoints 已解析 installed payload，config parser 對壞 JSON／退役 provider 拒絕；這不等於模型按需讀 Markdown 的失敗行為已驗證 | **優先候選**：驗證一般文字任務也能找到正確 contract；缺檔時不能靠記憶繼續受管動作。使用已安裝 skill 路徑，不沿用 `${CLAUDE_PLUGIN_ROOT}` |
| **事實觸發 `procedure_hint`**：`9dddeed`，依 failed rounds、override 檔、長 feature doc 給 reference pointers | [`stateEnvelope`](../plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract.js) 已有 `next_action`／`reason`，[`hook.js`](../plugin/sd0x-dev-flow-codex/scripts/runtime/hook.js) 輸出 fingerprint-bound 事實 | **條件候選**：先證明現有提示漏掉哪些必要契約，再增加最小 pointer。若需要，狀態判斷留在 runtime owner，hook 只轉接；不新增另一套 gate 狀態機 |
| **Git override／protected branches／完成後 offer**：`3600370`、`6d7dbe7` | Codex mutation skills 已有範圍內授權延續；沒有來源的 Offer Mode、Goal Commit、Deploy Workflow 設定或 protected-set resolver | **依需求選配**：可整理保護分支解析及已有授權的執行體驗；不把來源每次 AskUserQuestion、TTY 或環境變數協定搬進 Codex |
| **Goal mode 自動 commit**：`3600370` | [`smart-commit`](../plugin/sd0x-dev-flow-codex/skills/smart-commit/SKILL.md) 限定 existing index，禁止代為 stage，且要求授權涵蓋 operation／target／payload | **另立範圍**：一般任務或模型自行建立的 goal 不構成 commit 授權。若要 goal 內自動 commit，須明訂 goal 來源、有效期、branch／index 範圍與失效條件；push 不隨之授權 |
| **Native stacked PR**：`6189f54`、`262d614` 新增 `gh-stack`，來源綁 extension v0.1.1 的 mutation 面 | [`create-pr`](../plugin/sd0x-dev-flow-codex/skills/create-pr/SKILL.md) 目前建立／更新單一 PR；[`epic-merge`](../plugin/sd0x-dev-flow-codex/skills/epic-merge/SKILL.md) 合併既有線性 stack，不負責原生 Stack 建立 | **功能候選**：確有多層 PR 需求時再做。先查當時實際 extension／API 能力，涵蓋部分發佈、base／auto-merge／draft 變化及 read-back；不能只用 exit 0 判成功 |
| **Git 正確性修補**：`853e79f` partial publication；`3668404` expected remote tip；`b735e49` 重跑保留 target | [`push-ci`](../plugin/sd0x-dev-flow-codex/skills/push-ci/SKILL.md) 限單 branch／單 refspec／fast-forward；epic-merge 已綁 expected remote OID、checkpoint 與 read-back；[`smart-rebase`](../plugin/sd0x-dev-flow-codex/skills/smart-rebase/SKILL.md) 已綁 target OID，沒有來源 shell analyzer 重跑路徑 | **採納案例，無直接 patch**：保留 target 不漂移、lease mismatch 停止、遠端操作後讀回的驗收案例。若未來引入 stack 多 ref 發佈，再加入 partial-success 測試；不由來源修補推定我們也有同一 bug |
| **部署流程**：`3600370` 新增 `deploy-flow`，宣告 merge／run，綁 OID／script blob，預設只印 run steps | [`runbook`](../plugin/sd0x-dev-flow-codex/skills/runbook/SKILL.md) 僅產生／檢查操作文件，明確不 deploy；沒有同等執行器 | **延後**：待有具體專案流程再定義執行範圍。任意 repo script 可能 publish／push，不能把配置檔當使用者授權，也不為了技能數量補齊而新增通用入口 |
| **Setup 退役管理、release migration notes**：`073af7e`、`37a0148`、`7805e98` | 本專案 setup 已保留 user-authored AGENTS／custom agents；已有[reload matrix](../docs/PROJECT-MIGRATION-GUIDE.md#9-reload-matrix)與 release payload owner | **沿用治理方式**：每次真的改 skill／安裝載體時寫清楚 migration 與 reload；來源兩份退役 rules 在 Codex 沒有對應檔案可刪 |
| **Canary／kernel digest pins**：`4eb9b2a`、`c9dac61`、`b0498ec` | 已有 [`skill-behavior-eval.js`](../scripts/skill-behavior-eval.js) 的隔離路由／task 實驗，以及 fingerprint／authority 行為測試 | **沿用實驗方法**：記錄 routing、契約讀取、耗時及實際載入；來源 6 筆 canary 是觀察紀錄，不能證明 Codex 的改善幅度。避免整段自然語句 hash 測試造成措辭綁死 |
| **Claude → codex exec launch guard**：`5eb6947` | 我們是 Codex host，configured primary 走 native subagent lifecycle | **不移植** shell launch guard、Claude hook payload 與 nested reviewer transport；原生 terminal authenticity 保持現行 owner |

來源入口：[v5 migration notes](https://github.com/sd0xdev/sd0x-harness/blob/7805e98510943f45e57f9856966172401cff0c40/CHANGELOG.md)、[Git autonomy requirements](https://github.com/sd0xdev/sd0x-harness/blob/7805e98510943f45e57f9856966172401cff0c40/docs/features/git-autonomy/1-requirements.md)、[gh-stack contract](https://github.com/sd0xdev/sd0x-harness/blob/7805e98510943f45e57f9856966172401cff0c40/skills/gh-stack/SKILL.md)、[deploy-flow contract](https://github.com/sd0xdev/sd0x-harness/blob/7805e98510943f45e57f9856966172401cff0c40/skills/deploy-flow/SKILL.md)。以上是固定版本的 repository 證據，未執行來源全部測試或驗證 GitHub Stack 線上可用性。

## 3. 本機載入量測與解讀

| 載體 | 字元／行數 | 計算邊界 |
|---|---:|---|
| Codex managed AGENTS block | 2,694／36 | `workflow-contract.js` 匯出的 `MANAGED_BLOCK`；含 markers |
| 本 repository 完整 `AGENTS.md` | 4,879／64 | 含 user-authored repo guidance；不能因 managed block 預算刪掉這些內容 |
| 86 個 Codex skills 的 description | 14,751 字元 | 對各 `SKILL.md` 的單行 description 用 `JSON.parse` 解碼後加總；不含 name、path、catalog 包裝 |
| 來源 v5 plugin-managed resident 合計 | 49,614／582 | 來源 `residency-manifest.json` 的 `owner=plugin` 欄位總和；是 worst-ecosystem rendered fresh install 的口徑，並非本機 Codex 實測 |

字元以 JavaScript `String.length`（UTF-16 code units）計，行數以換行切分、排除結尾空行計。來源 budget 為 50,000 chars／600 lines；來源 migration notes 的 78,378 → 49,614 是它自己的前後比較。它與 Codex managed block 的涵蓋面不同，**不能推算 Codex 更省多少 tokens，或把 50,000 當成 Codex 上限**。

目前量測亦未包含 host system instructions、其他 plugins、使用者全域 AGENTS、動態 hook 訊息及執行時實際讀入的 references。下一步應分別報告 managed guidance、discovery catalog、selected skill、references、hook emissions；靜態大小與實際讀取量分開，缺少實際 token accounting 時明確標示未知。

重現 Codex 靜態量測：

```sh
node <<'NODE'
const fs = require('node:fs');
const { MANAGED_BLOCK } = require('./plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract');
const size = s => ({ chars: s.length, lines: s.split('\n').length - Number(s.endsWith('\n')) });
const root = 'plugin/sd0x-dev-flow-codex/skills';
const entries = fs.readdirSync(root).filter(name => fs.existsSync(`${root}/${name}/SKILL.md`));
const descriptions = entries.map(name => JSON.parse(/^description: (.+)$/m.exec(
  fs.readFileSync(`${root}/${name}/SKILL.md`, 'utf8'))[1]));
console.log({ managed: size(MANAGED_BLOCK), agents: size(fs.readFileSync('AGENTS.md', 'utf8')),
  skills: entries.length, description_chars: descriptions.reduce((n, s) => n + s.length, 0) });
NODE
```

## 4. 建議執行批次

全部為 **Proposed**，本次沒有建立 successor delivery 或聲稱以下驗收已通過。

| 順序 | 工作範圍 | 完成條件 |
|---|---|---|
| F0：本機相容性證據 | 刷新 Codex 0.159.2 的 alias registry 真實 probe；目前證據仍綁 0.154.0 | 依既有 capability／successor 流程產生可驗證證據，再完成 `npm run check`；不只手改版本字串，不拿舊版 registry dump 充當新版結果 |
| F1：先量測 | 在既有 doctor／skill-health-check 相關工具補 Codex 載體報表；先做 repository-local analyzer，決定是否值得進正式 payload | 清楚區分 plugin／user／host unknown、常駐／按需；可重現本表數字；以 Codex 基準決定 regression threshold，不能照抄 Claude 上限 |
| F2：證明按需可用 | 依 F1 與既有 behavior eval，檢查 review／verify、Git mutation、test/doc review 的 reference 可達性；只精簡已證明冗餘內容 | 一般文字任務可找到正確入口；缺失 contract 的代表案例停止相關動作；不錯用 staged／installed／legacy copy；7 Anchors、原生 review authority、edit invalidation 不變 |
| F3：Git 體驗與回歸 | 沿用現有 authorization policy，檢查是否仍有重複詢問或目標漂移；有實際需求才加入保護分支設定／goal commit | 已授權同範圍可執行；目標或內容改變不沿用舊 preview；不隱含 stage、force push 或 goal 授權。只為確認的缺口加行為測試 |
| F4：Stack 功能 | 使用情境明確時，先決定由 create-pr 增加 mode 還是獨立 skill；GH extension／API 現況另行驗證 | mutation 面及 payload 明確、精確 leases、partial success／unverifiable 可區分、逐 PR read-back，與 epic-merge／push-ci 邊界清楚 |
| F5：部署執行 | 有專案需求再做；目前 runbook 持續只寫程序 | 宣告不等於授權；runner 身分固定、step 與 script bytes 綁定、順序停止與恢復證據可測，外部發佈範圍獨立處理 |

先處理 F0 的本機檢查阻塞，再將第一個來源功能跟進範圍選為 **F1 + F2 的代表案例**；先得到可比較的載入與路由證據，再決定是否修改 hook 或擴充技能。前次延後的 Node workspace manifest map／intent templates（B3）仍為獨立 backlog，不因 v5 新盤點而視為完成。

本次已執行 `npm run check`：syntax（71 個 shipped JavaScript files）與 payload manifest 檢查通過；`audit-source` 以 `mapping-only alias evidence is stale for Codex version: codex-cli 0.159.2` 結束（exit 1），尚未執行 active-candidate audit 或完整測試。版本綁定見 [`migration/alias-capability.json`](alias-capability.json)，相容性檢查 owner 為 [`scripts/skill-migration-audit.js`](../scripts/skill-migration-audit.js)。本次僅記錄此環境／evidence 差異，未改能力決策或宣稱全綠。

## 5. 持續跟進方式與原生邊界

1. 以「來源有新 release，或開始相關功能開發」作為下一次盤點時機。先 fetch，再 pin 舊／新 OID；dirty 或 divergent 的來源 checkout 不直接覆蓋，仍可用固定 remote OID 讀取差異。
2. 分開保存 **最新已盤點來源** 與 **各能力已交付版本**。本次前者前進到 `7805e98`；後者須逐項由 target commit、request owner、測試與 gates 證明，沒有一個全域「已同步 v5」旗標。
3. 每項新來源變更記錄 source commit／paths、Codex 對應 owner、已有／原生適配／延後／不適用、驗收案例及最後結果。無前進就停止本次同步，不重建歷史 inventory；有 history rewrite 則註明並重算可達差集，不能只看版本號。
4. 兩邊可共用 user intent、failure examples、驗收語意與經驗；runtime、event adapters、授權載體及發行各自維護。真正實作時走既有 request／candidate 流程，不 bulk-copy skills 或改寫歷史 evidence。
5. Codex 每次改動仍對最終 fingerprint 執行 configured primary review，再依 change class 執行 deterministic verify；本 repository 的 `npm run check` 要求持續有效。修改 `SKILL.md`／新增 payload／manifest 時，照指南的 unlink → link → status 與新 task reload；此盤點僅修改文件，沒有 overlay reload 需求。

以下來源政策與 Codex Anchors 不相容，維持不移植：依 tier 放行 P2、fallback reviewer 取得 gate authority、按 plane 沿用其他 gate 證據，以及以 round cap 結束未通過的工作。來源純文字 kernel digest pins 也不取代我們的 runtime authenticity 與直接行為測試。

## 6. 本次 commit inventory

以下以 `git log --reverse` 列舉固定範圍；日期為 author date，merge 拓樸可能使日期非遞增。兩筆 merge commits 也保留，不能將 34 筆全部算作獨立功能。

```text
6189f543b93abd5a65a067ba06a747c7a9ff1368 2026-09-23 feat(gh-stack): Add native stacked-PR skill and enumerate it in Anchor Register #4
262d614b053d18ee07ebff5b7708762835ebc48f 2026-09-23 docs(gh-stack): Sync the workflow carriers and record the integration
853e79ff24bd74292b9668069e7be2892ecb4b3a 2026-09-23 fix(push-ci): Admit partial publication, protected deletions and unverified overwrite targets
3668404fbdc9c704bd127b292cd4f03ba09b4163 2026-09-23 fix(epic-merge): Name the bound remote tip in every compared approval and withdraw the force-if-includes claim
b735e4965216b98d4be0567391bc460bb5e08669 2026-09-23 fix(smart-rebase): Carry --target through every --base re-run
fb47eb6b67217b1478f15edc1d247b67bdf3ce58 2026-09-23 docs(readme): Name /codex-setup init as the commit-msg-guard installer
d2cf55c7ea79563e833812c12ce0eae61ba42685 2026-09-23 docs(gh-stack): Record the deferred-defect follow-up
f7d80a80c405363b622614a4bef1591e521bb512 2026-09-23 fix(rules): State protected-branch deletion and the optional commit-msg hook precisely
5eb6947ea900cbea3aa03afa60fe9ca08a48d276 2026-09-23 feat(hooks): Guard the launch shape of a Codex dispatch
360037021a2d27e98124355a4df5da39b41c8bf7 2026-09-25 feat: Git autonomy, instruction budget and goal-mode commits (v4.7.0) (#14)
68f3a205e0ee31f4696166acf4cdcef2aaab8b65 2026-09-25 docs(rules-residency): Add v5.0 requirements and intent, link them from the spec and request
850edbdbf9fc304e0a2a2a2b0fab80be6dd40726 2026-09-25 docs(rules-residency): Record the 5.0 decisions and reconcile the spec with the requirements
4fb2fb07b8f9b5ec74dc31cc97387b7b75b36425 2026-09-25 docs(rules-residency): Add the feasibility study for trigger carriers and override placement
6d7dbe7570e77653032d11a8b4be0cfd8cc314fb 2026-09-25 fix(review-state): Fail closed when the git override cannot be read or located
017223946763fff25cb33d08c4fe86bb5aeed609 2026-09-25 docs(rules-residency): Fold the feasibility decisions into the spec work breakdown
4eb9b2a45cd78f727a633fdbe60323cb66830f95 2026-09-25 feat(rules-residency): Install the canary staging duty (task 8a)
f45bb5fb3f3c20f0d0c6f309e962bf720cd6858a 2026-09-25 feat(rules-residency): Extract the override contract into a path-scoped rule (r4)
36605a1d5ebd28da4003aea99a95a0da850bddaf 2026-09-25 feat(rules-residency): Move the testing and documentation procedure into on-demand contracts (r2)
e2952a875575464fefbb77beed2c8fe8041358a3 2026-09-25 docs(rules-residency): Record r2, add the FR-6 probe ticket, repoint the pre-pr-audit spec
9dddeed8c4abb20638b4acb091c6395ffa205ff6 2026-09-25 feat(review-state): Add a fact-conditioned procedure_hint to the AUTO_LOOP_STATE line (task 5)
f0c44eff87e304aeaae666cd69ab4b933c9fc2e9 2026-09-25 fix(rules-residency): Stop scope and stall diagnosis when their contract cannot be read (FR-6)
98ca331151a6c8d0450c68bbc7f844302b2150e8 2026-09-26 Merge pull request #15 from sd0xdev/feat/rules-residency-v5
525302d0a5193da1ad2525fbc215f4d714405b04 2026-09-25 feat(rules-residency): Move the push authorization text into an on-demand contract (r3)
bc0e19b6343a9a2d9cc18d0455f3d2f624e28467 2026-09-25 docs(rules-residency): Record r3 and its FR-6 probe round
073af7ee3a76163b689167d6c35636b92b7e62d2 2026-09-26 refactor(rules-residency): Retire fix-all-issues.md and framework.md (task 3)
c404c0b61857126a95c492897859ed473db9b62c 2026-09-26 feat(rules-residency): Compact the resident kernel and add contract triggers (task 3)
dd41be2094ef3863d45e0dd5bfe454b0439d4a30 2026-09-26 feat(hooks): Print the plugin root the contract triggers resolve against
1140bb3ef3a8ec66450250e06ff2bcc6ddd1c1b9 2026-09-26 docs(rules-residency): Update rule counts and the namespace-hint hook row
c9dac617133541394cf6a0011695b064bbf571cc 2026-09-26 test(rules-residency): Add the dual budget, residency manifest and kernel digest pins (tasks 4, 6)
b0498ec203852703bfc2097146698e0000d7ff93 2026-09-26 chore(rules-residency): Close the canary with the logged records (tasks 8b, 8c)
37a0148a405ff128d4559b539968840021c34157 2026-09-26 docs(release): Add the 5.0.0 migration guide and ship it in both release channels (task 9)
a1647d8d0e10059ee8251eee009ec04e1bda7827 2026-09-26 chore(release): Bump to 5.0.0
c9f112af4af9e6bf362d7baa3502b3593f42c1c4 2026-09-26 Merge pull request #16 from sd0xdev/feat/rules-residency-v5-kernel
7805e98510943f45e57f9856966172401cff0c40 2026-09-26 docs: Explain the 5.0 loading model in the READMEs and reference docs (#18)
```

## 2026-09-30 相容性修正續接

使用者後續要求修正 F0。已以 repository-only canonical probe 重新取得 Codex 0.159.2 的 schema、explicit／neutral catalogs 與 exact invocation marker，更新 normalized evidence 及 successor owner，保留 0.154.0 owner 的原始 bytes。

Review adapter 的根因是新版 transcript 以 namespaced function call／host receipt 記錄 spawn，沒有舊版 sub_agent_activity。v3 adapter 驗證 call ID、configured agent type、成功 receipt 的 direct task path 與 terminal sender／recipient，保留舊 wire format 支援。新版每輪使用 fresh configured spawn；僅有 terminal 文字、缺 receipt、profile 不符、client-authored 記錄、interruption／overlap 都不能通過。測試在隔離 repository 執行，不把 fixture 寫入實際 session transcript。

以上為修正內容，最終 review／verify 結果以當前 fingerprint 的正式 runtime evidence 為準；本頁前面的失敗紀錄仍代表修正前狀態。F1 至 F5 的功能跟進尚未交付。
