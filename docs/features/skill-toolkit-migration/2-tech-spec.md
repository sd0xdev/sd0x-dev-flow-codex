# sd0x Skill Toolkit 遷移技術規格

> **Doc class**: Lifecycle — Phase 2 technical specification
> **Created**: 2026-07-10
> **Updated**: 2026-07-12
> **Status**: Proposed
> **Primary source snapshot**: `sd0x-dev-flow@f4187c53eb746b6f84eb1f413e7210bd506e6db9` (`v3.0.12-18-gf4187c5`) + pinned two-skill local overlay
> **Request tickets**: See [`requests/`](./requests/)

## 1. Requirement Summary

### 1.1 Problem

Codex-native review auto loop 已完成，下一個缺口是來源 `sd0x-dev-flow` 的完整 skill 工具包。可重現 Git snapshot 有 98 個 skills / 263 files / 138 references / 25 scripts；目前 sibling 開發環境另有兩個 ignored local-only skills，共 3 files / 1 reference。Composite inventory 因此是 100 / 266 / 139 / 25；Wave 1 的 `req-analyze` 與 `tech-spec` final payload 已進入 gate transaction，目標 repository 只有 11 個核心 skills。若逐檔直拷，Claude Code tool names、hook payload、session state、Codex MCP 角色與 mutation authorization 會在 Codex runtime 失真；若只挑少數重寫，又會遺失來源長期累積的工作流理論。

### 1.2 Goals

1. 對來源 100 個 skills 達成 100/100 disposition coverage：每個 skill 都有 closed disposition、target package、canonical target、alias policy 與 capability 分類。
2. 優先交付需求生命週期、研究決策、Git/CI 交付等高價值 skills。
3. 保留來源核心理論：problem/solution/execution 文件分層、獨立研究、Nash 式對抗辯論、evidence-first synthesis、最小權限與顯式 mutation authorization。
4. 所有 live skills 使用 Codex-native tools、events 與 state；不得把 Claude hook payload 當作 Codex runtime contract。
5. 只有 curated-core allowlist 可 promotion 到 `plugin/sd0x-dev-flow-codex/skills/`；其餘 skills 產生 separate-pack-ready payload/spec，且各自通過相稱 gates，不能膨脹 core。

### 1.3 Non-Goals

- 本規格階段不一次建立 100 個 live entrypoints。
- 不把 100-row inventory/table 等同於 100 個 core live skills；non-core destination 必須是 separate plugin pack。
- 不複製 Claude-only statusline、`.claude/` installer 或 `mcp__codex__*` choreography 到 Codex runtime。
- 不讓 compatibility alias 與 canonical skill 同時競爭自動 routing。
- 不以降低既有 fingerprint-bound review/verify gate 換取遷移速度。

### 1.4 Scope

| Scope | Included |
|---|---|
| In | Skill inventory、Codex adapter contracts、migration waves、canonical/alias 決策、測試策略、request tickets、reload/release gates |
| Out | 本輪實際 promotion 大量 skills、外部服務登入、git commit/push、使用者層級 `CODEX_HOME` 變更 |

## 2. Existing Code Analysis

### 2.1 Inventory Baseline

| Metric | Composite source | Current Codex plugin | Gap |
|---|---:|---:|---:|
| Skills | 100 | 11 | 89 entrypoints, plus semantic merges |
| SKILL.md lines | 16,849 | curated core | Large orchestration surface |
| Skill payload files | 266 | bundled core only | 259 files require disposition |
| References | 139 | review theory + existing refs | Progressive-loading migration required |
| Bundled scripts | 25 | deterministic runtime scripts | Runtime/API audit required |

Current Codex skills are `bug-fix`、`create-request`、`doctor`、`feature-dev`、`remind`、`req-analyze`、`reset`、`review`、`setup`、`tech-spec`、`verify`。其中 review 已把來源的 reviewer/auto-loop 理論改成 configured Codex-first/Claude-wrapper primary + 一個 independent native Codex test perspective，並綁定 exact worktree fingerprint 與 provider policy。R1/R2 infrastructure 已實作，R3 durable closure/ledger 已完成；R4 對 Codex `0.144.4` 的 registry capability probe 已完成並永久選定 version-bound `mapping-only` fallback；`create-request` 仍是受限 live bootstrap，正式 Wave 1 promotion evidence 由後續唯一 gate-owner ticket補齊。

Composite provenance 不把 dirty working tree 假裝成 commit：primary Git tree 固定為 98/263/138/25；`readme-i18n-sync` 與 `update-readme` 是明列 raw-byte hash 的 local overlay。R1 只能在 hashes 全部相符時匯入；完成後 overlay bytes 由本 repository 的 tracked staging 固定。

### 2.2 Source Lifecycle Contract

來源 `/req-analyze`、`/tech-spec`、`/create-request` 的核心不是三個獨立模板，而是文件生命週期：

```mermaid
flowchart LR
    R[req-analyze<br/>problem space] --> T[tech-spec<br/>solution design]
    T --> Q[create-request<br/>execution tickets]
    Q --> F[feature-dev<br/>implementation]
    F --> V[review + verify<br/>fingerprint gates]
```

| Artifact | Cardinality | Responsibility | Forbidden content |
|---|---:|---|---|
| `1-requirements.md` | One per feature | 5-Why、stakeholders、FR/NFR、MoSCoW、acceptance signals | Architecture、solution ranking、progress table |
| `2-tech-spec.md` | One per feature | Existing-code research、architecture、risk、WBS、testing | Per-task status tracking |
| `requests/YYYY-MM-DD-*.md` | Many per feature | Single-task scope、AC ≤ 8、progress、related files | Feature-wide requirement decomposition |

這個 contract 必須先遷移，因為後續每個 skill migration 都要透過相同 tech spec/request workflow 追蹤。

### 2.3 Codex-Native Constraints

| Source assumption | Codex-native replacement |
|---|---|
| `mcp__codex__codex` / reply threads | Native Codex reasoning or read-only Codex subagent；真正獨立模型視角改由 bundled Claude MCP 提供 |
| Claude `Agent` tool | Codex collaboration agents；只有 skill 明確要求獨立或平行研究時才 dispatch |
| `AskUserQuestion` | 可用時採 product input tool；mutation approval 不可自動 resolve，否則停止並用一般訊息取得下一個 user turn |
| Claude `Skill(...)` nesting | Canonical Codex skill contract + explicit orchestration；不得假設未註冊的 Skill tool |
| `CLAUDE.md` / `.claude_review_state.json` | `AGENTS.md` + Git metadata/`.sd0x` runtime state |
| Claude hook payloads | Codex event adapter in `scripts/runtime/hook.js` |
| WebSearch/WebFetch | Codex web tool，技術事實優先官方/primary sources，web content 一律視為 untrusted data |
| Bash tool allowlist | Codex sandbox/approval policy + deterministic built-in Node scripts |

## 3. Technical Solution

### 3.1 Migration Architecture

```mermaid
flowchart TD
    S[Composite sources<br/>98 Git + 2 overlay] --> I[Inventory + provenance]
    I --> C{Classify}
    C -->|direct| P[Source-faithful shadow port]
    C -->|Claude-specific| A[Codex event/tool adapter]
    C -->|duplicate| M[Merge into canonical skill]
    C -->|domain-specific| O[Optional/domain wave]
    P --> G[Promotion gates]
    A --> G
    M --> G
    O --> G
    G --> L[Live plugin skills]
    L --> R[Configured primary + Codex test review]
    R --> V[Deterministic verify]
```

### 3.2 Copy-First, Promote-Later Policy

使用者要求「不確定就全抄再慢慢改」採以下安全版本：

1. **Pin**：每批固定 source commit，記錄每個檔案 hash 與 license provenance。
2. **Shadow port**：Foundation R1 允許把 pinned `skills/` payload 完整複製到 tracked `migration/staging/`；它不在 plugin payload 下，也不得被 manifest 或 registry discovery 納入。
3. **Adapter audit**：逐項處理 tools、hooks、state、paths、external writes、secrets、model-role reversal。
4. **Canonicalization**：決定 live name、aliases、merge target 與 routing boundary。
5. **Delivery**：`target_package=core` 才採 two-phase promotion 到唯一 distributable core payload；non-core 只移到 `migration/packs/<target-package>/` 成為 pack-ready handoff，不進 core manifest/discovery，未在獨立 pack repository 重跑 gates前不得稱 live。唯一例外是下述 user-authorized `create-request` bootstrap，它是受限 live workflow，不是已完成的 formal promotion。
6. **Drift audit**：後續分開比較 primary Git SHA/tree 與 local-overlay hashes，列出新增、移除、修改的 source skills。

Shadow copy 不是 live skill，不得出現在 plugin manifest 或 skill registry；因此不會違反「public skill set curated」與單一 distributable payload 原則。

### 3.3 Package Shape

```text
plugin/sd0x-dev-flow-codex/
├── skills/<canonical-name>/
│   ├── SKILL.md
│   ├── references/*.md
│   └── scripts/*.js
├── skills/create-request/scripts/
│   └── request-tool.js        # bootstrap query-only resolver/scan owner
├── scripts/runtime/
│   └── feature-resolver.js    # future shared owner when req-analyze/tech-spec land
└── templates/
    └── ...

docs/features/skill-toolkit-migration/
├── 2-tech-spec.md
└── requests/*.md

migration/                       # repository-only, never distributed
├── source-inventory.generated.json
├── source-disposition.json
├── evidence/
│   └── alias-registry-dump.json
├── candidates/<canonical-skill>/... # adapted, not discovered/distributed
├── packs/<target-package>/<canonical-skill>/... # pack-ready handoff only
└── staging/
    ├── LICENSE.upstream
    └── <source-skill>/...
```

`migration/staging/` 採 tracked source mirror；`LICENSE.upstream`（以及來源存在時的 NOTICE）必須從 pinned commit raw-byte 複製並納入 hash。來源與本專案同為 MIT，promotion 前仍須逐 skill 記錄 `license_status=approved`，且 audit 必須以 attribution file hash 驗證。根目錄 `scripts/skill-migration-audit.js` 是 migration validation 的唯一 owner；live runtime 不新增第二份 catalog validator。

### 3.4 Source Manifest Contract

Primary source 是 `https://github.com/sd0xdev/sd0x-dev-flow.git`，固定 commit `f4187c53eb746b6f84eb1f413e7210bd506e6db9`；該 Git tree 必須且只會列出 98 skills / 263 files / 138 references / 25 scripts。Composite 的另外兩個 skills 來自 pinned local overlay：

| Overlay path | Size | Raw-byte SHA-256 |
|---|---:|---|
| `skills/readme-i18n-sync/SKILL.md` | 5,890 | `6de25877ad11f4da564261485849394018dda7637875e03b2911ec7eb28a5f0a` |
| `skills/readme-i18n-sync/references/glossary.md` | 2,781 | `a7151b3130ee0ddaf7382b05e5809f07469879db8401545b5b181d664946130c` |
| `skills/update-readme/SKILL.md` | 3,413 | `c2cea3d903e872ffb535c396764a47690cb8b112ce67fdcfe26fce4fac7fff95` |

Local overlay 沒有可聲稱的 Git commit；R1 必須把 `kind=local-overlay`、base commit、path/size/hash 與 acquisition path 明記，hash mismatch 或檔案不存在就 block，要求新 pinned source decision，不能改讀任意 dirty bytes。資料分成 immutable generated inventory 與 mutable disposition overlay；audit 依 `source_name` compose 成 logical manifest，generator 永不讀寫 overlay。Foundation R1 以 Node.js 18 built-ins 執行：

