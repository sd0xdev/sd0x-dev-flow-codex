# 全面 Agent 指令系統改版審計（2026-09-06）

> 狀態：全面改版的持久化調查與決策紀錄；本文件不是 review、verify 或 reload 通過證明。
> 範圍：86 個 live skills、其 instructional references、discovery metadata、生成來源，以及 managed AGENTS／reviewer／hook 的一致性。
> 前階段：[核心指令審計](./instruction-system-audit-2026-09-06.md) 保留為歷史階段；該階段的核心完成不能代表本輪全範圍完成。

## 1. 結論與完成定義

方向是讓模型依問題、證據與風險決定探索、批次、格式、協作與檢查時機，同時保留真正的權限、資料完整性、來源身分、可執行介面與完成證據。全面改版不能只刪掉 generic Protocol，也不能保留原本不符合目標的 helper，再用較自主的文字掩蓋它。

本輪已完成 A–M 與 N–Z 的現行指令語意盤點及實際改寫，並將研究／辯論的模型來源與分數完成權限納入實作修改。最終交付仍須以全部更新後的 payload、generator、migration contracts 與正式 successor evidence 一致性，以及同一最終 fingerprint 的 configured-primary review → deterministic verify 為準。完整 `npm run check` 與重載後真實 SessionStart activation 尚須由主流程完成並記錄。本報告不沿用先前 clean 文字、舊 fingerprint 或 focused tests 宣稱當前關卡通過。

「全面涵蓋」指每個現行技能與指令參照都經分類並有保留或修改理由，不要求把有效的領域知識全部重寫，也不以刪除行數或 changed-file 數量作為成功條件。第三方 plugins、全球 Codex home、歷史 migration/staging/packs 與來源 repository 不屬改寫目標。

## 2. 調查方法與盤點邊界

兩份改寫前審計共涵蓋 **86 個 SKILL.md、52 個 instructional references，共 138 個來源**：A–M 35 技能／58 來源，N–Z 51 技能／80 來源。參照包括 Markdown 與 orchestrate 的 typed admission JSON；不將 deterministic scripts 誤算成一般指令文件。兩份審計將 1,273 個 section groups 分類，列出 146 個具體保留／改寫決策。Section 可同時具有多種語意；這些數字不是精確句子數、缺陷數或常駐 token 量。

先閱讀來源、分類並提出整體架構，再改寫 live 檔案。初始只讀審計將 helper/schema 依賴標出；之後對存在真實行為差異的 helper 另行修改並新增 accepting/rejecting tests。這區分了「改寫前建議」與「實際程式已支援的行為」。早期 rewrite logs 中的 pending 項目是當時交接狀態，不能直接當作目前仍未修正，也不能因為已修改正文就當作 helper 已完成。

改寫前有 41 個重複 generic Protocol wrapper，包含固定的 resolve → inspect → smallest plan → apply/read-only → re-read/report。這些 wrapper 與其後的任務正文重複；例如 zh-tw 的通用 Result 要求 scope、verification、follow-up，直接抵觸其「只回傳翻譯內容」的真正輸出需求。另有 discovery description 直接序列化整份 routing registry，與正文 machine routing contract 重複。新版 discovery 應是可讀用途摘要，canonical 正負 routing cases 仍維持獨立契約與歷史相容。

較早核心盤點的 431 個來源包含歷史、project/install、fixture 與其他 runtime/config surfaces，統計母體不同，不能與本報告的 138 個現行技能指令來源直接比較大小或宣稱縮減比例。Generator 補漏另列於第 5 節。

## 3. A–H 分類與取捨

| 類別 | 定義 | 處置原則與具體例子 |
|---|---|---|
| A | 領域知識 | 保留需求／設計分層、API 解碼信心、request 狀態、版本與來源出處、部署與回復資訊。 |
| B | 不變量、權限、安全或 schema | 保留精確 fingerprint、唯讀 reviewer、payload identity、路徑 containment、來源簽章、原子送出/readback、未授權不執行。 |
| C | 完成條件 | 保留需求涵蓋、可觀察行為、可重現證據與真正 gate；分數或輸出標籤不得自行建立完成權限。 |
| D | 實質偏好或產品範圍 | 保留 readiness-only、response-only、既有 index commit、bounded removal 等明確產品範圍；一般格式與深度偏好可按問題調整。 |
| E | 通用微管理／舊模型 workaround | 去除強制 full scan、每 slice 重跑、固定圖表／行數／問題數、無證據的調查次數要求。 |
| F | 重複或歷史噪音 | 合併 generic wrapper、重述完成 checklist、完整 discovery registry；歷史 provenance 不作現行規則載入。 |
| G | 衝突或誤導權限 | 修復 sole authorization policy、已有授權仍強制 later turn、失效 @ 路徑、假 auto-trigger、gate pass 等同 user goal complete。 |
| H | 宿主／模型特定 | 使用 Codex subagent lifecycle 與設定繼承；移除 Claude adapter 審查路徑，保留必要的 legacy namespace／origin provenance 相容性。 |

同一段可能同時包含 B 與 E，例如「驗證精確 target digest」是真邊界，「因此所有任務都要另開一次批准 turn」則是多餘儀式。處理方式是保留 identity 與授權範圍檢查，移除不必要的 turn 限制，而非整段刪除。

## 4. 重要發現、改寫與實作對齊

