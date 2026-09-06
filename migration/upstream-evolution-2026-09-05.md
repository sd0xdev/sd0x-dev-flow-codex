# 來源演進盤點與移植批次（2026-09-05）

## 基準與重現

- 來源：唯讀 `../sd0x-harness`，HEAD `78443ce44ac88d34e2cda63e33f2ade0e19c85af`，package version `4.6.1`，worktree clean。使用者先前觀察的 `3d3c4c7 / v4.6.0` 之後另有 progress/stale sweep 與 background watcher 改進。
- 目標起點：`d6f7e39`；歷史 source inventory 綁 `f4187c53eb746b6f84eb1f413e7210bd506e6db9`，另加 2026-07-10 兩個 local overlay skills。該 commit 在目前兩個 repository 都不存在，不宣稱具有完整的 ancestor-to-HEAD 比較。
- 指南已有 v4.1.0 校準，因此另以來源 tag v4.1.0（`77d0e7b9181a8dd697ea80073061e64e602cc47b`）至 pinned HEAD 枚舉 **123 commits**。這個範圍與歷史 inventory 是不同證據。
- [機器清單](upstream-evolution-2026-09-05.json) 保存完整 commit IDs／paths，並以 `git show <pinned-head>:<path>` 的 SHA-256 比對歷史 inventory 的每個 source file。100 個歷史 skills 中 67 個內容改變、31 個未變、2 個刪除；來源新增 `adr`。內容差異不等於目標功能缺口。
- 重現：`git -C ../sd0x-harness log --reverse --format='%H %s' v4.1.0..78443ce44ac88d34e2cda63e33f2ade0e19c85af`；逐檔 `git show` 與 `migration/source-inventory.generated.json` 的 SHA-256 比對。來源後續若再前進，另建新 snapshot，不改本次 pinned subject。
- 不修改歷史 inventory、封存 packs／staging、歷史 request owner 或既有 promotion evidence。`source-disposition.json` 的 100-row delivery registry 不代表下列新功能已完成。

## 依功能判定

「已移植」包含有目標實作證據的等價行為；「需原生適配」代表不能直接搬來源流程；「新增」代表來源新增且尚無對等能力；「不適用」代表與本專案 contract 衝突或不值得加入核心。批次狀態另列，避免把判定當成交付。

