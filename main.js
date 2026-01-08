function doPost(e) {
  let logBuffer = [];
  const log = (msg) => {
    logBuffer.push(new Date().toISOString() + " " + msg);
  };

  log("=== 処理開始 (Safe Mode v3.0) ===");
  
  try {
    // 1. 受信データの確認
    if (!e || !e.postData) {
      log("エラー: データが受信できていません");
      return sendLogAndReturn(logBuffer, "Error: No data");
    }
    
    const data = JSON.parse(e.postData.contents);
    log("受信データ: " + JSON.stringify(data));

    let contactInfo = null;
    let searchType = "";

    // 2. 検索実行（優先度順）
    if (data.email) {
      searchType = "email";
      contactInfo = searchContactSafe(log, searchType, data.email);
    }

    if (!contactInfo && data.phone_mobile) {
      searchType = "mobile";
      contactInfo = searchContactSafe(log, searchType, data.phone_mobile);
    }

    if (!contactInfo && data.phone_fixed) {
      searchType = "fixed";
      contactInfo = searchContactSafe(log, searchType, data.phone_fixed);
    }

    // 3. 更新処理
    if (contactInfo) {
      log("対象コンタクト特定: " + contactInfo.resourceName + " (by " + searchType + ")");
      
      updateContactKanaSafe(log, contactInfo, data.given_name_kana, data.family_name_kana);
      
      log("=== 処理完了 (成功) ===");
      return sendLogAndReturn(logBuffer, "Success: Updated");
    } else {
      log("警告: コンタクトが見つからないか、検索結果が曖昧なためスキップしました");
      return sendLogAndReturn(logBuffer, "Skipped: Not found or Ambiguous");
    }

  } catch (err) {
    log("致命的なエラー: " + err.toString());
    log("Stack: " + err.stack);
    // エラー時は必ずメール通知
    sendErrorEmail(logBuffer.join("\n"));
    return ContentService.createTextOutput("Error: " + err.toString());
  }
}

// ログ送信とレスポンス生成の補助関数
function sendLogAndReturn(logBuffer, responseText) {
  // 成功時も念のためログを送る（運用が安定したら「エラー時のみ」に切り替え推奨）
  sendErrorEmail(logBuffer.join("\n"));
  return ContentService.createTextOutput(responseText);
}

function sendErrorEmail(body) {
  try {
    const email = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to: email,
      subject: "GAS Zoho Sync Log",
      body: body
    });
  } catch (e) {
    console.error("メール送信失敗: " + e.toString());
  }
}

// ① 改善案：結果が1件以外ならnullを返す安全な検索
function searchContactSafe(log, type, query) {
  try {
    if (!query) return null;
    log("検索実行: " + type + " = " + query);

    const response = People.People.searchContacts({
      query: query,
      readMask: 'names,emailAddresses,phoneNumbers'
    });

    if (!response.results || response.results.length === 0) {
      log("→ 結果なし");
      return null;
    }

    // ★最重要修正：1件のみヒットした場合だけ対象とする
    if (response.results.length > 1) {
      log("⚠ 警告: " + response.results.length + " 件のコンタクトがヒットしたため、安全のため更新を中止します。");
      return null;
    }

    const person = response.results[0].person;
    return {
      resourceName: person.resourceName,
      etag: person.etag,
      names: person.names || []
    };
  } catch (e) {
    log("検索エラー: " + e.toString());
  }
  return null;
}

function updateContactKanaSafe(log, contactInfo, givenNameKana, familyNameKana) {
  try {
    // ② 改善案：Primary指定がある名前を優先取得、なければ先頭
    const existingName = contactInfo.names.find(n => n.metadata && n.metadata.primary) 
                         || contactInfo.names[0] 
                         || {};

    log("既存の名前データ(Primary): " + JSON.stringify(existingName));

    // ③ 改善案：入力がない場合は既存の値を維持（空文字上書き防止）
    // InputがあるならInputを使う。Inputが空なら、既存のPhoneticを使う。それもなければ空文字。
    const newPhoneticGiven = givenNameKana ? givenNameKana : (existingName.phoneticGivenName || '');
    const newPhoneticFamily = familyNameKana ? familyNameKana : (existingName.phoneticFamilyName || '');

    const namePayload = {
      givenName: existingName.givenName || '',
      familyName: existingName.familyName || '',
      phoneticGivenName: newPhoneticGiven,
      phoneticFamilyName: newPhoneticFamily
    };
    
    log("更新ペイロード: " + JSON.stringify(namePayload));

    // ④ etagを利用した楽観ロック更新
    const contact = {
      etag: contactInfo.etag,
      names: [namePayload]
    };

    // ⑤ updatePersonFields 指定（これは元からOK）
    People.People.updateContact(
      contact,
      contactInfo.resourceName,
      { updatePersonFields: 'names' }
    );
    
    log("API更新リクエスト完了");

  } catch (e) {
    log("更新処理中にエラー: " + e.toString());
    throw e;
  }
}

// ⑦ 権限認証用関数
function setupAuth() {
  console.log("メール送信権限の確認完了");
}