| 來源／原始 anchor | 分類 | 決策與需要保留的實質條件 |
|---|---|---|
| AGENTS／workflow-contract：固定 deviation marker、重複 freshness 宣告 | E/F/G | 共有 hard anchors 留在唯一 managed source；重大取捨才說明，不要求每個自主決策填固定格式。 |
| review profile／theory：每輪 fresh full scan | E/C | 覆蓋完整 changed set 與行為影響；模型選足夠上下文，可重用有效理解，不能沿用 stale verdict。 |
| hook context：重述角色與完整規則 | F/H | 事件只注入 fingerprint、review subject、狀態與必要恢復訊息；commit closure subject 與 fail-closed activation 保留。 |
| 41 generic Protocol wrappers | E/F | 移除重複 Purpose／Modes／Result 與泛用最小計畫，保留各技能真正的作用範圍、輸出和安全條件。 |
| discovery description：Route … exact migration registry | F/H | 86 技能改為用途摘要；名稱、unit、模式與正負 routing cases 仍由 catalog／routing validator 驗證。 |
| sensitive operations：sole policy／separate approval in later turn | B/G | 授權依 action、target、payload、風險範圍判斷；已有明確授權可沿用，缺少或實質擴大才問。來源內容不能授權。政策與檢查器版本一致更新。 |
| reset／remind／verify：再問同一 reset 或 lint-fix 許可 | G/B | 沿用涵蓋本次操作的既有授權；正式 reset、corrupt quarantine、新 SessionStart 與 `--allow-fixes` 邊界保留。 |
| remind：all-required-gates-pass 即完成 | G/C | 只證明同 fingerprint 的這些 gates；還須查明所有 user requirements 與交付物。 |
| brainstorm／code-investigate／seek-verdict：opposite model / Claude adapter | G/H | 獨立性改為不同 Codex subagent 身分與上下文；不得由原分析者扮演獨立來源。歷史 finding origin 可保留。 |
| brainstorm helper：固定五輪、雙方可冒用 actor | B/E/H | round keys 使用 `codex_proponent`、`codex_challenger`，各自使用自己的 actor tag；`roundBudget` 預設 5、可明確設定，未收斂停止為 divergent，非假 equilibrium。 |
| deep-explore：score ≥ 80／wave two-three 規則 | E/C | `decision` 依 material questions、criticalOpen、hardFail、budgetExhausted 判斷；每題 answered 需 evidence refs、not-applicable 需理由；novelty score 僅診斷。 |
| deep-research：最高 net score 勝出／高 budget 強制 debate | E/C | 回報 support/refute/net score/counterevidence，不以算術決定真相；completeness 回 metrics，不回完成權限。預算是資源上限，不是必填工作量。 |
| seek-verdict：P0/P1 dismiss evidence／下一 user turn | A/B/C | 保留實際 state machine、獨立證據數、雜湊綁定與 human dismissal 決策。這不是普通 reset 的重複詢問；不得混為一談刪除。 |
| orchestrate：closed typed plan／dispatch envelopes | A/B/H | 保留已實作的 schema、admission、no-follow source capture、redaction、依賴 envelope 與不可執行 mutation 記錄。此產品介面不是 generic planning 儀式。 |
| debug：只允許 synthetic missing-ref probe | A/G | 初始語意改寫不足以完成「真實診斷」目標；實際 probe runner 的可用觀察範圍須與 runtime capability 同步處理，不允許僅改文字宣稱已可執行。 |
| dev-security-audit：secret prefix/suffix、always copy/archive | B/G | 以 metadata／非可逆識別為主；不輸出 credential 片段，不暗中保存或外傳鑑識內容。metadata presence 不等同 confirmed compromise；案例 intelligence 必須有來源與時間。 |
| doc-refactor：AGENTS <50／rules <30／固定 diagram | E/D | 以資訊保留、清楚、引用正確與約束無衝突驗收；格式依用途選，不以行數成功。 |
| refactor／feature-dev：after each slice checks | E/C | 模型依風險決定批次與 focused checks；保留 before/after proof、integration coverage 及最後 gates。 |
| req-analyze：固定 5-Why／每模式四種 stakeholder／三頁 research | E/D | 說明 underlying need、實際 stakeholder 與材料性未知；不為配額製造角色、研究或反問。 |
| recap-doc／project-brief／smart-commit：5/10/15 files、三問、三層、15 files | E/D | 未找到相應 live JS/JSON 執行限制的呈現配額改為 scope coverage／audience needs／coherent staged subject；真正 byte/time 與原子操作上限保留。 |
| update-docs：@rules/auto-loop.md／不存在 feature-context-resolution.md | G/H | 改用實際 create-request resolver，明確目標可直接選定；parent 自行安排同步，不宣稱 implicit precommit hook。任何 edit 重開新 fingerprint gates。 |
| timeout 即 failure、重新 dispatch／重跑 | G/B | 觀察逾時不等於 work terminal；確認同一 live handle，繼續觀察，未知寫入結果不重複提交。實際被 runner 終止的 timeout 才按該 terminal evidence 處理。 |
| pack handoff：Core discovery Forbidden | F/G | 區分當前 core canonical owner 與 former pack；歷史檔案保留，移除 runtime 必讀指令。 |
| source-semantic assertions 固定舊文字 | B/E/F | schema、安全與拒絕／接受行為需維持測試；純 prose 拼寫與固定探索流程不能迫使新版回復舊指令。 |

### 已對齊的 helper 介面

[brainstorm debate](../plugin/sd0x-dev-flow-codex/skills/brainstorm/scripts/debate.js) 與 [seek-verdict state](../plugin/sd0x-dev-flow-codex/skills/seek-verdict/scripts/verdict-state.js) 的 native actor／verifier 修改，已有 `test/research-native-review.test.js` 的 7 項 focused checks：正確獨立 actor 接受、legacy/cross-side 拒絕、evidence/novelty integrity、提前停止與預算、無效 options、verifier 選擇、golden/live 一致性。

[deep-explore completeness](../plugin/sd0x-dev-flow-codex/skills/deep-explore/scripts/completeness.js) 與 [deep-research metrics](../plugin/sd0x-dev-flow-codex/skills/deep-research/scripts/research-score.js) 的行為修改，已有 `test/research-coverage-decisions.test.js` 的 7 項 focused checks：question coverage、critical gap 阻擋、justified NA、無效 schema 拒絕、高分不宣稱完成、反證保留、可選預算和資源上限。

這些 focused results 只證明各自被測的 accepting/rejecting 路徑。來源簽章、identity、dedup、dispatch anti-cross-seeding 與 dismissal transaction 保持原有邊界，仍須在全套測試與最終 primary review 中核對，不能由上述 14 項結果推導整案通過。

## 5. 架構與 generator 補漏

| 層 | 真正來源與同步面 | 責任 |
|---|---|---|
| Project guidance | `AGENTS.md`、`scripts/runtime/workflow-contract.js`、setup 的 managed block | 保留使用者內容，唯一生成共有 anchors/defaults；一般文件不自行覆寫權限層級。 |
| Reviewer | `templates/agents/sd0x-codex-primary-reviewer.toml` → setup → `.codex/agents/` | configured read-only primary、parent model/effort inheritance、terminal parser output。 |
| Hook | `hooks/hooks.json`、`scripts/runtime/hook.js`、state/collaboration | 事件 adapter、身分與 fingerprint 事實、正式 activation；不將 Claude payload 假設移植。 |
| Discovery/routing | `scripts/skill-discovery-catalog.json`、`scripts/skill-routing-test.js`、skill frontmatter、canonical routing blocks | 用途摘要與 route ownership 分離；immutable historical metadata 維持可解析相容。 |
| Authorization | `scripts/skill-authorization-policy.js`、generator、operation declarations／migration validators | 單一版本化 policy，已有授權範圍沿用；拒絕缺少真正權限的 sensitive mutation。 |
| Large template generator | `scripts/prepare-planned-formal-plugin.js` | 初始 431-source inventory 遺漏的關鍵指令來源；保存正文、參照、authorization wrapper 與部分 script payload，不可只修 live copy。 |
| Wave templates | `scripts/skill-wave-plans.json` | 另一份會重新產生技能正文的來源；既有 domain workflows 與新版 autonomy 語意必須一致。 |
| Helper golden sources | `scripts/research-validators/{brainstorm,seek-verdict,deep-explore,deep-research}.js` → live scripts | 同步真的 runtime behavior；保持 copies 一致，不靠在 SKILL 宣告不同功能。 |
| Migration validation | skill `migration-contract.json`、source-semantic／research-contract tests、`scripts/skill-migration-audit.js` | Current successor、payload hash、preflight identity 與實際能力一致；歷史 owner 與 provenance 不手改。 |
| Operational docs | `docs/PROJECT-MIGRATION-GUIDE.md`、本報告與 upstream continuation record | reload matrix、host lifecycle、觀察逾時與證據限制；不是 runtime pass ledger。 |

