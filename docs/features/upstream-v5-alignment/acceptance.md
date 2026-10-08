# v5 驗收證據

固定來源：`7805e98510943f45e57f9856966172401cff0c40`／v5.0.0，tag `c9f112af4af9e6bf362d7baa3502b3593f42c1c4`。來源後續變更未採入。

獨立判定由 `/root/v5_regression_primary` 對 fingerprint `956fc943bece238f601f3918fca568058057ed8e0d3966655bb27123bcd97477` 執行。41 個 successor units 的 82 條 AC 均為 Complete／High；可封存引用另由 `/root/v5_sealable_ac` 獨立核對。完整 `npm run check` 隨後通過。這些數字是交付單元與條件數，不是功能數。

101 筆來源技能的差異／原生等價判定與 57 個追蹤 ID 已逐項對應。各 ID 的範圍、來源與實作位置見 [功能追蹤表](coverage.md)。30 個來源樹未變、71 個有變更；此分類不同於是否需要本地 successor owner。完整對照與 file:line evidence families 存在 [語義 ledger](../../../migration/upstream-v5-semantic-assessment.json)。

41 個 successor owners 已由 canonical closure transaction 結案並記錄 promotion，歷史 owners/evidence 保留。ledger 的 acceptance_checkpoint 記錄每項 closure/promotion SHA。每次本文與索引變更都必須重新完成 configured-primary review 及 deterministic verification；是否可宣稱整體完成，以目前 runtime fingerprint 與主 feature canonical closure 為準，不能從本文舊 fingerprint 推算。

| ID | 驗收結果 | 範圍與限制 |
|---|---|---|
| A01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| B01 | 101 筆語義映射及完整回歸已驗收 | 完整 npm run check 已執行通過；來源差異、共用契約與既有模式映射分層驗收。 |
| C01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| C02 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| C03 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| C04 | 原生行為與邊界已驗收 | issue UNAVAILABLE 的實際原因是 native dispatch 缺 task_name，不能當成已證實 profile 不存在；delegated 前後觀察不證明中途絕無暫態 mutation。 |
| D01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| D02 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| D03 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| D04 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G02 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G03 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G04 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G05 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G06 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G07 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G08 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G09 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G10 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G11 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G12 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G13 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| G14 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| I01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| M01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| O01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| O02 | 來源載體不適用；原生替代已核對 | 原生單次 process memory baseline 不建立來源 disk FIFO；沒有需清理的持久化 queue。 |
| Q01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| Q02 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| R01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| R02 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| R03 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| S01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| S02 | 原生行為與邊界已驗收 | 原生固定 argv/API 替代來源 extension 執行；外部安裝未執行。 |
| S03 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| S04 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| S05 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| S06 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| SEC01 | 原生行為與邊界已驗收 | 本次確認已交付的 OWASP 2025 reference、分類與邊界；沒有外部系統滲透或寫入。 |
| SVD01 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V01 | 原生行為與邊界已驗收 | 七個 Anchors、ordering、invalidations、protected state 已回歸；當前 gates 由 runtime 另行核對。 |
| V02 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V03 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V04 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V05 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V06 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V07 | 來源載體不適用；原生替代已核對 | fallback/rotation 不取得 configured-primary gate authority；native recovery 仍保留。 |
| V08 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V09 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V10 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V11 | 觸發條件未成立；不新增無證據功能 | 未重現須新增提示的漏讀；不憑空增加常駐提示或宣稱已測不存在的分支。 |
| V12 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V13 | 原生行為與邊界已驗收 | 已撤回的來源 release canary 不列必要條件；原生代表性 consumer 有實際紀錄。 |
| V14 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V15 | 原生行為與邊界已驗收 | 共用行為族、入口協定與必要 consumer 觀察；未宣稱每一模式各跑一次模型實驗。 |
| V16 | 來源載體不適用；原生替代已核對 | 靜態 chars/bytes/lines、成功 reader content SHA/version、整體 CLI tokens 分開；逐載體 tokens unknown。 |

完整回歸：1483 tests，1480 pass，0 fail，3 skip。跳過的是需 native Windows 的案例；本機結果不代表其執行成功。

## 證據分層

- 靜態 chars／UTF-8 bytes／lines、實際 reader version／content SHA、整體 CLI token usage 分開記錄；逐載體 token accounting 仍 unknown。
- 自然語言 testing contract、文件 authority／Corpus scan／intent create-only／history preservation、issue 成功與 UNAVAILABLE、fresh debug、review branch dual、reference conversion 及 delegated Git identity 均有原生執行觀察。
- source、installed 86 SKILL bytes、registry、SessionStart、parent/primary model/effort 各自核對；existing runtime JS 與 payload hashes 透過 live symlinks 更新。
- Git／Stack／deploy 使用隔離 fixtures 驗證；沒有授權或執行主專案 commit、push、外部發布、部署、全域 home 修改。
- 原始執行輸出與獨立 reviewer transcript 保留於本專案 `.sd0x/v5-native-delivery/` 及 `.codex-dev-home/sessions/`；不以摘要、自述或舊 task_pass grade 代替執行證據。
