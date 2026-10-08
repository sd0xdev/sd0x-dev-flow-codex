# Requirements: 完整 v5 Codex 原生升級

> **Doc class**: Lifecycle — Phase 1 feature-level problem analysis
> **Created**: 2026-09-30
> **Updated**: 2026-10-03
> **Tier**: standard
> **Status**: In Progress — 使用者已授權全部適用 v5 升級；實作與驗收逐項追蹤

## 2026-10-03 範圍擴充（優先於下列歷史假設）

使用者明確要求實作全部適用 v5 功能。下文保留原始 FR-1–7 與當時觀察作為載入子需求；原先 Git／stack／部署的 Non-Goals 與「另立需求」假設已被本節取代。不得只完成 FR-1–7 就宣稱完整遷移。

| ID | 新增必要範圍 | 驗收 |
|---|---|---|
| FR-8 | 固定來源 tag、commit、版本、dirty 狀態；涵蓋所有來源技能、模式與 v4.6.2 後升級路徑 | 可重現 inventory；每項有原生 owner、狀態、理由與證據，不以 commit 數代表功能數 |
| FR-9 | Git 專案設定、只增不減的 protected set、offer 去重、既有授權延續與明確 goal commit 範圍 | malformed/unreadable 設定拒絕受管操作；一般 goal 不隱含 commit/push 授權；本輪禁止實際 commit/push |
| FR-10 | 原生 stacked PR 的 report/link/push/submit/install 模式、chained-base fallback 與逐層 readback | 固定 extension 身分與版本、精確 mutation 預覽、partial/absent/unverifiable 分離、錯誤後不重複發佈 |
| FR-11 | 宣告式 deploy 的 parse/plan/merge/run、預設 print、順序停止與恢復 | 獨立授權、宣告/HEAD/OID/script bytes 不漂移、不可把配置當授權；本輪只在隔離 fixtures 驗證 |
| FR-12 | review scope/stall、testing/AC、documentation 與 override 的按需契約和必要觸發 | 語意保真；失敗停止依賴動作；保持 configured-primary-only，不接受 fallback 或 tier 降級 |
| FR-13 | setup preservation、退休載體 ownership、release/reload 說明與 source/install/session 三層驗收 | 歷史 evidence 不改寫；舊 host 關閉後重建 overlay；新 task 真實 activation/registry |

來源 v5.0.0 tag = `c9f112af4af9e6bf362d7baa3502b3593f42c1c4`；快照 = `7805e98510943f45e57f9856966172401cff0c40`（tag 後的 v5 說明補充）；2026-10-03 來源工作樹 clean，未 fetch 或寫入來源。目標 implementation base = `6782d7f0e3c38bc48b60b7002dd2343796ef0374`。本輪不授權外部發布、部署或全域配置變更。

執行規格見 [2-tech-spec.md](2-tech-spec.md)，完整狀態见 [完整 v5 request](requests/2026-10-03-complete-v5-native-alignment.md)。

## 1. Problem Statement

使用者要求學習隔壁 `sd0x-harness` 5.0 的模式，盤點 Codex 版需要調整的項目。來源 v5 的核心是保留必要的常駐規則，詳細程序按情境讀取；Codex 版已有精簡 managed guidance 與部分按需 references，但還缺少真實載入成本及必要契約讀取行為的完整證據。

### Underlying Need

1. Surface：對照來源 5.0，找出目前 Codex 版的具體缺口。
2. Why：減少無關程序佔用 context，同時確保一般文字任務仍能取得必要規則。
3. Root：提升無人值守交付能力，讓精簡程序不損害完成證據、安全界線及必要驗證。

## 2. Goals / Non-Goals