Generator rewrite log 記錄 64 個 template 同步點與 10 個 wave-plan 變更。它記錄的是同步當時的 live bytes；後續 helper／policy／正文修改仍必須回寫同一 named template owner。不能因為 generator syntax check 通過就推斷最終產物相同，也不能執行 bulk generator 後不檢查是否覆蓋了新版正文。

## 6. 隔壁來源的採納與不採納

沿用前階段只讀調查紀錄：`../sd0x-harness`，當時 HEAD `04e8a5e3f5d9c482937c2ad2170fab5fbd02b630`、v4.6.2，當時 worktree clean。本文件沒有重新操作或修改該來源，也不將這個歷史 clean 觀察宣稱為當前所有外部狀態。

參考來源為 `CLAUDE.template.md`、`rules/auto-loop.md`、`rules/codex-invocation.md`、`rules/scope-discipline.md`、`rules/fix-all-issues.md`、`hooks/stop-guard.sh`、`hooks/post-skill-auto-loop.sh`，以及 rules-residency 的 `2026-08-29-extract-on-demand-contracts-r1.md` request。採納常駐規則／按需程序分離、hook factual state、模型自行判斷探索批次、依具體未證明行為擴大 assurance 的方向。

不採納來源的固定 Git 探索順序、tier/round 儀式、Claude-specific hooks／agents／bridge、fallback gate reviewer 與以加強 meta-guards 取代問題解決。獨立審查、permission continuity 與 scope completion 必須在 Codex 本身的 lifecycle 和正式 evidence 路徑上成立。相關研究只提供 instruction density／context residency 的設計動機，沒有提供本 repository 缺陷率改善的量化證明。

## 7. 五種任務情境與驗收證據

| 情境 | 模型自行決定 | 必須保留的邊界 | 驗收方式 |
|---|---|---|---|
| 小 bug fix | 最有診斷力的讀檔、修補批次、focused check 次序；不強制完整計畫／full-file 重讀 | 具體 failure/invariant、必要 regression proof、同 fingerprint review → verify | 接受有效修復並記錄最終 gates；不要求每 slice 所有檢查，也不把舊結果當新 fingerprint。 |
| 多檔 feature | AC 驅動的調查、實作分組、圖表、可獨立的 Codex subagent 任務 | 需求 traceability、架構與授權範圍、完整 changed-set coverage | 每項實際 AC 有證據或明確 gap；不能為了較容易通過而縮成已完成的核心 subset。 |
| 事故／debug | 有價值的唯讀觀察、替代假說、恢復時機 | 真實 probe capability、秘密遮蔽、外部動作授權、unknown mutation 不重送 | 分清 reported/observed/confirmed；同 live handle 逾時繼續觀察；不偽造 production reproduction 或自動外傳鑑識內容。 |
| 重構／文件重整 | 變更批次、解說深度與呈現、按資料選 references | 行為與關鍵資訊不流失、使用者內容保護、source/target identity | 檢查 observable behavior 與完整資料涵蓋；行數、固定圖表、問題數不是完成指標。 |
| Infra／migration／release | source 比較、相容設計、checks 的合理安排 | readonly upstream、精確 OID／payload／簽章、hooks、recovery、正式 reload | 先完成可 review 的本地產物與正式 evidence；source-only 更新不得宣稱 host registry 已重載。 |

情境表記錄對新指令的五種代表任務檢查：上下文、裁量空間、衝突、授權與完成條件均依表中邊界評估；不是已執行五次端到端使用者任務的宣稱。每個 helper 的測試 scope 與整個產品流程的驗收 scope 必須分開。

## 8. 尚待完成與不可逾越的限制

1. 已核對 helper 與正文：debug 的 synthetic-only probe 是現有執行能力界線，保留唯讀調查與明確 blind spots；request verifier 的實際 caps/deadlines、來源 intelligence 的查證／時效界線均保留。Primary 指出的 bump-version owner 錯誤已修正，詳見下方修復紀錄。
2. 最終正文、discovery、v2 authorization、canonical routing／semantic contracts、generator／golden sources 與正式 successor ownership 全部一致。早期 rewrite logs 的 staged pending 不替代當前檔案檢查。
3. 更新正式 payload/preflight evidence，使用 installed skill 的正式 review/provider → snapshot → round → configured Codex primary terminal → import/gate 路徑。不得手改 runtime 或以 parent prose 補上缺失 transcript/marker。
4. 若 transport adapter 無法使用，fresh native configured subagent 的真實 start/terminal lifecycle 才能建立新 round；followup 完成的 agent 不會自動產生新的 native start。Observation timeout 本身不能證明 reviewer 或 verifier 已停止。
5. 最終修改後重新 configured-primary review，再執行 deterministic verifier，包含完整 `npm run check`。Review／verify 在本報告產生時仍視為待最終有效證據確認；舊 clean、上階段 pass、focused tests 均不得代替。
6. `SKILL.md`、payload path、manifest 等更新必須依 [reload matrix](../docs/PROJECT-MIGRATION-GUIDE.md) 關閉舊 Codex、repository-only unlink/link/status、以本專案 `.codex-dev-home` 重新啟動並建立新 task。Hook hash 改變還需 `/hooks` trust；doctor 必須檢查真實 SessionStart activation。不可修改全球 home 或手造 activation。
7. Reset 只使用已授權範圍與正式 entrypoint；corrupt runtime 的 quarantine／新 session 要求維持。Reset 不讓任何 gate 通過。上游來源保持唯讀，不建立 worktree，不 commit／push。

### 彙整時的主流程進度

主流程回報的最新局部驗證為：research focused **24 pass／0 fail**、三個 workflow 修復 **6 pass**、historical prepare 隔離 **3 pass**，以及 **69 個 shipped JavaScript** 的 syntax check 通過。Research 的 24 項包含相關 helper 驗證，不能再與本報告前列的兩份 7 項 focused checks 相加宣稱新的測試總數。Historical prepare 的修正使缺少 current owner 的歷史準備成為唯讀 no-op，避免重新覆蓋現行產物。這些是局部驗證，尚不是完整 `npm run check` 或本輪 gate pass。

本輪已為 **95 個 canonical units** 建立 successor requests；它們對應 **85 個 migrated live skills**，加上獨立的 reset，共 **86 個 live skills**；同一技能可有多個模式。Registry 的 **0/95 delivered** 表示這次全面 revision 的交付證據全部重新待驗，**不是刪除 95 個單位，也不是沒有 live payload**。正式 preflight 前須凍結相關檔案；之後任何修改都要依實際身份與 fingerprint 重新判定 evidence freshness。

## 9. 86 個技能的覆蓋紀錄

下表逐一列出 live canonical entrypoint、A–H 語意分類與本輪處理主旨。分類是改寫前 section／finding 的聚合；不是宣稱每個技能都有全部類型的缺陷。Canonical routing、metadata、runtime 證據等共同工作適用於每個技能。保留有效正文同樣是經審查的決定。

