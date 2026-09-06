# Agent 指令系統審計（2026-09-06，改寫前）

> 階段紀錄：以下是核心改寫前的調查與當時規劃。使用者要求的全面改版已延伸至所有現行技能與產生器；最新範圍及尚待驗證項目見 [全面改版審計](instruction-system-comprehensive-audit-2026-09-06.md)。本頁舊階段結果不代表目前 fingerprint 通過。

## 結論與範圍

尚未全面更新。核心已有模型自治、non-blocking Stop、單一 Codex primary 與 parent settings inheritance；AGENTS managed template、hook 提示及 reviewer 程序仍有重複與過度指定。

已盤點 431 個 repository instruction/config/reference sources：140 個 active payload sources（含 86 個 SKILL.md）、4 個 project/install sources、286 個歷史非啟用 sources、1 個測試 fixture；其中 active payload 共 9,071 行，並非全部常駐。86 個 discovery descriptions 合計 57,323 bytes，與正文 routing blocks 57,571 bytes 大幅重複；這是路由相容契約，不能未研究載入器就刪除。41 個 active skills 有相同 generic protocol，該段合計約 23,186 bytes。

本次完整語意改寫的優先範圍是核心 AGENTS／managed rules／reviewer／hook／reset-review recovery；其餘 skills 已納入 inventory 與 prompt-debt 盤點，個別業務契約保留，列後續候選而不全面重寫。歷史 migration/staging、packs 與 owner bytes 是 provenance，不視為現行指令或修改對象。環境內第三方 plugins 與上層平台指令不屬本 repo 的改寫權限。

核心有意義指令人工估計：65% 原意保留、25% 改寫、10% 合併或移至一般文件；這不是全 repo 精確比例或刪減配額。

## 來源對照

唯讀 ../sd0x-harness，HEAD 04e8a5e3f5d9c482937c2ad2170fab5fbd02b630 / v4.6.2，worktree clean。參考 CLAUDE.template.md、rules/auto-loop.md、rules/codex-invocation.md、rules/scope-discipline.md、rules/fix-all-issues.md、hooks/stop-guard.sh、hooks/post-skill-auto-loop.sh 與 docs/features/rules-residency/requests/2026-08-29-extract-on-demand-contracts-r1.md。

採納：常駐語意與 on-demand 程序分離；模型決定探索與批次；hooks 報事實；依具體未證明的行為判斷是否擴大 assurance；使用者已有授權應沿用。來源仍有固定 Git 探索步驟、tier/round budgets、host-specific workarounds 與 fallback reviewer，不直接移植。來源紀錄自身指出 rules residency 曾陷入反覆加強測試 guard 的循環，這是避免新建 meta-test 儀式的實際案例。既有論文參照提供設計動機，沒有證明本 repo 的缺陷率改善百分比。

## 重要發現與分類

| Location | 最短原文 | 分類 | 問題／確定替代 |
|---|---|---|---|
| AGENTS.md:3–19 | Node 24、single payload、Codex adapter、runtime metadata | A/B/C | 保留專案架構、相容性、保護 user content 與 npm run check；CI 已執行不代表可刪除完成標準。 |
| AGENTS.md:24–27 | unlink → link → status | A/F | 保留 reload 觸發條件與 local-home 邊界，詳細原理維護於 PROJECT-MIGRATION-GUIDE；本批不更動 unmanaged user content。 |
| workflow-contract.js:69 | Anchor-first | G | 限定是 managed contract 內的 hard-constraint/default 關係，不宣稱凌駕系統、開發者或使用者指令。 |
| workflow-contract.js:81 | SD0X_DEVIATION 五欄格式 | E | 改為只有影響結果、風險或使用者預期的偏離才簡述依據，沒有固定 marker。 |
| workflow-contract.js:87 | After any fix... Never claim... | F | Anchors 已承載 freshness/evidence，尾句只留 canonical skill 入口。 |
| reviewer template:10,14 | full relevant files；fresh full scan | E/C | 所有變更與行為影響均須評估；模型決定足夠上下文與檢查深度。新 fingerprint 必須新審查，但不用強迫重讀已充分理解的所有上下文。 |
| reviewer template:9 | every other reviewer | F/H | 現行為單一 primary，改為依 repo evidence 獨立判斷，不以 implementer 結論作證據。 |
| hook.js:179–184,233–234 | read-only／authority／findings 重述 | F/H | 靜態角色由 profile 承載，hook 保留事件、fingerprint、subject 與必要故障原因；commit closure context 不刪除。 |
| hook.js:328；review/reset skill | Ask the user before reset | G/D | 有涵蓋本次恢復的既有授權即使用正式 reset，未授權才詢問；reset 不會省略 gates，corrupt state 的新 SessionStart 邊界保留。 |
| 41 active skills 的 Protocol | Build the smallest plan... | E/F | 大量 generic wrapper，應逐一移除不增加任務知識的部分；本批先記錄，不改已交付的 41 個業務流程。 |
| doc-refactor/SKILL.md:75–81 | AGENTS <50；rules <30 | E/D | 行數不是品質標準，應改為資訊／約束不流失與衝突消除。本批列非核心 follow-up。 |
| feature-dev/refactor | checks after each slice | E | 批次與 focused checks 時機可由風險決定；保留 final gates。本批列 follow-up。 |
| orchestrate/planner-prompt | closed typed records only | B/E（待定） | 這是既有受限只讀產品介面，不能僅因繁瑣就視為 workaround 刪除；獨立分析才變更。 |
| workflow-contract/setup/hook tests | SD0X_DEVIATION、fresh full scan、agentPlans 拼寫 | E/F | 移除純 prose/helper 拼寫鎖定；保留 setup ownership、state facts、matching terminal、failure/activation 的真實路徑測試。 |
| reviewer exact clean phrase／runtime fingerprint | No actionable findings remain. | B/C/H | 這是 parser/wire contract，不是文風偏好，保留；Codex transport 限定於 profile／review skill。 |

分類：A domain knowledge；B invariant；C done；D material preference；E legacy workaround；F duplicate；G conflict；H model-specific。未確定的安全/產品契約原樣保留。

## Top 10（按自治、正確性、清晰度、上下文、跨模型影響排序）

1. 沿用既有 reset 授權：解決實際中斷，保持正式 evidence 路徑。
2. 將 reviewer 固定 full scan 改為全變更 coverage outcome：減少每輪重複研究，不沿用 stale pass。
3. 移除固定 deviation 格式：保留必要說明，普通判斷不另成儀式。
4. 分清 contract/source/generated copy：修改真正模板並由 setup 同步，避免只修本 repo 的 AGENTS。
5. Hook 僅承載動態事實與必要恢復訊息：降低每事件重複規則。
6. Root AGENTS 留專案知識／constraints／done：reload 詳情以既有指南為準；unmanaged user content 本批保留。
7. 精簡 review role 與 skill/theory 的重複：runtime 順序保留，generic reasoning 不重述。
8. 移除 prose-only 測試：以實際拒絕／接受、ownership 與 terminal evidence 驗證。
9. 後續逐一去掉 41 個 generic Protocol wrapper 與 doc-refactor 行數配額：不一次攪動所有 skill owner。
10. 後續改善 description/routing 重複與 MCP 長作業觀察：先確認宿主契約，不減少路由正確性或因觀察逾時重跑活程序。

## 建議架構（不建立新 rules 目錄或 Claude profile）

AGENTS.md：project context、hard constraints、definition of done、local-home/reload pointer；managed block 由 workflow-contract.js 唯一產生。

