function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 検索優先順位: Email -> 携帯 -> 固定電話
    let contactInfo = null;

    if (data.email) {
      contactInfo = searchContact('email', data.email);
    }

    if (!contactInfo && data.phone_mobile) {
      contactInfo = searchContact('phone', data.phone_mobile);
    }

    if (!contactInfo && data.phone_fixed) {
      contactInfo = searchContact('phone', data.phone_fixed);
    }

    // コンタクトが見つかった場合のみ更新
    if (contactInfo) {
      updateContactKana(contactInfo, data.given_name_kana, data.family_name_kana);
      return ContentService.createTextOutput("Success: Updated");
    } else {
      return ContentService.createTextOutput("Skipped: Contact not found");
    }

  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString());
  }
}

function searchContact(type, query) {
  try {
    if (!query) return null;

    // namesフィールドを含めて取得（必須）
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
    console.error("Search Error: " + e.toString());
  }
  return null;
}

function updateContactKana(contactInfo, givenNameKana, familyNameKana) {
  try {
    // 既存の名前リストの先頭を取得。なければ空オブジェクト
    const existingName = contactInfo.names.length > 0 ? contactInfo.names[0] : {};

    // 更新用オブジェクトの作成
    // 重要: 既存の漢字名(givenName, familyName)を維持しつつ、フリガナを追加する
    const namePayload = {
      givenName: existingName.givenName || '',
      familyName: existingName.familyName || '',
      phoneticGivenName: givenNameKana || '',
      phoneticFamilyName: familyNameKana || ''
    };

    const contact = {
      etag: contactInfo.etag,
      names: [namePayload]
    };

    // updatePersonFields には 'names' を指定
    People.People.updateContact(
      contact,
      contactInfo.resourceName,
      { updatePersonFields: 'names' }
    );
    
  } catch (e) {
    console.error("Update Error: " + e.toString());
    throw e;
  }
}