| 技能 | 分類 | 調查／改寫主旨 |
|---|---|---|
| [architecture](../plugin/sd0x-dev-flow-codex/skills/architecture/SKILL.md) | A,B,C,D,F,H | Create or update a feature architecture document grounded in its approved technical specification and repository boundaries. Use for component design and consequential decisions, not implementation or feature requirements. |
| [architecture-advice](../plugin/sd0x-dev-flow-codex/skills/architecture-advice/SKILL.md) | A,B,C,D,F,H | Compare architecture choices and offer an evidence-backed second opinion. Returns advice without writing lifecycle documents or implementation. |
| [ask](../plugin/sd0x-dev-flow-codex/skills/ask/SKILL.md) | A,B,C,D,F,H | Answer bounded repository questions using attributable code, guidance or Git evidence. Read-only; broader investigation and implementation belong to their dedicated workflows. |
| [best-practices](../plugin/sd0x-dev-flow-codex/skills/best-practices/SKILL.md) | A,B,C,D,F,H | Assess a named implementation against current authoritative standards and identify substantiated gaps. Read-only; does not turn generic preferences into project requirements. |
| [brainstorm](../plugin/sd0x-dev-flow-codex/skills/brainstorm/SKILL.md) | A,B,C,D,F,H | Codex proponent/challenger 身分，own-actor 檢查，明確資源預算與真實 divergent/equilibrium。 |
| [bug-fix](../plugin/sd0x-dev-flow-codex/skills/bug-fix/SKILL.md) | A,C,D,F,H | Diagnose and correct a concrete bug with regression evidence, then complete configured review and deterministic verification. Preserve unrelated user changes. |
| [bump-version](../plugin/sd0x-dev-flow-codex/skills/bump-version/SKILL.md) | A,B,C,D,F,H | Synchronize the requested semantic version across authoritative package and plugin release metadata. Does not publish a release or modify unrelated fields. |
| [check-coverage](../plugin/sd0x-dev-flow-codex/skills/check-coverage/SKILL.md) | A,B,C,D,F,H | Map a feature’s behaviors and failure boundaries to existing unit, integration and end-to-end tests. Produces an evidence-backed gap analysis without editing tests. |
| [code-explore](../plugin/sd0x-dev-flow-codex/skills/code-explore/SKILL.md) | A,B,C,D,F,H | Explain how a repository subsystem, execution path or data flow connects using source evidence. Read-only; does not implement proposed changes. |
| [code-investigate](../plugin/sd0x-dev-flow-codex/skills/code-investigate/SKILL.md) | A,B,C,D,F,H | Investigate a specific mechanism or suspected root cause through independent Codex analysis and repository evidence. Returns a causal assessment without editing code. |
| [contract-decode](../plugin/sd0x-dev-flow-codex/skills/contract-decode/SKILL.md) | A,B,C,D,F,H | Decode EVM selectors, calldata and revert payloads using supplied or verified ABI evidence. Distinguishes verified decoding from ambiguous signature candidates; no chain mutation. |
| [create-pr](../plugin/sd0x-dev-flow-codex/skills/create-pr/SKILL.md) | A,B,C,D,F,H | Prepare, create or update one GitHub pull request using the branch diff and repository conventions. Validates the target and exact payload before publication. |
| [create-request](../plugin/sd0x-dev-flow-codex/skills/create-request/SKILL.md) | A,B,C,D,F,H | Create, update or inspect date-prefixed execution tickets and verify their acceptance criteria. Durable completion uses the runtime closure transaction; does not implement the ticket. |
| [de-ai-flavor](../plugin/sd0x-dev-flow-codex/skills/de-ai-flavor/SKILL.md) | A,B,C,D,F,H | Remove generic writing filler and unsolicited self-attribution while preserving facts, technical meaning, quotations and the author’s voice. |
| [debug](../plugin/sd0x-dev-flow-codex/skills/debug/SKILL.md) | A,B,C,D,F,H | 保留 sanitized bounded probes；synthetic-only helper 能力與真正診斷目標須另核實完成。 |
| [deep-explore](../plugin/sd0x-dev-flow-codex/skills/deep-explore/SKILL.md) | A,B,C,D,F,H | 以 material question coverage 決定停止；novelty score 僅診斷，取消固定波數。 |
| [deep-research](../plugin/sd0x-dev-flow-codex/skills/deep-research/SKILL.md) | A,B,C,D,F,H | 保留來源身分／簽章／dedup／trace；分數非真相，budget 是上限而非必做工作。 |
| [dep-audit](../plugin/sd0x-dev-flow-codex/skills/dep-audit/SKILL.md) | A,B,C,D,F,H | Audit exact resolved dependencies for current security, provenance and maintenance risks. Contextualizes advisories without installing or changing dependencies. |
| [dev-security-audit](../plugin/sd0x-dev-flow-codex/skills/dev-security-audit/SKILL.md) | A,B,C,D,F,H | 不輸出 secret 片段、不自動保存鑑識；metadata/exposure/confirmed compromise 分開，案例需來源。 |
| [doc-refactor](../plugin/sd0x-dev-flow-codex/skills/doc-refactor/SKILL.md) | A,B,C,D,F,H | 資訊與約束保留，不以 AGENTS／rules 行數或固定 diagram 作成功標準。 |
| [doc-review](../plugin/sd0x-dev-flow-codex/skills/doc-review/SKILL.md) | A,C,D,F,H | Review documentation against current repository behavior, sources and the intended audience. Returns factual defects and readiness without editing. |
| [doctor](../plugin/sd0x-dev-flow-codex/skills/doctor/SKILL.md) | A,F,H | Diagnose local plugin installation, real hook activation, reviewer configuration and fingerprint-bound gates through the official read-only runtime entrypoint. |
| [epic-merge](../plugin/sd0x-dev-flow-codex/skills/epic-merge/SKILL.md) | A,B,C,D,F,H | Execute an explicitly authorized squash-merge of a validated linear pull-request stack with exact leases, review/CI checks and recoverable checkpoints. Does not generalize to arbitrary branch merging. |
| [explain](../plugin/sd0x-dev-flow-codex/skills/explain/SKILL.md) | A,B,C,D,F,H | Explain selected code at the requested depth using relevant source and caller evidence. Read-only; avoids expanding a focused explanation into unrelated investigation. |
| [feasibility-study](../plugin/sd0x-dev-flow-codex/skills/feasibility-study/SKILL.md) | A,B,F,H | Assess whether an outcome is feasible under verified technical and operational constraints, comparing credible approaches and uncertainty. Does not invent requirements or authorize implementation. |
| [feature-dev](../plugin/sd0x-dev-flow-codex/skills/feature-dev/SKILL.md) | A,B,F,H | Implement a coherent feature from its accepted scope through behavior-focused acceptance evidence and configured review/verification gates. |
| [feature-verify](../plugin/sd0x-dev-flow-codex/skills/feature-verify/SKILL.md) | A,B,C,D,F,H | Verify deployed feature behavior using allowlisted read-only probes, logs and metrics bound to an exact environment and deployment. Does not satisfy the repository deterministic verification gate. |
| [fp-brief](../plugin/sd0x-dev-flow-codex/skills/fp-brief/SKILL.md) | A,B,C,D,F,H | Analyze a proposal from first principles, exposing assumptions, causal reasoning, alternatives and decision sensitivity. Returns a read-only briefing. |
| [generate-runner](../plugin/sd0x-dev-flow-codex/skills/generate-runner/SKILL.md) | A,B,C,D,F,H | Generate or update a contained repository check runner from the supported ecosystem’s closed command catalog. Does not install dependencies or run the generated file. |
| [git-investigate](../plugin/sd0x-dev-flow-codex/skills/git-investigate/SKILL.md) | A,B,C,D,F,H | Trace code history, renames and candidate regressions using exact commits and patches. Strictly read-only Git archaeology; does not fetch or change repository state. |
| [git-profile](../plugin/sd0x-dev-flow-codex/skills/git-profile/SKILL.md) | A,B,C,D,F,H | Inspect or update repository-local Git identity and signing profiles with explicit scope and verified configuration. Does not alter global settings or store secret key material. |
| [issue-analyze](../plugin/sd0x-dev-flow-codex/skills/issue-analyze/SKILL.md) | A,B,C,D,F,H | Classify a reported issue and investigate its likely cause, severity and next verification step using repository evidence. Independent Codex verdicts may inform analysis; no fix or external write. |
| [jira](../plugin/sd0x-dev-flow-codex/skills/jira/SKILL.md) | A,B,C,D,F,H | Inspect a Jira issue or carry out one explicitly authorized issue, branch-metadata or transition workflow. Validates the exact site, issue and payload before mutation. |
| [load-pr-review](../plugin/sd0x-dev-flow-codex/skills/load-pr-review/SKILL.md) | A,B,C,D,F,H | Load existing GitHub review threads, assess their relevance and draft evidence-backed replies. Read-only; publication and thread resolution belong to a separately authorized workflow. |
| [merge-prep](../plugin/sd0x-dev-flow-codex/skills/merge-prep/SKILL.md) | A,B,C,D,F,H | Analyze source branches against an exact target for ancestry, changed paths and likely conflicts. Does not merge, mutate refs or claim readiness without required evidence. |
| [necessity-audit](../plugin/sd0x-dev-flow-codex/skills/necessity-audit/SKILL.md) | A,B,C,D,F,H | Challenge whether proposed requirements or architecture need to exist now, using user value, status quo, alternatives, and carrying cost. Returns a read-only necessity verdict; implementation feasibility and plan review belong elsewhere. |
| [next-step](../plugin/sd0x-dev-flow-codex/skills/next-step/SKILL.md) | A,B,C,D,H | Recommend the next action from the user objective, current repository state, and fingerprint-bound review and verification evidence. Advice only; does not dispatch workflows or mutate state. |
| [obsidian-cli](../plugin/sd0x-dev-flow-codex/skills/obsidian-cli/SKILL.md) | A,B,C,D,H | Search a selected Obsidian vault or perform one authorized note or task update through the official CLI, with exact-target validation and readback. Excludes bulk edits, deletion, and direct Markdown editing. |
| [op-session](../plugin/sd0x-dev-flow-codex/skills/op-session/SKILL.md) | A,B,C,D,H | Diagnose existing 1Password CLI session readiness using non-secret metadata and explain supported interactive setup. Does not sign in or read secrets. |
| [orchestrate](../plugin/sd0x-dev-flow-codex/skills/orchestrate/SKILL.md) | A,B,C,D,H | 保留已實作 typed plan／admission／envelope／read-only 邊界，修正 observation timeout。 |
| [plan-review](../plugin/sd0x-dev-flow-codex/skills/plan-review/SKILL.md) | A,B,C,D,F,H | Independently review an implementation or migration plan for goal coverage, ordering, repository fit, risks, and verification. Returns findings and readiness without editing the plan or satisfying the code-review gate. |
| [portfolio](../plugin/sd0x-dev-flow-codex/skills/portfolio/SKILL.md) | A,B,C,D,H | Explain a repository’s portfolio API, provider routing, normalization, aggregation, and caching from code and supplied evidence. Does not query live wallets or providers. |
| [post-dev-recap](../plugin/sd0x-dev-flow-codex/skills/post-dev-recap/SKILL.md) | A,B,C,D,H | Create an evidence-backed recap of a completed change through recap-doc and support user-requested follow-up questions. Preserves repository and gate state outside the recap artifact. |
| [post-dev-test](../plugin/sd0x-dev-flow-codex/skills/post-dev-test/SKILL.md) | A,B,D,H | Run repository-native tests appropriate to a completed implementation and classify failures. Collects development feedback without recording the deterministic verification gate. |
| [pr-comment](../plugin/sd0x-dev-flow-codex/skills/pr-comment/SKILL.md) | A,B,C,D,H | Validate and publish one authorized atomic batch of inline GitHub pull-request comments against an exact head and diff. Revalidates positions and verifies the created review. |
| [pr-review](../plugin/sd0x-dev-flow-codex/skills/pr-review/SKILL.md) | A,B,C,D,H | Perform an author’s read-only pull-request readiness assessment of an exact comparison. Does not publish comments or replace configured primary review. |
| [pr-summary](../plugin/sd0x-dev-flow-codex/skills/pr-summary/SKILL.md) | A,B,C,D,H | List and group open pull requests for one repository with filters, ticket relationships, and explicit truncation. Does not change pull requests. |
| [pre-pr-audit](../plugin/sd0x-dev-flow-codex/skills/pre-pr-audit/SKILL.md) | A,B,C,D,H | Audit local branch readiness for a pull request using scope, commits, acceptance criteria, and current gate evidence. Returns READY, CONDITIONAL, or BLOCKED without publication. |
| [project-audit](../plugin/sd0x-dev-flow-codex/skills/project-audit/SKILL.md) | A,B,C,D,H | Assess repository engineering and open-source health across implementation, tests, security hygiene, operations, documentation, and release practices. Return evidenced scores and prioritized improvements. |
| [project-brief](../plugin/sd0x-dev-flow-codex/skills/project-brief/SKILL.md) | A,B,C,D,H | Convert an approved technical specification into a PM- and CTO-facing brief while preserving scope, commitments, provenance, and unresolved decisions. Does not approve or modify the source specification. |
| [push-ci](../plugin/sd0x-dev-flow-codex/skills/push-ci/SKILL.md) | A,B,C,D,H | Perform one authorized fast-forward branch push with hooks intact, then monitor CI for the exact pushed commit. Excludes force push, history rewriting, and pull-request mutation. |
| [readme-i18n-sync](../plugin/sd0x-dev-flow-codex/skills/readme-i18n-sync/SKILL.md) | A,B,C,D,H | Translate changed canonical English README sections into maintained locale files while preserving unchanged content, links, identifiers, and glossary terms. Does not edit the canonical English source. |
| [recap-ask](../plugin/sd0x-dev-flow-codex/skills/recap-ask/SKILL.md) | A,B,C,D,H | Answer questions about an existing recap, distinguishing its claims from verified current evidence. Read-only; unrelated questions are identified for the appropriate workflow. |
| [recap-doc](../plugin/sd0x-dev-flow-codex/skills/recap-doc/SKILL.md) | A,B,C,D,H | Write a post-development recap with design decisions, specification drift, blind spots, and verified source citations. Uses a temporary destination unless a repository output path is requested. |
| [refactor](../plugin/sd0x-dev-flow-codex/skills/refactor/SKILL.md) | A,B,C,D,H | Improve a named structural concern while preserving observable behavior and compatibility. Establish regression evidence and complete required review and verification. |
| [remind](../plugin/sd0x-dev-flow-codex/skills/remind/SKILL.md) | A,B,D,H | 沿用已有 reset 授權；gate completion 不等於完整 user objective。 |
| [repo-intake](../plugin/sd0x-dev-flow-codex/skills/repo-intake/SKILL.md) | A,B,C,D,H | Build a current repository map of entrypoints, tests, tooling, ownership, and integration risks, optionally saving it to a requested destination. Does not execute project code or modify implementation. |
| [req-analyze](../plugin/sd0x-dev-flow-codex/skills/req-analyze/SKILL.md) | A,B,D,H | Create or refine feature requirements in 1-requirements.md, with stakeholders, constraints, priorities, and observable acceptance signals. Solution design and execution tickets belong to separate workflows. |
| [request-tracking](../plugin/sd0x-dev-flow-codex/skills/request-tracking/SKILL.md) | A,B,C,D,F,H | Report cross-feature request status, age, acceptance counts, dependencies, and malformed records without editing tickets. Source status labels are not proof of completion. |
| [reset](../plugin/sd0x-dev-flow-codex/skills/reset/SKILL.md) | A,D,H | 正式 reset 與既有授權沿用；保留 quarantine、新 SessionStart 與重新 gates。 |
| [review](../plugin/sd0x-dev-flow-codex/skills/review/SKILL.md) | A,B,D,H | configured Codex primary、完整 changed-set 行為覆蓋、fresh lifecycle 與正式 evidence；無 Claude fallback。 |
| [review-spec](../plugin/sd0x-dev-flow-codex/skills/review-spec/SKILL.md) | A,B,C,D,F,H | Review lifecycle requirements, technical specifications, or architecture for traceability, repository consistency, risks, and testability. Read-only and independent of the code-review gate. |
| [risk-assess](../plugin/sd0x-dev-flow-codex/skills/risk-assess/SKILL.md) | A,B,C,D,H | Assess the delivery and operational risk of a bounded change from evidence, including failure scenarios, mitigations, rollout conditions, and rollback. |
| [runbook](../plugin/sd0x-dev-flow-codex/skills/runbook/SKILL.md) | A,B,C,D,H | Create, refresh, or check a release runbook against current repository and operational evidence. Does not deploy, roll back, or claim production readiness. |
| [safe-remove](../plugin/sd0x-dev-flow-codex/skills/safe-remove/SKILL.md) | A,B,C,D,H | Remove an explicitly identified repository asset and proven-safe references, preserving recovery evidence and unrelated work. Unresolved loading or compatibility dependencies block removal. |
| [security-review](../plugin/sd0x-dev-flow-codex/skills/security-review/SKILL.md) | A,B,C,D,H | Perform a bounded read-only security assessment of assets, trust boundaries, exploit preconditions, and controls. Return evidence-backed findings without destructive testing or secret exposure. |
| [seek-verdict](../plugin/sd0x-dev-flow-codex/skills/seek-verdict/SKILL.md) | A,B,C,D,H | 獨立 Codex verifier；保留原始來源標籤、dismissal thresholds 與人類嚴重風險決策。 |
| [setup](../plugin/sd0x-dev-flow-codex/skills/setup/SKILL.md) | A,B,D,H | Install or refresh project-local managed sd0x guidance, opt-in hook configuration, and the configured primary reviewer through the bundled setup script. Preserve user-authored content and report activation requirements. |
| [sharingan](../plugin/sd0x-dev-flow-codex/skills/sharingan/SKILL.md) | A,B,C,D,H | Adapt a bounded source workflow into a Codex-native skill with provenance, capability mapping, dependencies, and validation. Does not install or publish the generated skill. |
| [simplify](../plugin/sd0x-dev-flow-codex/skills/simplify/SKILL.md) | A,B,C,D,H | Remove incidental complexity from a bounded code path while preserving behavior and verifying affected callers. Excludes new features and unrelated architectural replacement. |
| [skill-health-check](../plugin/sd0x-dev-flow-codex/skills/skill-health-check/SKILL.md) | A,B,C,D,H | Audit skill discovery, routing, progressive loading, resources, safety, and verification evidence. Read-only; does not install candidates or claim a review gate. |
| [smart-commit](../plugin/sd0x-dev-flow-codex/skills/smart-commit/SKILL.md) | A,B,C,D,H | Create one authorized commit from the existing index with hooks, signing, exact-tree validation, and readback intact. Does not stage, unstage, or push. |
| [smart-rebase](../plugin/sd0x-dev-flow-codex/skills/smart-rebase/SKILL.md) | A,B,C,D,H | Analyze squash-merge history and perform an authorized bounded topic-branch rebase with a proven cut point and recovery ref. Does not push or guess conflict resolutions. |
| [statusline-config](../plugin/sd0x-dev-flow-codex/skills/statusline-config/SKILL.md) | A,B,C,D,H | Determine whether the installed Codex version supports an official statusline configuration surface and show verified fields. Read-only; does not invent schemas or write unsupported configuration. |
| [tech-brief](../plugin/sd0x-dev-flow-codex/skills/tech-brief/SKILL.md) | A,B,C,D,H | Write a developer-facing brief from approved specifications, implementation, tests, and decision evidence. Preserve provenance, limitations, and unresolved interpretations. |
| [tech-spec](../plugin/sd0x-dev-flow-codex/skills/tech-spec/SKILL.md) | A,B,C,D,H | Create or refine 2-tech-spec.md from established requirements, including architecture, interfaces, risks, work boundaries, and validation. Deep mode adds proposal validation and alternative analysis; no implementation or ticket mutation. |
| [test-deep](../plugin/sd0x-dev-flow-codex/skills/test-deep/SKILL.md) | A,B,C,D,H | Investigate test sufficiency across affected layers using material risks, reproducible execution, and failure triage. Does not edit production code or record the verification gate. |
| [test-gen](../plugin/sd0x-dev-flow-codex/skills/test-gen/SKILL.md) | A,B,C,D,H | Add behavior-focused tests for an identified coverage gap, using existing conventions and meaningful regression proof. Implementation defects are reported rather than encoded as expected behavior. |
| [test-health](../plugin/sd0x-dev-flow-codex/skills/test-health/SKILL.md) | A,B,C,D,H | Assess test reliability, speed, maintainability, coverage evidence, and layer balance. Historical trends require comparable artifacts. |
| [test-review](../plugin/sd0x-dev-flow-codex/skills/test-review/SKILL.md) | A,B,D,H | Provide an independent read-only assessment of tests and acceptance criteria for an exact subject. Returns actionable coverage gaps without participating in the repository review gate. |
| [ui-first-principles](../plugin/sd0x-dev-flow-codex/skills/ui-first-principles/SKILL.md) | A,B,C,D,H | Derive UI information hierarchy and field priorities from a user scenario and API field set. Produces design analysis without live user data, screenshots, or frontend implementation. |
| [update-docs](../plugin/sd0x-dev-flow-codex/skills/update-docs/SKILL.md) | A,B,C,D,H | 修復失效 @ 引用，實際 resolver、model-owned timing、任何 edit 重開 fingerprint evidence。 |
| [update-readme](../plugin/sd0x-dev-flow-codex/skills/update-readme/SKILL.md) | A,B,C,D,H | Regenerate owned README catalog sections from canonical skill and manifest evidence while preserving all other content. Report locale changes for readme-i18n-sync. |
| [verify](../plugin/sd0x-dev-flow-codex/skills/verify/SKILL.md) | A,B,C,D,H | default deterministic gate；fast/precommit 非 gate，lint-fix 沿用有效授權且仍需 --allow-fixes。 |
| [watch-ci](../plugin/sd0x-dev-flow-codex/skills/watch-ci/SKILL.md) | A,B,C,D,H | Monitor required GitHub Actions runs for one exact commit, distinguishing success, failure, missing runs, and timeout. Does not replace repository verification. |
| [zh-tw](../plugin/sd0x-dev-flow-codex/skills/zh-tw/SKILL.md) | A,B,C,D,H | 只回傳翻譯內容，保留事實與技術 tokens；刪除不相干 repository/verification wrapper。 |

