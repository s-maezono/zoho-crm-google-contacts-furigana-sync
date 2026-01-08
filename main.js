function doPost(e) {
  Logger.log("=== 処理開始 (doPost v2.1) ===");
  
  try {
    // 1. 受信データの確認
    if (!e || !e.postData) {
      Logger.log("エラー: データが受信できていません");
      return ContentService.createTextOutput("Error: No data");
    }
    
    const data = JSON.parse(e.postData.contents);
    Logger.log("受信データ: " + JSON.stringify(data));

    let contactInfo = null;

    // 2. 検索実行
    if (data.email) {
      Logger.log("メールアドレスで検索中: " + data.email);
      contactInfo = searchContact('email', data.email);
    }

    if (!contactInfo && data.phone_mobile) {
      Logger.log("携帯電話で検索中: " + data.phone_mobile);
      contactInfo = searchContact('phone', data.phone_mobile);
    }

    if (!contactInfo && data.phone_fixed) {
      Logger.log("固定電話で検索中: " + data.phone_fixed);
      contactInfo = searchContact('phone', data.phone_fixed);
    }

    // 3. 検索結果の判定
    if (contactInfo) {
      Logger.log("コンタクトが見つかりました: " + contactInfo.resourceName);
      // 詳細な名前情報のログ
      if (contactInfo.names) {
        Logger.log("現在の名前データ全量: " + JSON.stringify(contactInfo.names));
      } else {
        Logger.log("現在の名前データ: (なし)");
      }
      
      updateContactKana(contactInfo, data.given_name_kana, data.family_name_kana);
      
      Logger.log("=== 処理完了 (成功) ===");
      return ContentService.createTextOutput("Success: Updated");
    } else {
      Logger.log("警告: コンタクトが見つかりませんでした");
      return ContentService.createTextOutput("Skipped: Contact not found");
    }

  } catch (err) {
    Logger.log("致命的なエラーが発生: " + err.toString());
    return ContentService.createTextOutput("Error: " + err.toString());
  }
}

function searchContact(type, query) {
  try {
    if (!query) return null;

    const response = People.People.searchContacts({
      query: query,
      readMask: 'names,emailAddresses,phoneNumbers'
    });

    if (response.results && response.results.length > 0) {
      const person = response.results[0].person;
      return {
        resourceName: person.resourceName,
        etag: person.etag,
        names: person.names || []
      };
    }
  } catch (e) {
    Logger.log("検索中にエラー: " + e.toString());
  }
  return null;
}

function updateContactKana(contactInfo, givenNameKana, familyNameKana) {
  try {
    // 既存の名前情報を取得（なければ空）
    const existingName = contactInfo.names.length > 0 ? contactInfo.names[0] : {};

    Logger.log("既存の givenName: " + (existingName.givenName || '(なし)'));
    Logger.log("既存の familyName: " + (existingName.familyName || '(なし)'));

    // 更新データの構築
    const namePayload = {
      givenName: existingName.givenName || '',
      familyName: existingName.familyName || '',
      phoneticGivenName: givenNameKana || '',
      phoneticFamilyName: familyNameKana || ''
    };
    
    Logger.log("送信する更新データ: " + JSON.stringify(namePayload));

    const contact = {
      etag: contactInfo.etag,
      names: [namePayload]
    };

    // APIリクエスト実行
    const result = People.People.updateContact(
      contact,
      contactInfo.resourceName,
      { updatePersonFields: 'names' }
    );
    
    Logger.log("API更新成功。レスポンス: " + JSON.stringify(result));

  } catch (e) {
    Logger.log("更新処理中にエラー: " + e.toString());
    throw e;
  }
}