1. Primary 只能由 Git object database 列舉/匯出（等價於 `git ls-tree -r <commit> -- skills` + `git archive`），禁止用 source working tree `find` 冒充 commit snapshot。
2. Local overlay 只接受上表三個 exact paths；先驗 size/SHA-256，再匯入 tracked staging。所有 relative paths 正規化為 POSIX separators 並 bytewise stable sort。
3. 每檔計算 SHA-256 over raw bytes；inventory 同時記錄 `source_id`、`path`、`size`、`sha256`。
4. Skill entry 包含自身目錄全部 files；`@rules`、root scripts 等 shared dependencies 另列在 root `external_dependencies`，每筆同樣 hash 並列出 consumers，不計入 266 個 skill payload files。
5. `source-inventory.generated.json` 記錄兩個 source records、license path/hash、generator/schema version，以及 per-source/composite totals；同一 tracked staging 必須 byte-for-byte stable。
6. `source-disposition.json` 是 checked-in planning seed，只由 requests 修改；R1 依本規格的 100-row table 初始化，generator 不得覆寫。
7. Audit 必須先斷言 primary 98/263/138/25、overlay 2/3/1/0，再斷言 composite 100/266/139/25；任一 missing、duplicate 或 hash drift 都 fail。

**R1 implementation record (2026-07-12)**：`scripts/generate-skill-manifest.js` 已用 pinned Git objects 建立 tracked shadow snapshot，並把 exact-hash local overlay 合成 100/266/139/25 inventory。實際 catalog 含 36 個 literal shared dependencies；每筆皆有 closed kind、raw-byte SHA-256 與 sorted unique consumers。Upstream `LICENSE` 原始 1,064 bytes 已固定為 `migration/staging/LICENSE.upstream`（SHA-256 `c4fe0757bdfa3af1a4d1578b35bffa8b7b42199bdfd3c746b3f43efa391dae62`），pinned tree 無 root NOTICE。Mutable planning seed 由只能首次建立、拒絕 overwrite 的 `scripts/initialize-skill-disposition.js` 初始化；immutable generator 的 execution path 不讀寫 disposition。`npm run migration:manifest:check` 以 hard-pinned inventory hash 驗 tracked bytes，`npm run migration:manifest:source-check` 另從隔離 replacement/object selectors 的 source Git database 重建比較；fixture tests 證明 dirty primary working tree 不會影響 output、overlay drift 與 symlink escape 會 block、publication failure 會 rollback。Shadow payload 仍完全位於 distributable plugin 之外。

```json
{
  "schema_version": 1,
  "generator_version": 1,
  "sources": [{
    "id": "upstream-git",
    "kind": "git",
    "repository": "https://github.com/sd0xdev/sd0x-dev-flow.git",
    "commit": "f4187c53eb746b6f84eb1f413e7210bd506e6db9",
    "totals": { "skills": 98, "skill_files": 263, "references": 138, "scripts": 25 },
    "license": { "path": "LICENSE", "staged_path": "migration/staging/LICENSE.upstream", "size": 0, "sha256": "..." },
    "notices": []
  }, {
    "id": "local-skill-overlay-2026-07-10",
    "kind": "local-overlay",
    "base_commit": "f4187c53eb746b6f84eb1f413e7210bd506e6db9",
    "acquisition": {
      "origin": "sibling-repository-working-tree",
      "repository": "https://github.com/sd0xdev/sd0x-dev-flow.git",
      "relative_path_from_target": "../sd0x-dev-flow",
      "observed_head": "f4187c53eb746b6f84eb1f413e7210bd506e6db9",
      "observed_on": "2026-07-10"
    },
    "totals": { "skills": 2, "skill_files": 3, "references": 1, "scripts": 0 },
    "license_source_id": "upstream-git",
    "files": [
      { "path": "skills/readme-i18n-sync/SKILL.md", "size": 5890, "sha256": "6de25877ad11f4da564261485849394018dda7637875e03b2911ec7eb28a5f0a" },
      { "path": "skills/readme-i18n-sync/references/glossary.md", "size": 2781, "sha256": "a7151b3130ee0ddaf7382b05e5809f07469879db8401545b5b181d664946130c" },
      { "path": "skills/update-readme/SKILL.md", "size": 3413, "sha256": "c2cea3d903e872ffb535c396764a47690cb8b112ce67fdcfe26fce4fac7fff95" }
    ]
  }],
  "hash_algorithm": "sha256",
  "totals": { "skills": 100, "skill_files": 266, "references": 139, "scripts": 25 },
  "external_dependencies": [{
    "path": "rules/example.md", "kind": "rule", "size": 0, "sha256": "...", "consumers": ["tech-spec"]
  }],
  "skills": [{
    "source_id": "upstream-git",
    "source_name": "tech-spec",
    "source_dir": "skills/tech-spec",
    "source_files": [{ "path": "skills/tech-spec/SKILL.md", "size": 0, "sha256": "..." }]
  }]
}
```

```json
{
  "schema_version": 1,
  "compatibility_alias_candidates": ["claude-health", "codex-architect", "codex-brainstorm", "codex-cli-review", "codex-code-review", "codex-explain", "codex-implement", "codex-review", "codex-review-branch", "codex-review-doc", "codex-review-fast", "codex-security", "codex-setup", "codex-test-gen", "codex-test-review", "deep-analyze", "install-hooks", "install-rules", "install-scripts", "precommit", "precommit-fast", "project-setup"],
  "alias_policy_decision": {"policy":"mapping-only","codex_version":"codex-cli 0.144.4","evidence":"migration/alias-capability.json","rationale":"version-bound registry capability result"},
  "canonical_targets": {
    "doctor": { "modes": ["claude"] },
    "review": { "modes": ["branch", "deep", "fast", "full"] },
    "setup": { "modes": ["guidance", "hooks", "scripts"] },
    "tech-spec": { "modes": ["deep"] },
    "verify": { "modes": ["fast", "precommit"] }
  },
  "skills": [{
    "source_name": "tech-spec",
    "disposition": "adapt",
    "target_package": "core",
    "delivery_state": "planned",
    "target_skill": "tech-spec",
    "target_mode": null,
    "alias_candidate": false,
    "alias_policy": "none",
    "capabilities": [],
    "operations": [],
    "wave": 1,
    "routing_owner": "tech-spec",
    "promotion_unit_id": "tech-spec/default",
    "promotion_request": null,
    "license_status": "approved",
    "rationale": "Codex-native lifecycle adapter"
  }]
}
```

Closed enums:

| Field | Values / rule |
|---|---|
| `disposition` | `keep`, `port`, `adapt`, `merge`, `optional`, `retire` |
| `target_package` | `core`, `planning-pack`, `research-pack`, `development-pack`, `quality-pack`, `delivery-pack`, `docs-ops-pack`, `domain-pack`, `retired` |
| `delivery_state` | `planned`, `candidate`, `pack-ready`, `promoted`, `retired`；initial `planned`，transitions require matching evidence kind |
| `alias_candidate` | Boolean；只有 root `compatibility_alias_candidates` exact list 為 `true`；其他 rows 為 `false` |
| `alias_policy` | `none`, `mapping-only`, `manual-only`；candidate 初始 `mapping-only`，non-candidate `none`；Foundation R4 capability test 可決定是否升級 |
| `capabilities[]` | Sorted unique values from `core`, `git`, `web`, `connector`, `local-cli`, `claude-mcp`；planning 可空，non-retire promotion 前不可空 |
| `operations[]` | Sorted unique values from `read`, `local-write`, `commit`, `push`, `pr-write`, `history-rewrite`, `connector-write`；planning 可空，promotion 前至少含 `read` 並完整揭露 mutations；V1 不支援 index mutation |
| `license_status` | `approved`, `blocked`, `unknown`；只有 `approved` 可 promotion |
| `routing_owner` | Exactly one canonical live skill；retired entries為 `null` |
| `promotion_unit_id` | `<target_skill>/<target_mode-or-default>`；同一 promoted artifact/mode 的 source aliases 共用；retired entry 使用 `retire/<source_name>` |
| `promotion_request` | Planning 時可為 `null`；promotion 或 retirement closure 前必須是存在且 single-task 的 request path；每個 promotion unit 恰有一個 gate owner |
| `canonical_targets.*.modes[]` | Bytewise sorted closed list；R1 seed 可先宣告 planned modes，`audit-source` 只驗 overlay references；promotion 時 candidate audit 才要求 canonical skill contract/routing tests 實作每個 mode |

Counting predicates 固定如下：`skill_files` 是 `skills/**` 全部 regular files；`references` 是其中 relative path 符合 `skills/<skill>/references/**` 的 files；`scripts` 是其中符合 `skills/<skill>/scripts/**` 的 files，後兩者是 266 的子集合。`external_dependencies.kind` 是 `rule | root-script | template | asset | other`；path、consumers 都以 POSIX bytewise sort，consumer 是 source skill name。相同 external path 只記一次，consumers 去重；其 missing/hash drift 會 fail，但不加入 skill totals。Compose 時 inventory 與 overlay 必須各自有 exactly 100 unique source names，集合完全相等；overlay precedence 只適用 disposition fields，絕不改 provenance/hash。

Package assignment 是 closed derivation，不由 implementer 自由選：以下 source rows 對應 10 個 curated core canonical targets（`bug-fix`, `create-request`, `doctor`, `feature-dev`, `remind`, `req-analyze`, `review`, `setup`, `tech-spec`, `verify`），因此 `target_package=core`：`bug-fix`, `claude-health`, `codex-cli-review`, `codex-code-review`, `codex-implement`, `codex-review`, `codex-review-branch`, `codex-review-fast`, `codex-setup`, `create-request`, `deep-analyze`, `feature-dev`, `install-hooks`, `install-rules`, `install-scripts`, `precommit`, `precommit-fast`, `project-setup`, `remind`, `req-analyze`, `tech-spec`, `verify`。`statusline-config` 是 `retired`。其餘 rows 依 wave 固定：Wave 1 → planning、2 → research、3 → development、4 → quality、5 → delivery、6 → docs-ops、7 → domain pack。Core allowlist 或 package assignment 要改，必須先開獨立 architecture/guidance request；本規格不 supersede AGENTS.md 或 `docs/MIGRATION.md` expansion rule。

Wave owner 由 `wave 0..7 → Foundation R1-R4 / future Wave 1..7 request batch` 決定，不使用模糊的「owner」欄位。每個 future request 必須列出自己承接的 source names 與 promotion units；audit 在 promotion 時拒絕任何 unit 的 zero/multiple designated gate ownership。Supporting implementation tickets 可以有多張，但只有 disposition overlay 指向的 single-task gate owner 可以執行 promotion；owner designation 不因 ticket 完成而消失。

### 3.5 Promotion Gates

每個 formal-promoted live skill 必須滿足：

| Gate | Required evidence |
|---|---|
| Provenance | Source path/hash、target、closed disposition、routing owner、promotion request and approved license recorded |
| Schema | Valid `name` / `description`；unsupported Claude frontmatter removed or mapped |
| References | Every referenced local resource exists；no orphan references；relative paths resolve from SKILL.md |
| Tool contract | No `mcp__codex__*`、Claude `Agent/Skill/AskUserQuestion` assumptions remain |
| Routing | Positive triggers、negative boundaries、canonical owner、alias behavior defined |
| Authorization | Read/write/external mutation classified；commit/push/PR writes require explicit user authority |
| State | Persistent evidence uses Git metadata or `.sd0x`，never tracked runtime artifacts |
| Tests | Routing/schema/reference tests + behavior tests proportional to risk |
| Review | Configured primary + independent Codex test perspective clean on exact fingerprint and provider |
| Verify | Deterministic repository checks pass on the reviewed fingerprint |

Adapted payload 先放在 repo-contained、non-distributable `migration/candidates/<canonical-skill>/`。`audit-candidate` 先 derive/validate `target_package`：core row 使用 virtual target `plugin/sd0x-dev-flow-codex/skills/<canonical-skill>/`；pack row 使用 virtual separate-plugin root並額外證明不會進 core manifest/discovery。Audit 同時載入 composed inventory/overlay、core plugin manifest、所有 live core frontmatter 與 candidate row，判 global routing、ownership與 package boundary。Candidate tree 本身永不直接 distributed。

