# 完整 v5 原生升級

> **Doc class**: Request ticket (date-prefixed non-lifecycle)
> **Created**: 2026-10-03
> **Implementation Base SHA**: `6782d7f0e3c38bc48b60b7002dd2343796ef0374`
> **Status**: Completed
> **Priority**: P0
> **Tech Spec**: [Technical specification](../2-tech-spec.md)
> **Requirements**: [Requirements](../1-requirements.md)

## Scope

完整來源 v5 適用功能與模式的原生實作及實際驗收。來源只讀；本轮不 commit/push/publish/deploy、不修改全域 home。保留先前未提交修改、歷史 owner/evidence 及七個 Anchors。

## Acceptance Criteria

- [x] 完整功能／模式／來源路徑 inventory 可重現，所有適用項均有 implementation 與當前驗收，排除項有具體原生等價評估。
- [x] 載入報表分開靜態大小、成功讀取、token accounting；正反案例涵蓋缺檔、拒絕讀取、錯版本及漏讀。
- [x] Git 設定、protected branches、offer、goal commit、stack 與 deploy 適用模式均有行為與邊界測試。
- [x] scope/stall/test/doc/override 契約保持可達；setup preservation 與 gate ordering 不退化。
- [x] 所有受影響 delivery units 依 canonical scripts closure/promotion，最後 configured primary review 與 deterministic verify 綁相同 fingerprint，完整 check 通過。
- [x] source、installed bytes、新 task registry 與 SessionStart activation 分層驗證完成。

## Progress

固定來源的 101 筆語義映射、57 個追蹤 ID、41 個 successor units 的 canonical closure/promotion 與完整回歸已記錄於 [驗收證據](../acceptance.md)。本票的狀態與 AC 勾選由 canonical closure transaction 管理；當前 gate 依 runtime fingerprint 判定。
