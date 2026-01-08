# Zoho CRM to Google Contacts Furigana Sync

Zoho CRMの連絡先更新をトリガーとして、Googleコンタクトの「ふりがな（Phonetic Name）」を自動的に同期・更新するGoogle Apps Script (GAS) です。

実務運用を想定し、誤更新防止（同姓同名対策）や既存データの保護機能（漢字名の維持）を実装しています。

## 🚀 特長

1.  **マルチ検索ロジック**
    * 以下の優先順位でGoogleコンタクトを検索し、同一人物を特定します。
        1.  メールアドレス
        2.  携帯電話番号
        3.  固定電話番号
2.  **安全な更新 (Safety Mode)**
    * **同姓同名対策:** 検索条件で「複数件」のコンタクトがヒットした場合、誤って別人を書き換えるリスクを避けるため、更新を行わずに処理をスキップします。
3.  **データ保護 (Data Integrity)**
    * **漢字名の維持:** 既存の「名前（漢字）」は一切変更せず、ふりがな項目のみをピンポイントで更新します。
    * **空値の上書き防止:** Zoho側からふりがなが空で送られてきた場合、Googleコンタクト側の既存のふりがなを消去せず維持します（マージ更新）。

## 🛠 技術スタック

* Google Apps Script (GAS)
* Google People API

## 📦 セットアップ手順

### 1. プロジェクトの準備
`clasp` を使用している場合：

```bash
clasp push

```

### 2. APIの有効化

Google Apps Script エディタの左メニュー「サービス」から以下を追加してください。

* **Google People API** (ID: `People`)

### 3. デプロイ設定

Webhookとして機能させるため、ウェブアプリとしてデプロイします。

1. GASエディタ右上の **[デプロイ]** > **[デプロイを管理]** をクリック。
2. **[新しいデプロイ]** を選択。
3. 設定内容:
* **種類**: ウェブアプリ
* **説明**: (任意)
* **次のユーザーとして実行**: **自分** (重要: コンタクトへのアクセス権を持つアカウント)
* **アクセスできるユーザー**: **全員** (Zohoからのアクセスを許可するため)


4. 発行された **ウェブアプリURL** をコピーします。

## 🔗 Zoho CRM (Webhook) の設定

Zoho CRMの「ワークフロールール」または「Zoho Flow」にて、以下のようにWebhookを設定します。

* **メソッド:** `POST`
* **URL:** (GASで発行したウェブアプリURL)
* **Body Type:** `Raw` / `JSON`
* **Payload 例:**

```json
{
  "email": "${Contacts.Email}",
  "phone_mobile": "${Contacts.Mobile}",
  "phone_fixed": "${Contacts.Phone}",
  "given_name_kana": "${Contacts.First_Name_Kana}",
  "family_name_kana": "${Contacts.Last_Name_Kana}"
}

```

※ `${...}` の部分は、Zoho CRM側の実際のAPI名（差し込み項目）に合わせてください。

## ⚠️ 動作仕様

* **検索の一致:** 完全一致検索を行います。
* **ログ:** GASの標準コンソール (`console.log`) に出力されます。Google Cloud Consoleのログエクスプローラから確認可能です。
* **エラーハンドリング:** 必須データ欠落やAPIエラー時は、HTTPステータスコードと共にエラーメッセージを返します。

## License

MIT

```

```