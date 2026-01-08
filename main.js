function doPost(e) {
  let logBuffer = []; // ログを貯める変数
  const log = (msg) => {
    logBuffer.push(new Date().toISOString() + " " + msg);
  };

  log("=== 処理開始 (Email Debug Mode) ===");
  
  try {
    // 1. 受信データの確認
    if (!e || !e.postData) {
      log("エラー: データが受信できていません");
      return sendLogAndReturn(logBuffer, "Error: No data");
    }
    
    const data = JSON.parse(e.postData.contents);
    log("受信データ: " + JSON.stringify(data));

    let contactInfo = null;

    // 2. 検索実行
    if (data.email) {
      log("メールアドレスで検索中: " + data.email);
      contactInfo = searchContact(log, 'email', data.email);
    }

    if (!contactInfo && data.phone_mobile) {
      log("携帯電話で検索中: " + data.phone_mobile);
      contactInfo = searchContact(log, 'phone', data.phone_mobile);
    }

    if (!contactInfo && data.phone_fixed) {
      log("固定電話で検索中: " + data.phone_fixed);
      contactInfo = searchContact(log, 'phone', data.phone_fixed);
    }

    // 3. 検索結果の判定
    if (contactInfo) {
      log("コンタクトが見つかりました: " + contactInfo.resourceName);
      
      const existingName = contactInfo.names && contactInfo.names.length > 0 ? contactInfo.names[0] : {};
      log("既存の名前データ: " + JSON.stringify(existingName));

      // 更新処理
      updateContactKana(log, contactInfo, data.given_name_kana, data.family_name_kana);
      
      log("=== 処理完了 (成功) ===");
      return sendLogAndReturn(logBuffer, "Success: Updated");
    } else {
      log("警告: コンタクトが見つかりませんでした");
      return sendLogAndReturn(logBuffer, "Skipped: Contact not found");
    }

  } catch (err) {
    log("致命的なエラーが発生: " + err.toString());
    log("Stack: " + err.stack);
    return sendLogAndReturn(logBuffer, "Error: " + err.toString());
  }
}

// ログをメール送信してレスポンスを返す補助関数
function sendLogAndReturn(logBuffer, responseText) {
  try {
    const email = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to: email,
      subject: "GAS Debug Log: Zoho Sync",
      body: logBuffer.join("\n")
    });
  } catch (e) {
    // メール送信失敗時は何もしない（無限ループ防止）
  }
  return ContentService.createTextOutput(responseText);
}

function searchContact(log, type, query) {
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
    log("検索中にエラー: " + e.toString());
  }
  return null;
}

function updateContactKana(log, contactInfo, givenNameKana, familyNameKana) {
  try {
    const existingName = contactInfo.names.length > 0 ? contactInfo.names[0] : {};

    const namePayload = {
      givenName: existingName.givenName || '',
      familyName: existingName.familyName || '',
      phoneticGivenName: givenNameKana || '',
      phoneticFamilyName: familyNameKana || ''
    };
    
    log("送信する更新データ: " + JSON.stringify(namePayload));

    const contact = {
      etag: contactInfo.etag,
      names: [namePayload]
    };

    People.People.updateContact(
      contact,
      contactInfo.resourceName,
      { updatePersonFields: 'names' }
    );
    
    log("API更新リクエスト送信完了");

  } catch (e) {
    log("更新処理中にエラー: " + e.toString());
    throw e;
  }
}

// 初回権限認証用のダミー関数
function setupAuth() {
  console.log("認証用関数実行完了");
}