| Goals | Non-Goals |
|---|---|
| 可重現地區分各載體的靜態大小與觀察到的載入 | 把來源 50,000 字元預算或 Claude 載入行為直接套用 Codex |
| 一般文字任務也能在相關操作前取得正確契約 | 批量移植來源全部 skills、hook payload 或 reviewer fallback |
| 缺少必要契約時只停止依賴它的操作，並說明可恢復條件 | 用摘要、推測或不同 fingerprint 的證據通過 gates |
| 以證據決定哪些程序值得精簡 | 在本需求內新增 goal 自動 commit、stacked PR 或部署執行器 |

## 3. Stakeholders

| Stakeholder | Role | Key Concern |
|---|---|---|
| Plugin 維護者 | Developer | 載入成本可追蹤；指令調整不產生不可見的路由退化 |
| 透過 Codex 使用技能的開發者 | User | 不必記住技能名稱；可逆命名與文件位置不阻塞交付 |
| 安裝及升級此 plugin 的 repository 維護者 | Operator | installed/live 版本一致；使用者自訂內容保留 |
| review、verify 與消費 lifecycle 文件的流程 | Dependent | 必要契約及完成證據真實、可達、綁定正確版本 |

## 4. Scenarios

| ID | Actor | Action | Expected Outcome |
|---|---|---|---|
| UC-1 | 技能使用者 | 不指定 skill 名稱，要求分析需求或檢查變更 | 選擇合適入口並讀取必要契約，交付受證據支持的結果 |
| UC-2 | 維護者 | 調整一份入口或 reference | 可看出各載體成本及必要契約讀取的變化 |
| UC-3 | 技能使用者 | 所需契約缺檔、不可讀或指向錯版本 | 相關操作停止並回報原因；獨立工作仍可繼續 |
| UC-4 | 安裝維護者 | 升級後開始新 session | 能區分 source、installed entrypoint、session registry 與 activation 證據 |

## 5. Functional Requirements

| ID | Requirement | Priority | Rationale |
|---|---|---|---|
| FR-1 | 分別呈現 managed guidance、discovery catalog、selected skill、references、動態 hook 訊息的成本及量測範圍 | Must | 單看磁碟文件長度不足以代表實際 context |
| FR-2 | 未明示技能名稱的代表性任務，仍能在受管操作前找到並讀取當前安裝版本的必要契約 | Must | 按需載入必須涵蓋日常自然語言工作 |
| FR-3 | 必要契約不可讀時，不依記憶或簡化摘要執行依賴該契約的判斷或操作 | Must | 可讀取性是程序執行前提，並非可選提示 |
| FR-4 | 區分模型自行列出的 evidence paths 與可觀察到的成功讀取 | Must | 正確答案不能替代程序確實執行的證據 |
| FR-5 | 僅精簡已量測到的重複或無關載入，保留可達性、必要判斷與單一規則來源 | Should | 降低成本需與行為保真同時成立 |
| FR-6 | 對已重現的漏讀情境提供必要提示，且提示不取得 gate authority | Should | 只補真實可達性缺口，避免新增常駐噪音 |
| FR-7 | 版本及升級說明能辨識 source 更新與新 session 生效的差異，並保留使用者 ownership | Must | 編輯或 link 本身不是 registry 更新證據 |

## 6. Non-Functional Requirements

| ID | Category | Requirement | Metric or validation |
|---|---|---|---|
| NFR-1 | Evidence | 靜態字元、行數、觀察到的載入與 token accounting 分開 | 同一版本及輸入的靜態量測可重現；不可觀察的值明列 unknown |
| NFR-2 | Safety | 保留七個 Anchors、configured primary authority、edit invalidation 與同 fingerprint verification | 既有行為測試與代表性成功／拒絕案例皆通過；不得 degraded pass |
| NFR-3 | Compatibility | 以 Codex 實際載體與版本驗證，不把來源平台假設當作本機能力 | 每份結果記錄 source/target revision、CLI 版本、installed root 與觀察範圍 |
| NFR-4 | Reliability | 代表案例涵蓋一般文字觸發、必要讀取失敗及錯版本路徑 | 每例有實際觀察結果；未測不得以成功或零成本代替 |
| NFR-5 | Ownership | 升級保留使用者自訂文件與 historical evidence | 差異及既有 setup/containment 測試證明未覆寫非管理內容 |