scripts/runtime/workflow-contract.js：shared workflow constraints、model discretion、授權原則及 skill pointers。

templates/agents/sd0x-codex-primary-reviewer.toml → setup → .codex/agents/...：Codex role、read-only、parent settings、review coverage/output contract。

hooks/hooks.json → runtime/hook.js：事件 routing、fingerprint facts、terminal identity、activation／corruption 恢復訊息。

skills/review、reset、verify：按需載入正式操作介面與順序；review theory 保留 evidence/severity/assurance 規範，移除重複背景與固定探索腳本。

docs/PROJECT-MIGRATION-GUIDE.md：reload matrix、host lifecycle 限制、MCP timeout 與持久 agent 事故；migration records：來源演進、歷史證據、不作常駐命令。

## 五種情境的驗收

| 任務 | 必要上下文／完成條件 | 應移除的儀式 | 授權邊界 |
|---|---|---|---|
| 小 bug fix | 受影響 invariant、regression proof、同 fingerprint review/verify | 無條件 plan/deviation/full-context 重讀 | 可逆 in-scope 自主 |
| 多檔 feature | AC、架構邊界、全變更 coverage、focused＋final tests | 每 slice 固定所有檢查 | 行為範圍 materially ambiguous 才問 |
| incident/debug | 真實觀察、redaction、production scope | 未解 ambiguity 全部當阻塞 | 實際外部/不可逆操作依已有授權 |
| refactor | preserved behavior、caller impact、回歸證據 | line-count success、固定掃描順序 | 不增加產品行為 |
| infra/migration | exact identity、user content ownership、reload matrix、新 task activation | clone source host 假設、逾時即重跑 | corrupt reset 仍需新 session；已有 reset 授權沿用 |

## 逐檔 inventory

以下列出每個來源的 scope、用途、大小與 overlap；歷史來源只作 provenance，不隱含 active inheritance。未找到另一本 repository nested AGENTS.md；根 AGENTS 影響全 repo，custom reviewer profile 只影響對應 role，SKILL/reference 按需載入，hook context 按事件注入。已安裝的本地 overlay 是 payload 副本／symlink，不能以更新 source 宣稱當前 process 的 registry 已 reload。