R2 candidate contract 固定放在 payload root 的 `migration-contract.json`。Core 與非-research packs 的基本 contract 使用 schema v1：`{schema_version,target_skill,target_package,authorization:{policy,sensitive_operations[]},units:[{promotion_unit_id,target_mode,source_names[],routing:{positive_triggers[],negative_boundaries[]},behavior_tests[]}]}`。Research pack 使用 schema v2，unit 另有 repository-owned `semantic_requirements:{required[],forbidden[]}`。需要把額外 repository-owned trusted harness 綁進 transferable identity 的非-research payload 使用 schema v3；v3 保留 v1 fields，且每個 unit 必須另有非空、bytewise-sorted `supplemental_behavior_tests[]`。V1 consumer 必須拒絕 v2/v3 與所有額外 unit fields；v2 只接受 research pack；v3 只接受 non-research package 且拒絕缺少 supplemental evidence 的 unit；unknown version 或 cross-version fields 一律 fail closed。每層 fields 都是 closed set。Schema v3 audit 會遞迴驗證 supplemental entrypoint 可達的 local module graph、把每一份 trusted module bytes 納入 transaction，並拒絕 direct、computed、aliased、dynamic loader capability 與任何 candidate/pack path，即使 forbidden load 藏在 helper module 亦同。`units[]` 必須 bytewise sorted，且完整等於該 target 已進入 `candidate|pack-ready|promoted` 的 disposition units；因此 `review` 等 multi-mode owner 可用一份 stable contract 同時保留既有 modes，再以 `--mode <mode|default>` 選定本輪 unit，不必覆寫先前 evidence。每個 unit 的 `source_names` 完整等於 disposition rows，routing cases 非空。

Schema v1 的每個 unit 只能擁有 deterministic `test/<target>-<mode|default>-routing.test.js`；research schema v2 另且只能擁有 `test/<target>-<mode|default>-semantics.test.js`。Schema v3 的 `behavior_tests[]` 仍只能是 exact generated routing test，`supplemental_behavior_tests[]` 則只能指向 root `test/*.test.js`、必須以 exact `sd0x-migration-supplemental-test target=<target> unit=<unit>` marker 宣告 owner，且 path/raw SHA-256 必須 byte-for-byte 符合 `scripts/supplemental-behavior-tests.json` 的 repository-owned closed registry。Supplemental harness 由 repository `npm run check` 執行，raw bytes 與 unit 一起進 preflight/final identity；audit 靜態拒絕 direct、computed、dynamic candidate/pack code loading，candidate payload code 本身不能被 supplemental test 直接載入，trusted repository harness 只能先驗證 payload bytes 等於 repository-owned implementation 後再執行 trusted copy。Audit 分別以 `scripts/skill-routing-test.js` 與 `scripts/research-contract-test.js` 產生 expected bytes，要求 generated tests byte-for-byte 相同，並要求 `SKILL.md` 內每個 unit 的 machine-readable routing JSON、完整 multi-mode registry、Codex authoritative frontmatter description與 trusted semantic registry一致。Description 是最多 4,096 bytes 的 JSON-quoted YAML scalar，routing cases 是最多 256 characters 的 single-line strings，因此 `: `、` #`、quotes與 backslashes不會改變 frontmatter。Full-registry predicate要求每個 positive prompt只有一個 unit owner，且不得同時出現在任何 mode 的 negative set；逐 case test 對 exact positives 回傳唯一 owner、對 exact negatives回傳 excluded。反向、無關或 registry 外的 routing prose都會失敗。Harness 在 preflight 同時存在舊 live owner 時 deterministic 優先 candidate，final 才讀 core/pack path；每個 path component 都必須 real、non-symlink且 realpath-contained。因此 pasted markers、empty/no-op tests、filesystem API、network calls或任意 candidate-authored test code 都會被拒絕。Audit 本身不執行 untrusted candidate code；repository `npm run check` 只執行 exact trusted harness。Test bytes、unit、routing、semantic 與 supplemental hashes全部進 audit identity。

Audit 從 `SKILL.md` 建立 Markdown/resource 與 local `.js|.cjs|.mjs` import reachability graph，拒絕 missing/orphan/path/symlink escape、external package dependency、unsupported executable、dynamic/commented/computed/internal module或 code loading、frontmatter/Claude tool-event-runtime assumptions、malformed tables、未宣告 mutation與 V1 index mutation。Local imports 必須使用 exact audited extension，禁止 package metadata/directory/native resolution；每個 script 先按實際 CJS/ESM kind 做 non-executing syntax check，再對 comment-normalized source套用 Node 18/ES2022 baseline，因此新版 runtime 也不能認可 `using` 或 import attributes。Git/GH/subprocess、`node:fs`、`process/global` namespaces、network globals/built-ins 全採 closed classifier：child process 只准 direct named APIs與一整行 literal audited argv；filesystem namespace 與 closed allowlist 的 process members每次出現都必須是 direct classified member access，不能透過 optional/computed access、Reflect/property descriptor、argument、closure、container或 alias傳遞；code constructors、indirect eval、所有 network/native-loader use、未知 executable/subcommand一律 fail或要求 closed operation，shell candidate scripts不接受。Machine routing block會先從 Markdown operation scan移除；一般 prose只有正規化 blockquote/list/task/一至三層 emphasis 後仍符合 closed executable/path syntax才分類，無條件 pure prohibition不算 mutation，但含 `without|until|approval` 等條件者算 actionable。Shell redirect parser涵蓋 fd prefixes、no-space redirects、heredocs、shell test與 arithmetic/substitution boundaries；明確 command context 的未知 executable fail closed，普通 blockquotes、comparisons與 state arrows不算寫入。Sensitive operations 必須精確等於 machine authorization list；唯一 normative policy 是緊接 frontmatter 的 byte-exact sole-policy block，且 `SKILL.md` 與所有 reachable instructional references 的其他 permission/consent/sign-off/waiver prose一律拒絕。Preflight audit identity 綁 phase/path/target/unit/payload/all active disposition rows/test evidence；core-live與 pack-final 都由 move 後 bytes重算 exact expected preflight identity，random/cross-target/stale digest 都不接受。Pack-final transaction 在 disposition 尚為 `candidate` 的 move window，必須只接受 candidate 或 final pack 其中恰一個完整且另一個未 populated 的 physical payload；`pack-ready` 後只接受完整 pack 且 candidate 未 populated。`pack-ready|promoted` re-audit只把 delivery lifecycle 正規化回已審核的 candidate state，不忽略其他 row drift；final audit 開始與完成時 fingerprint 必須相同，且 review/verify gates 都仍為 current。R3 才把 accepted preflight/final identities寫進 durable evidence chain。

Supplemental graph 的每個 reachable module path/raw SHA-256 都必須排序後同時進入 live 與 commit-based preflight/final identity；helper-only drift 因此必須改變 audit fingerprint。Capability classifier 對 template literal/interpolation、CommonJS wrapper/global access、escaped identifiers、comment-separated calls、computed/reflection/constructor chains、multiline ESM、transitive helper loads、非 closed-safe Node built-ins 與非 exact-trusted Git subprocess argv 一律 fail closed。每個 supplemental entrypoint 必須有 exact `const test = require('node:test')` 與 `const assert = require('node:assert/strict')` bindings，以及至少一個 unconditional top-level direct `test(<literal>, <callback>)` registration；closed callback 必須含 direct、reachable、callback-top-level strict assertion，prefix module probe會拒絕 nested control flow、shadowed assert 與先行 `return`。Marker-only、empty/no-import、empty/non-asserting callback、unreachable、skip/todo/options-only harness 都拒絕，helper module 不得自行載入 `node:test`。`process` 採 closed member classifier，只接受 trusted harness 使用的 `cwd()`、`platform` 與 `env.PATH` 形狀；alias、`exit`、`abort`、`kill` 或其他 termination API 一律拒絕。Static/dynamic module namespace、destructuring、alias、property access、whitespace-separated loader calls、`run`、`mock.module` 或其他 programmatic launch API 也拒絕，direct 與 transitive module 同樣適用。唯一 probe subprocess 必須位於 hash-pinned trusted helper，由 platform-aware fixed-location resolver 選出 absolute、protected native Git executable，不繼承 `PATH`，使用 closed environment 並以 inline config停用 hooks、fsmonitor、submodule recursion 與 pager；supplemental test fixture 以純檔案建立最小 repository，不執行 `git init`/`git add`，因此 repository filters 不存在 setup execution surface。Windows、macOS、Linux 的候選位置是 closed contract，forged resolver、wrapper/PATH/repository-configured execution不得成立。

**2026-07-11 user-authorized bootstrap exception**：為先取得能建立後續單一任務 tickets 的入口，`create-request` 可在 R1–R4 前直接放入 core payload，但只能維持本段的受限狀態：必須使用 Codex-native、query-only resolver，所有 heuristic/batch completion 停在 `Candidate Complete`，沒有 R3 closure API 時不得直接寫 `Completed`，並照常通過 exact-fingerprint review/verify 與 repository-only reload。它不得寫 migration disposition/evidence、不得宣稱 Wave 1 promotion complete，也不得成為其他 skill 的直接-promotion precedent。R1–R4 完成後，`create-request` 仍須由唯一 Wave 1 gate-owner ticket補做 provenance、candidate/global audit、closure與 durable promotion record；未補齊前 inventory 只能標示 `live-bootstrap`。

Core promotion transaction 固定為：(1) candidate static/behavior preflight；(2) move 到 final core plugin path 並更新 overlay；(3) 不 reload、不 package、不宣稱完成；(4) 對 move 後 final fingerprint 重跑 global audit、behavior tests、configured primary + Codex test review、verify；(5) clean 後寫 promotion evidence。Step 2 後 fail 必須修復重跑或 rollback；preflight evidence 永遠不能充當 final gate。Authorization gate 以 closed `operations[]` 對照 §4.6。

Pack transaction 把 audited payload/spec移到 `migration/packs/<target-package>/`，對 final fingerprint 跑 review/verify，並在 transferable evidence ref append `kind=pack-ready` 後才把 overlay state 設為 `pack-ready`。Record 綁 final request closure、target package、disposition row、payload tree、pack spec/dependency tree、final fingerprint、review/verify blobs與 record hash；它不是 core promotion，也不產生 core routing entry。Later re-audit 重算 pack trees與 closure/disposition；unrelated wave 可保留，delete/modify/swap/supersede mismatch fail。真正 live pack 仍須在 separate plugin repository 重跑 manifest/dependency/release gates並取得發布授權。

Current-fingerprint gates 不是歷史 ledger。Canonical historical store 是 transferable Git ref `refs/sd0x-dev-flow-codex/evidence/v1`，不是 clone 後會消失的 plain `.git/*.json`。Promotion pass 後，`scripts/runtime/state.js` 在既有 state lock 下建立 append-only evidence commit，並以 compare-and-swap `update-ref` 前進；hook handler 不承載 transition logic，custom ref 不改 worktree fingerprint。Promotion record 固定為：

```json
{
  "kind": "promotion",
  "promotion_unit_id": "review/deep",
  "request_path": "docs/features/example/requests/2026-07-10-review-deep.md",
  "request_status": "Completed",
  "request_content_sha256": "...",
  "ac_definition_sha256": "...",
  "request_closure_record_sha256": "...",
  "disposition_row_sha256": "...",
  "payload_tree_sha256": "...",
  "final_fingerprint": "...",
  "head_sha": "...",
  "review_evidence_sha256": "...",
  "verify_evidence_sha256": "...",
  "recorded_at": "...",
  "supersedes_record_sha256": null,
  "record_sha256": "..."
}
```

`request_content_sha256` 是 final request raw bytes；`ac_definition_sha256` 是 ordered Acceptance Criteria text 的 canonical JSON hash，先 normalize LF、去除 checkbox marker/cosmetic whitespace，但保留 title、scope與每條語意文字。`request_closure_record_sha256` 必須指向同 evidence ref 上 matching `kind=request-closure` record，其 request path/content/AC hash、Completed status 與 closure subject仍有效；直接手改 Completed、missing/stale closure或不同 AC definition 都不能 promotion/retire。Writer 另要求 current final review/verify pass 與 matching payload/disposition hashes；`record_sha256` 是 canonical JSON excluding only that field 的 SHA-256。