## 7. Constraints & Assumptions

| Type | Description | Source |
|---|---|---|
| Constraint | 不移植 Claude event assumptions；runtime/state/worktree owner 維持原責任 | repository `AGENTS.md` |
| Constraint | 常駐核心精簡不得降低任何 Anchor | `scripts/runtime/workflow-contract.js` |
| Assumption — Business | 首批價值集中在載入成本與契約可達性；Git/部署新增能力另立需求 | 使用者要求學習 5.0；依現有差異盤點推論 |
| Assumption — Technical | 目前受控 evaluator 不足以證明 native registry 下每份必要契約確實被讀取 | `scripts/skill-behavior-eval.js` 的 catalog、routing 與 task grading 實作 |
| Assumption — Compatibility | 本 session 的 catalog 描述縮短現象需被後續驗收涵蓋，尚不能推論所有 Codex surface 都相同 | 2026-09-30 本 session 觀察 |
| Assumption — Resource | 先驗證代表性情境；完整技能覆蓋範圍由後續證據決定 | 分析推論，尚未設定模型實驗預算 |
| Assumption — Technical | 文件採 `upstream-v5-alignment` 命名，作為新需求而不覆寫已核准的 v4 autonomy requirements | 使用者要求自主處理可逆選擇；canonical resolver 已驗證新 key |

### Baseline observations

來源為 `sd0x-harness` v5.0.0、HEAD `7805e98510943f45e57f9856966172401cff0c40`；Codex 比較基準為 v0.5.4、HEAD `6782d7f`。來源工作樹盤點時 clean，未執行來源測試或查證線上新版本。

在本次自主推進指令修改**之前**，managed block 為 2,694 UTF-16 code units／36 行；86 個磁碟完整 descriptions 合計 14,751 code units。本 session 原始 registry 的 descriptions 合計 4,508 code units，86 行 catalog 加名稱及 alias path 合計 10,441 code units，不含 root 宣告與外層包裝。這些是特定版本的不同載體數字，不代表整個 session 大小或 token 節省。後續修改需重新建立基準。

既有來源盤點的 F0 相容性修正已有 0.159.2 successor 紀錄，不列為本需求尚待實作的缺口。F1–F2 的載入與契約證據仍是主要需求；本文件不宣稱它們已完成。

## 8. Acceptance Signals

- FR-1／NFR-1：相同輸入可重現分載體報告，未知值與量測排除項清楚可見。
- FR-2／FR-4：一般文字案例的觀察紀錄包含必要契約讀取，不能只靠回覆列出的路徑通過。
- FR-3／NFR-4：移除、拒絕讀取或替換錯版本的必要契約後，依賴它的動作不會執行；獨立工作仍有結果。
- FR-5：精簡前後可比的成本下降且必要行為維持，未觀察到的改善不宣稱達成。
- FR-6：每個新增提示對應重現案例，沒有新增 reviewer 或 verification authority。
- FR-7／NFR-2–5：安裝、生效及 preservation 證據完整；最終變更通過同 fingerprint 的既有 gates。

## 9. Open Questions

- Codex 的持續載入成本預算應如何定義？待建立相同口徑的量測後再決定門檻。
- 哪些 native session 觀察能可靠區分未讀、讀取失敗、讀取錯版本與部分讀取？此為 `feasibility-study` 的驗證問題。
- 代表案例應涵蓋哪些 task/mode 組合，才值得增加契約提示或精簡入口？先以真實漏讀證據決定。
- 尚未證明 native 描述缩短會造成路由錯誤；不可把呈現差異直接列成已確認的行為缺陷。

## 10. References

