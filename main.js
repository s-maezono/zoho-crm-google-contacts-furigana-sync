/**
 * Zoho CRM - Google Contacts Furigana Sync
 * Final Production Version
 * * 機能:
 * 1. 同姓同名（複数ヒット）時は安全のため更新しない
 * 2. 既存の漢字や、Zoho側から送られなかったふりがなは消さずに維持する
 * 3. ログはシンプルにGAS標準コンソールに出力する
 */

function doPost(e) {
  console.log("=== 処理開始 ===");

  try {
    // 1. データ受信チェック
    if (!e || !e.postData) {
      console.error("エラー: データが受信できていません");
      return ContentService.createTextOutput("Error: No data");
    }

    const data = JSON.parse(e.postData.contents);
    // 個人情報保護のため、ログには識別子程度を出力する運用も可だが、デバッグ中は出す
    console.log(`受信データ: ${JSON.stringify(data)}`);

    let contactInfo = null;
    let searchType = "";

    // 2. コンタクト検索（優先度: Email -> 携帯 -> 固定電話）
    // ロジックはテスト成功時と同じものを維持
    if (data.email) {
      searchType = "email";
      contactInfo = searchContactSafe(data.email);
    }

    if (!contactInfo && data.phone_mobile) {
      searchType = "mobile";
      contactInfo = searchContactSafe(data.phone_mobile);
    }

    if (!contactInfo && data.phone_fixed) {
      searchType = "fixed";
      contactInfo = searchContactSafe(data.phone_fixed);
    }

    // 3. 更新処理
    if (contactInfo) {
      console.log(`特定成功: ${contactInfo.resourceName} (by ${searchType})`);
      
      updateContactName(contactInfo, data.given_name_kana, data.family_name_kana);
      
      console.log("=== 処理完了 (成功) ===");
      return ContentService.createTextOutput("Success: Updated");
    } else {
      console.warn("スキップ: 対象が見つからないか、検索結果が曖昧です");
      return ContentService.createTextOutput("Skipped");
    }

  } catch (err) {
    console.error(`システムエラー: ${err.toString()}`);
    return ContentService.createTextOutput(`Error: ${err.toString()}`);
  }
}

/**
 * 安全な検索実行
 * 複数ヒット時は誤更新防止のため null を返す（安全装置）
 */
function searchContactSafe(query) {
  try {
    const response = People.People.searchContacts({
      query: query,
      readMask: 'names,emailAddresses,phoneNumbers'
    });

    if (!response.results || response.results.length === 0) {
      return null;
    }

    // ★安全策: 複数件ヒットした場合は、別人書き換えリスクがあるため何もしない
    if (response.results.length > 1) {
      console.warn(`警告: "${query}" で ${response.results.length} 件ヒットしました。安全のため処理を中断します。`);
      return null;
    }

    const person = response.results[0].person;
    // Primaryフラグがある名前を優先、なければ配列の先頭
    const primaryName = (person.names || []).find(n => n.metadata && n.metadata.primary) || (person.names || [])[0] || {};

    return {
      resourceName: person.resourceName,
      etag: person.etag,
      names: person.names || [],
      // ログ確認用に表示名も持たせておく
      displayName: primaryName.displayName || '(No Name)'
    };
  } catch (e) {
    console.error(`検索APIエラー: ${e.toString()}`);
    return null;
  }
}

/**
 * 名前の更新処理
 * 既存の値を維持しつつマージする（データ保護）
 */
function updateContactName(contactInfo, newGivenKana, newFamilyKana) {
  try {
    const existingName = contactInfo.names.find(n => n.metadata && n.metadata.primary) 
                         || contactInfo.names[0] 
                         || {};

    console.log(`既存データ: ${JSON.stringify(existingName)}`);

    // マージロジック:
    // 入力値がある -> それを使う
    // 入力値がない -> 既存のフリガナを使う
    // 既存もない -> 空文字
    const phoneticGiven = newGivenKana ? newGivenKana : (existingName.phoneticGivenName || '');
    const phoneticFamily = newFamilyKana ? newFamilyKana : (existingName.phoneticFamilyName || '');

    const namePayload = {
      givenName: existingName.givenName || '',       // 漢字は既存を維持
      familyName: existingName.familyName || '',     // 漢字は既存を維持
      phoneticGivenName: phoneticGiven,
      phoneticFamilyName: phoneticFamily
    };

    console.log(`更新ペイロード: ${JSON.stringify(namePayload)}`);

    People.People.updateContact(
      {
        etag: contactInfo.etag,
        names: [namePayload]
      },
      contactInfo.resourceName,
      { updatePersonFields: 'names' }
    );

  } catch (e) {
    console.error(`更新処理エラー: ${e.toString()}`);
    throw e;
  }
}