Evidence commit tree 固定存 `records/<kind>/<record_sha256>.json`。Promotion 使用 `evidence/<record>/review.json`、`verify.json`；closure pending 使用 `subject-review.json`、`verify.json`、`ac.json`、`checks.json`；closure final 使用獨立 `docs-review.json`。Record 內各 SHA 對對應 raw canonical redacted blob bytes計算。Review blob 保留 Claude structured result與兩個 Codex terminal results；verify/check blob 保留 runner、argv、exit/duration與 bounded redacted stdout/stderr；AC blob 保留 ordered per-AC verdict/evidence。Evidence record schema v2 要求每個 Complete AC 至少一個 request 外部位置；schema v1 只為稽核與明確 supersession 相容，不能新增、fresh apply或 finalize，但既有 legacy apply journal仍可 recover。Versioned redactor 移除 secrets/account/absolute-path data，無法安全 redaction 就拒絕 ledger write。Evidence commit 以 prior ref commit 為 parent；re-audit 必須從 ref tree 讀 blobs、重算 hashes/chain，不能信任孤立 digest。合法內容變更要 fresh gates + linked revision；missing/tampered blob、stale/mismatch 都 fail。Retirement record 的 payload/verify 可為 `null`，但要有 reason、request/AC hashes、review blob與 approved disposition。

Fresh clone 必須顯式取得 evidence ref，例如 `git fetch <remote> refs/sd0x-dev-flow-codex/evidence/v1:refs/sd0x-dev-flow-codex/evidence/v1`；離線搬移可用 user-approved Git bundle。Publication 是 external mutation，必須 preview exact remote/ref/**approved immutable local commit OID**/expected old OID 並另行 approval。首次 create 使用 remote compare-and-swap `git push --force-with-lease=refs/sd0x-dev-flow-codex/evidence/v1: <remote> <approved-local-oid>:refs/sd0x-dev-flow-codex/evidence/v1`；empty expected OID 是 actual mutation guard，且 refspec 不讀可變 local ref。後續先驗 approved local OID descendant of fetched remote OID，再用 `--force-with-lease=<ref>:<exact-old-oid> <remote> <approved-local-oid>:<ref>` 做 single-ref CAS。Local ref 在 approval 後前進不會改 command source；若 policy要求發布 newest OID，必須重新 preview/approval。禁止 unleased force、auto-merge或 retry with new expectation。已知曾發布卻 missing、divergence、metadata loss或 unavailable import 都 fail closed。Local append 是 promotion workflow 內的 Git-metadata transition；fetch/import/push 不可從最初 migration request 推論授權。

Evidence writer 的 guards 依 record kind 分開，禁止把 promotion prerequisites 套到 pending：

| Record kind | Required guards | Explicitly forbidden / absent |
|---|---|---|
| `request-closure-pending` | Subject snapshot、proposed request/AC hash、AC/check/subject-review evidence、state lock | Request 可尚未 Completed；不要求 promotion payload/disposition/docs review |
| `request-closure` | Matching pending、exact Completed bytes/AC、unchanged non-request projection、current docs review | 不接受 missing/stale pending；不要求 promotion payload |
| `promotion` | Matching final closure、`target_package=core`、payload/disposition hashes、current final review/verify | Pack-ready/retire row、direct Completed edit、pending hash |
| `retirement` | Matching final closure、retire disposition/reason/license、current review | Payload and verify 必須 null；不可有 live target/routing owner |

每種 positive/negative transition 都要 fixture；unknown kind、跨 kind 欄位、缺 required evidence 一律 fail closed。

**R3 implementation record (2026-07-12)**：runtime state 現以 append-only single-parent evidence commits保存 closed per-kind records與 versioned canonical redacted blobs；每次 append與 replay先完整 re-audit舊 ref，再以 state lock + exact old OID CAS 前進。每個 evidence commit與 final tree的 paths 必須精確等於該 record kind 的 record + required blobs；writer/auditor拒絕修改/刪除歷史、extra/orphan/misplaced paths、stale redactor、blob/record hash drift、跨 kind/unit或未連續 supersedes chain。Dirty closure subject 綁 exact fingerprint + HEAD；clean commit subject先以 runtime `commit-review-begin` 清空舊 gate/ledger並開啟 `fingerprint=clean` 的 Codex-only collaboration round，SubagentStart context強制 exact base..head/tree，persistent dispatch與每個 terminal result必須帶 canonical subject hash，且 attestation把 primary + test 兩個 reviewer start bindings持久化進 review evidence；只有同 runtime epoch/provider、begin後兩個 subject-bound terminal reviewers與 deterministic verify可由 `commit-review-attest`交給 prepare，caller-authored hashes、reset/provider drift與舊三視角 evidence均無效，Claude provider在等價 range adapter落地前 fail closed。所有 represented aggregate/command exits必須一致為 zero且至少有一個具名 invocation；docs-only exemption由 pending record的 closed `verify_required=false`保存，且只接受 exact `{not_required:true}`。逐 AC 必須 `Complete/High` 且有 file:line evidence，且至少一個位置在 request 外；checkbox、Progress 或其他 request-local 行的任意組合都不能閉環自證。`test/r3-acceptance.test.js` 另將八條 AC 各自綁到 focused runtime symbol、具名 regression 與行為 signal，避免用 generic dispatcher或規格敘述代替可執行 traceability。Prepare與 finalize replay皆回傳相同 record/ref，並重驗 blobs、subject、request bytes、AC definition與 non-request projection；final docs-review envelope綁新 fingerprint且與 subject review獨立。Promotion/pack/retirement從目前 disposition與實際 payload tree重算 evidence，closure request必須等於 unit唯一 `promotion_request`，review/verify blobs各自綁 final fingerprint/provider；`audit-source` 對 delivered unit重新導出 owner path、disposition與payload hashes。Fresh clone explicit ref fetch與offline Git bundle fixtures現搬移完整 prepare→finalize→promotion unit並重驗 request/AC/payload/disposition/review/verify；另涵蓋合法 payload revision、tamper、metadata loss、divergence、retirement與 clean/dirty closure。Bundled `create-request` 明確編排 commit attestation（需要時）與 `closure prepare` → exact write → docs review → `closure finalize`。

R3 auditor 也以 commit-order `seen` map驗證 pending→closure→promotion與 supersedes predecessor，所有 transition timestamp必須在 predecessor之後；同 unit跨 promotion/pack-ready/retirement 的 completion timestamp亦須按 append順序單調前進，權威 completion直接取最後的 commit-order record，而非 caller timestamp排序。final tree存在未來紀錄不再能補正逆序歷史。AC `file:line[:column]` 必須是 canonical repo-relative regular-file位置，並在 bound dirty snapshot或 commit tree中實際存在且未超出行/欄範圍；pending blob對 dirty subject保存經 raw-redaction safety驗證的完整 file bytes並重算 file/line hashes，commit subject則綁 commit blob OID與完整 base/head/tree關係。Current/proposed request的 canonical Implementation Base SHA不可變、不得為 null且必須是 subject HEAD ancestor；commit subject另要求與 subject base相等。pending另保存 exact prior/proposed request bytes的 base64 blob，所有 decoded bytes在 writer與auditor層再次拒絕 unsafe redaction；只有 `closure apply`能在重驗 ref/path/projection/HEAD後透過 captured no-follow descriptor與 inode-bound journal寫入。既有或 write-boundary drift保持原樣；mutation後 failure保留 journal且不自動 rollback。Operator以 inspected current hash明確執行 `closure recover restore-prior|abandon`，recover在 journal removal前重驗 full bytes/path，exact success則冪等。apply/finalize/promotion、low-level append與 commit-order selected audit拒絕非最新 pending/closure revision，且 latest closure必須消費 latest pending；writer在 state lock內重驗。request、payload與 disposition所有 path segments拒絕 symlink；finalize、selected audit與 promotion request使用 captured no-follow descriptor重驗完整 ancestor/leaf identity，runtime與 `audit-source` payload hashing共用 initial/final directory entry manifest與 no-follow file descriptors，source audit在 ledger檢查後重新 hash。Evidence Git root discovery與所有 Git reads清除 ambient `GIT_DIR`/worktree/object/ref selectors；ledger history/tree固定到 captured OID並在回傳前重驗 ref。prepare、finalize與 promotion皆在 state lock的 append linearization point重新驗證 HEAD/tree/fingerprint並重算 request/projection/payload/disposition/evidence hashes，第二次 identity或 ref OID改變即拒絕，interposed worktree bytes不能沿用舊 gate。commit attestation marker帶 generation，collaboration marker也綁同 generation；double begin為 idempotent，舊回合不能覆寫或授權 successor round。

### 3.6 Canonical Names and Compatibility

| Source pattern | Target rule |
|---|---|
| `codex-*` where Codex was the external second opinion | Rename canonical skill to host-neutral behavior；Foundation R4 前只保留 mapping，R4 證明 manual-only alias 不參與 auto-routing 後才可建立 alias |
| Generic review variants | `review` owns completion-gate review and closed `fast`, `full`, `branch`, `deep` modes；each mode boundary is defined below |
| Specialized review intent | `doc-review`、`security-review`、`test-review` 是獨立 routing owners，但單獨結果不能滿足 core completion gate |
| `claude-*` runtime/config skills | Merge into `doctor`/`setup` or keep as compatibility diagnostics；never pretend Claude config is Codex config |
| Thin wrappers | Merge or generate tested aliases；do not duplicate canonical theory |
| Domain integrations | Port only with capability detection and graceful unavailable result |

Foundation R4 必須以實際 local plugin registry 做 alias capability test。唯一 pass criterion 是 Codex registry 提供可檢查的 exclusion flag/API，且 normalized registry dump 能證明 alias 可 manual invoke、卻不在 automatic routing candidates；prompt sampling 只能作負面回歸測試，永遠不能單獨把 policy 升級為 `manual-only`。Normalized/redacted dump 存在 `migration/evidence/alias-registry-dump.json`，保留必要 candidate/exclusion fields 並移除 user/account data；另以 fixture plugin manifest 重現。Decision 寫入 `migration/alias-capability.json`，固定包含 `{codex_version, registry_mechanism, alias, manual_invocation, auto_route_excluded, registry_dump_path, registry_dump_hash, fixture_manifest_path, plugin_fingerprint, owner_request_path, reproduce_argv[], tested_at}`；audit 重新 hash artifact/fixture 並驗 fingerprint，且要求 `owner_request_path` 指向至少一項 AC 且全數完成的 acceptance-ready ticket。該 ticket 必須只有一筆 `sd0x-alias-capability-owner:v1` JSON evidence record，綁定完整 decision artifact hash及其 Codex version、tested-at、decision、registry mechanism；缺失、重複或矛盾都 fail closed。若無法證明，`codex-*` 只留 disposition mapping，不建立 live skill directory；後續 waves 不得自行改此決策。

