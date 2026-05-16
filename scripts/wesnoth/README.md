# Wesnoth Data Extraction Scripts

Wesnoth の WML ファイルから TypeScript オブジェクトを生成するスクリプト群。

## 前提条件

- Node.js 24+
- [Wesnoth リポジトリ](https://github.com/wesnoth/wesnoth) のローカルクローン

## スクリプト一覧

### `extract-units.ts` — ユニットデータ抽出

WML ファイルをパースし、以下のデータを `packages/wesnoth-data/src/generated/` に出力：

- `units.ts` — 全ユニットタイプ（攻撃、アビリティ、アニメーション含む）
- `races.ts` — 全種族定義
- `movetypes.ts` — 全移動タイプ（地形コスト、防御、耐性）
- `provenance.ts` — 抽出元情報（Git revision、ファイル一覧）

```bash
npx tsx src/extract-units.ts --wesnoth-root ~/repos/wesnoth
```

### `extract-images.ts` — 画像アセット抽出

Wesnoth リポジトリから画像アセットを `packages/wesnoth-data/assets/` にコピー：

```bash
npx tsx src/extract-images.ts --wesnoth-root ~/repos/wesnoth
```

### 全て一括実行

```bash
npm run extract:all -- --wesnoth-root ~/repos/wesnoth
```

## WML パーサーについて

`src/wml-parser.ts` は WML の以下の構文をサポート：

| 構文 | サポート | 備考 |
|------|---------|------|
| `[tag]` / `[/tag]` ネスト | ✅ | |
| `key=value` ペア | ✅ | 翻訳マーカー `_ "..."` の除去含む |
| `{MACRO}` 引数なし定数マクロ | ✅ | マクロ辞書で展開 |
| `{MACRO args...}` パラメータ付きマクロ | ⚠️ | マクロ名として記録（未展開） |
| `[+tag]` マージ構文 | ✅ | |
| 文字列連結 (`+`) | ✅ | |
| 複数行文字列 | ✅ | |
| `#define` / `#enddef` | ✅ | スキップ（macro-loader で別途処理） |
| `#ifdef` / `#else` / `#endif` | ❌ | 未対応 |
| WML 式 `$(...)` | ❌ | 未対応 |

### マクロ展開方針

`src/macro-loader.ts` が `data/core/macros/` から引数なし・1行定義の定数マクロを辞書として読み込み、パース時にインライン展開します。

**展開されるマクロの例：**
- `{SOUND_LIST:HUMAN_DIE}` → `"human-die-[1~3].ogg"`
- `{SOUND_LIST:SWORD_SWISH}` → `"sword-1.ogg"`

**展開されないマクロの例（名前のみ記録）：**
- `{AMLA_DEFAULT}` — 複数行のアドバンスメント定義
- `{DEFENSE_ANIM "img1.png" "img2.png" sound.ogg}` — パラメータ付きアニメーション
- `{TRAIT_STRONG}` — トレイト定義（複数行）