- [來源差異與續接紀錄](../../../migration/upstream-evolution-2026-09-30.md)
- [既有 autonomy requirements](../contract-driven-autonomy/1-requirements.md)
- [Canonical workflow contract](../../../plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract.js)
- [受控技能 evaluator](../../../scripts/skill-behavior-eval.js)
- [Current alias capability evidence](../../../migration/alias-capability.json)
- Source checkout `../sd0x-harness` at the pinned HEAD: `README.md:122`, `CLAUDE.template.md:28`, `test/rules/residency-budget.test.js:147`, `test/rules/contract-read-failure.test.js:18`.

## 11. 完整 v5 差異擴充（2026-10-03，覆蓋前述窄範圍假設）

本輪使用者明確授權完整適用 v5 功能。第 7 節「Git/部署另立需求」及僅聚焦 F1–F2 的舊假設不再限制本輪範圍；保留文字作為原始草稿歷史。本節連同第 0 節與 coverage.md 為當前需求。

- FR-14：文件 taxonomy、四種 authority roles、preamble metadata、split main、完整 source sets、shape validation、scan unknown、canonical ambiguity 與所有適用 consumer 必須原生接入；不能把歷史文件硬改成現行規格。
- FR-15：exact feature intent 必須具備只建立缺檔、既有內容保留、錯 key strays、最多 60 行／3–7 INV-nnn，以及規劃、實作、修錯、request 與 next-step 的適用讀取／衝突處理。
- FR-16：repo-intake 支援 bounded manifest map 的 Node/PHP/Go/Rust/Python 工作區、保守 candidate membership、直接 reverse、迴圈、coverage／omission 與完整 bounded JSON；宣告依賴不冒充 runtime impact，輸出須 redaction。
- FR-17：reference-stability 以最多五個明確檔案做同類語意 anchor 轉換，保護 executable/data/directive/history，逐檔量測且仍欠 outer gates。
- FR-18：read-only orchestration 檢查 ignored content、目錄與 Git 控制資訊；明列有限排除。Verifier 無專案檢查時不得只靠 Git policy checks 通過，並涵蓋 Kotlin Gradle、Maven、Ruby 與空 Node fallback。
- FR-19：security-review 採用已查證的 OWASP Top 10:2025，包括 A03 supply chain、A10 exceptional conditions 與 A01 SSRF；每個分類區分已查、具理由不適用、未查。

上述需求的適用性由固定來源逐檔差異與目標實作決定，與新 commit 數無關。新增 runtime 的來源演算法使用原生固定 root／CLI transport，保留 MIT attribution；不得匯入 Claude locator、event payload 或 fallback reviewer authority。

- FR-20：smart-commit 除 message attribution 外，必須有 effective/configured identity、合法 valueless／empty／unset／read failure 區分、scope-aware helper 信任與完整 all-ref newly reachable commit readback。第一次 commit、side-ref attribution、unknown concurrent origin、ancestry overlays、command failure/timeout 後副作用都不得被單一 HEAD 或 exit code 掩蓋。
- FR-21：seek-verdict clarify 的影響程度需獨立於可處置性，以信心 0.70 分界；不取得 dismissal 或 primary gate authority。Independent assessor 未執行則為 UNAVAILABLE，不提供偽造 confidence／policy mapping。
- FR-22：ref/base 與 remote mapping 的歧義、失敗、negative exclusions 不可猜測；delegated implementation 的 Git mutation 邊界與前後 persistent drift 必須可觀察，並明列無法證明中間無暫態 mutation。

- FR-23：原生 Git hook installer 必須具備 default commit-msg guard、明確 opt-in pre-push、Husky/core.hooksPath/direct/fallback 的具體路由、foreign ownership preservation、installed/pending/declined 續接與安全移除。Git hook 不等於 Codex event hook；written、current bytes、Git-resolved active routing 與真實執行分開。外部 hook path 由其 owner 處理，不默認取得外部寫入權。
- FR-24：branch review 明確選用 dual 時提供 fresh advisory secondary；debug 的獨立根因確認使用 fresh neutral context，不傳入 parent 結論。兩者都不替代 configured primary gate；缺 capability 或 subject drift 不宣稱確認。
