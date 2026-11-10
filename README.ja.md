# create-fsd-architecture

完全な[Feature-Sliced Design](https://feature-sliced.design/)構造を持つフロントエンドのスタータープロジェクトを作成します。

[![npm version](https://img.shields.io/npm/v/create-fsd-architecture?style=flat-square&logo=npm&label=release)](https://www.npmjs.com/package/create-fsd-architecture)
[![Weekly downloads](https://img.shields.io/npm/dw/create-fsd-architecture?style=flat-square&logo=npm&label=downloads%2Fweek)](https://www.npmjs.com/package/create-fsd-architecture)
[![Total downloads](https://img.shields.io/npm/dt/create-fsd-architecture?style=flat-square&logo=npm&label=total%20downloads)](https://www.npmjs.com/package/create-fsd-architecture)
[![Node.js version](https://img.shields.io/node/v/create-fsd-architecture?style=flat-square&logo=nodedotjs&label=node)](https://www.npmjs.com/package/create-fsd-architecture)

[![Contributors](https://img.shields.io/github/contributors/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/graphs/contributors)
[![Forks](https://img.shields.io/github/forks/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/forks)
[![Stars](https://img.shields.io/github/stars/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/stargazers)
[![Open issues](https://img.shields.io/github/issues/FSD-CLI/cli?style=flat-square&logo=github&label=issues%20open)](https://github.com/FSD-CLI/cli/issues?q=is%3Aissue%20is%3Aopen)
[![Closed issues](https://img.shields.io/github/issues-closed/FSD-CLI/cli?style=flat-square&logo=github&label=issues%20closed)](https://github.com/FSD-CLI/cli/issues?q=is%3Aissue%20is%3Aclosed)
[![License](https://img.shields.io/github/license/FSD-CLI/cli?style=flat-square&label=license)](https://github.com/FSD-CLI/cli/blob/main/LICENSE)

[![CI workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/ci.yml?branch=main&style=flat-square&logo=githubactions&label=CI)](https://github.com/FSD-CLI/cli/actions/workflows/ci.yml)
[![Dependency security workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/dependency-security.yml?branch=main&style=flat-square&logo=githubactions&label=dependency%20security)](https://github.com/FSD-CLI/cli/actions/workflows/dependency-security.yml)
[![Release workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/github-release.yml?style=flat-square&logo=githubactions&label=release%20workflow)](https://github.com/FSD-CLI/cli/actions/workflows/github-release.yml)

- ドキュメント： https://fsdcli.me
- GitHub： https://github.com/FSD-CLI/cli
- 英語版： [README.md](./README.md)

## 検証の範囲

生成されたプロジェクトは出発点です。CLIやテンプレートのチェックに合格したからといって、アプリケーション固有のセキュリティ、認証、ランタイムの動作、本番デプロイが保証されるわけではありません。根拠と未テストの組み合わせについては、[現在のリリース状況](docs/RELEASE-STATUS.md)を確認してください。

## リポジトリのドキュメント

Angularのスタンドアロンスターターは、CLIソース（`check`、`doctor`、`config`）に検査可能な設定コントラクトを持っています。Angularのプロジェクト作成、スライス生成、管理対象アップグレードは利用できません。以下の5つの安定したテンプレートが、サポートされているスキャフォールディング用フレームワークです。

- [Changelog](./docs/CHANGELOG.md)
- [安全なアップグレードのアーキテクチャ](./docs/UPGRADE-ARCHITECTURE.md)
- [公開ドキュメントのアウトライン](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [セキュリティポリシー](./SECURITY.md)

## クイックスタート

```bash
npx create-fsd-architecture@latest my-app
```

または、一度インストールして短い`fsd`コマンドを使います（同じCLIです）：

```bash
npm install -g create-fsd-architecture
fsd create my-app
fsd generate entity product   # または: fsd g entity product
fsd check
```

## 🤖 AI Agent Skill（ベータ）

Codex、Claude Code、Cursor、その他Agent Skills対応のコーディングエージェントに、自然言語のスキャフォールディング要求を検証済みのFSD CLIコマンドに変換する方法を教えます：

```bash
npx skills add FSD-CLI/create-fsd-architecture --skill fsd-cli
```

このスキルは現在`v1.0.0-beta.1`として提供されています。コマンドとインストールフローは検証済みですが、ツールや既存のプロジェクト構造によってエージェントの動作は変わる場合があります。生成された変更はコミットする前に確認してください。

このスキルはプロジェクトを検査し、同等のフォルダを手動で再作成する代わりに、サポートされている構造的な作業にCLIを使います。たとえば：

- 「カート機能を作成して」
- 「productエンティティを追加して」
- 「チェックアウトページを作成して」
- 「Feature-Sliced Designの新しいNext.jsプロジェクトを作成して」

このスキルは意図的に実行に焦点を当てています。方法論については公式の[Feature-Sliced Designドキュメント](https://feature-sliced.design/)を使ってください。このツールの実際のコマンド、フレームワークの動作、安全ルール、既知の制限については、別の[`create-fsd-architecture` Agent Skillリポジトリ](https://github.com/FSD-CLI/create-fsd-architecture)を使ってください。

インタラクティブフローでは、フレームワーク、APIクライアント、サーバー状態、クライアント状態、フォームスタック、パッケージマネージャー、依存関係のインストール、任意の開発サーバー起動を選択します。

CI、デモ、再現可能なローカル自動化の場合：

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## コマンド

```bash
# すべてのオプションを表示
npx create-fsd-architecture@latest --help

# インストールされているCLIのバージョンを表示
npx create-fsd-architecture@latest --version

# 安定版と計画中のテンプレートを確認
npx create-fsd-architecture@latest --list-templates

# 既存のプロジェクト内で生成
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# すぐに使えるレイアウトウィジェットと共有プリミティブ（2.7.0）
npx create-fsd-architecture@latest -g widget navbar sidebar footer bottom-bar
npx create-fsd-architecture@latest -g shared ui button input label card
npx create-fsd-architecture@latest -g shared api
npx create-fsd-architecture@latest -g page home about consult

# ファイルを書き込まずに作成や生成をプレビュー
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# 既存のFSDプロジェクトを検査
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# 既存のプロジェクト内のCLI所有ツールを安全に検査または移行
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

作成オプション：

| オプション | 目的 |
| --- | --- |
| `-f, --framework <id>` | フレームワークのプロンプトをスキップ |
| `-y, --yes` | プロンプトなしでフレームワークのデフォルトを受け入れる。プロジェクト名と`--framework`が必要 |
| `--package-manager <id>` | npm、pnpm、Yarn、Bunのいずれかを非対話的に選択 |
| `--package-name <name>` | npmパッケージ名をフォルダ名とは別に設定。npmに公開可能な名前であること |
| `--api-client <id>` | AxiosまたはネイティブFetchを選択 |
| `--server-state <id>` | フレームワークのサーバー状態の選択を上書き |
| `--client-state <id>` | フレームワークのクライアント状態の選択を上書き |
| `--forms <id>` | フレームワークのフォームの選択を上書き |
| `--no-install` | 依存関係をインストールしない |
| `--no-start` | 開発サーバーを起動しない |
| `--dry-run` | ファイルを変更せずに完全なプランを表示 |
| `--force` | 既存のターゲットを置き換える。クローン、セットアップ、インストールが失敗した場合は復元する |

## 安全なアップグレード

`upgrade`は、CLIが所有していることを証明できるツールだけを進化させます。プロジェクトを再スキャフォールドすることは決してなく、feature、entity、widget、page、コンポーネント、スタイル、ルート実装、環境ファイル、シークレット、カスタムスクリプト、無関係な依存関係を書き換えることもありません。

```bash
# 完全なプランを検査します。常に読み取り専用です。
npx create-fsd-architecture@latest upgrade --dry-run

# CI用のステータスチェック。常に非対話的で読み取り専用です。
npx create-fsd-architecture@latest upgrade --check

# 競合のないプランだけをプロンプトなしで適用します。
npx create-fsd-architecture@latest upgrade --yes

# 依存関係をインストールせずにソースと設定の変更を適用します。
npx create-fsd-architecture@latest upgrade --yes --no-install

# Gitワークツリーがdirtyであるリスクを明示的に受け入れて適用します。
npx create-fsd-architecture@latest upgrade --allow-dirty
```

このコマンドは、ネストしたディレクトリから最も近い信頼できるプロジェクトルートを見つけ、選択されたルート、移行パス、すべてのcreate/update/preserve/conflict/manualアクション、検証結果を表示します。`--dry-run`と`--check`は、バックアップ、マニフェスト、ログ、ロックファイル、一時的なプロジェクトファイルを作成しません。

新しいプロジェクトには`.fsd/manifest.json`（所有権マニフェスト）が含まれ、アトミックに書き込まれます。CLI所有ファイル、マーカーリージョン、特定の管理対象依存関係エントリについてのみSHA-256ハッシュを記録します。環境変数、シークレット、`node_modules`のデータは含まれません。追跡対象ファイルやマーカーが変更されていた場合は、それは競合であり、上書きの許可ではありません。アップグレードに意図的に`--force`や無条件の`--adopt`モードはありません。

マニフェストより前に作成されたプロジェクトは、保守的なレガシーモードを使います。CLIは、生成された成果物、管理対象の依存関係、Nuxtのマーカーリージョンについて、リリース済みの正確な署名だけを採用します。欠落、カスタム、または曖昧な管理対象パスは`CONFLICT`または`MANUAL`として報告されます。再試行する前に解決してください。CLI所有の範囲外のアプリケーションコードは、バイト単位でそのまま残ります。

デフォルトでは、Gitワークツリーがdirtyな状態での適用は拒否されます。`--dry-run`と`--check`は引き続き利用できます。`--allow-dirty`は警告を表示し、内部の影響範囲バックアップを使います。このコマンドはGitの状態をリセット、スタッシュ、コミット、ブランチ切り替えなどで変更することは決してありません。Gitを使っていないプロジェクトもサポートされています。

書き込みの前に、upgradeは影響を受けるすべての通常ファイルを`.fsd/backups/`にスナップショットします。書き込みは隣接する一時ファイルとアトミックなリネームを使い、フックのパーミッションを維持し、トラバーサルやシンボリックリンクされた管理対象パスを拒否し、エラー時には逆順にロールバックします。バックアップは失敗したアップグレードの後も保持され、その場所が表示されます。依存関係のインストールに失敗した場合、ソース、設定、マニフェスト、ロックファイルのパスは復元されます。選択したパッケージマネージャーの`install`コマンドを実行して`node_modules`を復元してください。

`upgrade --check`の終了コードはCIで安定しています：

| コード | 意味 |
| --- | --- |
| `0` | プロジェクトは最新です |
| `2` | 競合のないアップグレードが利用可能です |
| `3` | 競合または手作業がアップグレードをブロックしています |
| `4` | プロジェクトの状態または設定がサポートされていないか無効です |

管理対象の状態を備えた最初のリリースは、npm、pnpm、Yarn、Bunを使う、テスト済みのReact + Vite、Next.js、Vue + Vite、Nuxt、SvelteKitスタックの、クリーンな署名一致プロジェクトをサポートします。所有権マニフェストをインストールし、検証済みのレガシーHuskyフックを堅牢化し、パスがまだ存在しない場合にのみCLI所有のpnpmビルドポリシーを追加します。現在、依存関係のバージョン移行は宣言されていません。インストーラーは、将来の移行で管理対象の依存関係が変更された場合にのみ実行されます。正確な互換性テーブル、復旧ガイダンス、拡張ルールについては、[アップグレードのアーキテクチャ](./docs/UPGRADE-ARCHITECTURE.md)を参照してください。

pnpmを使う場合は、**10.26以降**を使ってください（pnpm 11もNode 22+が必要です）。新しいpnpmプロジェクトは、フレームワーク固有の`allowBuilds`リストを`pnpm-workspace.yaml`に受け取ります。リストに載っているビルド依存関係だけがスクリプトを実行できます。未レビューのスクリプトは、黙って信頼されるのではなく、インストールに失敗します。既存のテンプレート所有のワークスペースポリシーは維持されます。追加の依存関係は`pnpm approve-builds`でレビューしてください。グローバルな承認設定は変更されません。[pnpmのビルド設定](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds)を参照してください。

インストールに失敗した場合、CLIはゼロ以外のコードで終了し、ターゲットをロールバックします。インストール前にパッケージマネージャーのポリシーをレビューするには、`--no-install`で作成し、生成されたプロジェクト内で選択したマネージャーを手動で実行してください。

ジェネレーターの種類：

- `feature`
- `entity`
- `widget`
- `page`

既存のスライスは保護されています。スライスを意図的に置き換えたい場合にのみ`--force`を使ってください。ページジェネレーターは、フレームワークネイティブのルートも登録します。React + ViteではReact Router、Vue + ViteではVue Router、Next.jsではApp Routerのルートファイルです。NuxtとSvelteKitのページは、FSDのページスライスをルートディレクトリに変えることなく、薄いファイルベースのルートラッパーを受け取ります。

## テンプレート

| テンプレートID | フレームワーク | ステータス |
| --- | --- | --- |
| `react-vite` | React + Vite | 安定版 |
| `nextjs` | Next.js App Router | 安定版 |
| `vue-vite` | Vue + Vite | 安定版 |
| `nuxt` | Nuxt 4 | 安定版 |
| `sveltekit` | SvelteKit | 安定版 |

VueとNuxtのプロジェクトは、フレームワークネイティブのモジュール、プロバイダー、ジェネレーターを通じてPinia、TanStack Vue Query、VeeValidate、Zodを使います。Nuxtはデフォルトでネイティブの`$fetch`クライアントを使い、Vue QueryのSSRハイドレーションを含みます。

SvelteKitのプロジェクトは、Svelte 5のrunes、TanStack Svelte Query、Svelteストア、SvelteKit Superforms、Zod 4を使います。デフォルトでネイティブFetchを使い、公開ランタイムAPI設定には`PUBLIC_API_BASE`を使います。

## 生成されるアーキテクチャ

```text
src/
├── app/          # アプリレベルのセットアップ、プロバイダー、ルーティング、スタイル
├── pages/        # ルートレベルのコンポジション
├── widgets/      # 大きな再利用可能なUIブロック
├── features/     # ユーザーインタラクションとビジネスアクション
├── entities/     # ビジネスエンティティとその表現
└── shared/       # API、アセット、設定、ユーティリティ、型、UI
```

Nuxtも公式の`app/`ソースディレクトリの下に同じ完全なレイヤーを使います。ファイルベースのルートラッパーは、FSDの`app/pages`レイヤーとは別に`app/app/routes`に置かれます。

SvelteKitはレイヤーを`src/`の下に置き、`src/routes`は薄いファイルベースのルートラッパー用に予約します。SvelteKitが`$app`エイリアスを所有するため、生成されたプロジェクトはFSDのアプリレイヤーに`$fsd-app`を使い、それ以外の場所では`$pages`や`$shared`のようなレイヤー固有のエイリアスを使います。

すべてのレイヤーとその中核セグメントは初日から存在します。ドキュメントのプレースホルダーにより、空のアーキテクチャフォルダもGitクローン間で維持されます。

## プロジェクト設定

選択したスタックは`fsd.config.json`に一度だけ保存されます。ジェネレーターはこのファイルを自動的に読み取り、開発者にスタックを再度選ばせません。

```json
{
  "$schema": "https://raw.githubusercontent.com/FSD-CLI/cli/main/schema/fsd.config.schema.json",
  "schemaVersion": 1,
  "packageManager": "npm",
  "apiClient": "axios",
  "serverState": "react-query",
  "clientState": "zustand",
  "forms": "react-hook-form-zod",
  "ui": "shared-ui",
  "framework": "react-vite"
}
```

`feature auth`を生成すると、ログイン、登録、パスワード忘れ、パスワードリセット、検証コードのフローがまとめて作成されます。デフォルトのスタックでは、型付きのReact Hook Formコンポーネント、Zodスキーマ、React Queryミューテーション、選択したクライアント状態の統合も生成されます。

### オプトインのSupabase Authアダプター（候補）

`-g feature auth --auth-provider supabase`は、公式のブラウザSDKアダプターを生成します。セッションの正規化、確認が必要なサインアップ、リカバリOTPの処理を備えています。これは候補の作業であり、公開されているnpm 2.6.1では利用できません。SDKをインストールし、公開鍵でブラウザクライアントを設定してください。SSRの認可とRLSには、別途アプリケーション統合とバックエンドの受け入れが必要です。[完全なコントラクト](docs/AUTH-SUPABASE-CONTRACT.md)を参照してください。

## 2.2のコアアーキテクチャ

CLIランタイムは安定した境界に分割されています：

```text
bin/
├── cli/                  # 引数のパースとターミナル出力
├── commands/             # ユーザー向けワークフロー
├── core/
│   ├── frameworks/       # ランタイム固有のアダプター
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # 再利用可能なジェネレーターの構成要素
```

- Template Registryは、テンプレートの識別情報、リポジトリ、リリース状況の唯一の情報源です。
- Capability Matrixは、フレームワークをまたぐ無効なスタックの組み合わせを防ぎます。
- Framework Adaptersは、環境変数とクライアントコンポーネントの動作を所有します。
- Project Lifecycleは、クローン、設定、Git、Husky、Commitlint、インストールの動作を所有します。
- CLIエントリーポイントは、コマンドのパースとルーティングだけを行います。

この分離により、React、Next.js、Vue、Nuxt、SvelteKitは1つのCLIライフサイクルを共有しながら、フレームワークネイティブのプロバイダーと生成コンポーネントを維持できます。

## 要件

- CLIにはNode.js 22.12.0以降
- 生成されるNuxtとSvelteKitプロジェクトにはNode.js 22.22.2以降

CLIランタイムの下限、各テンプレートの下限、サポートされているパッケージマネージャーのバージョンは、[docs/RUNTIME-REQUIREMENTS.md](./docs/RUNTIME-REQUIREMENTS.md)で検証されています。`doctor`コマンドがこれらを強制し、ローカルランタイムが一致しない場合は必要な正確なバージョンを報告します。

## 開発

```bash
npm install
npm test
npm run check
```

## リリース

npmへの公開は、メンテナーのみが行う手動のステップです。バージョンタグをプッシュするとリリースチェックが実行され、GitHub Releaseが作成されますが、npmへの公開は行われません。

## ライセンス

MIT

## FSD CLIを支援する

このプロジェクトが役に立つ場合は、任意で開発を支援できます：

- [GitHub Sponsors](https://github.com/sponsors/ashrafmo-1?frequency=one-time&sponsor=ashrafmo-1)
- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay（エジプト）：** `ashrafmo-1`

InstaPayを使う場合は、ユーザー名を記載のとおり正確に入力し、送金を確認する前にアプリ内で受取人の詳細を確認してください。寄付は任意です。

## 既存のプロジェクトと提案

既存のアプリケーションは、公式の[監査とガイド付き移行ワークフロー](docs/EXISTING-PROJECT-SUPPORT.md)を利用できます。CLIジェネレーターは、検証済みの互換性のあるプロジェクトを必要とします。管理対象アップグレードは引き続きCLI所有ファイルに限定されます。未定の追加機能やプラグインの提案、移行の調査については、[提案の決定事項](docs/PROPOSALS.md)を参照してください。

## 再現可能なテンプレートソース

サポートされている各テンプレートは、CLIレジストリ内の完全なコミットに紐づけられています。作成時にその正確なオブジェクトを取得し、SHAを検証して、リポジトリ、要求されたref、解決されたコミットを`.fsd/template.json`に記録します。移動するブランチへのフォールバックは許可されません。テンプレートを更新するには、レビュー済みのレジストリ変更と新しいCLI成果物が必要です。依存関係のバージョン範囲は、引き続き独自のロックファイルとランタイム検証を必要とします。古い生成プロジェクトと所有権マニフェストは、この任意の出所ファイルがなくても有効なままです。

### テンプレートソースの検証

CLIリポジトリから`npm run smoke:templates`を実行すると、登録されている各不変コミットを2回ダウンロードし、記録された出所を確認して、完全なソースバイトツリーを比較します。CLIの更新をリリースする前に、対応するテンプレートPRをマージし、ピン留めされたコミットが引き続き利用可能であることを確認してください。スカッシュやリベースによるマージの後はピンを再設定してください。セキュリティとビルドのチェックは、ソースの同一性検証とは別です。

## Gitワークフローポリシー

GitとConventional Commitsは引き続きセットアップの一部です。プリコミットチェックは、ステージされたファイルと作業ツリーの空白をチェックします。完全なビルドはCIで実行されます。コミット時にlintを実行するには`FSD_PRE_COMMIT_LINT=1`を設定し、プッシュ時にlintとビルドを実行するには`FSD_PRE_PUSH_CHECKS=1`を設定します。意図的な緊急バイパスとして、Huskyは`HUSKY=0 git commit ...`をサポートします。CIは引き続き必須の品質ゲートであり、失敗は解決しなければなりません。

Auto-PRとPRラベリングは任意です。Reactテンプレートは、レビュー済みの例を`.github/optional-workflows/`に保持しています。選択したファイルを`.github/workflows/`にコピーして有効化してください。Auto-PRは手動（`workflow_dispatch`）で、PRを作成するためのリポジトリ権限が必要です。Labelerは`.github/labeler.yml`、ラベル`documentation`、`source`、`ci`、ラベルを適用するためのActions権限が必要です。権限とラベルを設定する前に自動化を有効化しないでください。

## ジェネレーターの候補となる改善

npm 2.6.1には含まれていません：ネイティブのバッチスライス、カスタムルートでの構造のみのセグメントの維持、Steigerによるプロジェクトローカルの`check --architecture`。正確な構文、ロールバック、境界については、[ジェネレーターワークフロー](docs/GENERATOR-WORKFLOWS.md)を参照してください。`--root`には`--segments`が必要です。フレームワークのルートやエイリアス設定を書き換えることはありません。
