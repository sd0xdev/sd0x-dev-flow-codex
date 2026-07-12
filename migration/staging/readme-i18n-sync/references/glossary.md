# README i18n Glossary

Terms that must remain consistent across all locale READMEs. These are product vocabulary — do not freely translate.

## Keep as English (never translate)

These terms are code identifiers or established product names:

| Term | Reason |
|------|--------|
| `auto-loop` | Product feature name |
| `Claude Code` | Product name |
| `Codex MCP` | Product name |
| `AGENTS.md` | File name |
| `SKILL.md` | File name |
| `fail-closed` | Technical term used as-is in all locales |
| `stop guard` | Hook name used as-is |
| `precommit` | Script/skill name used as-is |
| `harness engineering` | Discipline name (industry term) |
| `harness layer` | Positioning phrase |
| `AI Agent Harness Engineering` | Full discipline name |
| `Pattern Map` | README section name |
| `reference implementation` | Positioning phrase |
| All `/slash-command` names | Skill invocation identifiers |
| All file paths | Code references |

## Locale-Dependent Category Names

These category terms are translated in table labels but kept as English in technical contexts (code blocks, file paths):

| English | zh-TW | zh-CN | ja | ko | es |
|---------|-------|-------|----|----|-----|
| Skills | Skills | Skills | スキル | Skills | Skills |
| Agents | Agents | 代理 | エージェント | Agents | Agents |
| Hooks | Hooks | 钩子 | フック | Hooks | Hooks |
| Rules | Rules | 规则 | ルール | Rules | Rules |
| Scripts | Scripts | 脚本 | スクリプト | Scripts | Scripts |

## Translate with Fixed Terms

These concepts should be translated but must use the same term consistently within each locale:

| English | zh-TW | zh-CN | ja | ko | es |
|---------|-------|-------|----|----|-----|
| dual review | 雙 review | 双审查 | デュアルレビュー | 듀얼 리뷰 | dual review |
| fail-closed | fail-closed | fail-closed | fail-closed | fail-closed | fail-closed |
| quality gate | 品質關卡 | 质量关卡 | 品質ゲート | 품질 게이트 | gate de calidad |
| stop guard | stop guard | stop guard | stop guard | stop guard | stop guard |
| context window | context window | context window | context window | context window | ventana de contexto |
| precommit | precommit | precommit | precommit | precommit | precommit |
| single-reviewer mode | 單 reviewer 模式 | 单 reviewer 模式 | シングルレビューモード | 싱글 리뷰어 모드 | modo single-reviewer |

## Style Notes

| Locale | Convention |
|--------|-----------|
| zh-TW | 台灣繁體中文、「程式」非「程序」、「資料」非「数据」 |
| zh-CN | 简体中文、大陆惯用词汇 |
| ja | です・ます体、カタカナ外来語は慣例に従う |
| ko | 존댓말、외래어는 관례에 따름 |
| es | Español neutral (no regional), tú form |