| 來源 commits／功能 | 判定 | 目標證據與處置 |
|---|---|---|
| v4.1.0 contract-driven autonomy；`997be8f` on-demand contracts | 已移植 | `scripts/runtime/workflow-contract.js`、AGENTS closed Anchors 與 `review/references/review-theory.md` 已分離事實、規則及 reviewer 程序。 |
| `1d773e9`、`d1cb0e9` content-addressed receipts／dispatch identity | 已移植（原生等價） | `worktree.js`、`state.js`、`collaboration.js` 已有 exact fingerprint、round/epoch identity、sticky finding、durable evidence。不得換成來源 receipt JSONL schema。 |
| `3c063ed`、`0b3b8f5` hook lightweighting | 已移植／不適用部分 | `hook.js` Stop 已為 advisory；activation、protected state 與 primary authenticity 仍 fail closed。來源刪除 enforcement machine 不套用。 |
| `187b0aa` PR attribution sanitation／commit environment isolation | 已移植（部分） | `create-pr/SKILL.md` 已在輸出前 sanitation、literal argv 與 payload hashes；smart-commit 有封閉操作契約。來源 shell dispatcher 不是 Codex runtime。 |
| `187b0aa` stacked PR；`18ec6ed`／`2418ba5` pre-push gate opt-in | 新增／不適用核心安裝 | Stacked PR 為可獨立採用的 Git workflow，現有 create-pr、smart-rebase、push-ci 可組合；本批不新增模式或 Git hooks，不代使用者變更 branch protection。 |
| `2d4e39b` smart-rebase binary-safe analyzer | 需原生適配 | 現有 `smart-rebase/SKILL.md` 使用 literal refs／read-only analysis，沒有來源 shell analyzer；其 JSON escaping patch 不可直接套用。新增 analyzer 留待有獨立需求時。 |
| `6cc8e0c` authority-aware doc classification；`d2af0a8` phased doc review／link checker | 需原生適配 | 本專案 docs-only fingerprint policy 與 `doc-review` 已存在；來源 taxonomy 不得使 code/config 降級。1109-line link checker／profiles 另需獨立 parser 與安全測試，本批不擴充 gate classifier。 |
| `0de5751`／`d9a8bca` native feature context | 已移植（核心邊界） | `request-metadata.js`、request-tool 與 feature reference 已由本專案 owner 解析；來源 shared context shape 不是持久化 schema 的直接替代。 |
| `6bbc589` live AC／closed-ticket freeze／status alignment | 已移植（原生更嚴格） | `request-metadata.js` 掃 rendered Markdown，request-tool 的 Completed 需 durable closure；不用 free-text gate receipt classifier 排除 AC。 |
| `06a4d91` immutable Due／lane ordering | 新增（來源設計，未交付） | 該 commit 為設計票；不把設計當成已存在程式，也不在本次自行擴充 request lifecycle。 |
| `171b5ee`／`b72ff94` manifest declared-dependency graph | 新增，需原生適配 | 目標 `repo-intake` 目前只有 map 契約，沒有 deterministic graph。後續候選為 bounded Node workspace manifest map，不直接複製 2120-line 多生態 parser。 |
| `4e1183f` shipping inventory 由 Git 決定 | 已移植（目的等價） | `generate-plugin-payload-manifest.js`、release allowlist 與單一 distributable payload 防止本機額外檔案被無條件發布；來源全倉 skill catalog 不套用。 |
| `6d73dec` lint argument injection opt-in | 已移植（不注入） | `runtime/verify.js` 以 closed script names／literal argv 執行，沒有把 lint flags 注入 aggregate check 的路徑。 |
| `11459ac`／`9128383` fallback reviewer／rotation | 不適用 | configured-primary-authority 禁止 substitute primary 或 degraded pass；unavailable 仍 fail closed。 |
| `20212e7`／`8ebfe8e` scope fields／bounded assurance | 需原生適配 | 既有 review theory 要求 change causality、完整 changed files 與 impact severity；B2 加入有證據的探索停止條件，不減少 primary 覆蓋或 gate 門檻。 |
| `f2f7cf4`／`a3672c0` stall diagnosis／attention diffusion／reference stability | 需原生適配 | B2 將診斷與調整紀錄放進既有 review reference。保留 fresh full scan；不搬 round cap、不重試 unavailable primary、不自動 commit/stash。 |
| `b6e2687` owed-now／opportunistic envelope | 不適用 gate；保留範圍原則 | 不引入 deferred P2 pass。獨立於本次變更的改善可記 backlog，已成 actionable finding 的 P0/P1/P2 仍全部阻擋。 |
| `e545732`／`5f1a140` per-feature intent；新增 adr | 需原生適配／不新增 alias | 後續候選在現有 requirements／tech-spec templates 保留 user intent、non-goals、success signals 與 drift 判斷。ADR 由 architecture 現有能力涵蓋，不新增 discovery entrypoint。 |
| `6f221ad` assignment redaction、capture position、ReDoS | 需原生適配 | B1 修正 `ask/scripts/redact.js` 的 JSON／env key 與 value-key collision；維持 high redact／medium mask 區分並加行為測試。Debug redactor 已按位置掃描完整 quoted value，不搬來源 PII relabel 回退。 |
| `90a263e` 與 v4.6.0 skill transport sweep | 不適用 | Claude host 呼叫 `codex exec` 的 adapter 與 grants；本專案使用原生 Codex primary + authenticated collaboration lifecycle。不可在原生 host 再巢狀啟動相同 reviewer。 |
| `0d3b1ca`／`286980e` v4.6.1 progress／stale sweep／watcher | 不適用 transport；原生保留存活保障 | 現有 collaboration mailbox、terminal evidence、round owner lock 與 cancellation 有原生邊界；不得以 age sweep 清除活著的 primary ledger。 |
| 其餘 README／release／test／設計紀錄 commits | 不適用直接搬檔 | 全數仍列於機器 commit inventory；只作上述能力的 corroborating evidence，不把來源版本或 README counts 複製到目標。 |