| Path | Scope | Purpose | Lines | Bytes | Overlap |
|---|---|---|---:|---:|---|
| .agents/plugins/marketplace.json | project | local plugin discovery registration | 20 | 402 | task-specific references; no global inheritance |
| .codex/agents/sd0x-codex-primary-reviewer.toml | installed-project | reviewer profile | 15 | 1211 | installed copy of payload reviewer template |
| .codex/sd0x-dev-flow.json | installed-project | project guidance or installation registration | 7 | 88 | task-specific references; no global inheritance |
| AGENTS.md | project | project guidance or installation registration | 63 | 4904 | managed section generated by workflow-contract.js |
| migration/packs/development-pack/debug/SKILL.md | archived-not-loaded | discovery and task instructions | 51 | 3982 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/development-pack/post-dev-test/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2577 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/development-pack/refactor/SKILL.md | archived-not-loaded | discovery and task instructions | 42 | 2471 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/development-pack/simplify/SKILL.md | archived-not-loaded | discovery and task instructions | 42 | 2507 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/development-pack/test-deep/SKILL.md | archived-not-loaded | discovery and task instructions | 42 | 2747 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/development-pack/test-gen/SKILL.md | archived-not-loaded | discovery and task instructions | 44 | 2706 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/planning-pack/architecture/references/pack-handoff.md | archived-not-loaded | on-demand task context | 14 | 874 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/architecture/references/template.md | archived-not-loaded | on-demand task context | 68 | 1575 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/architecture/SKILL.md | archived-not-loaded | discovery and task instructions | 66 | 6417 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/planning-pack/feasibility-study/references/output-template.md | archived-not-loaded | on-demand task context | 49 | 1042 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/feasibility-study/references/pack-handoff.md | archived-not-loaded | on-demand task context | 15 | 808 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/feasibility-study/SKILL.md | archived-not-loaded | discovery and task instructions | 74 | 5646 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/planning-pack/necessity-audit/references/output-template.md | archived-not-loaded | on-demand task context | 33 | 838 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/necessity-audit/references/pack-handoff.md | archived-not-loaded | on-demand task context | 15 | 723 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/necessity-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 80 | 6069 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/planning-pack/plan-review/references/output-template.md | archived-not-loaded | on-demand task context | 41 | 795 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/plan-review/references/pack-handoff.md | archived-not-loaded | on-demand task context | 14 | 644 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/plan-review/SKILL.md | archived-not-loaded | discovery and task instructions | 78 | 5827 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/planning-pack/request-tracking/references/output-template.md | archived-not-loaded | on-demand task context | 29 | 622 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/request-tracking/references/pack-handoff.md | archived-not-loaded | on-demand task context | 14 | 713 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/request-tracking/references/report-contract.md | archived-not-loaded | on-demand task context | 17 | 1151 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/request-tracking/SKILL.md | archived-not-loaded | discovery and task instructions | 68 | 5354 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/planning-pack/review-spec/references/output-template.md | archived-not-loaded | on-demand task context | 47 | 1009 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/review-spec/references/pack-handoff.md | archived-not-loaded | on-demand task context | 16 | 824 | historical source/pack copies, not current authority |
| migration/packs/planning-pack/review-spec/SKILL.md | archived-not-loaded | discovery and task instructions | 80 | 6381 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/best-practices/SKILL.md | archived-not-loaded | discovery and task instructions | 41 | 2718 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/check-coverage/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2185 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/dep-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 41 | 2367 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/doc-review/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2167 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/pre-pr-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 41 | 2216 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/project-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2206 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/risk-assess/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2133 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/security-review/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2245 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/quality-pack/test-health/SKILL.md | archived-not-loaded | discovery and task instructions | 37 | 2305 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/architecture-advice/SKILL.md | archived-not-loaded | discovery and task instructions | 62 | 3582 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/ask/SKILL.md | archived-not-loaded | discovery and task instructions | 63 | 4231 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/brainstorm/SKILL.md | archived-not-loaded | discovery and task instructions | 72 | 4680 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/code-explore/SKILL.md | archived-not-loaded | discovery and task instructions | 62 | 3602 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/code-investigate/SKILL.md | archived-not-loaded | discovery and task instructions | 62 | 3857 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/deep-explore/SKILL.md | archived-not-loaded | discovery and task instructions | 66 | 4727 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/deep-research/SKILL.md | archived-not-loaded | discovery and task instructions | 86 | 8028 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/explain/SKILL.md | archived-not-loaded | discovery and task instructions | 62 | 3367 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/fp-brief/SKILL.md | archived-not-loaded | discovery and task instructions | 63 | 3522 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/git-investigate/SKILL.md | archived-not-loaded | discovery and task instructions | 62 | 3516 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/issue-analyze/SKILL.md | archived-not-loaded | discovery and task instructions | 62 | 4010 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/packs/research-pack/seek-verdict/SKILL.md | archived-not-loaded | discovery and task instructions | 79 | 6496 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/architecture/references/codex-prompt.md | archived-not-loaded | on-demand task context | 59 | 2182 | historical source/pack copies, not current authority |
| migration/staging/architecture/references/template.md | archived-not-loaded | on-demand task context | 110 | 2998 | historical source/pack copies, not current authority |
| migration/staging/architecture/SKILL.md | archived-not-loaded | discovery and task instructions | 235 | 7839 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/ask/references/intent-patterns.md | archived-not-loaded | on-demand task context | 46 | 2691 | historical source/pack copies, not current authority |
| migration/staging/ask/references/routing-table.md | archived-not-loaded | on-demand task context | 31 | 1543 | historical source/pack copies, not current authority |
| migration/staging/ask/SKILL.md | archived-not-loaded | discovery and task instructions | 194 | 7360 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/best-practices/references/debate-guide.md | archived-not-loaded | on-demand task context | 42 | 1539 | historical source/pack copies, not current authority |
| migration/staging/best-practices/references/output-templates.md | archived-not-loaded | on-demand task context | 104 | 3519 | historical source/pack copies, not current authority |
| migration/staging/best-practices/SKILL.md | archived-not-loaded | discovery and task instructions | 195 | 9690 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/bug-fix/SKILL.md | archived-not-loaded | discovery and task instructions | 153 | 4479 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/bump-version/SKILL.md | archived-not-loaded | discovery and task instructions | 68 | 1990 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/check-coverage/SKILL.md | archived-not-loaded | discovery and task instructions | 97 | 2577 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/claude-health/references/best-practices.md | archived-not-loaded | on-demand task context | 63 | 2226 | historical source/pack copies, not current authority |
| migration/staging/claude-health/SKILL.md | archived-not-loaded | discovery and task instructions | 333 | 13736 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/code-explore/references/search-patterns.md | archived-not-loaded | on-demand task context | 121 | 2373 | historical source/pack copies, not current authority |
| migration/staging/code-explore/SKILL.md | archived-not-loaded | discovery and task instructions | 163 | 7333 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/code-investigate/references/output-template.md | archived-not-loaded | on-demand task context | 118 | 4123 | historical source/pack copies, not current authority |
| migration/staging/code-investigate/references/prompts.md | archived-not-loaded | on-demand task context | 107 | 3584 | historical source/pack copies, not current authority |
| migration/staging/code-investigate/SKILL.md | archived-not-loaded | discovery and task instructions | 158 | 6049 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-architect/references/project-knowledge.md | archived-not-loaded | on-demand task context | 80 | 2257 | historical source/pack copies, not current authority |
| migration/staging/codex-architect/SKILL.md | archived-not-loaded | discovery and task instructions | 111 | 3420 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-brainstorm/references/equilibrium.md | archived-not-loaded | on-demand task context | 92 | 3493 | historical source/pack copies, not current authority |
| migration/staging/codex-brainstorm/references/techniques.md | archived-not-loaded | on-demand task context | 156 | 4430 | historical source/pack copies, not current authority |
| migration/staging/codex-brainstorm/references/templates.md | archived-not-loaded | on-demand task context | 156 | 3533 | historical source/pack copies, not current authority |
| migration/staging/codex-brainstorm/SKILL.md | archived-not-loaded | discovery and task instructions | 110 | 4302 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-cli-review/SKILL.md | archived-not-loaded | discovery and task instructions | 133 | 6018 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-code-review/references/codex-prompt-branch.md | archived-not-loaded | on-demand task context | 151 | 4548 | historical source/pack copies, not current authority |
| migration/staging/codex-code-review/references/codex-prompt-fast.md | archived-not-loaded | on-demand task context | 104 | 3727 | historical source/pack copies, not current authority |
| migration/staging/codex-code-review/references/codex-prompt-full.md | archived-not-loaded | on-demand task context | 140 | 4166 | historical source/pack copies, not current authority |
| migration/staging/codex-code-review/references/codex-research-instructions.md | archived-not-loaded | on-demand task context | 85 | 3544 | historical source/pack copies, not current authority |
| migration/staging/codex-code-review/references/review-common.md | archived-not-loaded | on-demand task context | 199 | 7601 | historical source/pack copies, not current authority |
| migration/staging/codex-code-review/review_rubric.md | archived-not-loaded | project guidance or installation registration | 17 | 831 | historical source/pack copies, not current authority |
| migration/staging/codex-code-review/SKILL.md | archived-not-loaded | discovery and task instructions | 290 | 11952 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-code-review/templates/review_output.md | archived-not-loaded | project guidance or installation registration | 40 | 361 | historical source/pack copies, not current authority |
| migration/staging/codex-explain/references/codex-prompt-explain.md | archived-not-loaded | on-demand task context | 72 | 1768 | historical source/pack copies, not current authority |
| migration/staging/codex-explain/SKILL.md | archived-not-loaded | discovery and task instructions | 74 | 2277 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-implement/references/codex-prompts.md | archived-not-loaded | on-demand task context | 146 | 3913 | historical source/pack copies, not current authority |
| migration/staging/codex-implement/SKILL.md | archived-not-loaded | discovery and task instructions | 155 | 4807 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-review-branch/SKILL.md | archived-not-loaded | discovery and task instructions | 33 | 989 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-review-doc/SKILL.md | archived-not-loaded | discovery and task instructions | 25 | 717 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-review-fast/SKILL.md | archived-not-loaded | discovery and task instructions | 34 | 1046 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-review/SKILL.md | archived-not-loaded | discovery and task instructions | 33 | 1025 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-security/SKILL.md | archived-not-loaded | discovery and task instructions | 25 | 720 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-setup/references/agents-kernel.md | archived-not-loaded | on-demand task context | 55 | 2106 | historical source/pack copies, not current authority |
| migration/staging/codex-setup/SKILL.md | archived-not-loaded | discovery and task instructions | 129 | 4332 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-test-gen/SKILL.md | archived-not-loaded | discovery and task instructions | 29 | 883 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/codex-test-review/SKILL.md | archived-not-loaded | discovery and task instructions | 29 | 891 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/contract-decode/references/apis.md | archived-not-loaded | on-demand task context | 240 | 6505 | historical source/pack copies, not current authority |
| migration/staging/contract-decode/SKILL.md | archived-not-loaded | discovery and task instructions | 187 | 5310 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/create-pr/SKILL.md | archived-not-loaded | discovery and task instructions | 294 | 10934 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/create-request/references/feature-context-resolution.md | archived-not-loaded | on-demand task context | 113 | 5121 | historical source/pack copies, not current authority |
| migration/staging/create-request/references/template.md | archived-not-loaded | on-demand task context | 125 | 4866 | historical source/pack copies, not current authority |
| migration/staging/create-request/SKILL.md | archived-not-loaded | discovery and task instructions | 463 | 19923 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/de-ai-flavor/SKILL.md | archived-not-loaded | discovery and task instructions | 76 | 2571 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/debug/references/failure-taxonomy.md | archived-not-loaded | on-demand task context | 130 | 3739 | historical source/pack copies, not current authority |
| migration/staging/debug/references/probe-protocol.md | archived-not-loaded | on-demand task context | 71 | 2244 | historical source/pack copies, not current authority |
| migration/staging/debug/references/report-template.md | archived-not-loaded | on-demand task context | 62 | 1472 | historical source/pack copies, not current authority |
| migration/staging/debug/SKILL.md | archived-not-loaded | discovery and task instructions | 242 | 8733 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/deep-analyze/SKILL.md | archived-not-loaded | discovery and task instructions | 93 | 2111 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/deep-explore/references/agent-prompt.md | archived-not-loaded | on-demand task context | 88 | 2471 | historical source/pack copies, not current authority |
| migration/staging/deep-explore/references/synthesis.md | archived-not-loaded | on-demand task context | 109 | 3060 | historical source/pack copies, not current authority |
| migration/staging/deep-explore/SKILL.md | archived-not-loaded | discovery and task instructions | 268 | 8946 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/deep-research/references/claim-registry.md | archived-not-loaded | on-demand task context | 68 | 2186 | historical source/pack copies, not current authority |
| migration/staging/deep-research/references/research-roles.md | archived-not-loaded | on-demand task context | 117 | 3988 | historical source/pack copies, not current authority |
| migration/staging/deep-research/references/scoring-model.md | archived-not-loaded | on-demand task context | 48 | 2516 | historical source/pack copies, not current authority |
| migration/staging/deep-research/SKILL.md | archived-not-loaded | discovery and task instructions | 332 | 14240 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/dep-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 99 | 2758 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/dev-security-audit/references/cases/apifox-2026-03.md | archived-not-loaded | on-demand task context | 261 | 10654 | historical source/pack copies, not current authority |
| migration/staging/dev-security-audit/references/cases/axios-2026-03.md | archived-not-loaded | on-demand task context | 309 | 14478 | historical source/pack copies, not current authority |
| migration/staging/dev-security-audit/references/cases/README.md | archived-not-loaded | on-demand task context | 55 | 2457 | historical source/pack copies, not current authority |
| migration/staging/dev-security-audit/references/remediation.md | archived-not-loaded | on-demand task context | 196 | 6272 | historical source/pack copies, not current authority |
| migration/staging/dev-security-audit/references/scan-targets.md | archived-not-loaded | on-demand task context | 154 | 6242 | historical source/pack copies, not current authority |
| migration/staging/dev-security-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 345 | 14262 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/doc-refactor/SKILL.md | archived-not-loaded | discovery and task instructions | 68 | 1421 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/doc-review/references/codex-prompt-doc.md | archived-not-loaded | on-demand task context | 96 | 3115 | historical source/pack copies, not current authority |
| migration/staging/doc-review/references/review-loop-doc.md | archived-not-loaded | on-demand task context | 35 | 861 | historical source/pack copies, not current authority |
| migration/staging/doc-review/SKILL.md | archived-not-loaded | discovery and task instructions | 114 | 3963 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/epic-merge/SKILL.md | archived-not-loaded | discovery and task instructions | 363 | 15270 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/feasibility-study/references/analysis-phases.md | archived-not-loaded | on-demand task context | 68 | 2541 | historical source/pack copies, not current authority |
| migration/staging/feasibility-study/references/codex-discussion-guide.md | archived-not-loaded | on-demand task context | 85 | 3315 | historical source/pack copies, not current authority |
| migration/staging/feasibility-study/references/output-template.md | archived-not-loaded | on-demand task context | 138 | 3030 | historical source/pack copies, not current authority |
| migration/staging/feasibility-study/SKILL.md | archived-not-loaded | discovery and task instructions | 133 | 4393 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/feature-dev/SKILL.md | archived-not-loaded | discovery and task instructions | 172 | 6079 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/feature-verify/references/blackbox-testing.md | archived-not-loaded | on-demand task context | 235 | 8910 | historical source/pack copies, not current authority |
| migration/staging/feature-verify/references/environments.md | archived-not-loaded | on-demand task context | 150 | 5285 | historical source/pack copies, not current authority |
| migration/staging/feature-verify/references/output-template.md | archived-not-loaded | on-demand task context | 150 | 4973 | historical source/pack copies, not current authority |
| migration/staging/feature-verify/references/safety-rules.md | archived-not-loaded | on-demand task context | 67 | 2825 | historical source/pack copies, not current authority |
| migration/staging/feature-verify/SKILL.md | archived-not-loaded | discovery and task instructions | 288 | 12154 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/fp-brief/references/codex-verify-prompt.md | archived-not-loaded | on-demand task context | 82 | 3002 | historical source/pack copies, not current authority |
| migration/staging/fp-brief/references/detection-rules.md | archived-not-loaded | on-demand task context | 36 | 2047 | historical source/pack copies, not current authority |
| migration/staging/fp-brief/references/extraction-guide.md | archived-not-loaded | on-demand task context | 135 | 5382 | historical source/pack copies, not current authority |
| migration/staging/fp-brief/references/output-template.md | archived-not-loaded | on-demand task context | 137 | 4504 | historical source/pack copies, not current authority |
| migration/staging/fp-brief/SKILL.md | archived-not-loaded | discovery and task instructions | 174 | 7003 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/generate-runner/references/templates.md | archived-not-loaded | on-demand task context | 140 | 3008 | historical source/pack copies, not current authority |
| migration/staging/generate-runner/SKILL.md | archived-not-loaded | discovery and task instructions | 126 | 3590 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/git-investigate/references/commands.md | archived-not-loaded | on-demand task context | 113 | 2230 | historical source/pack copies, not current authority |
| migration/staging/git-investigate/SKILL.md | archived-not-loaded | discovery and task instructions | 81 | 2533 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/git-profile/SKILL.md | archived-not-loaded | discovery and task instructions | 190 | 5948 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/install-hooks/SKILL.md | archived-not-loaded | discovery and task instructions | 74 | 2087 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/install-rules/SKILL.md | archived-not-loaded | discovery and task instructions | 80 | 2171 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/install-scripts/SKILL.md | archived-not-loaded | discovery and task instructions | 75 | 2101 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/issue-analyze/references/classification.md | archived-not-loaded | on-demand task context | 100 | 4164 | historical source/pack copies, not current authority |
| migration/staging/issue-analyze/references/report-template.md | archived-not-loaded | on-demand task context | 142 | 3078 | historical source/pack copies, not current authority |
| migration/staging/issue-analyze/SKILL.md | archived-not-loaded | discovery and task instructions | 251 | 13553 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/jira/references/branch-policy.md | archived-not-loaded | on-demand task context | 73 | 2065 | historical source/pack copies, not current authority |
| migration/staging/jira/references/create-policy.md | archived-not-loaded | on-demand task context | 54 | 2021 | historical source/pack copies, not current authority |
| migration/staging/jira/references/transition-mapping.md | archived-not-loaded | on-demand task context | 41 | 1266 | historical source/pack copies, not current authority |
| migration/staging/jira/SKILL.md | archived-not-loaded | discovery and task instructions | 213 | 7475 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/load-pr-review/references/api-contract.md | archived-not-loaded | on-demand task context | 86 | 1977 | historical source/pack copies, not current authority |
| migration/staging/load-pr-review/references/token-budget.md | archived-not-loaded | on-demand task context | 67 | 1936 | historical source/pack copies, not current authority |
| migration/staging/load-pr-review/references/verdict-triage-prompt.md | archived-not-loaded | on-demand task context | 104 | 4297 | historical source/pack copies, not current authority |
| migration/staging/load-pr-review/references/writeback-guardrails.md | archived-not-loaded | on-demand task context | 73 | 2281 | historical source/pack copies, not current authority |
| migration/staging/load-pr-review/SKILL.md | archived-not-loaded | discovery and task instructions | 437 | 17433 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/merge-prep/SKILL.md | archived-not-loaded | discovery and task instructions | 199 | 5488 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/necessity-audit/references/dimensions.md | archived-not-loaded | on-demand task context | 117 | 4849 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/references/output-template.md | archived-not-loaded | on-demand task context | 38 | 2411 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/references/phase-a-classify.md | archived-not-loaded | on-demand task context | 37 | 1175 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/references/phase-b-debate-topic.md | archived-not-loaded | on-demand task context | 46 | 1977 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/references/phase-c-consolidate.md | archived-not-loaded | on-demand task context | 59 | 2857 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/references/redaction-rules.md | archived-not-loaded | on-demand task context | 37 | 1693 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/references/review-loop.md | archived-not-loaded | on-demand task context | 40 | 2693 | historical source/pack copies, not current authority |
| migration/staging/necessity-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 177 | 7662 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/next-step/references/progression-tables.md | archived-not-loaded | on-demand task context | 65 | 2278 | historical source/pack copies, not current authority |
| migration/staging/next-step/SKILL.md | archived-not-loaded | discovery and task instructions | 155 | 6242 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/obsidian-cli/references/integration-patterns.md | archived-not-loaded | on-demand task context | 71 | 1771 | historical source/pack copies, not current authority |
| migration/staging/obsidian-cli/references/troubleshooting.md | archived-not-loaded | on-demand task context | 55 | 2498 | historical source/pack copies, not current authority |
| migration/staging/obsidian-cli/SKILL.md | archived-not-loaded | discovery and task instructions | 134 | 4499 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/op-session/SKILL.md | archived-not-loaded | discovery and task instructions | 134 | 5104 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/orchestrate/references/execution-policy.md | archived-not-loaded | on-demand task context | 37 | 2209 | historical source/pack copies, not current authority |
| migration/staging/orchestrate/references/plan-schema.md | archived-not-loaded | on-demand task context | 45 | 3190 | historical source/pack copies, not current authority |
| migration/staging/orchestrate/references/planner-prompt.md | archived-not-loaded | on-demand task context | 53 | 2468 | historical source/pack copies, not current authority |
| migration/staging/orchestrate/SKILL.md | archived-not-loaded | discovery and task instructions | 112 | 7012 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/plan-review/references/codex-prompt-plan.md | archived-not-loaded | on-demand task context | 81 | 3261 | historical source/pack copies, not current authority |
| migration/staging/plan-review/references/review-loop-plan.md | archived-not-loaded | on-demand task context | 48 | 2656 | historical source/pack copies, not current authority |
| migration/staging/plan-review/SKILL.md | archived-not-loaded | discovery and task instructions | 218 | 11665 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/portfolio/references/api.md | archived-not-loaded | on-demand task context | 101 | 2844 | historical source/pack copies, not current authority |
| migration/staging/portfolio/references/architecture.md | archived-not-loaded | on-demand task context | 106 | 4795 | historical source/pack copies, not current authority |
| migration/staging/portfolio/SKILL.md | archived-not-loaded | discovery and task instructions | 96 | 3036 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/post-dev-recap/SKILL.md | archived-not-loaded | discovery and task instructions | 224 | 14250 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/post-dev-test/references/test-patterns.md | archived-not-loaded | on-demand task context | 224 | 5574 | historical source/pack copies, not current authority |
| migration/staging/post-dev-test/SKILL.md | archived-not-loaded | discovery and task instructions | 177 | 9550 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/pr-comment/references/api-and-guardrails.md | archived-not-loaded | on-demand task context | 82 | 2858 | historical source/pack copies, not current authority |
| migration/staging/pr-comment/SKILL.md | archived-not-loaded | discovery and task instructions | 178 | 5841 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/pr-review/SKILL.md | archived-not-loaded | discovery and task instructions | 43 | 918 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/pr-summary/SKILL.md | archived-not-loaded | discovery and task instructions | 105 | 2552 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/pre-pr-audit/references/output-template.md | archived-not-loaded | on-demand task context | 92 | 2330 | historical source/pack copies, not current authority |
| migration/staging/pre-pr-audit/references/scoring-model.md | archived-not-loaded | on-demand task context | 87 | 2176 | historical source/pack copies, not current authority |
| migration/staging/pre-pr-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 190 | 7800 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/precommit-fast/SKILL.md | archived-not-loaded | discovery and task instructions | 87 | 3400 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/precommit/SKILL.md | archived-not-loaded | discovery and task instructions | 92 | 3707 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/project-audit/references/check-catalog.md | archived-not-loaded | on-demand task context | 50 | 2517 | historical source/pack copies, not current authority |
| migration/staging/project-audit/references/output-template.md | archived-not-loaded | on-demand task context | 68 | 1612 | historical source/pack copies, not current authority |
| migration/staging/project-audit/SKILL.md | archived-not-loaded | discovery and task instructions | 91 | 2972 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/project-brief/SKILL.md | archived-not-loaded | discovery and task instructions | 119 | 2884 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/project-setup/references/detection-rules.md | archived-not-loaded | on-demand task context | 260 | 7892 | historical source/pack copies, not current authority |
| migration/staging/project-setup/SKILL.md | archived-not-loaded | discovery and task instructions | 553 | 26134 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/push-ci/SKILL.md | archived-not-loaded | discovery and task instructions | 227 | 8881 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/readme-i18n-sync/references/glossary.md | archived-not-loaded | on-demand task context | 61 | 2781 | historical source/pack copies, not current authority |
| migration/staging/readme-i18n-sync/SKILL.md | archived-not-loaded | discovery and task instructions | 185 | 5890 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/recap-ask/references/qa-prompt.md | archived-not-loaded | on-demand task context | 155 | 7305 | historical source/pack copies, not current authority |
| migration/staging/recap-ask/SKILL.md | archived-not-loaded | discovery and task instructions | 181 | 10211 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/recap-doc/references/output-template.md | archived-not-loaded | on-demand task context | 140 | 7085 | historical source/pack copies, not current authority |
| migration/staging/recap-doc/references/prompt-template.md | archived-not-loaded | on-demand task context | 155 | 7843 | historical source/pack copies, not current authority |
| migration/staging/recap-doc/references/source-guide.md | archived-not-loaded | on-demand task context | 104 | 6151 | historical source/pack copies, not current authority |
| migration/staging/recap-doc/SKILL.md | archived-not-loaded | discovery and task instructions | 196 | 10562 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/refactor/references/behavioral-gate.md | archived-not-loaded | on-demand task context | 64 | 2561 | historical source/pack copies, not current authority |
| migration/staging/refactor/references/output-template.md | archived-not-loaded | on-demand task context | 54 | 1714 | historical source/pack copies, not current authority |
| migration/staging/refactor/references/refactor-catalog.md | archived-not-loaded | on-demand task context | 36 | 1846 | historical source/pack copies, not current authority |
| migration/staging/refactor/references/target-detection.md | archived-not-loaded | on-demand task context | 72 | 3051 | historical source/pack copies, not current authority |
| migration/staging/refactor/SKILL.md | archived-not-loaded | discovery and task instructions | 199 | 6008 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/remind/references/detection-rules.md | archived-not-loaded | on-demand task context | 48 | 2504 | historical source/pack copies, not current authority |
| migration/staging/remind/SKILL.md | archived-not-loaded | discovery and task instructions | 195 | 9157 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/repo-intake/references/archived/MIDWAY_HEURISTICS.md | archived-not-loaded | on-demand task context | 34 | 1025 | historical source/pack copies, not current authority |
| migration/staging/repo-intake/SKILL.md | archived-not-loaded | discovery and task instructions | 99 | 2345 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/req-analyze/references/output-template.md | archived-not-loaded | on-demand task context | 113 | 3939 | historical source/pack copies, not current authority |
| migration/staging/req-analyze/references/research-cascade.md | archived-not-loaded | on-demand task context | 38 | 1879 | historical source/pack copies, not current authority |
| migration/staging/req-analyze/SKILL.md | archived-not-loaded | discovery and task instructions | 347 | 14157 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/request-tracking/references/operations.md | archived-not-loaded | on-demand task context | 92 | 1810 | historical source/pack copies, not current authority |
| migration/staging/request-tracking/references/template.md | archived-not-loaded | on-demand task context | 94 | 1768 | historical source/pack copies, not current authority |
| migration/staging/request-tracking/SKILL.md | archived-not-loaded | discovery and task instructions | 92 | 2322 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/review-spec/SKILL.md | archived-not-loaded | discovery and task instructions | 76 | 1610 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/risk-assess/references/output-template.md | archived-not-loaded | on-demand task context | 73 | 1839 | historical source/pack copies, not current authority |
| migration/staging/risk-assess/references/risk-dimensions.md | archived-not-loaded | on-demand task context | 92 | 2932 | historical source/pack copies, not current authority |
| migration/staging/risk-assess/SKILL.md | archived-not-loaded | discovery and task instructions | 96 | 3352 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/runbook/references/check-output.md | archived-not-loaded | on-demand task context | 69 | 2690 | historical source/pack copies, not current authority |
| migration/staging/runbook/references/discovery-heuristics.md | archived-not-loaded | on-demand task context | 55 | 3186 | historical source/pack copies, not current authority |
| migration/staging/runbook/references/template.md | archived-not-loaded | on-demand task context | 159 | 5317 | historical source/pack copies, not current authority |
| migration/staging/runbook/SKILL.md | archived-not-loaded | discovery and task instructions | 200 | 7593 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/safe-remove/references/removal-policy.md | archived-not-loaded | on-demand task context | 93 | 4540 | historical source/pack copies, not current authority |
| migration/staging/safe-remove/SKILL.md | archived-not-loaded | discovery and task instructions | 170 | 6025 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/security-review/references/codex-prompt-security.md | archived-not-loaded | on-demand task context | 115 | 2805 | historical source/pack copies, not current authority |
| migration/staging/security-review/references/examples.md | archived-not-loaded | on-demand task context | 106 | 2261 | historical source/pack copies, not current authority |
| migration/staging/security-review/SKILL.md | archived-not-loaded | discovery and task instructions | 104 | 3678 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/seek-verdict/references/policy-mapping.md | archived-not-loaded | on-demand task context | 125 | 5560 | historical source/pack copies, not current authority |
| migration/staging/seek-verdict/references/verdict-prompt.md | archived-not-loaded | on-demand task context | 106 | 3427 | historical source/pack copies, not current authority |
| migration/staging/seek-verdict/SKILL.md | archived-not-loaded | discovery and task instructions | 142 | 5780 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/sharingan/references/dependency-graph-algorithm.md | archived-not-loaded | on-demand task context | 121 | 3203 | historical source/pack copies, not current authority |
| migration/staging/sharingan/references/format-mapping.md | archived-not-loaded | on-demand task context | 61 | 2927 | historical source/pack copies, not current authority |
| migration/staging/sharingan/references/input-classification.md | archived-not-loaded | on-demand task context | 101 | 4691 | historical source/pack copies, not current authority |
| migration/staging/sharingan/references/output-template.md | archived-not-loaded | on-demand task context | 70 | 1564 | historical source/pack copies, not current authority |
| migration/staging/sharingan/references/quality-checklist.md | archived-not-loaded | on-demand task context | 42 | 1707 | historical source/pack copies, not current authority |
| migration/staging/sharingan/references/source-bundle.md | archived-not-loaded | on-demand task context | 230 | 8926 | historical source/pack copies, not current authority |
| migration/staging/sharingan/SKILL.md | archived-not-loaded | discovery and task instructions | 206 | 9096 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/simplify/SKILL.md | archived-not-loaded | discovery and task instructions | 75 | 1562 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/skill-health-check/references/routing-signature-guide.md | archived-not-loaded | on-demand task context | 46 | 2247 | historical source/pack copies, not current authority |
| migration/staging/skill-health-check/SKILL.md | archived-not-loaded | discovery and task instructions | 141 | 5211 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/smart-commit/references/execute-mode.md | archived-not-loaded | on-demand task context | 75 | 2852 | historical source/pack copies, not current authority |
| migration/staging/smart-commit/SKILL.md | archived-not-loaded | discovery and task instructions | 471 | 20953 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/smart-rebase/SKILL.md | archived-not-loaded | discovery and task instructions | 190 | 6352 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/statusline-config/references/json-schema.md | archived-not-loaded | on-demand task context | 96 | 4935 | historical source/pack copies, not current authority |
| migration/staging/statusline-config/references/themes.md | archived-not-loaded | on-demand task context | 94 | 5726 | historical source/pack copies, not current authority |
| migration/staging/statusline-config/SKILL.md | archived-not-loaded | discovery and task instructions | 182 | 11855 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/tech-brief/references/output-template.md | archived-not-loaded | on-demand task context | 175 | 5343 | historical source/pack copies, not current authority |
| migration/staging/tech-brief/references/source-guide.md | archived-not-loaded | on-demand task context | 109 | 4841 | historical source/pack copies, not current authority |
| migration/staging/tech-brief/SKILL.md | archived-not-loaded | discovery and task instructions | 182 | 7375 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/tech-spec/references/feature-context-resolution.md | archived-not-loaded | on-demand task context | 118 | 5607 | historical source/pack copies, not current authority |
| migration/staging/tech-spec/references/template.md | archived-not-loaded | on-demand task context | 85 | 1987 | historical source/pack copies, not current authority |
| migration/staging/tech-spec/SKILL.md | archived-not-loaded | discovery and task instructions | 100 | 3252 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/test-deep/references/fixer-catalog.md | archived-not-loaded | on-demand task context | 74 | 2719 | historical source/pack copies, not current authority |
| migration/staging/test-deep/references/test-selection.md | archived-not-loaded | on-demand task context | 60 | 2434 | historical source/pack copies, not current authority |
| migration/staging/test-deep/references/triage-pipeline.md | archived-not-loaded | on-demand task context | 110 | 3725 | historical source/pack copies, not current authority |
| migration/staging/test-deep/SKILL.md | archived-not-loaded | discovery and task instructions | 245 | 8966 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/test-health/references/artifact-formats.md | archived-not-loaded | on-demand task context | 57 | 3157 | historical source/pack copies, not current authority |
| migration/staging/test-health/references/test-count-parsers.md | archived-not-loaded | on-demand task context | 62 | 3033 | historical source/pack copies, not current authority |
| migration/staging/test-health/references/trend-schema.md | archived-not-loaded | on-demand task context | 122 | 3695 | historical source/pack copies, not current authority |
| migration/staging/test-health/SKILL.md | archived-not-loaded | discovery and task instructions | 228 | 9024 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/test-review/references/codex-prompt-ac-trace.md | archived-not-loaded | on-demand task context | 110 | 3860 | historical source/pack copies, not current authority |
| migration/staging/test-review/references/codex-prompt-test-gen.md | archived-not-loaded | on-demand task context | 66 | 1879 | historical source/pack copies, not current authority |
| migration/staging/test-review/references/codex-prompt-test-review.md | archived-not-loaded | on-demand task context | 117 | 2985 | historical source/pack copies, not current authority |
| migration/staging/test-review/SKILL.md | archived-not-loaded | discovery and task instructions | 215 | 7820 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/ui-first-principles/references/anti-patterns.md | archived-not-loaded | on-demand task context | 160 | 8570 | historical source/pack copies, not current authority |
| migration/staging/ui-first-principles/references/jtbd-framework.md | archived-not-loaded | on-demand task context | 121 | 7847 | historical source/pack copies, not current authority |
| migration/staging/ui-first-principles/references/output-template.md | archived-not-loaded | on-demand task context | 232 | 9342 | historical source/pack copies, not current authority |
| migration/staging/ui-first-principles/references/principle-anchors.md | archived-not-loaded | on-demand task context | 165 | 7477 | historical source/pack copies, not current authority |
| migration/staging/ui-first-principles/SKILL.md | archived-not-loaded | discovery and task instructions | 324 | 21858 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/update-docs/SKILL.md | archived-not-loaded | discovery and task instructions | 84 | 2346 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/update-readme/SKILL.md | archived-not-loaded | discovery and task instructions | 103 | 3413 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/verify/SKILL.md | archived-not-loaded | discovery and task instructions | 113 | 3780 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/watch-ci/SKILL.md | archived-not-loaded | discovery and task instructions | 202 | 10149 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| migration/staging/zh-tw/SKILL.md | archived-not-loaded | discovery and task instructions | 51 | 1279 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/hooks/hooks.json | active-payload | generated instructions and hook configuration | 106 | 2437 | event registration; runtime/hook.js owns prompt text |
| plugin/sd0x-dev-flow-codex/scripts/runtime/workflow-contract.js | active-payload | generated instructions and hook configuration | 164 | 6108 | canonical generator for AGENTS managed section |
| plugin/sd0x-dev-flow-codex/skills/architecture-advice/SKILL.md | active-payload | discovery and task instructions | 62 | 3420 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/architecture/references/pack-handoff.md | active-payload | on-demand task context | 14 | 759 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/architecture/references/template.md | active-payload | on-demand task context | 68 | 1575 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/architecture/SKILL.md | active-payload | discovery and task instructions | 66 | 6438 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/ask/SKILL.md | active-payload | discovery and task instructions | 63 | 4069 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/best-practices/SKILL.md | active-payload | discovery and task instructions | 41 | 2718 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/brainstorm/SKILL.md | active-payload | discovery and task instructions | 72 | 4518 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/bug-fix/SKILL.md | active-payload | discovery and task instructions | 37 | 2540 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/bump-version/SKILL.md | active-payload | discovery and task instructions | 108 | 4305 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/check-coverage/SKILL.md | active-payload | discovery and task instructions | 37 | 2185 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/code-explore/SKILL.md | active-payload | discovery and task instructions | 62 | 3440 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/code-investigate/SKILL.md | active-payload | discovery and task instructions | 62 | 3695 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/contract-decode/references/apis.md | active-payload | on-demand task context | 84 | 5589 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/contract-decode/SKILL.md | active-payload | discovery and task instructions | 226 | 7628 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/create-pr/SKILL.md | active-payload | discovery and task instructions | 234 | 11528 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/create-request/references/request-format.md | active-payload | on-demand task context | 178 | 9372 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/create-request/SKILL.md | active-payload | discovery and task instructions | 118 | 6857 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/de-ai-flavor/SKILL.md | active-payload | discovery and task instructions | 117 | 4825 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/debug/SKILL.md | active-payload | discovery and task instructions | 51 | 4022 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/deep-explore/SKILL.md | active-payload | discovery and task instructions | 66 | 4565 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/deep-research/SKILL.md | active-payload | discovery and task instructions | 86 | 8026 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/dep-audit/SKILL.md | active-payload | discovery and task instructions | 41 | 2367 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/cases/apifox-2026-03.md | active-payload | on-demand task context | 138 | 6926 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/cases/axios-2026-03.md | active-payload | on-demand task context | 140 | 8764 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/cases/README.md | active-payload | on-demand task context | 55 | 2496 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/remediation.md | active-payload | on-demand task context | 15 | 1339 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/dev-security-audit/references/scan-targets.md | active-payload | on-demand task context | 152 | 6203 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/dev-security-audit/SKILL.md | active-payload | discovery and task instructions | 333 | 16033 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/doc-refactor/SKILL.md | active-payload | discovery and task instructions | 109 | 3872 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/doc-review/SKILL.md | active-payload | discovery and task instructions | 37 | 2167 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/doctor/SKILL.md | active-payload | discovery and task instructions | 32 | 2052 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/epic-merge/SKILL.md | active-payload | discovery and task instructions | 106 | 7439 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/explain/SKILL.md | active-payload | discovery and task instructions | 62 | 3205 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/feasibility-study/references/output-template.md | active-payload | on-demand task context | 49 | 1042 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/feasibility-study/references/pack-handoff.md | active-payload | on-demand task context | 15 | 775 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/feasibility-study/SKILL.md | active-payload | discovery and task instructions | 74 | 5667 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/feature-dev/SKILL.md | active-payload | discovery and task instructions | 37 | 2509 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/feature-verify/references/blackbox-testing.md | active-payload | on-demand task context | 24 | 1639 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/feature-verify/references/environments.md | active-payload | on-demand task context | 28 | 1906 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/feature-verify/references/output-template.md | active-payload | on-demand task context | 28 | 1028 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/feature-verify/references/safety-rules.md | active-payload | on-demand task context | 23 | 1502 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/feature-verify/SKILL.md | active-payload | discovery and task instructions | 98 | 7228 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/fp-brief/SKILL.md | active-payload | discovery and task instructions | 63 | 3360 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/generate-runner/references/templates.md | active-payload | on-demand task context | 39 | 1747 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/generate-runner/SKILL.md | active-payload | discovery and task instructions | 93 | 6339 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/git-investigate/SKILL.md | active-payload | discovery and task instructions | 62 | 3354 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/git-profile/SKILL.md | active-payload | discovery and task instructions | 101 | 6624 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/issue-analyze/SKILL.md | active-payload | discovery and task instructions | 62 | 3848 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/jira/references/branch-policy.md | active-payload | on-demand task context | 26 | 1384 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/jira/references/create-policy.md | active-payload | on-demand task context | 54 | 2048 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/jira/references/transition-mapping.md | active-payload | on-demand task context | 19 | 1324 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/jira/SKILL.md | active-payload | discovery and task instructions | 92 | 6352 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/api-contract.md | active-payload | on-demand task context | 15 | 1161 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/token-budget.md | active-payload | on-demand task context | 12 | 777 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/verdict-triage-prompt.md | active-payload | on-demand task context | 12 | 762 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/load-pr-review/references/writeback-guardrails.md | active-payload | on-demand task context | 5 | 702 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/load-pr-review/SKILL.md | active-payload | discovery and task instructions | 82 | 5588 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/merge-prep/SKILL.md | active-payload | discovery and task instructions | 90 | 6012 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/necessity-audit/references/output-template.md | active-payload | on-demand task context | 33 | 838 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/necessity-audit/references/pack-handoff.md | active-payload | on-demand task context | 15 | 685 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/necessity-audit/SKILL.md | active-payload | discovery and task instructions | 80 | 6090 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/next-step/references/progression-tables.md | active-payload | on-demand task context | 43 | 1960 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/next-step/SKILL.md | active-payload | discovery and task instructions | 87 | 6094 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/obsidian-cli/references/integration-patterns.md | active-payload | on-demand task context | 21 | 1333 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/obsidian-cli/references/troubleshooting.md | active-payload | on-demand task context | 17 | 1299 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/obsidian-cli/SKILL.md | active-payload | discovery and task instructions | 93 | 6797 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/op-session/SKILL.md | active-payload | discovery and task instructions | 69 | 4693 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/orchestrate/references/execution-policy.md | active-payload | on-demand task context | 17 | 1422 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/orchestrate/references/plan-schema.md | active-payload | on-demand task context | 64 | 4107 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/orchestrate/references/planner-prompt.md | active-payload | on-demand task context | 5 | 1099 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/orchestrate/SKILL.md | active-payload | discovery and task instructions | 74 | 6118 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/plan-review/references/output-template.md | active-payload | on-demand task context | 41 | 795 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/plan-review/references/pack-handoff.md | active-payload | on-demand task context | 14 | 589 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/plan-review/SKILL.md | active-payload | discovery and task instructions | 78 | 5848 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/portfolio/references/api.md | active-payload | on-demand task context | 13 | 938 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/portfolio/references/architecture.md | active-payload | on-demand task context | 17 | 1162 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/portfolio/SKILL.md | active-payload | discovery and task instructions | 68 | 4506 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/post-dev-recap/SKILL.md | active-payload | discovery and task instructions | 74 | 5003 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/post-dev-test/SKILL.md | active-payload | discovery and task instructions | 37 | 2617 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/pr-comment/references/api-and-guardrails.md | active-payload | on-demand task context | 23 | 1549 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/pr-comment/SKILL.md | active-payload | discovery and task instructions | 78 | 5293 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/pr-review/SKILL.md | active-payload | discovery and task instructions | 68 | 4338 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/pr-summary/SKILL.md | active-payload | discovery and task instructions | 66 | 4136 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/pre-pr-audit/SKILL.md | active-payload | discovery and task instructions | 41 | 2216 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/project-audit/SKILL.md | active-payload | discovery and task instructions | 37 | 2206 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/project-brief/SKILL.md | active-payload | discovery and task instructions | 72 | 4564 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/push-ci/SKILL.md | active-payload | discovery and task instructions | 81 | 5599 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/readme-i18n-sync/references/glossary.md | active-payload | on-demand task context | 61 | 2775 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/readme-i18n-sync/SKILL.md | active-payload | discovery and task instructions | 74 | 5018 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/recap-ask/references/qa-prompt.md | active-payload | on-demand task context | 15 | 1249 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/recap-ask/SKILL.md | active-payload | discovery and task instructions | 70 | 4602 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/recap-doc/references/output-template.md | active-payload | on-demand task context | 21 | 1668 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/recap-doc/references/prompt-template.md | active-payload | on-demand task context | 7 | 805 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/recap-doc/references/source-guide.md | active-payload | on-demand task context | 19 | 1484 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/recap-doc/SKILL.md | active-payload | discovery and task instructions | 76 | 5269 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/refactor/SKILL.md | active-payload | discovery and task instructions | 42 | 2511 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/remind/SKILL.md | active-payload | discovery and task instructions | 37 | 2026 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/repo-intake/SKILL.md | active-payload | discovery and task instructions | 74 | 4894 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/req-analyze/references/output-template.md | active-payload | on-demand task context | 73 | 1993 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/req-analyze/references/research-policy.md | active-payload | on-demand task context | 15 | 951 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/req-analyze/SKILL.md | active-payload | discovery and task instructions | 111 | 8322 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/request-tracking/references/output-template.md | active-payload | on-demand task context | 29 | 622 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/request-tracking/references/pack-handoff.md | active-payload | on-demand task context | 14 | 650 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/request-tracking/references/report-contract.md | active-payload | on-demand task context | 17 | 1151 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/request-tracking/SKILL.md | active-payload | discovery and task instructions | 68 | 5375 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/reset/SKILL.md | active-payload | discovery and task instructions | 24 | 1223 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/review-spec/references/output-template.md | active-payload | on-demand task context | 47 | 1009 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/review-spec/references/pack-handoff.md | active-payload | on-demand task context | 16 | 767 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/review-spec/SKILL.md | active-payload | discovery and task instructions | 80 | 6402 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/review/references/review-theory.md | active-payload | on-demand task context | 180 | 10383 | review role, skill, hook prompts repeat parts of rubric |
| plugin/sd0x-dev-flow-codex/skills/review/SKILL.md | active-payload | discovery and task instructions | 199 | 15292 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/risk-assess/SKILL.md | active-payload | discovery and task instructions | 37 | 2133 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/runbook/SKILL.md | active-payload | discovery and task instructions | 70 | 4538 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/safe-remove/SKILL.md | active-payload | discovery and task instructions | 72 | 4770 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/security-review/SKILL.md | active-payload | discovery and task instructions | 37 | 2245 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/seek-verdict/SKILL.md | active-payload | discovery and task instructions | 79 | 6334 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/setup/SKILL.md | active-payload | discovery and task instructions | 91 | 6342 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/sharingan/SKILL.md | active-payload | discovery and task instructions | 72 | 4893 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/simplify/SKILL.md | active-payload | discovery and task instructions | 42 | 2547 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/skill-health-check/SKILL.md | active-payload | discovery and task instructions | 70 | 4685 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/smart-commit/SKILL.md | active-payload | discovery and task instructions | 77 | 4867 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/smart-rebase/SKILL.md | active-payload | discovery and task instructions | 74 | 4814 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/statusline-config/SKILL.md | active-payload | discovery and task instructions | 69 | 4458 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/tech-brief/SKILL.md | active-payload | discovery and task instructions | 70 | 4410 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/tech-spec/references/research-policy.md | active-payload | on-demand task context | 9 | 809 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/tech-spec/references/template.md | active-payload | on-demand task context | 80 | 1981 | task-specific references; no global inheritance |
| plugin/sd0x-dev-flow-codex/skills/tech-spec/SKILL.md | active-payload | discovery and task instructions | 108 | 10550 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/test-deep/SKILL.md | active-payload | discovery and task instructions | 42 | 2787 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/test-gen/SKILL.md | active-payload | discovery and task instructions | 44 | 2746 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/test-health/SKILL.md | active-payload | discovery and task instructions | 37 | 2305 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/test-review/SKILL.md | active-payload | discovery and task instructions | 50 | 2675 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/ui-first-principles/SKILL.md | active-payload | discovery and task instructions | 72 | 4630 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/update-docs/SKILL.md | active-payload | discovery and task instructions | 125 | 4635 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/update-readme/SKILL.md | active-payload | discovery and task instructions | 70 | 4373 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/verify/SKILL.md | active-payload | discovery and task instructions | 83 | 5342 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/watch-ci/SKILL.md | active-payload | discovery and task instructions | 70 | 4510 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/skills/zh-tw/SKILL.md | active-payload | discovery and task instructions | 66 | 3973 | frontmatter/routing contract overlap; generic protocol on 41 live skills |
| plugin/sd0x-dev-flow-codex/templates/agents/sd0x-codex-primary-reviewer.toml | active-payload | reviewer profile | 15 | 1211 | task-specific references; no global inheritance |
| test/fixtures/alias-capability/plugin/skills/r4-alias-probe/SKILL.md | test-fixture | discovery and task instructions | 9 | 355 | frontmatter/routing contract overlap; generic protocol on 41 live skills |

## 實作與後續範圍

核心 managed contract、hook context、review skill/theory、reviewer profile 與 reset/remind 已改寫。42 項 workflow-contract/setup/hook focused tests 通過；目前本批 fingerprint review/verify 待完成，不沿用上一批通過宣稱。修改 SKILL.md 後仍需 repository-only reload。

補充 generator surface：`scripts/prepare-planned-formal-plugin.js` 產生 generic Protocol 與既有權限程序，是上述 431 筆檔案盤點之外的指令生成來源；本批僅標示其負債，未全面改寫 41 個業務 skill 或重新執行 bulk generator。Inventory 是改寫前 snapshot，不是 resident token 總量，也不是逐句全倉語意審查證明。
