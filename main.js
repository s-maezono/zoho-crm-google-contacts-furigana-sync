function doPost(e) {
  console.log("=== 処理開始 (doPost) ===");
  
  try {
    // 1. 受信データの確認
    if (!e || !e.postData) {
      console.error("エラー: データが受信できていません");
      return ContentService.createTextOutput("Error: No data");
    }
    
    const data = JSON.parse(e.postData.contents);
    console.log("受信データ:", JSON.stringify(data));

    let contactInfo = null;

    // 2. 検索実行
    if (data.email) {
      console.log("メールアドレスで検索中: " + data.email);
      contactInfo = searchContact('email', data.email);
    }

    if (!contactInfo && data.phone_mobile) {
      console.log("携帯電話で検索中: " + data.phone_mobile);
      contactInfo = searchContact('phone', data.phone_mobile);
    }

    if (!contactInfo && data.phone_fixed) {
      console.log("固定電話で検索中: " + data.phone_fixed);
      contactInfo = searchContact('phone', data.phone_fixed);
    }

    // 3. 検索結果の判定
    if (contactInfo) {
      console.log("コンタクトが見つかりました: " + contactInfo.resourceName);
      console.log("現在の名前情報: ", JSON.stringify(contactInfo.names));
      
      updateContactKana(contactInfo, data.given_name_kana, data.family_name_kana);
      
      console.log("=== 処理完了 (成功) ===");
      return ContentService.createTextOutput("Success: Updated");
    } else {
      console.warn("コンタクトが見つかりませんでした");
      return ContentService.createTextOutput("Skipped: Contact not found");
    }

  } catch (err) {
    console.error("致命的なエラーが発生: " + err.toString());
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
    console.error("検索中にエラー: " + e.toString());
  }
  return null;
}

function updateContactKana(contactInfo, givenNameKana, familyNameKana) {
  try {
    const existingName = contactInfo.names.length > 0 ? contactInfo.names[0] : {};

    console.log("既存の givenName: " + (existingName.givenName || '(なし)'));
    console.log("既存の familyName: " + (existingName.familyName || '(なし)'));

    // 更新データの構築
    const namePayload = {
      givenName: existingName.givenName || '',
      familyName: existingName.familyName || '',
      phoneticGivenName: givenNameKana || '',
      phoneticFamilyName: familyNameKana || ''
    };
    
    console.log("送信する更新データ:", JSON.stringify(namePayload));

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
    
    console.log("API更新成功。レスポンス:", JSON.stringify(result));

  } catch (e) {
    console.error("更新処理中にエラー: " + e.toString());
    throw e;
  }
}