## 分批執行與驗收

| 批次 | 範圍 | 驗收 | 狀態 |
|---|---|---|---|
| B0 | 啟動、0.153.4 alias capability refresh、缺少的 transferable evidence refs provision | doctor、真實隔離 probe、source audit；immutable owner chain 保留 | 初步檢查通過；整體 gates 未完成 |
| B1 | Ask credential redaction | JSON／env／短密碼／值等於 key／delimiter／長輸入回歸 | 已實作，整體 gates 待驗收 |
| B2（優先） | Claude review 退役、GPT parent settings、bounded assurance、停滯診斷與測試精簡 | 原生 lifecycle 正反向行為、完整 fingerprint gates | 已實作，修復整體 checks 中 |
| B3 | Node workspace manifest map／intent templates | 依後續使用需求選定 | 依使用者 Auto Loop 優先指示延後，本批不交付 |
| B4 | Configured primary review → deterministic verify（含 npm run check） | 同 fingerprint runtime-recorded evidence；fix 後重新 review | Reload 後原生 terminal evidence 已成功形成 review pass；後續 Claude 分支清理須重新 review → verify |
| B5 | 本地 overlay reload | 關閉舊 Codex 後 unlink → link → status，使用相同 CODEX_HOME 重啟新 task；新 registry 實測 | 使用者已完成 reload／九個 hooks Active／new；本次 doctor 與真實 session activation 已確認 |

以上是本次選定的可交付增量；stacked PR、自訂 taxonomy、多生態 dependency parser 與 Due/lane 不在本次承諾的實作範圍。每項原因見上表。沒有 commit/push，來源唯讀，不建立 worktree，不改全域 Codex home。

## 本次續接觀察：v4.6.2 與 v4.4 設計依據

來源重新檢查為 `04e8a5e3f5d9c482937c2ad2170fab5fbd02b630 / v4.6.2`。
[增量 commit／paths](upstream-evolution-2026-09-05-v4.6.2.json) 保留新 HEAD 可達、舊觀察不可達的 commits；
同名變更多個 commit ID 必須比實際功能，不能把所有新 ID 都算新功能。前次快照不改寫。

| 來源 | 核心改變 | 本專案處置 |
|---|---|---|
| `c087245`、v4.4 README | 真實路徑正反向代表證明作為 assurance boundary；Prevention 是說明，不是新增 guard 配額 | 已寫入 review theory；五項 deliberate checks 的最後一項改查尚未證明的行為與反例 |
| `add1f9c` rules residency | 常駐僅保留啟動核心，程序按需讀 canonical reference | 既有 AGENTS anchors 保持精簡，rubric 仍由 review skill 按需讀；不增加常駐論文摘要 |
| `5566ee5` loop recovery | finding identity 比較、SCATTER fix 批次、REFERENCE_DRIFT | 已加入診斷與失敗調整記憶；修正完畢後全變更重新 review，local checks 無 gate 權限 |
| `ffbbffe` owed-now | 用 scope 與承諾決定 fix obligation | 僅採因果與實際影響判定；不移植可放行 P2 的 tier 政策 |
| `84e8c2b`、`84288da` transport | Claude host 改 codex exec 與背景觀察 | 不移植巢狀 CLI；本專案採原生 GPT subagent + terminal evidence |
| `f5d8e43` user-authorized execution | 已有明確 user authorization 可直接執行 | 本專案既有自主執行政策已涵蓋；仍遵守本次禁止 commit/push |

