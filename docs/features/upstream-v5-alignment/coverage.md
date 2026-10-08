# v5 功能與模式追蹤

最新驗收索引見 [驗收證據](acceptance.md)。下列各節保留實作、失敗、修正與待驗收的歷史檢查點，不代表最新 runtime gate 狀態。

此表與 [固定來源 inventory](../../../migration/upstream-v5-inventory.json) 與 [逐技能語義評估](../../../migration/upstream-v5-semantic-assessment.json) 共同定義完整驗收面；不是完成聲明。Inventory 涵蓋 snapshot 的 101 個技能、逐一來源 hash、lexical flags、既有 canonical modes/owner，以及 v4.6.2→snapshot 所有變更路徑。Flags 是搜尋輔助，不等於 modes。歷史 100 rows 中 `update-readme` 與 `readme-i18n-sync` 在 v5 source 已移除；目標仍保留既有能力，不刪除使用者入口。

狀態：**已有**＝原生實作存在、仍需本輪回歸；**適配中**＝尚有實作缺口；**待驗收**＝實作候選尚無最終 evidence；**不適用**＝具體政策／載體不適用，仍列原生替代。任何適配中／待驗收都阻止完整 v5 完成。

| ID | 來源功能／模式 | 原生 owner／對應 | 狀態與剩餘驗收 |
|---|---|---|---|
| V01 | rules-residency FR1–2：resident Anchors、gate supremacy、edit invalidation | workflow-contract/state/worktree | 已有；回歸 ordering、late finding、protected state、activation |
| V02 | resident kernel／dual character+line budget／rendered install | instruction-budget.js、setup | 待驗收；3192 chars/38 lines 初始基準；需固定本專案預算、fresh setup 測試 |
| V03 | instruction-budget scan、plugin/user shares、health reporting | repository analyzer → doctor | 待驗收；靜態字元/bytes/lines 已有，實際讀取/tokens 尚未觀察 |
| V04 | 八類 contract triggers、plugin-root locator、無 skill 自然語言路由 | managed guidance、installed contracts | 待驗收；必要 read failure 與錯版本須正反案例 |
| V05 | review scope／fix obligation／deferral exception | review theory + scope reference | 待驗收；不得以 source sub-threshold P2 取得 pass |
| V06 | review stall finding identity、bounded adjustment、durable stall memory | review diagnostics | 待驗收；保留 evidence comparison，拒絕 round cap 當完成 |
| V07 | fallback/rotation/degradation transport | configured primary + collaboration adapter | 不適用：fallback 取得 gate authority 違反 Anchor 4；native configured primary 與既有恢復流程維持功能，不複製 Claude→Codex shell launch guard |
| V08 | testing evidence／AC trace／manual exception assessment | test-review、request closure | 待驗收；exception 可報風險但不可偽造 Complete AC 或取代 deterministic verify |
| V09 | documentation split、functional exemptions、comment counting/checker | doc-review/doc-refactor + owning resolver | 待驗收；不能搬入 resolver 不支援的 split layout |
| V10 | override Anchor-first precedence、malformed/read-error refusal | project config + Git policy | 待驗收；policy 不授權 mutation，preservation 必測 |
| V11 | fact-conditioned procedure_hint：failed rounds／override／long docs | runtime factual pointers | 待驗收；只在重現漏讀後加入最小 pointer，不新增 gate authority |
| V12 | immutable user overrides、managed rule retirement | setup ownership checks | 已有；來源 fix-all-issues/framework 在 Codex 沒有安裝對應檔，不新增假退休刪除；回歸自訂 AGENTS/agents |
| V13 | canary staging／closeout | native representative observation records | 待驗收；來源 FR10 release canary 已撤回，六筆 Claude log 不作 Codex 證據 |
| V14 | kernel digest pins | seven Anchor identity + behavior tests | 已有；不 pin 整段自然語句來取代行為測試 |
| V15 | release migration notes、多語 catalog、reload | PROJECT-MIGRATION-GUIDE、payload manifest | 待驗收；記錄 canonical home/source/install/session，不發布 |
| V16 | Claude per-file warning/token import/model recommendation | Codex static/observed/unknown 分層 | 不適用：Claude 2.1.281 import accounting 與模型版本只適用來源；V02/V03 提供原生計量，不套用 50k/600 上限 |
| G01 | git-autonomy FR1–4,14–16：offer/commit-only/off、protected/detached、去重 | next-step/remind + Git policy | 待驗收；選项是路由，已有授權不重問；本輪禁止 offer/commit/push |
| G02 | repeated push invocation、0 ahead refusal | push-ci | 已有；每次 exact target/OID、FF、readback、CI；不導入每輪必問的 Claude 協定 |
| G03 | attribution invariants／sanitization | smart-commit/create-pr | 已有；需觀察受管所有入口不漏檢 |
| G04 | project override scaffold、naming conventions、offer mode | setup + Git policy | 待驗收；user-owned settings 不被升級重寫 |
| G05 | additional protected set 的 union、negation conflict | Git policy，所有 mutation owners | 待驗收；main/master/develop/release/* 不可縮小 |
| G06 | custom flow detection／scaffold opt-in | setup/runbook | 待驗收；配置內容不是執行授權 |
| G07 | user-set goal commit、off、protected permission、expiry | smart-commit goal mode | 待驗收；只承認使用者明確包含 commit 的 goal 授權，模型目標與本輪 migration task 均不授權 commit；不隱含 stage/push |
| G08 | push partial publication/protected deletion | push-ci + stack workflow | 待驗收；单-ref FF 既有；多層 partial evidence 必測；本輪不放寬 force/delete 邊界 |
| G09 | epic-merge expected remote tip、lease mismatch | epic-merge | 已有；檢查所有預覽與 readback 綁相同 OID |
| G10 | smart-rebase rerun preserves explicit target | smart-rebase | 已有；Codex 無來源 shell analyzer rerun，原生 exact target refresh 仍須回歸 |
| S01 | gh-stack report、--base、explicit chain、tracked chain | create-pr stack mode | 待驗收；chain/base 不能在 delegation 漂移 |
| S02 | extension detect/install 身分與版本 | create-pr stack mode | 待驗收；只允許已審視版本；本輪不安裝外部 extension |
| S03 | link 分支/PR URL、draft/open、existing base changes | stack protocol | 待驗收；PR-number operands 不能意外變成 branch push |
| S04 | tracked push、submit --auto、modify-state refusal | stack protocol | 待驗收；force surface、所有 layer／auto-merge/readiness 後果需預覽 |
| S05 | Stack API confirmed/absent/unverifiable、per-PR readback | stack outcome classifier | 待驗收；exit 0 不能證明完整成功，404 不是 absent |
| S06 | create-pr stack hand-built fallback、partial reconciliation | create-pr | 待驗收；native Stack 與 chained bases 分開，不能在不確定時重複 mutation |
| D01 | deploy parse/clean/candidates/resolve | native deploy helper | 待驗收；不搬 bash/Claude path locator；declared order、syntax fail closed |
| D02 | merge no-ff/ff-only、OID binding、fixed message、abort/readback | native deploy helper | 待驗收；helper 身分跨 branch switch 不變 |
| D03 | run-plan/run、print/execute、HEAD/script hash、argv | native deploy helper | 待驗收；腳本可能發布的後果需授權，預設不執行 |
| D04 | declaration drift、failure stop、restart/resume evidence | native deploy helper | 待驗收；不能自動重跑有副作用的步驟 |
| A01 | adr 新來源入口：feature resolution、numbering、append/supersede | architecture ADR mode | 待驗收；既有 architecture 不等於全部 ADR 行為；需 native resolver + immutable decision history |
| B01 | 其餘既有技能與 canonical modes | inventory 的 native_units + prior_delivery | 已有映射；每筆標 existing-mapping-awaiting-v5-acceptance，完整 check 與 changed-path semantic audit 後才提升 |

## 來源與觀察

2026-10-03 來源 HEAD `7805e98510943f45e57f9856966172401cff0c40`、v5 tag `c9f112af4af9e6bf362d7baa3502b3593f42c1c4`、clean。沒有較新 checkout commit 可採用，也沒有修改或 fetch 來源。

doctor 真實 CLI transport ready，本會話 SessionStart activated；configured primary profile 唯讀且未指定 model/effort，繼承 parent。新的 0.160.0 alias probe 完整取得 schema、兩種 catalog 與 exact invocation marker；不是 native contracts 行為驗收。

初始 static report：managed 3192 UTF-16 units / 38 lines，user 2185 / 29，full descriptions 14737 units（UTF-8 14747 bytes）。這些口徑不能和上次 2694/36 的 managed baseline混用，也不能換算 token 節省。尚未量測實際契約讀取或逐載體 tokens。

重現：`node scripts/upstream-v5-inventory.js ../sd0x-harness`；`node scripts/instruction-budget.js . plugin/sd0x-dev-flow-codex review test-review doc-review`。

## 第二批實作候選（尚未完成 gates）

2026-10-03 已接入 distributable runtime：八類 manifest-bound contract reader、doctor locator/靜態載體報告、3840 UTF-16 units／44 lines 的原生 resident regression budget、Git policy/scaffold/offer/goal eligibility、ADR planner、Stack exact-lease/API planner/readback classifier、deploy plan/step/ordered flow、review diagnosis 與 comment scanner。managed block 實際 3780 units／40 lines；增加的是先前未覆蓋的契約 triggers，沒有聲稱 token 節省。

三個技能擴充以新的 successor owners 交付：architecture 的 ADR、create-pr 的 Stack、runbook 的 deploy。Default runbook 保持文件用途。86 個公開入口與歷史 95 個 migration units 不擴張；101 個來源技能中的 adr/deploy-flow/gh-stack 另列 native_extension，並非把新增來源技能塞進歷史 100-row inventory。

已執行隔離 fixtures：政策 malformed/unreadable/symlink、protected union、offer decline/current gates、goal origin/scope/expiry、scaffold preservation、ADR numbering/archive/duplicates、merge parents/message、source/declaration drift、conflict abort、print default、failed run stopping、實際 bare-remote partial publication 與 stale lease refusal、Stack 404/absence/partial、契約錯版本/錯 bytes/漏檔/讀失敗、comment exemption/blank bridge、stall identity。測試直接 import 正式 runtime。尚未執行外部 PR/Stack/deploy 寫入；本輪授權不包含這些操作。

V02–V06、V08–V10、G01/G04–G08、S01–S06、D01–D04、A01 的狀態提升為「實作候選，待完整驗收」，表格的適配中備註保留缺口歷史；仍須核對 scope/override 的細項語意、完整 101-skill semantic assessment、正式 gates、closure/promotion 與新 host 觀察。V11 尚未發現已重現的 Codex 漏讀，不能捏造事實條件 hint 或 canary。

來源歷史 inventory 的 f4187c53 commit 在目前唯讀來源 object store 不存在。未 fetch 或改寫來源。以既有 hash-bound staged source inventory 逐檔比較 v5 snapshot，記錄每個技能所有檔案的 added/changed/removed/unchanged，和 v4.6.2 release delta 分開。尚未人工驗收的 semantic_review/acceptance 明確保持 pending。

## 完整差異補充追蹤（不可由 B01 一列取代）

| ID | v5 功能／模式 | 原生實作與邊界 | 狀態 |
|---|---|---|---|
| C01 | doc taxonomy／metadata preamble／four authority roles | runtime doc-metadata/doc-classifier；未知角色 fail closed、Yes 優先、身分與 read error refusal | 實作候選，待正式驗收 |
| C02 | split canonical／完整 context／scan_error／ambiguity | owning request resolver additive shape，root exact→split main→unique root variant；非完整 JSON／Git EIO 拒絕 | 實作候選，focused 5 tests pass |
| C03 | role-aware consumers／Corpus scan status | ask、runbook、brief、recap、test-health、architecture、feasibility、update-docs；歷史保留 | 實作候選，待技能驗收 |
| I01 | feature intent artifact／planning create-only／invariant conflicts | exact key、strays、60 lines、3–7 invariants、exclusive write；規劃／實作／request consumers | 實作候選，focused preservation pass |
| M01 | workspace manifest graph／overview／reverse／cycles | native manifest-map，五種生態系、budget、完整 JSON、保守 membership、secret redaction | 實作候選，原生 runner 與來源 regression corpus 已執行 |
| R01 | refactor reference-stability | 1–5 explicit files、manual region confirmation、same-kind anchors、outer gates | 實作候選，待技能驗收 |
| O01 | read-only baseline 完整性 | ignored bytes／empty dirs／refs/config/worktree metadata；512 MiB refusal；排除 host/dependencies/object store/runtime-owned metadata | 實作候選，3 focused tests pass |
| O02 | source run-state FIFO pruning | 原生 baseline 常駐單次 process memory，未建立來源 disk FIFO；無需清理不存在的持久化 queue | 不適用，原生等價已評估 |
| Q01 | NO CHECKS RUN／ecosystem fallback | policy-only fail；nonblank Node scripts；Kotlin Gradle/Maven/Ruby detection | 實作候選，verifier behavior tests pass |
| Q02 | runner globs／allowlist-before-probe／temporary cleanup | native fixed argv、feature-verify probe 前 allowlist、necessity-audit response-only 已有；沒有來源 shell glob/temp mutation 路徑 | 已有，待完整回歸 |
| SEC01 | OWASP 2025 categories | official sources 2026-10-03 查證，A03/A10/A01 SSRF reference 與技能接入 | 實作候選，待文件驗收 |

技能 successor 範圍已擴為 30 個既有入口／38 個既有 migration units。公開 inventory 仍為 86；這些數字是交付單位，**不是** v5 功能數。新 owner 保留前次 owner 的 hash 與 promotion record，不改寫先前 22 技能／23 模式的 durable evidence。

新增 focused 結果：manifest map＋native workflows＋contracts＋budget 共 188 pass；feature docs＋verifier 共 20 pass；readonly proof＋reference planner 共 3 pass。這些是局部測試結果，不是最終 fingerprint 的 review/verify。來源 metadata regression 與最終 full check 另列實際執行證據。

| ID | 第二輪完整 reference/script 對照補充 | 原生對應 | 狀態 |
|---|---|---|---|
| G11 | smart-commit effective/configured identity、valueless/empty/unset/error、scope-aware helpers | native commit-workflow inspector；不替換使用者 signer/hooks、不寫全域設定 | 實作候選，待邊界與正式驗收 |
| G12 | all-ref newly reachable commits、invocation marker、shallow/graft/replacement、failure partial | native commit plan/execute/audit；first commit、side-ref attribution、unknown concurrent commits | 實作候選，隔離 fixture 執行中 |
| G13 | rebase literal／ambiguous ref、remote mapping／negative refspec／producer errors | native git-refs＋smart-rebase guidance；不隱含 fetch | 實作候選，待正式驗收 |
| SVD01 | clarify impact 與 actionability 兩軸 | seek-verdict impact mapping ≥0.70；不授予 dismissal/gate authority | 實作候選，focused positive/negative pass |
| C04 | Related Files 不提升 design authority、issue UNAVAILABLE、delegated Git drift | runbook／architecture template／issue-analyze／feature-dev consumers | 實作候選，待技能驗收 |

兩個唯讀 investigator 已補讀原先未完全覆蓋的 changed references/scripts：第一組 25 組 references 的 staged baseline 與固定 v5 hashes 全部相符；第二組檢查 orchestrate、smart-commit、next-step、smart-rebase、skill-health/sharingan、runner templates、feature-verify。這是語義調查，並非 configured-primary review。新增缺口 G11/G12/SVD01 已列獨立功能，沒有以 G03 一般 attribution 字句代替驗收。交付單位目前 32 targets／40 units。

## 最後一輪語義補查與候選修正

[逐技能語義評估](../../../migration/upstream-v5-semantic-assessment.json) 現涵蓋全部 101 個來源技能：30 個來源樹完全相同，71 個有 entrypoint/reference/script 差異；逐筆保留原生 units/modes、實際調查範圍、具體平台替代與待驗收狀態。67 筆唯讀調查紀錄包含重疊主題，不拿紀錄數當功能數。來源缺口與後續 resolution 同時保留，未把調查或候選文字當作 AC pass。

| ID | 功能／原生模式 | 實作與驗收邊界 | 狀態 |
|---|---|---|---|
| G14 | setup Git hooks init/sync/doctor/remove | git-hooks runtime：commit-msg 預設、pre-push 明確 opt-in、Husky/ref stdin、ownership、fallback pending、decline 續接、安全移除；不寫外部 hooksPath | 6 個隔離實際執行測試通過，待正式 gates |
| R02 | review branch dual opinion | primary + fresh advisory secondary，前後 exact base/head；secondary 無 gate authority | 候選，待技能驗收 |
| R03 | debug independent confirmation | neutral failure evidence、fresh read-only context、未執行或分歧為 inconclusive | 候選，待技能驗收 |

commit inspector 已修正刪除最後 tracked file 的非空變更誤拒，正例與 empty-tree 無變更反例通過。Reference planner 對 code 的 regex 命中只回候選與 unknown count，模板字串／heredoc 不能被宣稱是可修改註解；Markdown fence 長度與跨行 HTML comment 邊界已有回歸。

交付範圍更新為 **33 個既有入口／41 個既有 units**，仍維持 86 個公開入口／95 個 migration units。首輪 40 preflights 為 34 pass／6 格式失敗；修正文句保留 auditor 規則，受影響單位重新驗證。Git hook 執行限隔離 fixture，本專案未安裝新 Git hook、commit、push 或改動 Git 設定。

### 搬入 live 與來源重查

41 個單位的 canonical preflight 與移動前 audit 均已通過；canonical move API 搬入 33 個既有技能，preflight payload hashes 與歷史 owner hashes 全部核對。搬移後 audit、正式 review/verify、closure/promotion 仍待完成。舊 overlay 的 regular SKILL.md 尚未重建，不能把 live source 更新當成 registry 生效。

來源重新觀察：HEAD `57401f0dca8fe6d6800d3857a5a58a1617235a3d`、版本 5.0.0、v5 tag 未變；新 commit 僅增加相容性 tech-spec/intent。來源另有未提交的 Canonical Anchor extraction／Codex setup 相容性開發，本輪未修改也未採入這些並行 work-in-progress；固定 `7805e98510943f45e57f9856966172401cff0c40` 繼續作可重現基準。Native workflow-contract 本來就是七個 Anchors 的單一 renderer，沒有移植未完成的 Claude artifact generator。初始 clean 記錄保留為歷史觀察。

Push hook 額外回歸證明 remote destination 會改變確認 digest、Git 合法符號／Unicode refs 可處理、non-UTF8 local ref 的 stdin bytes 原樣交給 downstream；自動 fallback 仍 pending，doctor 亦檢查 recorded Node/guard 是否可用。這些均在隔離 fixture，不是本專案的 Git 操作授權。

Node 24.21.0 以官方 SHA256核對後隔離執行。首輪新增 corpus 共267 cases：266pass／1fail，暴露 Git保留 /var 與 /private/var 不同 root spelling 的真實安裝誤判；已修正僅正規化 repository ancestor，仍保留 descendant symlink refusal。修正後 Git hook 11cases 全pass，含真實 Git commit、modern Husky shim、recorded Node消失與missing helper。尚不把 focused 結果稱為完整 check；其餘case於final verifier回歸。

### 正式主審修正與未完成驗收

Fingerprint `b885c47cea9ceddf4781b5b33e8add97a61dda18e6589799d3d590be7e0b2637` 的41單位移動後 canonical audit 通過；configured primary 實際回報四項問題，已透過 round import／gate fail 正式記錄。後續修正使該 fingerprint 的稽核僅為歷史紀錄，不能沿用為新 fingerprint 的完成證據。

- Manifest map 的 missing／ambiguous selector 與最外層錯誤輸出統一遮罩；原生 runner 回歸使用合成 token，未接觸真實憑證。
- Deployment 的 Git 探測停用 fsmonitor；隔離正反控制證明原 helper 可執行、preview 不執行，而明確授權的 merge 仍保留使用者 Git hook。
- Comment scanner 對 template、heredoc、multiline quoted data 與無法區分的 regexp／division 回報待人工確認區域；只對已解析前綴產生確定 finding，不把字串資料算成註解，也不把未掃描後綴稱為 checked。
- issue-analyze successor owner／交付 plan 的 AC 已更正為獨立判斷成功與 UNAVAILABLE 的實際行為；成功／不可用 consumer 觀察仍待補，未沿用錯置的 Git policy AC。

修正後 Node24 的相關 corpus 共23 tests全通過。正式 review／deterministic verify 尚須重開；其他單位的 consumer、mode-specific 輸出與新 host registry／SessionStart 不能由 routing 字串檢查或共用 helper pass 推算為 Complete。原始主審的 AC Pending 判定保留，不由父代理補寫通過。


### 2026-10-03 新 session consumer 驗收觀察

以下為補充觀察，不把前述歷史 Pending 改寫成已通過；完整 AC 仍由 configured primary 獨立判定，closure 與最終 gates 另行執行。

- Source/install/session 分開核對：86 份 SKILL 的 SHA-256 全部一致、hooks hash 一致；新 thread 的實際 discovery catalog 含 86 個入口。Doctor 的 runtime 與 review context 可用，runtime activation record 與本次 thread ID 相符。Parent transcript 設定為 gpt-6-astra/high；configured primary profile 唯讀、不固定 model/effort。
- 自然語言測試充分性案例未點名技能。CLI 在判斷前透過版本 0.5.4 reader 成功取得 testing contract，JSONL 中回傳的 content SHA 與宣告 SHA 相符；先前錯誤的命令格式確實失敗，修正後才進行評估。結果區分 1 個已執行正例與未驗證的拒絕路徑，沒有把靜態程式檢查當成測試通過。
- 文件 consumer 實際取得 documentation contract 及 owning resolver 完整 context。ask／update-docs／recap-doc 共用的 fixture 涵蓋 Current、Design、Work、History、split main、exact intent 與 stray。只更新 Current 文件；其他歷史與 intent bytes 前後一致。recap 明列 Corpus scan；ambiguous 是 complete scan 下的多候選，symlink 讀取拒絕是 unknown，兩者都不是 absence。
- req-analyze／tech-spec intent-create 路徑實際回傳既有檔 preserved；缺檔首次 created、再次 preserved。新檔 16 行／3 invariants；無覆寫既有 intent。
- debug 使用 fresh read-only 子代理，提供 neutral reload failure trace，不含父代理結論；獨立回覆區分原始程序退出競態、後續恢復證據與未自行觀察的 activation。issue-analyze 成功案例另有 native spawn 及獨立 terminal 證據；CLI events 不完整呈現 custom spawn，故使用完整 host transcript 核對，不能單看 wait 或摘要。
- review/branch dual opinion 在隔離 fixture 對同一 base/head 執行 configured primary 與 fresh secondary；兩者各自實讀 dispatch/scope/stall contracts，前後 OID 相同，分別完成 22 與 27 個輸入斷言，沒有寫入主專案 gate。其他 report modes 的共同邊界仍須依各 mode 程序與現有測試逐項評估，這一筆不冒充所有 modes 的獨立執行。
- Node 24.21.0 focused corpus：283 tests 通過；setup／既有 consumer／probe 回歸另有 41 tests 通過。它們是開發觀察，完整 npm run check 與正式 review/verify 尚待最終 fingerprint。

原始本機觀察保存在 ignored `.sd0x/v5-native-delivery/`：`session-current-observation.json`、`consumer-evidence.json`、`consumer-observations/*.events.jsonl`、對應 host transcripts 及兩份 current 測試 log。CLI 的整體 token usage 與各檔靜態 chars/bytes/lines 分開記錄；逐載體 token 歸屬仍 unknown。自然語言 consumer 的 login shell 實際使用 Node 24.20.0，主專案回歸使用指定 Node 24.21.0，兩者不混稱同一執行環境。這些觀察不得由舊 skill-behavior-eval 的 task_pass grade 推算。


issue-analyze 的失敗 consumer 亦已觀察：原生 spawn_agent 拒絕缺少 task_name 的請求，沒有產生獨立 terminal。輸出明確回報 UNAVAILABLE、policy mapping unavailable，未給獨立信心值，且未把參數解析錯誤誤稱為 profile 不存在。此為實際派送失敗下的輸出驗收，不代表已證明不存在 profile 的 host 行為。


### 長憑證與委派邊界補驗

後續 configured primary 在 `b6ce4fa3d5b21a7ec5f7f529488e55dabf95f939f084ec4538c30d8a81d6a022` 找到 P1：manifest map 先截短長 URL，移除 `@` 後無法遮罩密碼。該輪已正式 import／fail。修正將完整 diagnostic／rawSpec 先遮罩再截短；新增 Node／Go／Rust 長憑證輸入，經 CLI 與 native runner 驗證 JSON／Markdown 不洩漏前綴。相關 corpus 170 tests 通過，修正仍須新的正式 review。

Reference-stability 另有實際三檔 consumer 觀察：Markdown 3→1（兩個轉為同目標的 symbol／heading，一個目標缺失保留）；程式註解人工確認後 1→0；歷史記錄不改。基準與修改後斷言確認程式、字串、fenced example 與歷史 bytes 保留。不能將 native planner 的 code count=null 改稱自動精確計數。

Delegated implementation 以獨立 worker 在隔離 fixture 新增 multiply 並保留 sum，只有兩個指定檔案變動，Node24.21 的四個行為測試通過。父代理及 worker 分別觀察 item 前後 HEAD 與 stash：HEAD 相同、stash 均空。這證明沒有持續性 identity drift，不能證明兩次觀察間沒有瞬時 mutation。原始 before/after、worker transcript 及 reference conversion 紀錄都在 `.sd0x/v5-native-delivery/consumer-observations/`；主專案未 staging、commit 或 stash。


### 完整回歸發現與修正

`52a8b9ecf27cce3c09cacf8b57e7201601ac814a7718fe963c1ba40673937950` 的 configured primary 已正式通過；隨後 deterministic verifier 執行完整 `npm run check`，source audit 與 41 個 active candidates audit 通過，測試為 1475 pass／5 fail／3 skip，因此 verification gate 為 fail，尚未進入 closure。

四項 state 測試的 fixture 沒有專案檢查命令，被新的 `NO CHECKS RUN` 規則正確拒絕；fixture 改為提供實際 `node --check app.js`，不放寬 verifier。另一項揭露 detached resource 重建會受執行環境 umask 影響：來源檔明確為 `0744` 時，在 `0077` umask 下仍會重建成 `0700`。重建流程改在綁定父目錄中 exclusive open，寫入後對同一 descriptor 還原捕捉的權限，保留防 symlink 與父目錄身分檢查。回歸 fixture 明確設定來源 mode 與 restrictive umask，並於測試後恢復 umask。修正後須重新 review／verify，不沿用前次 gate。

修正後的 state／verify 共44 tests及 preserved-resource／atomic-write 共3 tests通過；包含 policy-only verification 仍必須失敗的反例。完整檢查仍需重新執行。