**R4 implementation record（2026-07-13；2026-07-14 以 Codex `0.144.4` 重驗）**：Codex `0.144.4` 的官方 contract 明確區分 `$`/`/skills` explicit invocation 與 description-based implicit invocation；repository-only fixture 不只同時出現在 explicit 與 neutral prompt 的 model-visible catalog，isolated ephemeral read-only `codex exec` 也實際回傳 fixture 的 exact marker。實際 `skills/list` metadata 只有 `description`、`enabled`、interface/name/path/scope/dependency fields，`skills/config/write` 只有 whole-skill `enabled` selector，沒有 automatic-candidate exclusion flag/API。因此 R4 fail closed 為 `mapping-only`：22 個 compatibility rows 保持 mapping、core 不建立 alias directories，`manual-only` 不可由 prompt sampling 升級，且只有 neutral catalog 實際排除 alias時才可通過；正向/逐欄負向 fixtures固定此 future contract。`migration/alias-capability.json` 綁 Codex version、probe 直接生成的 normalized/redacted dump hash、fixture manifest hash與 core plugin fingerprint；`audit-source`/`audit-candidate` 在本機 CLI 可用時會拒絕任一 policy 的 Codex version drift，且總是拒絕 missing/tampered fixture/dump、plugin drift或缺失/模糊的 `manual-only` proof。`CODEX_HOME="$PWD/.codex-dev-home" npm run migration:alias:probe` 以 ownership lock/no-follow real-directory checks 在 ignored repository home 暫載 fixture，將執行前後 bytes、directory manifest與 file/directory inode identity綁定，實際執行 marker、byte-compare committed dump後把整個 owned directory 原子搬入 exclusive nonce quarantine container再驗 identity，只刪本次 inode；任一 foreign/replacement/quarantine-collision path使 probe非零退出，能原位還原就還原，否則保留完整 quarantine，不改 user-level Codex home。

Review mode boundaries：`full` 是 current dirty-worktree completion gate；`branch` 以 merge-base 到 HEAD 加 dirty worktree 為 scope；`deep` 在 full scope 之外強制追 architecture/dependency/security blast radius，但沿用同一 blocking gate；`fast` 只做 bounded triage、不能記錄 completion pass。其他 planned modes 的 owner 是：`doctor:claude` 診斷 Claude CLI/MCP、`setup:guidance/hooks/scripts` 限定 setup component、`tech-spec:deep` 提高研究深度、`verify:fast/precommit` 選擇 deterministic check profile。`audit-source` 依 `canonical_targets` 驗 seed；candidate promotion 才要求 owner skill 的 contract與 positive/negative routing fixtures 落實 mode。未宣告 mode 一律拒絕。

Research semantic authority另由 `scripts/research-semantic-contracts.json` 綁定每個完整 `SKILL.md` SHA-256。Registry、package、trusted validators、pack tree與 behavior tests只經 no-follow、realpath-contained regular-file descriptor capture；fd identity/bytes在單一 transaction內固定，validation與hash共用同一份 immutable bytes，結尾再驗 current manifest、snapshots與 fingerprint，transient ABA swap無法混用不同版本。任何 block 外 waiver/negation、把 active block 移入 comment/code fence、或未列舉的同義縮限都因 full-byte drift fail closed，不依賴 NLP blacklist。Candidate Complete research-pack ticket 必須記錄實際 payload tree與 derived preflight 64-hex；source audit透過 private internal token重用完整 static `auditCandidate` path，再以 captured pack/test/contract/disposition bytes 重算，拒絕 placeholder、malformed、no-op behavior、stale或 cross-unit evidence。

## 4. Priority Skill Contracts

### 4.1 Lifecycle: req-analyze → tech-spec → create-request

| Skill | Codex-native behavior |
|---|---|
| `req-analyze` | Preserve quick/standard/deep tiers、problem-space boundary、5-Why、stakeholders、MoSCoW、measurable NFRs；standard/deep research uses Codex web + explicit parallel agents |
| `tech-spec` | Upsert `2-tech-spec.md` after real code research；preserve unchanged sections in update mode；Mermaid、risk mitigation、WBS、testing、open questions required |
| `create-request` | Preserve create/update/scan/update-all modes and AC ≤ 8 granularity；`--verify-ac` uses isolated read-only verifier and file:line evidence |
| `request-tracking` | Query-only projection over request metadata；no duplicated update logic |
| Shared resolver | Explicit path/feature → branch → changed paths → single feature dir；reject traversal/symlink escape；cross-link canonical docs lazily |

Resolver contract：

| Priority | Input | Accepted form / basis | Result on ambiguity |
|---:|---|---|---|
| 0 | Explicit docs path | Repo-relative `docs/features/<slug>/`、`docs/features/<slug>/1-requirements.md`、`docs/features/<slug>/2-tech-spec.md` or `docs/features/<slug>/requests/<ticket>.md`；only the feature directory may include one trailing slash | Invalid/escaping/symlinked path → fail |
| 0 | Explicit key | `--feature <slug>`；`/^[a-z0-9][a-z0-9._-]*$/i` | Missing feature dir returns a proposed path；resolver never creates it |
| 1 | Branch | Prefix is one of `feat/`, `feature/`, `fix/`, `docs/`；remaining first segment is `<slug>` and must match an existing feature dir | No exact match → continue cascade |
| 2 | Changed paths | `git diff --name-only HEAD --`；unique `docs/features/<slug>/` or canonical skill-to-feature manifest mapping | Multiple features → Need Human |
| 3 | Directory inventory | Exactly one non-archived directory under `docs/features/` | Zero/multiple → Need Human |

若 explicit docs path 與 explicit key 同時提供，兩者 canonical slug 必須相同，否則立即 fail。Canonical output 是 `{ key, source, confidence, docs_path, exists, canonical_docs, active_requests[] }` with repo-relative POSIX paths。對既有 path，resolver 在 read 前 realpath 並檢查 repository containment；對不存在 leaf，先 realpath 最近存在 parent，再只回傳 contained proposed path。Resolver 永不 mkdir/write；只有收到明確 local-create intent 的 caller 可依 mutation matrix 建立。Null resolution never guesses。

Cross-link topology：

| Artifact | Required links when target exists |
|---|---|
| `1-requirements.md` | `./2-tech-spec.md` + `./requests/` directory |
| `2-tech-spec.md` | `./1-requirements.md` + each active `./requests/<file>.md` |
| Request ticket | `../2-tech-spec.md` + optional `../1-requirements.md` + explicit sibling dependencies |

`create-request` public mode/state contract：

| Mode | Required behavior |
|---|---|
| `create` | Create one date-prefixed single-task request；≤8 AC、one concern layer、explicit related files/dependencies |
| `update` | Resolve exactly one request；update status/progress/AC only from evidence；ambiguity is Need Human |
| `scan` | Read-only；exclude archived and `Completed`/`Done`/`Superseded`；parse blockquote then legacy table metadata；group In Progress → Candidate Complete → Pending → Proposed，within group sort P0 → P1 → P2 → unknown then oldest first |
| `update-all` | Reuse scan；ignore docs-only commits；apply atomic per-file heuristic updates and report failures；never run `--verify-ac` or set `Completed` |
| `update --verify-ac` | Single request only；fresh isolated read-only verifier、60-second bound、structured per-AC status/confidence/file:line evidence |

Canonical state is `Pending → In Progress → Candidate Complete → Completed`；normalize `In Development`/`In Dev` to In Progress and `Done` to Completed。Heuristic/update-all can reach Candidate Complete only。New requests record `Implementation Base SHA` at create time；legacy ticket missing it must ask for an exact base and never guess。

`--verify-ac` supports two closure subjects：

| Subject | Completion evidence |
|---|---|
| Dirty implementation | Exact worktree fingerprint、all non-quality AC Complete/High、current core review pass，and same-fingerprint verify pass for code/config |
| Clean post-commit implementation | Clean tracked worktree、exact `base_sha..HEAD` + HEAD tree hash、all AC Complete/High、deterministic checks against HEAD、fresh commit-scope review provenance clean for the same base/head/tree |

Commit-scope review uses the same independent configured primary + native test perspectives over the exact Git diff, but records SHA-bound request evidence rather than fabricating a dirty-worktree gate。Closure is an explicit two-phase state transition owned by R3's deterministic runtime API：