已查閱原始研究：
[IFScale](https://arxiv.org/abs/2507.11538) 的任務是密集 keyword instructions；
[Chroma context rot](https://www.trychroma.com/research/context-rot) 研究 context 長度與干擾內容；
[Vercel agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) 比較其 Next.js 任務的文件供給方式。
它們支持減少無效指令與清楚提供參照的設計方向，沒有直接驗證本專案 review 的漏報率；不把來源早期可行性文件的百分比當成本專案成效。

測試精簡採用實際邊界：刪除 `test/r3-acceptance.test.js` 的 source-text meta-tests
（搜尋函式／其他測試字串、再測搜尋器能否拒絕假字串），其對應行為仍由
`evidence-ledger.test.js`、`state.test.js`、`collaboration-review.test.js` 直接執行。
歷史 R3 request 保持原文；現行升級用本盤點記錄移除原因。
Claude-only transport 測試退役，保留 runtime allowlist、取消、provider 拒絕與真實 handshake。
沒有刪除 evidence tamper、stale fingerprint、epoch migration 或 gate ordering 的行為測試。

## 本工作階段驗證與續接邊界

- 七個 successor units 的 deterministic candidate audit 已通過，票內保留實際 payload／preflight hashes；目前是 Candidate Complete，未寫正式 promotion 或修改歷史 closure。
- 35 項 focused runtime/setup/verify/redaction tests 與 103 項 ledger/release/MCP tests 通過。
- 最後完整 `npm run check`：syntax、payload manifest、source audit、active-candidate audit 通過；測試共 1169 項，1165 pass、1 fail、3 existing skip，測試階段約 27 分鐘。
- 唯一失敗是 alias tamper 測試把 current owner 寫死為舊版歷史票。已改從 decision 讀取 current owner，該完整測試重跑通過（約 46 秒）。**尚未對最後修正重新跑完整 check，不宣稱全綠。**
- 共用歷史 fixture 同步 current alias decision 與 immutable owner chain，僅在隔離 fixture 中把合成的新 owner 綁到 fixture HEAD；正式歷史 owner bytes 不改寫。代表性的 source no-follow 與 candidate preflight tests 均已通過。
- 原生 GPT primary 已對先前 fingerprint `7f488924126651785cc33fe4d8e4025f10f701738fd10d8761d656a0ae359776` 回傳 clean terminal 文字，但 MCP round begin 回報 `collaboration-transcript-unavailable`、import 回報 `marker-missing`，runtime 無 completed reviewer evidence，gate 拒絕 pass。已經由正式 gate wrapper 記錄 reviewer-unavailable，未偽造 hook 或清除 ledger。
- 後續 fixture/test 修正與本紀錄均屬新 fingerprint，需重新 review；不要拿先前 clean 文字當作新 fingerprint 的 pass。一般執行環境可定位本 session transcript，MCP runner 不能，需 reload 後再檢查 runner 的 session 環境與原生 lifecycle。
- Setup 已更新受管理 Codex profile，移除受管理 Claude/test profiles；保留 AGENTS 與自訂檔案。Setup 回報 activation_deferred，未宣稱新 registry/profile 已在舊程序啟用。
- 續接：關閉舊 Codex → repository-only unlink/link/status → 同一 CODEX_HOME 以 `codex --yolo` 啟動 → `/hooks` 確認新 hook trust 並開新 task → doctor → configured primary review → deterministic verify（重新執行完整 npm run check）。若同一 fingerprint 仍有 failed reviewer ledger，依 review/reset skill 先取得使用者 reset 授權，不手改 state。
- 來源唯讀，沒有建立 worktree，沒有對本專案 commit/push，沒有修改使用者全域 Codex home。

## Reload 後原生 review 實測與追加清理

- 新 task `01a07239-326d-71c3-bffb-ac8d146af642` 的 doctor 通過，runtime `isSessionActive=true`。Provider 是 `codex`，primary 透過 full-history fork 繼承 parent model／effort。
- MCP `round begin` 仍回報 `collaboration-transcript-unavailable`，import 為 `marker-missing`；一般命令環境可定位本次 transcript，因此仍存在執行環境 session context 差異，不宣稱 MCP adapter 已修好。
- 本次原生 SubagentStart／SubagentStop 完整到達，runtime 寫入 `outcome: clean`、`result_sha256` 與 `has_transcript: true`，正式 gate wrapper 對 fingerprint `48ff012d235d1aecc15b45b4e94a2f1cbb3e31f175a8513f588be55bd4697a22` 記錄 review pass。這證明原生 Codex 路徑可用，不依賴先前 clean 文字或手工 import，也未 reset。
- 使用者追加要求只使用 Codex subagent review。現行 collaboration marker／round／result／failure 與 verification provider 入口收斂為 Codex，移除 gate 中退役的 Claude 分支；歷史 evidence parser 與 managed legacy config 遷移仍保留。MCP 相容名稱只承載 deterministic scripts，沒有 Claude reviewer capability。
- 新增行為測試涵蓋退役 provider 拒絕且不改動 state；既有 collaboration tests 涵蓋缺 terminal 不得 pass，以及 transcriptless round 可由原生 terminal evidence 完成。這批追加修改使上述 pass 過期，必須對最終 fingerprint 重新 primary review，再執行 deterministic verify 與完整 `npm run check`。
- 續接實測：對已完成的 persistent agent 使用 followup 不會取得新的 SubagentStart；在 MCP adapter unavailable 的環境必須建立新的 configured Codex primary，不能重用 agent 文字作為證據。使用者已明確授權技術阻塞時自主 reset／重新 review；正式 reset 後建立新 primary 已取得完整 native lifecycle，無須再詢問同類 reset 授權。
- 追加清理後的完整 check 在 active-candidate audit 發現五張 review successor tickets 的舊 payload hash；新 primary 獨立確認同一 P2。已透過 `auditActiveMoveWindowIdentity` 對 branch／deep／default／fast／full 完整重跑並通過，僅更新本批 successor tickets 的實際 payload／preflight hashes；不改歷史 owner，亦不新增重複 meta-test。最終整體結果仍以當前 fingerprint 的 runtime review／verify 紀錄為準。

## 2026-09-06 指令系統核心整理

前一批最終 fingerprint `0ff11d273753df0090744c50571def35907c16722a0c0fadf694b63c421fd18f` 已取得 native configured review 與 deterministic verify pass：完整 check 1170 tests、1167 pass、0 fail、3 skip。這是歷史結果，不能適用本次指令改寫。

本批參考唯讀 sd0x-harness v4.6.2，改寫前先提供 inventory、分類報告與架構，再調整 managed AGENTS、review profile／theory、hook context、reset/remind 授權延續。詳見 [instruction audit](./instruction-system-audit-2026-09-06.md) 與 [inventory snapshot](./instruction-system-inventory-2026-09-06.json)。核心 42 項 focused tests 通過；本批須重新 review → deterministic verify，不沿用歷史 clean。其餘 generic skill wrappers／generator debt 未在本批全面重寫。

正式 setup 已同步 managed guidance 與 profile，回報 activation_deferred；改動 SKILL.md 後需關閉舊程序再 repository-only unlink/link/status，以同一 CODEX_HOME 重啟並開新 task。不得手改 runtime 或模擬 SessionStart。使用者既有技術恢復 reset 授權持續適用。

本批 fingerprint `ddf4af48bdb6122b5cb717307570114770f16503285d05d79e32a2d3e2a55a04` 的 native primary review 已由 gate 接受。其完整 check 為 1165 tests、1161 pass、1 fail、3 skip：唯一失敗是 non-default review contract 測試鎖定舊探索字句。已移除三個純探索措辭 assertions，保留 mode subject、snapshot freshness 與 no-gate 邊界，branch 排版 assertion 改容許空白。Focused test 通過；這項修正需新 fingerprint review 與完整 verify。MCP 在 1860 秒等待逾時後，原 verifier 仍完成並正式記錄這次 fail，未重啟或偽造 evidence。


## 全面指令改版續接（2026-09-06）

核心 AGENTS／managed rules／hooks／Codex reviewer 的先前 review 與 verify 是歷史 fingerprint 證據。最新工作延伸到 86 個技能及 references、discovery descriptions、authorization policy 與正式生成器；95 個 canonical units 已建立 superseding revision requests，保留舊 owner、來源封存與 closure 證據。Registry 的 pending 數表示本輪新 revision 尚未完成正式交付，並非刪除技能。

目前研究 helper focused 檢查 24 pass、0 fail；其餘完整檢查與 configured primary review 尚待在固定 fingerprint 執行。新 descriptions 需要 repository-only reload 後的新 task 才能確認 registry 啟用。完整計畫、分類與限制見 [全面改版審計](instruction-system-comprehensive-audit-2026-09-06.md)。不得以本頁舊 clean／pass 文字宣稱新 fingerprint 通過。


### 全面改版正式 preflight checkpoint

95/95 canonical unit preflights 已通過，實際 payload／preflight hashes 已記錄於 `2026-09-06-model-trust-*-revision.md` successor requests（Candidate Complete）。歷史 owner／closure 不變，沒有 commit／push／worktree。新一輪 configured Codex primary review 與 deterministic full check 尚待執行；此 checkpoint 不能作為 pass 文字。Reload 後仍需 doctor 確認實際新 task activation 與技能 registry。


### 全面 primary 第一輪修復

第一輪 comprehensive primary 找到兩個 P2，正式 gate 已記錄 fail。PR／Jira 的已有授權延續與 bump-version release owner 已修正，generator／tests 同步；三個 unit 正式 preflight 重跑成功且 tickets 已更新實際 hashes。39 focused tests pass。接續新 fingerprint 的 fresh configured primary，再執行完整 deterministic verify；不得沿用第一輪或核心階段 verdict。


### 全面 primary 第二輪修復

第二輪 configured primary 對 fingerprint `d512a3e49e6028846be223e91070128825216ce12f1b275f9e0459a22219c205` 發現一個 P2：verify fast/precommit 的生成測試仍鎖定舊 diff-only 模式。正式 gate 已記錄 fail；現已同步真正的 lint-fix、非 gating 與 explicit allow-fixes 邊界，並以實際生成正文執行生成測試。相關 7 tests pass；同類 9 個 runtime modes 的生成測試也通過。兩個 unit 正式 preflight 已重跑成功，tickets 更新其實際 hashes。接續新 fingerprint 的 fresh configured primary，再執行完整 deterministic check。最終 gates 以正式 runtime status 為準，不以本紀錄的歷史狀態推測。


### 全面 deterministic check 相容性修復

第三輪 configured primary 對 fingerprint `55921bad520178b61d0523975d32f4786ff10e9be26797414542e28fc2b59fa2` 的 clean terminal 已由原生 lifecycle 與正式 gate 接受。隨後 deterministic full check 在 active-candidate audit 失敗，尚未進入完整測試套件：create-request 的歷史 Acceptance 格式例外錯誤套用到所有後續 owners。已將例外限定到三個實際歷史 owner 路徑與原 unit；新 successor 使用一般 Candidate Complete／durable closure 規則。兩項回歸測試通過，95 份現行 ticket／preflight 配對皆通過正式 evidence validator。

另以 focused test 發現 July 28 formal delivery 的歷史 fixture 依賴 current registry owner，95 個新 successor 使其選取為空。現改從完整 83 份 immutable 歷史 requests 建立 adapter fixture，保留所有 metadata 與超過 300 份 evidence redaction 檢查；該檔 15 tests pass、0 fail。Migration 整合回歸與新 fingerprint 的 review／完整 deterministic verify 仍待完成，以上歷史 pass 不適用最新 fingerprint。


### Verify modes 共享測試身分修復

第四輪 primary 已對 fingerprint `919caccabfd38b7d3929ee5614b6e8e1c5eee28c077f6cbe03933510d860f012` 取得正式 review pass。完整 deterministic check 隨後在 `verify/default` 的 candidate preflight evidence mismatch 失敗，尚未進入完整測試套件；MCP 等待先逾時，但原 verifier 持續執行並由 runtime 記錄真實 failure。

原因是 fast／precommit 的生成測試變更也影響同一 verify payload 的 preflight 身分，先前僅重核兩個 modes，漏更新 default。現已對 default／fast／precommit 三個 modes 全部重新執行正式 preflight，皆成功；只有 default ticket 的舊 hash 需要替換。沒有改動歷史 owner 或 runtime evidence。新 fingerprint 仍須 fresh primary review → 完整 deterministic check；migration 整合回歸仍在原程序執行。


### Integration 舊契約與重複審計修復

第五輪 primary 對 fingerprint `6b5355b382fb1513099f0fec32212825836f544d5cf34a7eff92c915f6f844af` 重現三個舊契約測試失敗，並確認重複全量審計成本，正式 gate 記錄四個 P2。原 migration integration 共 148 tests、140 pass、5 fail、3 skip；其中另兩項是前述舊 default hash，以及更新 ticket 時觸發的 source-snapshot freshness 拒絕，不宣稱該次 integration 通過。

Wave 3 overlay 現允許所有現行 owners 都是新 candidates，仍拒絕錯誤的 delivered／pending overlay，另由實際歷史 completion records 建立隔離 overlay 檢查，保留 successor 不繼承歷史 evidence 的斷言。移除 live research 已退役 semantic-block 與 mutation skills 最後 numbered-step 的逐字格式檢查；現行 routing、helper 行為、review→verify ordering 與 edit invalidation 由既有直接測試覆蓋，歷史 research semantic preflight 拒絕案例保留。

移除 Wave 4 的重複全域 smoke audit：該單項實測 3,686,384 ms（61.4 分鐘），只重複 `npm run check` 前面的完整 active audit。完整 check 仍逐一審計全部 95 units；integration 的真正 candidate evidence 接受／拒絕與 transaction tests 不變。Focused overlay／歷史 research preflight／CLI audit 三項通過，最終 overlay 再跑通過，另 46 項 state／workflow／research 行為測試通過。這些變更仍須新 fingerprint primary review 與完整 deterministic verify；後續執行期間保持受審查檔案固定。


### 完整測試揭露的舊配額斷言

第六輪 primary 對 fingerprint `790861809cad3a8c1e52af5b0d1fa786b29ab9878ce434f1f4282b1d954a6530` 取得正式 pass；其 deterministic check 已通過 95-unit active audit 並執行完整測試，但最終 exit 1（5,522,030 ms），runtime 記錄 verify fail。正式輸出尾端是 tech-spec 的強制圖表配額斷言，因輸出截短，不由此推算完整 pass／fail 數。

另外保存的 946 項較短測試結果為 943 pass、3 fail；集中確認 create-request 的八個 AC／60 秒／行數配額、req-analyze 強制協作者措辭、tech-spec 至少一張 Mermaid 圖等舊斷言。現移除已退役的配額與流程文字檢查，保留 resolver containment、mode/lifecycle/backlink、AC evidence、timeout／subject drift 與 durable closure 等實際邊界。三個修正檔案共 32 tests pass。完整 suite 日誌重跑、新 fingerprint primary review 及 deterministic full check 仍需完成；不沿用第六輪 verdict。
