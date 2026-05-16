# @webnoth/wesnoth-data

Wesnoth のゲームデータ（ユニット、種族、移動タイプ）を TypeScript オブジェクトとして提供する共有パッケージ。

## 概要

[Battle for Wesnoth](https://wesnoth.org/) の WML (Wesnoth Markup Language) ファイルから抽出した構造化データ。以下のプロジェクトで利用予定：

- **ユニット図鑑** — 全ユニットのパラメータ・画像・アニメーション表示
- **バトルシミュレーター** — 戦闘パラメータを用いた模擬戦闘
- **Web版 Wesnoth** — フル実装のブラウザ版ゲーム

## 使い方

```typescript
// 全データの型定義
import type { WesnothUnitType, WesnothRace, WesnothMovetype } from '@webnoth/wesnoth-data';

// 個別データのインポート（tree-shaking対応）
import { unitTypes } from '@webnoth/wesnoth-data/units';
import { races } from '@webnoth/wesnoth-data/races';
import { movetypes } from '@webnoth/wesnoth-data/movetypes';
import { provenance } from '@webnoth/wesnoth-data/provenance';
```

## データ内容

| データ | 件数 | 説明 |
|--------|------|------|
| `unitTypes` | 328 | ユニットタイプ（攻撃・アビリティ・アニメーション含む） |
| `races` | 24 | 種族定義 |
| `movetypes` | 38 | 移動タイプ（地形コスト・防御・耐性） |
| `provenance` | 1 | 抽出元情報（Git revision, ファイル一覧等） |

## 画像アセット

`assets/` ディレクトリに全ユニット関連画像を格納：

| ディレクトリ | 内容 | サイズ |
|-------------|------|--------|
| `assets/units/` | ユニットスプライト・アニメーションフレーム | ~8.5 MB |
| `assets/portraits/` | ポートレート画像 | ~32 MB |
| `assets/attacks/` | 攻撃アイコン | ~937 KB |
| `assets/projectiles/` | 飛び道具アニメーション | ~842 KB |

> **Note:** 画像アセットは合計 42MB+ あります。将来的に Git LFS への移行、またはパッケージからの分離を検討中です。

## データの更新

Wesnoth リポジトリのデータを再抽出するには：

```bash
# scripts/wesnoth/ から実行
cd scripts/wesnoth

# ユニットデータの抽出
npx tsx src/extract-units.ts --wesnoth-root ~/repos/wesnoth

# 画像アセットの抽出
npx tsx src/extract-images.ts --wesnoth-root ~/repos/wesnoth
```

## 将来の拡張（次フェーズ）

### Era / Faction データ
`data/multiplayer/eras.cfg` および `data/multiplayer/factions/` からマルチプレイヤーの Era・Faction 情報を抽出予定。Faction は `leader` と `recruit` フィールドでユニットID (`WesnothUnitType.id`) を参照するため、本パッケージのユニットデータと自然に統合可能。

### Terrain データ
`data/core/terrain.cfg` からの地形定義抽出。Movetype のキー（`shallow_water`, `forest` 等）と対応。

### マクロ展開の拡充
現在、引数なし定数マクロのみ展開。将来的に以下を検討：
- `{TRAIT_STRONG}`, `{TRAIT_QUICK}` 等のトレイトマクロ展開
- `{ABILITY_HEALS}` 等のアビリティマクロ展開
- `{DEFENSE_ANIM ...}` 等のアニメーションマクロ展開

### `specials_list` vs `[specials]` ブロック
現在は `specials_list` の簡略記法（カンマ区切り文字列）のみパース。`[specials]` ブロック形式は全327ユニットファイル中わずか2ファイル（Ant Queen系）でのみ使用されており、マクロ名として記録。

### 画像アセットの最適化
- Git LFS 導入
- WebP 変換・圧縮
- スプライトシート生成