1. `closure prepare` runs before editing the request。It snapshots the dirty fingerprint or clean base/head/tree、hashes the non-request worktree projection與 proposed Completed request bytes/AC definition，and appends `kind=request-closure-pending` with AC/check/verify/**subject-review** blobs to the evidence ref。
2. Runtime `closure apply` writes exactly the proposed request bytes。It rejects pre-existing/request-boundary drift unchanged；before its first mutation it durably records the pending hash、inode and prior/proposed hashes並使用 write-all loop。Mutation開始後任一 truncate/write/fsync/validation failure都保留 journal，不執行無法對 concurrent editor提供原子 CAS 的自動 rollback；exact full-file equality（含 EOF）才可清除 journal。An explicit operator may run `closure recover` with inspected `expected_current_sha256` and `restore-prior` to restore persisted prior bytes before replay，or `abandon` to remove recovery ownership without changing request bytes。Restore要求 journaled inode，先把 live file原子移到 `.sd0x/closure-recovery/` displaced backup，再用 no-overwrite link安裝 prior；abandon允許 atomic-save replacement inode。Apply/recover在 mutation與 journal removal前重驗 current bytes/path/ref/latest pending。Runtime never chooses automatically。Any non-request projection drift、different request/AC hash、subject change、non-latest pending revision or restart without a valid pending record blocks finalization。
3. The new dirty docs fingerprint runs the ordinary two-perspective docs review。`closure finalize --pending <record_sha256>` then appends `kind=request-closure` with `{pending_record_sha256, request_path, request_content_sha256, implementation_base_sha, ac_definition_sha256, subject_review_evidence_sha256, docs_review_evidence_sha256, docs_fingerprint, recorded_at, supersedes_record_sha256, record_sha256}`；both review hashes must resolve to distinct matching blobs in the ref chain。Current/proposed `implementation_base_sha` must be immutable、non-null and ancestral to subject HEAD；commit closure additionally requires equality with `subject.base_sha`。Legacy tickets missing the field fail closed until an exact base is supplied。Finalize and promotion accept only the unit's latest commit-order pending/closure revision。

Missing/tampered pending、changed projection/subject、failed subject checks、missing docs reviewer、stale final fingerprint or mismatched hashes fail closed。Existing closure reuse requires every field/blob to match；title/scope/AC edits require fresh prepare/finalize and linked revision。Promotion/retirement record must point to the final closure hash, never the pending hash。Commit closure's pending subject includes base/head/tree；dirty closure includes worktree fingerprint + HEAD。

Verifier snapshots the selected fingerprint or base/head/tree before dispatch and again before any request edit。Unavailable、cancelled、timeout、malformed output or missing file:line evidence marks affected ACs Inconclusive and caps status at Candidate Complete；subject drift discards the whole result and performs no request edit。Partial/Not Found keeps In Progress。After either valid closure path writes `Completed`, that request-doc edit creates a new dirty docs fingerprint and still needs the normal docs review gate before task completion；commit-scope evidence cannot satisfy that gate。Scan/update-all parser errors remain per-file report entries and cannot silently classify a request Completed。

`architecture` creates/updates `3-architecture.md` from an accepted tech spec；`architecture-advice` is answer-only consulting and never creates lifecycle artifacts。`review-spec` judges an existing spec；它不與前兩者競爭 creation routing。

Exploration routing precedence：

| Skill | Positive trigger | Must not own |
|---|---|---|
| `ask` | Bounded question answerable with a small context lookup | Full execution trace、multi-source research |
| `explain` | Explain already-identified code/file/logic at chosen depth | Discovery、correctness review |
| `code-explore` | Single-domain code trace or architecture discovery | Dual-model confirmation |
| `code-investigate` | Same code question explicitly needs independent Claude/Codex confirmation | General code review gate |
| `deep-explore` | Multi-domain repository exploration requiring parallel shards | Web/community research |
| `deep-research` | Mixed web/code/community evidence or broad ambiguous research | Bounded code lookup |

### 4.2 Brainstorm: Independent Research → Debate → Equilibrium

`codex-brainstorm` canonical target is `brainstorm`：

1. Native Codex forms Position A after independent repository research。
2. Claude MCP forms Position B without seeing Position A。
3. 最多 5 rounds 的 attack/rebuttal；每輪記錄 concession 與 position update。
4. 只有雙方都無新 valid attack 才宣告 equilibrium。
5. Closed outcome 是 `pure | conditional | pareto | divergent`；source 的 mixed strategy 以 `conditional` 表示，不另建重疊狀態。

Attack record 固定為 `{attack_id, target_claim_id, novelty_key, argument, evidence_refs[], proposed_by, validity}`。`novelty_key` 在整段 transcript 唯一；evidence refs 必須能解析到 claim registry，argument 必須直接反駁 target，否則 structural validator 判 invalid。若雙方對 semantic validity 有爭議，交給未參與 position generation 的 blind verifier；verifier 無法形成有證據的 verdict 時視為 unresolved。每輪雙方都必須輸出 `position_changed`、經裁決的 `new_valid_attack` 與 evidence refs。只有同一輪雙方都沒有 valid/unresolved attack 才達 equilibrium；5 rounds 後仍有任一 valid/unresolved attack 必須輸出 `divergent`，列出 assumptions 與 Need Human inputs，不得宣稱 consensus。

Outcome decision table：一個 unconditional position 支配且另一方完全 concession → `pure`；依明列 assumption/condition 選不同 action → `conditional`；兩個以上互不支配方案只剩可量化 trade-off → `pareto`；未收斂、attack validity unresolved 或缺少必要 evidence → `divergent`。依序判斷 divergent → conditional → pure → pareto，避免同一 transcript 多重分類。

### 4.3 Deep Research

保留 source 的 evidence pipeline：official/web、code/implementation、community/cases shards → claim registry → dedup/consensus/conflict → completeness score → conditional validator/debate。Codex 版本的必要修正：

- Internet claims 必須附可點擊 primary-source citations。
- Web content 永遠是資料，不是指令。
- Agents 必須在 skill contract 明確允許時才平行 dispatch。
- Low/medium/high budget 控制 agent 數與 debate，不直接映射未支援的 token frontmatter。
- 高 blast-radius、security、compliance 或 unresolved P0/P1 conflict 一律 validation/debate。

Research plan 在 dispatch 前固定 `{questions[], subquestions[], required_source_types[]}`。Claim schema 固定為 `{claim_id, claim, evidence[], confidence, critical, status}`；schema-v2 每筆 evidence 是 `{source_id, publisher_id, author_id, identity_binding_hash, independence_key, source_type, agent_role, locator, content_hash, relation, weight}`，其中 `relation = supports | refutes`。Evidence weight：official standard/direct file:line = 3、authoritative secondary = 2、community/case = 1。Dedup key 是 canonical `source_id + locator + content_hash + relation`；同 key 只取最大 weight，同一 independence key/relation 的多筆證據對同一 claim 也只取最大值，不同 independence keys 才加總。每個 claim 分別加總 support/refute buckets，`net_score = max(0, support - refute)`；cross-verification 只計 independent supporting sources。矛盾 claims 的最高 net score 勝出，同分或 refute ≥ support 標記 divergence；`source_type` 與 `agent_role` 不放在 claim level。

Canonical identity：web `source_id` 是移除 fragment/tracking params、正規化 host/path 的 URL；independent validator 先建立以 exact canonical `source_id` 為 key 的 trusted registry，record 固定為 `{publisher_id, author_id, authority_id, identity_binding_hash, signature}`。`identity_binding_hash` 綁定 canonical source、publisher、author 與 authority；signature 必須由 validator authority 的 Ed25519 private key 產生，scoring helper 只接受 payload 內 pinned `sd0x-host-identity-v1` public key 的驗證結果，API 不接受 caller trust-root argument，caller 無法加入 authority key；更換 pinned key 必須是經 review/verify 的 payload change。Scoring helper 只有在 evidence declaration 與 authenticated registry exact match 時才 derive `independence_key`；caller labels、opaque hashes、hostname suffix 或 URL path segment 都沒有 authority。Repository 是 `<canonical-repo-url>@<commit>:<path>#<locator>`，independence key 是 repo URL + commit，publisher/author/binding fields 為 null；community/case 以 authenticated registry-bound platform + actual author/issuing organization為 independence。Redirects resolve before identity。相同 publisher、repo commit、author 或 issuing organization的多個 artifacts不算 cross-independent；registry missing、untrusted authority、invalid signature、source relabel、binding mismatch或無法確定 identity時 fail closed，標記 unresolved而不增加 cross-verification。

Completeness formula 沿用來源：

| Mode | Diversity | Cross verification | Gap coverage | Question closure |
|---|---:|---:|---:|---:|
| Exploratory | 30% | 30% | 25% | 15% |
| Compliance | 20% | 35% | 25% | 20% |
| Decision | 25% | 35% | 20% | 20% |

各 dimension 是 0–100：Diversity = `100 × 有 evidence 的 required_source_types / 全部 required_source_types`；Cross verification = 至少有兩個 independent source 的 critical claims / 全部 critical claims；Gap coverage = 有 evidence 的預先列舉 research subquestions / 全部 subquestions；Question closure = 沒有 divergence/unresolved status 的 research questions / 全部 questions。分母為零時，只有 research plan 明記「不適用」才得 100，否則為 0。加權分數的 pass threshold：Exploratory 70、Compliance 90、Decision 80；未達門檻不得宣稱 complete，必須列 gaps 或升級 budget。

Budget caps：low = inline 1 shard / ≤3 fetched sources / no debate unless security；medium = ≤3 parallel researchers / ≤12 sources / conditional validator；high = ≤3 researchers + 1 validator / ≤24 sources / forced debate。Debate仍最多 5 rounds。Runtime 記錄 redacted dispatch trace `{dispatch_id, role, scope_hash, prompt_template_hash, input_artifact_hashes[], started_at, completed_at, evidence_count}`，不記 secrets 或完整 fetched body。所有 dispatch 的 `started_at` 與 input hashes 必須在任何 peer result `completed_at` 之前固定；trace validator 拒絕 input hashes 引用 peer result artifact，讓 no-cross-seeding 可觀測。

### 4.4 Seek Verdict

改成 source-aware blind verification：

| Finding origin | Independent verifier |
|---|---|
| Claude MCP primary finding | Fresh native Codex reviewer/subagent |
| Native Codex reviewer finding | Fresh Claude MCP verdict tool/mode |
| User-provided finding | 選擇未參與原 finding 的模型；不確定則雙方各自 blind verify |

保留 asymmetric dismissal thresholds、P0/P1 human gate、單次 objective rebuttal、anti-abuse counters；audit trail 綁定 `finding_key + worktree fingerprint`，不可只綁 HEAD。

| Severity | Confirm threshold | Dismiss threshold | Human gate |
|---|---|---|---|
| P2 | Verifier confidence ≥ 0.70 + 1 concrete evidence | Confidence ≥ 0.85 + 2 independent evidence | None |
| P1 | Confidence ≥ 0.65 + 1 evidence | Confidence ≥ 0.90 + 3 independent evidence | Explicit confirm on a later user turn |
| P0 | Confidence ≥ 0.60 + 1 evidence | Confidence ≥ 0.95 + 4 independent evidence | Explicit confirm on a later user turn |

Per-finding counter key 是 `finding_key + fingerprint + intent`，其中 intent 是 `confirm | dismiss | clarify`；同一 key/intent 最多一次 verifier attempt，同 fingerprint 的新 evidence 只追加 audit trail，不能重開同 intent。Session state 另有 `dismiss_streak`，只在相同 session/branch/fingerprint 中、跨 distinct finding keys 的 `DISMISS_VERIFIED` 連續成功時累加；任何 confirm、unresolved、session/branch/fingerprint change 都歸零。Streak ≥ 3 後只提高後續 **dismiss threshold**：confidence +0.05（cap 0.99）、independent evidence +1，直到 reset。

State transitions 固定如下：`ACTIVE --confirm threshold→ CONFIRMED`；`ACTIVE --P2 dismiss threshold→ DISMISS_VERIFIED`；`ACTIVE --P0/P1 dismiss threshold→ DISMISS_CANDIDATE`；`ACTIVE --insufficient/conflict→ UNRESOLVED`。P0/P1 candidate 攜帶 `finding_key + fingerprint + dismissal_evidence_hash`，只在**第一個後續 user turn**有效；該 turn 明確 confirm 同一 binding 才 `DISMISS_CANDIDATE → DISMISS_VERIFIED`，拒絕、ambiguous、不同 finding、fingerprint drift 或略過都 `→ ACTIVE`。`UNRESOLVED` 與 `ACTIVE` 都保持 gate fail；只有 new fingerprint 能重開已用過的 confirm/dismiss intent，human clarification 只能使用尚未消耗的 `clarify` intent。所有 counter 寫入 Git metadata/`.sd0x` runtime state，禁止 tracked audit file。

### 4.5 Smart Commit and Push CI

| Skill | Safety contract |
|---|---|
| `smart-commit` | V1 existing-index-only + plan-first；entire index becomes exactly one commit、≤15 staged files；never stages/unstages；exclude secrets；detect partial staging；execute requires a separate explicit authorization turn；only current reviewed+verified fingerprint may commit |
| `push-ci` | Manual-only trigger；preflight branch/remote/ahead SHA；show exact command；separate explicit user approval；never `--force`；`--force-with-lease` only when explicitly requested；successful push delegates read-only `watch-ci` |
| `watch-ci` | Read-only monitor；bind to pushed SHA；bounded timeout；report pass/fail/timeout without mutating external state |

來源的 `.claude_review_state.json.session_commit_scope` 不可照搬。V1 明確採 **existing-index-only, one-index-one-commit**；smart-commit 不執行 `git add`/unstage，也不拆 groups。Index 為空或 staged files >15 就 fail，要求使用者自行重新 staging 後再跑；`--all` 只產生 plan，不直接 execute。Touched-file ownership、multi-commit grouping 與 auto-staging 另開後續 request，沒有 state schema 前不得混入 V1。

Secret scan 先用 repository 明確宣告的 scanner command，否則使用 bundled、versioned、fixture-tested patterns 檢查 staged filenames 與 staged blob content；只輸出 finding type/path，不輸出 secret value。任一命中都 fail 整個 execute、不改 index、不可用 flag override；使用者自行 remediation 後必須以新 fingerprint 重新 plan/review/verify。

V1 `push-ci`/GitHub delivery 以 `gh` CLI 為 canonical implementation，先做 capability/auth status check但不啟動登入；connected GitHub app 可作 read-only metadata fallback，不作 write authority來源。

### 4.6 Mutation Authorization Matrix

| Operation | Initial user request sufficient? | Additional gate | Binding / expiry |
|---|---|---|---|
| Read、research、monitor | Yes | None | Bounded scope/timeout |
| Requested local file edit | Yes | Existing sandbox/policy | Current turn + declared files |
| Commit existing index | No | Show exact staged files and one message；separate approval turn；V1 不執行 `git add`/unstage | `fingerprint + index_tree + message_hash`；any edit/staging drift expires |
| Push | No | Show exact remote/branch/SHA/command；separate approval turn | `remote + branch + SHA + command`；failure or SHA drift expires |
| PR create/update/comment | No | Preview exact repo/PR/body/comments；separate approval turn | Target + payload hash；any payload change expires |
| Rebase、merge、force-with-lease | No | Per-operation plan、backup/recovery and separate approval | HEAD/base/target/command；no automatic retry |
| Connector/domain write | No | Exact account/resource/payload preview and separate approval | Connector target + payload hash；capability/auth failure blocks |

拒絕、timeout、ambiguous response 或工具不可用一律視為未授權；不得沿用先前 approval 到不同 target/payload，也不得把最初「幫我看看」推論成 external mutation authority。

## 5. Migration Waves

| Wave | Theme | Exit criterion |
|---:|---|---|
| 0 | Inventory、manifest、validators、adapter contracts | 100/100 source skills have machine-readable disposition；no live payload changes required |
| 1 | Lifecycle planning | req-analyze、tech-spec、create-request、request-tracking and shared resolver usable end-to-end |
| 2 | Research and decision | deep-research、brainstorm、seek-verdict、exploration skills preserve independent evidence semantics |
| 3 | Development and refactoring | feature/bug/debug/refactor/test completion skills compose existing review loop |
| 4 | Review、test、security、quality | Canonical modes replace duplicate Codex-centric wrappers；all remain fingerprint-bound |
| 5 | Git、commit、push、PR、CI | Mutations require explicit authority；read-only monitoring and deterministic preflight tested |
| 6 | Setup、docs、briefing、orchestration | Codex-native project lifecycle and documentation utilities complete |
| 7 | Optional/domain and compatibility | Capability-gated integrations or explicit retirement rationale；100/100 closure audit |

Waves execute in numeric order；priority denotes safety/business value, not permission to skip dependencies。Exact ownership lists source responsibility, **not core admission**。A wave exits only when its core units are promoted and its non-core units are pack-ready/retired under the derived package rule：

| Wave | Source skills owned by the wave |
|---:|---|
| 0 | No source skill promotion；migration manifest/audit infrastructure only |
| 1 | `architecture`, `create-request`, `deep-analyze`, `feasibility-study`, `necessity-audit`, `plan-review`, `req-analyze`, `request-tracking`, `review-spec`, `tech-spec` |
| 2 | `ask`, `code-explore`, `code-investigate`, `codex-architect`, `codex-brainstorm`, `codex-explain`, `deep-explore`, `deep-research`, `fp-brief`, `git-investigate`, `issue-analyze`, `seek-verdict` |
| 3 | `bug-fix`, `codex-implement`, `codex-test-gen`, `debug`, `feature-dev`, `post-dev-test`, `refactor`, `simplify`, `test-deep` |
| 4 | `best-practices`, `check-coverage`, `codex-cli-review`, `codex-code-review`, `codex-review`, `codex-review-branch`, `codex-review-doc`, `codex-review-fast`, `codex-security`, `codex-test-review`, `dep-audit`, `doc-review`, `pre-pr-audit`, `project-audit`, `risk-assess`, `security-review`, `test-health`, `test-review` |
| 5 | `bump-version`, `create-pr`, `epic-merge`, `git-profile`, `load-pr-review`, `merge-prep`, `pr-comment`, `pr-review`, `pr-summary`, `precommit`, `precommit-fast`, `push-ci`, `smart-commit`, `smart-rebase`, `verify`, `watch-ci` |
| 6 | `claude-health`, `codex-setup`, `de-ai-flavor`, `doc-refactor`, `generate-runner`, `install-hooks`, `install-rules`, `install-scripts`, `next-step`, `orchestrate`, `post-dev-recap`, `project-brief`, `project-setup`, `readme-i18n-sync`, `recap-ask`, `recap-doc`, `remind`, `repo-intake`, `runbook`, `safe-remove`, `sharingan`, `skill-health-check`, `tech-brief`, `update-docs`, `update-readme` |
| 7 | `contract-decode`, `dev-security-audit`, `feature-verify`, `jira`, `obsidian-cli`, `op-session`, `portfolio`, `statusline-config`, `ui-first-principles`, `zh-tw` |

Before a wave starts, `/create-request` generates single-task delivery tickets from this exact list。`create-request` 目前是 §3.5 的 user-authorized `live-bootstrap`，可先建立與維護 tickets，但沒有 R3 closure API 時最高只能寫 `Candidate Complete`；這不等於它自身已 promotion。每票只擁有一個 `promotion_unit_id`（名稱沿用於 core/pack/retire），有 ≤ 8 AC、one concern layer、≤ 3-day estimate；overlay's `promotion_request` 指向唯一 gate owner。Core ticket closes promotion；pack ticket closes pack-ready handoff；retire ticket closes approved evidence。Supporting tickets 不直接改 delivery state；wave umbrella tickets prohibited。

Wave 1 closure bootstrap 使用 Foundation R3 的 deterministic `runtime/cli.js closure prepare|finalize`：ticket pin base SHA；prepare pending；寫 proposed Completed bytes；跑 docs review；finalize；core promotion 引用 closure hash。受限 live-bootstrap skill 不得另造 closure state machine。R3 只負責 fixture-level bootstrap simulation與自舉自己的 ticket；**實際**第一個 `create-request` formal promotion E2E 由其未來 Wave 1 gate-owner ticket負責。

## 6. Full Source Skill Disposition (100/100)

Human-readable table mirrors the manifest's closed `disposition` enum。`Target` uses `target_skill[:target_mode]`; alias、capability、routing owner and rationale live in the manifest rather than free-text disposition cells。

| # | Source skill | Target | Disposition | Wave |
|---:|---|---|---|---:|
| 1 | `architecture` | `architecture` | Port | 1 |
| 2 | `ask` | `ask` | Port | 2 |
| 3 | `best-practices` | `best-practices` | Adapt | 4 |
| 4 | `bug-fix` | `bug-fix` | Keep | 3 |
| 5 | `bump-version` | `bump-version` | Port | 5 |
| 6 | `check-coverage` | `check-coverage` | Port | 4 |
| 7 | `claude-health` | `doctor:claude` | Merge | 6 |
| 8 | `code-explore` | `code-explore` | Port | 2 |
| 9 | `code-investigate` | `code-investigate` | Adapt | 2 |
| 10 | `codex-architect` | `architecture-advice` | Adapt | 2 |
| 11 | `codex-brainstorm` | `brainstorm` | Adapt | 2 |
| 12 | `codex-cli-review` | `review:deep` | Merge | 4 |
| 13 | `codex-code-review` | `review` | Merge | 4 |
| 14 | `codex-explain` | `explain` | Adapt | 2 |
| 15 | `codex-implement` | `feature-dev` | Merge | 3 |
| 16 | `codex-review` | `review:full` | Merge | 4 |
| 17 | `codex-review-branch` | `review:branch` | Merge | 4 |
| 18 | `codex-review-doc` | `doc-review` | Merge | 4 |
| 19 | `codex-review-fast` | `review:fast` | Merge | 4 |
| 20 | `codex-security` | `security-review` | Merge | 4 |
| 21 | `codex-setup` | `setup` | Merge | 6 |
| 22 | `codex-test-gen` | `test-gen` | Adapt | 3 |
| 23 | `codex-test-review` | `test-review` | Merge | 4 |
| 24 | `contract-decode` | `contract-decode` | Optional | 7 |
| 25 | `create-pr` | `create-pr` | Adapt | 5 |
| 26 | `create-request` | `create-request` | Adapt | 1 |
| 27 | `de-ai-flavor` | `de-ai-flavor` | Port | 6 |
| 28 | `debug` | `debug` | Adapt | 3 |
| 29 | `deep-analyze` | `tech-spec:deep` | Merge | 1 |
| 30 | `deep-explore` | `deep-explore` | Adapt | 2 |
| 31 | `deep-research` | `deep-research` | Adapt | 2 |
| 32 | `dep-audit` | `dep-audit` | Adapt | 4 |
| 33 | `dev-security-audit` | `dev-security-audit` | Optional | 7 |
| 34 | `doc-refactor` | `doc-refactor` | Port | 6 |
| 35 | `doc-review` | `doc-review` | Adapt | 4 |
| 36 | `epic-merge` | `epic-merge` | Adapt | 5 |
| 37 | `feasibility-study` | `feasibility-study` | Adapt | 1 |
| 38 | `feature-dev` | `feature-dev` | Keep | 3 |
| 39 | `feature-verify` | `feature-verify` | Optional | 7 |
| 40 | `fp-brief` | `fp-brief` | Port | 2 |
| 41 | `generate-runner` | `generate-runner` | Adapt | 6 |
| 42 | `git-investigate` | `git-investigate` | Port | 2 |
| 43 | `git-profile` | `git-profile` | Adapt | 5 |
| 44 | `install-hooks` | `setup:hooks` | Merge | 6 |
| 45 | `install-rules` | `setup:guidance` | Merge | 6 |
| 46 | `install-scripts` | `setup:scripts` | Merge | 6 |
| 47 | `issue-analyze` | `issue-analyze` | Adapt | 2 |
| 48 | `jira` | `jira` | Optional | 7 |
| 49 | `load-pr-review` | `load-pr-review` | Adapt | 5 |
| 50 | `merge-prep` | `merge-prep` | Adapt | 5 |
| 51 | `necessity-audit` | `necessity-audit` | Adapt | 1 |
| 52 | `next-step` | `next-step` | Adapt | 6 |
| 53 | `obsidian-cli` | `obsidian-cli` | Optional | 7 |
| 54 | `op-session` | `op-session` | Optional | 7 |
| 55 | `orchestrate` | `orchestrate` | Adapt | 6 |
| 56 | `plan-review` | `plan-review` | Adapt | 1 |
| 57 | `portfolio` | `portfolio` | Optional | 7 |
| 58 | `post-dev-recap` | `post-dev-recap` | Port | 6 |
| 59 | `post-dev-test` | `post-dev-test` | Adapt | 3 |
| 60 | `pr-comment` | `pr-comment` | Adapt | 5 |
| 61 | `pr-review` | `pr-review` | Adapt | 5 |
| 62 | `pr-summary` | `pr-summary` | Port | 5 |
| 63 | `pre-pr-audit` | `pre-pr-audit` | Adapt | 4 |
| 64 | `precommit` | `verify:precommit` | Merge | 5 |
| 65 | `precommit-fast` | `verify:fast` | Merge | 5 |
| 66 | `project-audit` | `project-audit` | Adapt | 4 |
| 67 | `project-brief` | `project-brief` | Port | 6 |
| 68 | `project-setup` | `setup` | Merge | 6 |
| 69 | `push-ci` | `push-ci` | Adapt | 5 |
| 70 | `readme-i18n-sync` | `readme-i18n-sync` | Adapt | 6 |
| 71 | `recap-ask` | `recap-ask` | Port | 6 |
| 72 | `recap-doc` | `recap-doc` | Adapt | 6 |
| 73 | `refactor` | `refactor` | Adapt | 3 |
| 74 | `remind` | `remind` | Keep | 6 |
| 75 | `repo-intake` | `repo-intake` | Adapt | 6 |
| 76 | `req-analyze` | `req-analyze` | Adapt | 1 |
| 77 | `request-tracking` | `request-tracking` | Port | 1 |
| 78 | `review-spec` | `review-spec` | Adapt | 1 |
| 79 | `risk-assess` | `risk-assess` | Adapt | 4 |
| 80 | `runbook` | `runbook` | Port | 6 |
| 81 | `safe-remove` | `safe-remove` | Adapt | 6 |
| 82 | `security-review` | `security-review` | Adapt | 4 |
| 83 | `seek-verdict` | `seek-verdict` | Adapt | 2 |
| 84 | `sharingan` | `sharingan` | Adapt | 6 |
| 85 | `simplify` | `simplify` | Adapt | 3 |
| 86 | `skill-health-check` | `skill-health-check` | Adapt | 6 |
| 87 | `smart-commit` | `smart-commit` | Adapt | 5 |
| 88 | `smart-rebase` | `smart-rebase` | Adapt | 5 |
| 89 | `statusline-config` | — | Retire | 7 |
| 90 | `tech-brief` | `tech-brief` | Port | 6 |
| 91 | `tech-spec` | `tech-spec` | Adapt | 1 |
| 92 | `test-deep` | `test-deep` | Adapt | 3 |
| 93 | `test-health` | `test-health` | Adapt | 4 |
| 94 | `test-review` | `test-review` | Adapt | 4 |
| 95 | `ui-first-principles` | `ui-first-principles` | Optional | 7 |
| 96 | `update-docs` | `update-docs` | Adapt | 6 |
| 97 | `update-readme` | `update-readme` | Adapt | 6 |
| 98 | `verify` | `verify` | Keep | 5 |
| 99 | `watch-ci` | `watch-ci` | Adapt | 5 |
| 100 | `zh-tw` | `zh-tw` | Optional | 7 |

## 7. Risks and Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Registry explosion causes routing collisions | Wrong skill auto-selected | Canonical owner + negative boundaries + compatibility aliases manual-only when supported |
| Blind copy preserves Claude payload assumptions | Runtime failure or unsafe writes | Tool/event adapter audit is a hard promotion gate |
| Source drift during long migration | Rework and inconsistent semantics | Pin source SHA per wave；machine-readable drift report |
| External model/research cost | Slow and expensive workflows | Budget tiers、conditional debate、bounded timeout、graceful fail-closed |
| Git/PR mutation without fresh approval | External state damage | Plan-first、separate approval turn、exact command preview、no implicit retries |
| Duplicate theory across 100 skills | Divergence | Canonical shared references；thin entrypoints only for routing |
| Cross-platform scripts | Windows/macOS/Linux inconsistency | Node 18 built-ins、no shell for complex argv、platform tests |
| Staging becomes accidental distribution | Unreviewed skills become live | Staging outside plugin payload + manifest validator |

Dependencies:

- Existing fingerprint-bound review/verify runtime remains the completion authority。
- Plugin manifest and Codex skill discovery behavior must be validated before alias strategy。
- Connector-backed skills (`jira`、GitHub、Obsidian、1Password) require capability discovery and must not silently authenticate。
- `smart-commit` session-aware scope depends on a Codex-native touched-file evidence design。

## 8. Work Breakdown

目前建立四張符合 `/create-request` granularity contract、可直接依序執行的 foundation tickets。Foundation 是 migration infrastructure，不擁有 source skill promotion unit：

| Request | Scope | Depends on |
|---|---|---|
| [R1 — Source snapshot and manifest](./requests/2026-07-10-skill-migration-foundation-r1.md) | Pinned shadow copy、license attribution、manifest、100/100 closed disposition | — |
| [R2 — Migration validation harness](./requests/2026-07-10-skill-migration-validators-r2.md) | Source/candidate audit modes、schema/reference/tool/routing checks、drift report | R1 |
| [R3 — Promotion evidence ledger](./requests/2026-07-10-promotion-evidence-ledger-r3.md) | Durable per-unit completion evidence in Git metadata | R2 |
| [R4 — Alias registry capability](./requests/2026-07-10-skill-alias-capability-r4.md) | Registry exclusion proof or permanent mapping-only fallback | R3 |
| [R4 refresh — Codex 0.144.4 alias capability](./requests/2026-07-14-alias-capability-codex-0-144-4-refresh.md) | Re-run version-bound registry evidence without rewriting the completed R4 transaction | R4 |

Wave 1 gate-owner tickets（每票恰好一個 promotion unit）：

| Promotion unit | Delivery | Request |
|---|---|---|
| `architecture/default` | planning-pack handoff | [Architecture pack-ready](./requests/2026-07-14-wave1-architecture-pack-ready.md) |
| `create-request/default` | core promotion | [Create-request promotion](./requests/2026-07-14-wave1-create-request-promotion.md) |
| `feasibility-study/default` | planning-pack handoff | [Feasibility-study pack-ready](./requests/2026-07-14-wave1-feasibility-study-pack-ready.md) |
| `necessity-audit/default` | planning-pack handoff | [Necessity-audit pack-ready](./requests/2026-07-14-wave1-necessity-audit-pack-ready.md) |
| `plan-review/default` | planning-pack handoff | [Plan-review pack-ready](./requests/2026-07-14-wave1-plan-review-pack-ready.md) |
| `req-analyze/default` | core promotion | [Req-analyze promotion](./requests/2026-07-14-wave1-req-analyze-promotion.md) |
| `request-tracking/default` | planning-pack handoff | [Request-tracking pack-ready](./requests/2026-07-14-wave1-request-tracking-pack-ready.md) |
| `review-spec/default` | planning-pack handoff | [Review-spec pack-ready](./requests/2026-07-14-wave1-review-spec-pack-ready.md) |
| `tech-spec/deep` | core promotion | [Tech-spec deep promotion](./requests/2026-07-14-wave1-tech-spec-deep-promotion.md) |
| `tech-spec/default` | core promotion | [Tech-spec promotion](./requests/2026-07-14-wave1-tech-spec-promotion.md) |

Wave 3 gate-owner tickets（每票恰好一個 promotion unit）：

| Promotion unit | Delivery | Request |
|---|---|---|
| `bug-fix/default` | core promotion | [Bug-fix promotion](./requests/2026-07-15-wave3-bug-fix-promotion.md) |
| `feature-dev/default` | core promotion（合併 `feature-dev` 與 `codex-implement`） | [Feature-dev promotion](./requests/2026-07-15-wave3-feature-dev-promotion.md) |
| `test-gen/default` | development-pack handoff | [Test-gen pack-ready](./requests/2026-07-15-wave3-test-gen-pack-ready.md) |
| `debug/default` | development-pack handoff | [Debug pack-ready](./requests/2026-07-15-wave3-debug-pack-ready.md) |
| `post-dev-test/default` | development-pack handoff | [Post-dev-test pack-ready](./requests/2026-07-15-wave3-post-dev-test-pack-ready.md) |
| `refactor/default` | development-pack handoff | [Refactor pack-ready](./requests/2026-07-15-wave3-refactor-pack-ready.md) |
| `simplify/default` | development-pack handoff | [Simplify pack-ready](./requests/2026-07-15-wave3-simplify-pack-ready.md) |
| `test-deep/default` | development-pack handoff | [Test-deep pack-ready](./requests/2026-07-15-wave3-test-deep-pack-ready.md) |

Foundation R1–R4 完成後，由受限 live-bootstrap `/create-request` 為 Wave 1 建立 child requests；後續 wave 採相同 just-in-time split。這些 tickets 在 R3 closure API 可用前仍不得由 skill 直接寫成 `Completed`。Request creation algorithm：

1. 先以 `(target_skill, target_mode-or-default)` 建立 `promotion_unit_id`；同 unit 的 source aliases 可合併，不同 units 不得同一 promotion ticket。
2. 若一個 unit 超過單一 concern/3 days，拆 supporting tickets，並保留一張 ≤ 3-day 的 final gate-owner ticket只做整合、promotion 與 acceptance closure。
3. 每票 ≤ 8 AC、≤ 3 days、明確 Related Files 與 `Depends On`。
4. 回寫 disposition overlay 的 `promotion_request`；audit 確保每個 promotion unit 恰有一張 designated gate-owner ticket，無論狀態是 Pending、In Progress、Candidate Complete 或 Completed；supporting tickets 不得冒充 owner。
5. Retire row 以 `retire/<source_name>` 建獨立 evidence ticket；Wave 所有 units 都完成或有 approved retirement evidence 後才進下一 wave。

Gate-owner lifecycle：promotion completion 要求 pointed ticket 為 `Completed`，並由 promotion ledger 綁定 final fingerprint/payload/evidence；Completed ticket 保留為 historical owner，後續 fingerprint 變更仍由 ledger re-audit。若 owner 變成 `Superseded`，同一變更必須原子更新 overlay 到 replacement request，並在兩票寫 `supersedes`/`superseded_by` cross-links；不存在 replacement、同時兩個 owners 或先 supersede 後再更新 overlay 都 fail closed。

## 9. Testing Strategy

### 9.1 Static Validators

- Skill schema and supported frontmatter。
- Local reference existence、no orphan resources、no path escape。
- No forbidden Claude-only tool/event tokens in promoted payloads。
- Canonical/alias graph is acyclic and has one routing owner。
- Source inventory independently proves primary 98/263/138/25 + pinned overlay 2/3/1/0 = composite 100/266/139/25。
- Markdown table rows preserve header cell counts；target modes are declared by their canonical owners。
- Promotion ledger schema/hash/revision integrity and historical evidence survive later unrelated fingerprints。

### 9.2 Behavioral Contract Tests

| Skill family | Required tests |
|---|---|
| Lifecycle docs | Create/update/scan/update-all、status normalization、scan ordering/parsing、ambiguous/path/cross-links/AC split、verifier failures/drift、dirty-fingerprint and clean base..HEAD closure、stale commit evidence、Candidate Complete vs Completed、final docs review gate |
| Research/debate | Independent prompts、no cross-seeding、claim dedup/conflict、budget caps、equilibrium/divergence termination |
| Seek verdict | Origin-aware opposite model、fresh context、P0/P1 human gate、anti-abuse、fingerprint invalidation |
| Git/commit | Dirty/staged/partial-staged、secret exclusion、identity/signing failures、no unauthorized commit |
| Push/CI | Protected branch、no remote/ahead commits、approval rejection、SHA-bound monitor、timeout、never `--force` |
| Review aliases | Same canonical theory、mode-specific scope、exact fingerprint evidence |
| Optional integrations | Capability absent、auth absent、read-only vs write confirmation |

### 9.3 End-to-End Gate

每個 request 完成時：

1. Repository-only install/reload matrix。
2. New Codex task rebuilds skill registry。
3. Representative positive/negative routing prompts。
4. Configured primary + native test reviewer clean。
5. `npm run check` and `$sd0x-dev-flow-codex:verify` pass on the same fingerprint。

## 10. Rollout and Reload

1. 每 wave 獨立 request/PR；core allowlist 可 promotion，其他 units 只到 pack-ready；不要一次建立 100 個 live entries。
2. 新增 skill、改 `SKILL.md` 或 manifest 後，依 repository guidance 執行 `dev:local:unlink` → `dev:local:link` → `dev:local:status`。
3. 關閉舊 Codex process，以 repository-only `CODEX_HOME` 啟動新 task。
4. `hooks.json` 變更需新 task 並重新 trust `/hooks`。
5. 每 wave 更新 `docs/PROJECT-MIGRATION-GUIDE.md` 的完成範圍、core/pack boundary 與 reload matrix；R2 audit 在 marker 缺失或 guidance 衝突時阻擋 Wave 1+ core promotion。

## 11. Acceptance Criteria

- [ ] Primary Git snapshot 98 skills + exact-hash local overlay 2 skills 可由 deterministic script 重建 composite 100 skills inventory。
- [ ] 100/100 skills 都有 closed disposition、target/mode、wave、routing owner、promotion unit、license status；promotion/retirement 前每個 unit 有唯一 designated gate-owner request，不存在 unresolved alternative。
- [ ] Wave 1 lifecycle skills 可產生互相正確連結的 requirements/spec/request artifacts。
- [ ] Wave 2 research skills保留 independent research、claim registry、Nash/divergence 與 source-aware verdict semantics。
- [ ] `smart-commit`、`push-ci`、PR writes 在沒有 fresh explicit approval 時不會執行。
- [ ] Promoted payload 沒有 Claude hook payload 或 `mcp__codex__*` runtime assumptions。
- [ ] Curated core live skills 與 non-core pack-ready payloads 各自通過 static + behavioral + routing/package-boundary tests。
- [ ] 每 wave 都有 exact-fingerprint review pass 與 deterministic verification evidence。

## 12. Decisions and Deferred Work

| Topic | V1 decision | Deferred path |
|---|---|---|
| Compatibility aliases | Codex `0.144.4` registry 無 manual-only exclusion mechanism；Foundation R4 已永久選定 `mapping-only`，不建立 live aliases，prompt sampling 不得升級 | Codex version/plugin registry 變更後另開 capability request並重生 version-bound evidence |
| Source copy | Tracked full `skills/` mirror under non-distributable `migration/staging/` | Refresh only through pinned drift request |
| Smart commit scope | One existing index → one commit、≤15 files、never stage/unstage；`--all` plan-only | Separate touched-file/multi-commit/auto-stage state request |
| GitHub delivery | `gh` CLI canonical with capability/auth check；no automatic login | Connector may provide read-only metadata fallback |
| Core vs packs | Keep exactly 10 canonical core workflows；all non-core destinations remain repository-only pack-ready handoffs until moved to separate plugin repositories | Core allowlist change requires architecture/guidance request |
| Research default | Medium for explicit broad research；low auto-downgrade for narrow intent；brainstorm auto-trigger only from defined validation conditions | Project budget override after usage data |
| `statusline-config` | Retire: Claude statusline schema has no proven Codex equivalent | New request only after official Codex statusline API exists |