## 10. Instructional references 覆蓋紀錄

以下 52 個參照都在語意盤點內。格式 template 保留真正欄位／identifier／狀態契約；歷史 handoff 不作現行權限；JSON admission 是機器介面，不能只因冗長刪除。

| 參照 | 分類 | 用途與處置理由 |
|---|---|---|
| [architecture/references/pack-handoff.md](../plugin/sd0x-dev-flow-codex/skills/architecture/references/pack-handoff.md) | B | former pack provenance；解除 live 必讀／normative authority，不推導現在 core 禁止 discovery。 |
| [architecture/references/template.md](../plugin/sd0x-dev-flow-codex/skills/architecture/references/template.md) | A,B,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [contract-decode/references/apis.md](../plugin/sd0x-dev-flow-codex/skills/contract-decode/references/apis.md) | A,C,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [create-request/references/request-format.md](../plugin/sd0x-dev-flow-codex/skills/create-request/references/request-format.md) | A,B,C,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [dev-security-audit/references/cases/README.md](../plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/cases/README.md) | A,B | 安全案例與來源／日期／confidence；metadata 不推導 confirmed compromise，秘密不輸出。 |
| [dev-security-audit/references/cases/apifox-2026-03.md](../plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/cases/apifox-2026-03.md) | A,B,C,D | 安全案例與來源／日期／confidence；metadata 不推導 confirmed compromise，秘密不輸出。 |
| [dev-security-audit/references/cases/axios-2026-03.md](../plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/cases/axios-2026-03.md) | A,B | 安全案例與來源／日期／confidence；metadata 不推導 confirmed compromise，秘密不輸出。 |
| [dev-security-audit/references/remediation.md](../plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/remediation.md) | C,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [dev-security-audit/references/scan-targets.md](../plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/scan-targets.md) | A,B | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [feasibility-study/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/feasibility-study/references/output-template.md) | A | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [feasibility-study/references/pack-handoff.md](../plugin/sd0x-dev-flow-codex/skills/feasibility-study/references/pack-handoff.md) | B | former pack provenance；解除 live 必讀／normative authority，不推導現在 core 禁止 discovery。 |
| [feature-verify/references/blackbox-testing.md](../plugin/sd0x-dev-flow-codex/skills/feature-verify/references/blackbox-testing.md) | A,C,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [feature-verify/references/environments.md](../plugin/sd0x-dev-flow-codex/skills/feature-verify/references/environments.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [feature-verify/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/feature-verify/references/output-template.md) | A,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [feature-verify/references/safety-rules.md](../plugin/sd0x-dev-flow-codex/skills/feature-verify/references/safety-rules.md) | A,B | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [generate-runner/references/templates.md](../plugin/sd0x-dev-flow-codex/skills/generate-runner/references/templates.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [jira/references/branch-policy.md](../plugin/sd0x-dev-flow-codex/skills/jira/references/branch-policy.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [jira/references/create-policy.md](../plugin/sd0x-dev-flow-codex/skills/jira/references/create-policy.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [jira/references/transition-mapping.md](../plugin/sd0x-dev-flow-codex/skills/jira/references/transition-mapping.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [load-pr-review/references/api-contract.md](../plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/api-contract.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [load-pr-review/references/token-budget.md](../plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/token-budget.md) | C,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [load-pr-review/references/verdict-triage-prompt.md](../plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/verdict-triage-prompt.md) | C,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [load-pr-review/references/writeback-guardrails.md](../plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/writeback-guardrails.md) | A | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [necessity-audit/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/necessity-audit/references/output-template.md) | A,B,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [necessity-audit/references/pack-handoff.md](../plugin/sd0x-dev-flow-codex/skills/necessity-audit/references/pack-handoff.md) | A,F | former pack provenance；解除 live 必讀／normative authority，不推導現在 core 禁止 discovery。 |
| [next-step/references/progression-tables.md](../plugin/sd0x-dev-flow-codex/skills/next-step/references/progression-tables.md) | A,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [obsidian-cli/references/integration-patterns.md](../plugin/sd0x-dev-flow-codex/skills/obsidian-cli/references/integration-patterns.md) | A,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [obsidian-cli/references/troubleshooting.md](../plugin/sd0x-dev-flow-codex/skills/obsidian-cli/references/troubleshooting.md) | A,B,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [orchestrate/references/admission-allowlist.json](../plugin/sd0x-dev-flow-codex/skills/orchestrate/references/admission-allowlist.json) | A,B,H | typed schema、admission、source capture 與 dependency envelope 的真實能力邊界；保留，逾時按觀察／terminal 區分。 |
| [orchestrate/references/execution-policy.md](../plugin/sd0x-dev-flow-codex/skills/orchestrate/references/execution-policy.md) | A,B,D | typed schema、admission、source capture 與 dependency envelope 的真實能力邊界；保留，逾時按觀察／terminal 區分。 |
| [orchestrate/references/plan-schema.md](../plugin/sd0x-dev-flow-codex/skills/orchestrate/references/plan-schema.md) | A,B | typed schema、admission、source capture 與 dependency envelope 的真實能力邊界；保留，逾時按觀察／terminal 區分。 |
| [orchestrate/references/planner-prompt.md](../plugin/sd0x-dev-flow-codex/skills/orchestrate/references/planner-prompt.md) | A,B | typed schema、admission、source capture 與 dependency envelope 的真實能力邊界；保留，逾時按觀察／terminal 區分。 |
| [plan-review/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/plan-review/references/output-template.md) | A,B,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [plan-review/references/pack-handoff.md](../plugin/sd0x-dev-flow-codex/skills/plan-review/references/pack-handoff.md) | A,F | former pack provenance；解除 live 必讀／normative authority，不推導現在 core 禁止 discovery。 |
| [portfolio/references/api.md](../plugin/sd0x-dev-flow-codex/skills/portfolio/references/api.md) | A,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [portfolio/references/architecture.md](../plugin/sd0x-dev-flow-codex/skills/portfolio/references/architecture.md) | A,B,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [pr-comment/references/api-and-guardrails.md](../plugin/sd0x-dev-flow-codex/skills/pr-comment/references/api-and-guardrails.md) | A,B,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [readme-i18n-sync/references/glossary.md](../plugin/sd0x-dev-flow-codex/skills/readme-i18n-sync/references/glossary.md) | A,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [recap-ask/references/qa-prompt.md](../plugin/sd0x-dev-flow-codex/skills/recap-ask/references/qa-prompt.md) | A,B,D | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [recap-doc/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/recap-doc/references/output-template.md) | A,B,C,D | 保留 evidence index／scope／blind spots；移除僅為格式的檔案、句數與問題配額。 |
| [recap-doc/references/prompt-template.md](../plugin/sd0x-dev-flow-codex/skills/recap-doc/references/prompt-template.md) | A,B | 保留 evidence index／scope／blind spots；移除僅為格式的檔案、句數與問題配額。 |
| [recap-doc/references/source-guide.md](../plugin/sd0x-dev-flow-codex/skills/recap-doc/references/source-guide.md) | A,B,D | 保留 evidence index／scope／blind spots；移除僅為格式的檔案、句數與問題配額。 |
| [req-analyze/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/req-analyze/references/output-template.md) | A,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [req-analyze/references/research-policy.md](../plugin/sd0x-dev-flow-codex/skills/req-analyze/references/research-policy.md) | A,B | 保留 primary sources、citation、untrusted-input 邊界；取消非執行介面的三頁配額。 |
| [request-tracking/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/request-tracking/references/output-template.md) | A,B,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [request-tracking/references/pack-handoff.md](../plugin/sd0x-dev-flow-codex/skills/request-tracking/references/pack-handoff.md) | A,F | former pack provenance；解除 live 必讀／normative authority，不推導現在 core 禁止 discovery。 |
| [request-tracking/references/report-contract.md](../plugin/sd0x-dev-flow-codex/skills/request-tracking/references/report-contract.md) | A,B | 保留 task-specific integration、詞彙、API、解析或證據規則；對已識別重複／衝突作相應改寫。 |
| [review-spec/references/output-template.md](../plugin/sd0x-dev-flow-codex/skills/review-spec/references/output-template.md) | A,B,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |
| [review-spec/references/pack-handoff.md](../plugin/sd0x-dev-flow-codex/skills/review-spec/references/pack-handoff.md) | A,F | former pack provenance；解除 live 必讀／normative authority，不推導現在 core 禁止 discovery。 |
| [review/references/review-theory.md](../plugin/sd0x-dev-flow-codex/skills/review/references/review-theory.md) | A,B,D | 獨立證據、severity、bounded assurance 與 exact clean parser 介面；探索次序由 reviewer 判斷。 |
| [tech-spec/references/research-policy.md](../plugin/sd0x-dev-flow-codex/skills/tech-spec/references/research-policy.md) | A,B | 保留 primary sources、citation、untrusted-input 邊界；取消非執行介面的三頁配額。 |
| [tech-spec/references/template.md](../plugin/sd0x-dev-flow-codex/skills/tech-spec/references/template.md) | A,B,C,D | 保留任務資訊、stable IDs 與 parser-required metadata；格式依讀者與適用性調整。 |

## 11. 調查來源封存識別與使用限制

本報告將決策、完整技能／參照覆蓋、實作介面與限制持久化；不將全部原指令或大型 old/new snapshots 再複製成另一個 normative source。下列暫存工作紀錄是本報告的輸入，SHA-256 用來辨識此次彙整讀取的版本；它們本身不是 runtime evidence，也不要求後續使用者依賴 `/tmp` 才能理解本報告。

| 工作紀錄 basename | SHA-256 |
|---|---|
| `sd0x-instruction-a-m.md` | `e9a1bdcb02b051e2012fc262d700ed48d3982825c15460299083ddf25dada58f` |
| `sd0x-instruction-a-m.json` | `33dc78badfdd14c060eb9fb9966572ba0258b16ccea5fc6207e97752e6c98466` |
| `sd0x-instruction-n-z.md` | `ae4b4e1cc9fe9da83cd61da4a351ca78acf3ebc026e3d8b5498b2199a675168d` |
| `sd0x-instruction-n-z.json` | `042429571c5b7ea0d236308add66c57c903e30b230aaaca737dcac2530b12f9b` |
| `sd0x-a-m-rewrite-log.json` | `99036683d57d8a52897f9b987e8a8f54fccc09a6527a972bac691b73ae008172` |
| `sd0x-n-z-rewrite-log.json` | `2ab1b34f7de413d5f8946ce70bbb28f6f07e7bf160e9dc13ec0191812fa23d24` |
| `sd0x-generator-rewrite-log.json` | `46c0b102546b94e68d566a2ca0019d26f2286dad8a5ca3fb4541a98f852ba396` |
| `sd0x-instruction-redesign-v2-plan.md` | `ba285eb53be1b94ebabcc835b638bf413dc5e580fc6cea4a4b6f089995879b43` |

後續完成聲明必須引用最後 fingerprint 的正式 runtime-recorded review／verify 以及重載後 doctor 結果。報告存在、表格覆蓋、source diff 或數字改善都不是這些關卡的替代物。


## 12. 正式 candidate preflight 結果

本輪 95/95 canonical units 已通過正式 `auditActiveMoveWindowIdentity`（0 failure）；每個 successor request 記錄實際回傳的 payload tree 與 preflight hashes，狀態為 Candidate Complete。這是來源、routing、操作宣告、測試身分與 payload 的靜態審計，不等同執行全部測試，也不是 runtime review／verify pass。Registry 仍以 candidate 表示尚未 durable promotion 的修訂；沒有修改既有 closure 或建立 commit。

Preflight 暴露的相容問題已修正：schema helper 改用可審計的 own-property APIs 且保留 symbol 拒絕；自然語句與 API 說明避開 shell 命令誤判；generator replay 測試與 supplemental sandbox 分離。Obsidian 的明確 connector-write 宣告現在能由分析器辨識，並有實測證明將該能力漏報為 read-only 會被拒絕。未放寬既有動態程式碼或 supplemental sandbox 防線。

正式 primary review、完整 deterministic `npm run check` 與新 registry reload activation 仍待主流程完成。改版後 doctor 已回報 payload、MCP runtime 與 managed guidance 檢查成功；這不代表目前宿主已重新載入新 SKILL.md discovery descriptions。


## 13. Primary review 修復紀錄

第一輪全面 configured primary 對 fingerprint `b8f5bc996e27ea051dd9d4c4c366f782cfe7a8089c5c76de230b0116384eef83` 提出兩個 P2，已由正式 gate 記錄 failure。create-pr／jira 的 preview 無條件停止與 later-task 限制已改為依 dry-run／preview-only／政策條件分支；滿足既有授權可同 task 執行，送出前 identity／payload 重驗保留。Bump-version 已改用本 repository 的 release owner，涵蓋 guide、alias manifest fingerprint 與 owner decision hash；安裝狀態不由版本更新偽造。

正文與 generator 同步，新增 current／regenerated 授權分支回歸案例；既有 release fixture 驗證完整 metadata 一致及 install-state／無關欄位不變。相關 focused batch 39 pass、0 fail。三個變更 unit 已重新取得正式 preflight，successor tickets 更新為其實際新 hashes。Supplemental tests 中描述 global／process 的斷言採字串比對，以保持測試意義並符合現有 code-loading sandbox。

這些修復使 fingerprint 改變；前輪 review failure 不可當新 verdict。新一輪 configured primary 與完整 deterministic verify 仍須執行。


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
