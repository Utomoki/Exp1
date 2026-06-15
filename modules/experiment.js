(async () => {
  // 初期ベースCSSを適用
  ExpUtils.injectBaseCSS();

  try {
    // サーバーサイドから構成パラメータ一式を非同期Fetchロード
    const config = await ExpUtils.loadConfig('./config/experiment.config.json');

    // jsPsychコア初期化 (v7/v8 準拠型仕様)
    const jsPsych = initJsPsych({
      display_element: 'jspsych-target'
    });

    // Fisher-Yatesアルゴリズムに基づく堅牢なコア内蔵シャッフルエイリアス
    const shuffle = (arr) => jsPsych.randomization.shuffle(arr);

    // マニフェストJSONLのパラレルロード
    const [practiceRaw, mainARaw, mainBRaw, mainCRaw] = await Promise.all([
      ExpUtils.loadJsonl(config.lists.practice.file),
      ExpUtils.loadJsonl(config.lists.mainA.file),
      ExpUtils.loadJsonl(config.lists.mainB.file),
      ExpUtils.loadJsonl(config.lists.mainC.file)
    ]);

    const bSize = config.block_size;

    // 1. 練習リスト構築 (練習はboth条件固定の12試行、ルアーなし)
    const practiceDecorated = ExpUtils.decorateByBlocks(shuffle(practiceRaw), {
      blockSize: bSize,
      colorsSeq: shuffle(config.colors.filter(c => c !== 'black')),
      posSeq: shuffle(config.positions)
    }).map((item, idx) => ({
      ...item,
      block_type: "practice",
      is_lure: false,
      encoding_index: idx + 1
    }));

    // 2. 本番ブロック条件割付マッピング関数の定義
    function generateMainBlockData(rawItems, blockType) {
      const shuffled = shuffle(rawItems);
      
      // カテゴリごとにターゲット(36枚)とルアー(6枚)を比率に沿って安全に分離
      // 仕様：ファイル名に含まれる 'anim_' や 'tool_' を自動判別
      const categories = {};
      shuffled.forEach(item => {
        const match = item.src.match(/([A-Za-z0-9_-]+)_/);
        const cat = match ? match[1] : 'default';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      });

      const targetPool = [];
      const lurePool = [];
      
      Object.keys(categories).forEach(cat => {
        const catItems = categories[cat];
        // 1ブロック辺り 42枚中 記銘36(85.7%):ルアー6(14.3%) の比率で配分
        const targetCount = Math.round(catItems.length * (36 / 42));
        targetPool.push(...catItems.slice(0, targetCount));
        lurePool.push(...catItems.slice(targetCount));
      });

      // 過不足の補正セーフティ
      const finalTargets = targetPool.slice(0, 36);
      const finalLures = lurePool.slice(0, 6);

      let colorsSeq = [];
      let posSeq = [];

      if (blockType === "color") {
        colorsSeq = shuffle(config.colors.filter(c => c !== 'black'));
        posSeq = [0]; // 常に中央
      } else if (blockType === "position") {
        colorsSeq = ['black']; // 常に黒
        posSeq = shuffle(config.positions);
      } else if (blockType === "both") {
        colorsSeq = shuffle(config.colors.filter(c => c !== 'black'));
        posSeq = shuffle(config.positions);
      }

      // 記銘用36枚に対して文脈の環境情報を付与
      const decoratedTargets = ExpUtils.decorateByBlocks(finalTargets, {
        blockSize: bSize, colorsSeq, posSeq
      }).map((item, idx) => ({
        ...item,
        block_type: blockType,
        is_lure: false,
        encoding_index: idx + 1
      }));

      // ルアー用6枚に対するダミー環境属性の付与 (再認評価時の参照メタデータ)
      const decoratedLures = finalLures.map((item, idx) => ({
        ...item,
        block_type: blockType,
        is_lure: true,
        context_order: idx + 1,
        order_in_context: 99,
        frame_color: colorsSeq[idx % colorsSeq.length],
        position_index: posSeq[idx % posSeq.length],
        encoding_index: null
      }));

      return [...decoratedTargets, ...decoratedLures];
    }

    // 3. カウンターバランス（ブロック順序の被験者間ランダム化）
    const blockConditions = shuffle(["color", "position", "both"]);
    const rawLists = [mainARaw, mainBRaw, mainCRaw]; // リストと条件の結合
    
    const mainBlocksCombined = blockConditions.map((condition, idx) => {
      return {
        type: condition,
        list: generateMainBlockData(rawLists[idx], condition)
      };
    });

    // 全画像アセットの統合プリロード配列化
    const allImagesToPreload = [
      ...practiceDecorated.map(x => x.src),
      ...mainBlocksCombined.flatMap(b => b.list.map(x => x.src))
    ];

    // タイムラインの初期スタック
    const timeline = [];

    // プリロードノード
    timeline.push({
      type: jsPsychPreload,
      images: allImagesToPreload,
      show_progress_bar: true,
      message: "実験に必要な画像アセットを読み込んでいます。しばらくお待ちください..."
    });

    // 同意・属性フェーズ
    timeline.push(...BuildIntroduction.build(jsPsych, config));

    // 自動フルスクリーン移行ノード
    timeline.push({
      type: jsPsychFullscreen,
      fullscreen_mode: true,
      message: '<p>【練習課題へ】ボタンを押すと画面が自動的に全画面モードへ切り替わります。</p>',
      button_label: '練習課題へ'
    });

    // 練習ブロックの注入
    timeline.push(...BuildTrials.buildPracticeBlock(jsPsych, practiceDecorated, config));

    // 本番3ブロックの動的ループインジェクト
    mainBlocksCombined.forEach((blockObj, i) => {
      const setIndex = i + 1;
      timeline.push(...BuildTrials.buildMainBlock(jsPsych, blockObj.list, blockObj.type, setIndex, config));
    });

    // フルスクリーン自動解除
    timeline.push({
      type: jsPsychFullscreen,
      fullscreen_mode: false,
      on_start: () => ExpUtils.disableFullscreenMonitoring()
    });

    // スクロール・カーソル完全復帰
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<p style="font-size:22px;">全タスクが完了しました。現在、実験データをサーバーへ安全に保存しています...</p>',
      choices: "NO_KEYS",
      trial_duration: 1200,
      on_load: () => {
        ExpUtils.showCursor();
        ExpUtils.unlockScroll();
      }
    });

    // 【欠陥解消修正】Promise/async/await 規格準拠型データ永続化処理
    timeline.push({
      type: jsPsychCallFunction,
      async: true,
      func: async function(done) {
        const now = new Date();
        const expDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const expTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

        // データ層の最終確定プロパティ格納
        jsPsych.data.addProperties({
          experiment_date: expDate,
          experiment_end_time: expTime,
          block_order_sequence: blockConditions.join('-')
        });

        try {
          const response = await fetch('write_data.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsPsych.data.get().json()
          });
          
          if (!response.ok) throw new Error(`HTTP Status Error: ${response.status}`);
          console.log("Data packet saved successfully.");
        } catch (err) {
          console.error("Critical Data Loss Prevention Error:", err);
          alert("【警告】データの保存中に通信エラーが発生しました。この画面を絶対に閉じず、完了コードを控えて実験担当者までお伝えください。");
        } finally {
          done(); // 非同期完了をjsPsychコアへ通知し、初めて次ノード（終了画面）へ安全に移行
        }
      }
    });

    // 終了確定・完了コード提示画面（Choices: NO_KEYS で離脱を担保）
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div class="inst-wrap" style="text-align:center;">
          <p style="font-size:24px; font-weight:bold; color:#2c3e50;">お疲れ様でした。以上で実験調査はすべて終了です。</p>
          <p>以下の完了コードを確実にコピー、またはメモに残してから画面を閉じてください。</p>
          <div style="background:#f1c40f; padding:15px; border-radius:8px; display:inline-block; margin:20px 0;">
            <span style="font-size:16px; font-weight:bold; color:#333;">Yahoo!クラウドソーシング用 作業完了コード</span><br>
            <strong style="font-size:38px; letter-spacing:4px; color:#c0392b;">${config.completion_code}</strong>
          </div>
          <div class="contact" style="text-align:left;">
            <div><strong>お問い合わせ先</strong>（システムエラーや謝礼に関する問題が生じた場合）</div>
            <div>${config.investigator.affiliation}</div>
            <div>氏名：${config.investigator.name}</div>
            <div>Mail：<a href="mailto:${config.investigator.email}">${config.investigator.email}</a> ／ TEL：${config.investigator.phone}</div>
          </div>
        </div>
      `,
      choices: "NO_KEYS"
    });

    // 実験駆動
    jsPsych.run(timeline);

  } catch (error) {
    console.error("Initialization Error:", error);
    // 初期化に失敗した場合、画面が真っ白になるのを防ぐためのフォールバックUI
    document.getElementById('jspsych-target').innerHTML = `
      <div style="max-width: 800px; margin: 50px auto; padding: 30px; border: 2px solid #e74c3c; border-radius: 8px; background-color: #fadbd8; color: #c0392b; font-family: sans-serif; text-align: center;">
        <h2 style="margin-top: 0;">実験の読み込みに失敗しました</h2>
        <p style="font-size: 18px; line-height: 1.6;">画像リストや設定ファイルが正しく取得できませんでした。<br>HTMLファイルをローカル（<code>file://</code>）で直接開いている場合、セキュリティ制限により動作しません。</p>
        <p style="font-weight: bold; font-size: 18px;">VS Codeの拡張機能「Live Server」などを利用し、ローカルサーバー経由で起動してください。</p>
        <hr style="border-color: #e74c3c; margin: 25px 0;">
        <p style="font-size: 14px; text-align: left; color: #333;"><strong>エラー詳細:</strong> ${error.message}</p>
      </div>
    `;
  }
})();
