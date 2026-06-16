window.BuildTrials = (() => {
  
  // 順序課題用の左右画像HTML生成
  function makePairHTML(leftSrc, rightSrc) {
    return `
      <div style="display:flex; justify-content:center; gap:80px; align-items:center; margin-top:40px;">
        <div style="border:1px solid #ccc; padding:10px; background:white; width:220px; height:220px; display:flex; align-items:center; justify-content:center;">
          <img src="${leftSrc}" width="200" height="200" style="object-fit:contain;">
        </div>
        <div style="border:1px solid #ccc; padding:10px; background:white; width:220px; height:220px; display:flex; align-items:center; justify-content:center;">
          <img src="${rightSrc}" width="200" height="200" style="object-fit:contain;">
        </div>
      </div>
    `;
  }

  // Fisher-Yates シャッフルアルゴリズム（ローカル用）
  function localShuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 1. 記銘試行 (Encoding) の動的構築
  function buildEncodingTrials(jsPsych, list, config, isPractice = false) {
    const encodingTimeline = [];
    
    // 【重要バグ修正】リストにルアーが含まれている場合、記銘フェーズからは確実に排除する
    const encodingList = list.filter(x => !x.is_lure);

    encodingList.forEach((item, idx) => {
      // 注視点ノード
      encodingTimeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div class="fixation">+</div>',
        choices: "NO_KEYS",
        trial_duration: 500,
        on_start: () => { 
          if (idx === 0) ExpUtils.hideCursor(); 
        }
      });

      // ブランクノード
      encodingTimeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '',
        choices: "NO_KEYS",
        trial_duration: 2000
      });

      // 刺激提示・可食判断ノード
      encodingTimeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: () => ExpUtils.makeFramedImageHTMLWithPos(item.src, item.frame_color, item.position_index, config),
        choices: ['f', 'j'],
        response_ends_trial: false, // 反応があっても2.5秒固定制御
        trial_duration: 2500,
        data: {
          Task: "encoding",
          Phase: "encoding",
          Id: item.id,
          Item_name: item.src,
          Block_type: item.block_type,
          Context_order: item.context_order,
          Order_in_context: item.order_in_context,
          Frame_color: item.frame_color,
          Position_index: item.position_index,
          Encoding_index: item.encoding_index,
          Trial_index_in_task: idx + 1,
          Is_practice: isPractice,
          Pair_type: null,
          Test_type: null
        },
        on_finish: function(data) {
          data.Encoding_response = data.response;
          data.Encoding_RT = data.rt;
          
          if (data.response !== null) {
            const isF = (data.response === 'f');
            data.Correctness = (isF === item.eatable) ? 1 : 0;
          } else {
            data.Correctness = null; // 無反応時はnull
          }
          data.Encoding_correctness = data.Correctness;
        }
      });
    });

    return encodingTimeline;
  }

  // 2. 再認 ＆ ソースメモリー課題のビルド構造（静的展開へ全面修正）
  function buildRecognitionAndSource(jsPsych, testPool, blockType, config, isPractice = false) {
    const trials = [];

    testPool.forEach((item, idx) => {
      // 再認試行ノード
      const recognitionTrial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style="border:1px solid #ccc; padding:10px; width:200px; height:200px; margin:0 auto; background:white; display:flex; align-items:center; justify-content:center;">
            <img src="${item.src}" style="width:200px; height:200px; object-fit:contain;" />
          </div>
          <p style="margin-top:40px;">この画像は、このセットの中に提示されていましたか？</p>
          <p style="font-weight:bold; font-size:24px;">F：表示されていた &nbsp;&nbsp;&nbsp;&nbsp; J：表示されていなかった</p>
        `,
        choices: ['f', 'j'],
        data: {
          Task: "retrieval",
          Phase: "retrieval_recognition",
          Id: item.id,
          Item_name: item.src,
          Block_type: blockType,
          Context_order: item.context_order,
          Order_in_context: item.order_in_context,
          Frame_color: item.frame_color,
          Position_index: item.position_index,
          Trial_index_in_task: idx + 1,
          Test_type: item.test_type, // "boundary", "within", "lure"
          Is_practice: isPractice,
          Pair_type: null
        },
        on_finish: function(d) {
          d.Recognition_response = d.response;
          if (d.response !== null) {
            const isOldResponse = (d.response === 'f');
            const isTrueOld = (d.Test_type !== "lure");
            d.Correctness = (isOldResponse === isTrueOld) ? 1 : 0;
          } else {
            d.Correctness = null;
          }
        }
      };
      trials.push(recognitionTrial);

      // --- ソースメモリー選択肢の事前構築 ---
      let colorChoices = [];
      let posChoices = [];
      const allColors = config.colors.filter(c => c !== 'black');
      const allPositions = config.positions;

      if (item.test_type !== "lure" && !isPractice) {
        // Old画像：1つ前の文脈属性を誤認候補にするロジック
        const currentContext = item.context_order;
        const prevContext = (currentContext === 1) ? 6 : currentContext - 1;
        // 別の文脈から環境属性を抽出するためのダミー候補
        colorChoices = [item.frame_color, allColors[prevContext % allColors.length]];
        posChoices = [item.position_index, allPositions[prevContext % allPositions.length]];
      } else {
        // Lure画像または練習問題：ランダムな2択を生成
        colorChoices = [item.frame_color, allColors.find(c => c !== item.frame_color) ?? allColors[0]];
        posChoices = [item.position_index, allPositions.find(p => p !== item.position_index) ?? allPositions[0]];
      }

      // 重複セーフガード
      if (colorChoices[0] === colorChoices[1]) {
        colorChoices[1] = allColors.find(c => c !== colorChoices[0]) ?? 'red';
      }
      if (posChoices[0] === posChoices[1]) {
        posChoices[1] = allPositions.find(p => p !== posChoices[0]) ?? 60;
      }

      const finalColorOptions = localShuffle([...new Set(colorChoices)]);
      const finalPosOptions = localShuffle([...new Set(posChoices)]);

      // カラー設問ノード
      const colorSourceTrial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style="border:1px solid #ccc; padding:10px; width:200px; height:200px; margin:0 auto; background:white; display:flex; align-items:center; justify-content:center;">
            <img src="${item.src}" style="width:200px; height:200px; object-fit:contain;" />
          </div>
          <p style="margin-top:40px;">この画像は、どの<strong>「枠の色」</strong>で表示されていましたか？</p>
          <p style="font-weight:bold; font-size:26px;">
            F：<span style="color:${config.color_map[finalColorOptions[0]] ?? '#000'}">${finalColorOptions[0]}</span> 
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 
            J：<span style="color:${config.color_map[finalColorOptions[1]] ?? '#000'}">${finalColorOptions[1]}</span>
          </p>
        `,
        choices: ['f', 'j'],
        data: {
          Task: "retrieval",
          Phase: "retrieval_source",
          Id: item.id,
          Item_name: item.src,
          Block_type: blockType,
          Context_order: item.context_order,
          Order_in_context: item.order_in_context,
          Frame_color: item.frame_color,
          Position_index: item.position_index,
          Trial_index_in_task: idx + 1,
          Test_type: item.test_type,
          Is_practice: isPractice,
          Source_kind: "color",
          Opt_left: finalColorOptions[0],
          Opt_right: finalColorOptions[1],
          Correct_value: item.frame_color,
          Pair_type: null
        },
        on_finish: function(d) {
          d.Source_response = d.response;
          if (d.response !== null) {
            const chosen = (d.response === 'f') ? d.Opt_left : d.Opt_right;
            // ルアーの場合は常に0(不正解)とする仕様
            d.Correctness = (item.test_type !== "lure" && chosen === d.Correct_value) ? 1 : 0;
          } else {
            d.Correctness = null;
          }
        }
      };

      // 位置設問ノード
      const posSourceTrial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style="border:1px solid #ccc; padding:10px; width:200px; height:200px; margin:0 auto; background:white; display:flex; align-items:center; justify-content:center;">
            <img src="${item.src}" style="width:200px; height:200px; object-fit:contain;" />
          </div>
          <p style="margin-top:40px;">この画像は、画面のどの<strong>「配置位置（角度）」</strong>に表示されていましたか？</p>
          <p style="font-weight:bold; font-size:24px;">F：左選択肢 [ ${finalPosOptions[0]}° ] &nbsp;&nbsp;&nbsp;&nbsp; J：右選択肢 [ ${finalPosOptions[1]}° ]</p>
        `,
        choices: ['f', 'j'],
        data: {
          Task: "retrieval",
          Phase: "retrieval_source",
          Id: item.id,
          Item_name: item.src,
          Block_type: blockType,
          Context_order: item.context_order,
          Order_in_context: item.order_in_context,
          Frame_color: item.frame_color,
          Position_index: item.position_index,
          Trial_index_in_task: idx + 1,
          Test_type: item.test_type,
          Is_practice: isPractice,
          Source_kind: "position",
          Opt_left: finalPosOptions[0],
          Opt_right: finalPosOptions[1],
          Correct_value: item.position_index,
          Pair_type: null
        },
        on_finish: function(d) {
          d.Source_response = d.response;
          if (d.response !== null) {
            const chosen = (d.response === 'f') ? d.Opt_left : d.Opt_right;
            d.Correctness = (item.test_type !== "lure" && chosen === d.Correct_value) ? 1 : 0;
          } else {
            d.Correctness = null;
          }
        }
      };

      // 条件付きソース記憶ノード（再認でOld＝Fと答えた場合のみ実施）
      const sourceConditionalNode = {
        timeline: [],
        conditional_function: function() {
          const lastTrialData = jsPsych.data.get().filter({ Phase: "retrieval_recognition", Id: item.id }).values()[0];
          return !!(lastTrialData && lastTrialData.Recognition_response === 'f');
        }
      };

      // ブロック条件に応じたソース記憶課題の展開インジェクト
      if (blockType === "color") {
        sourceConditionalNode.timeline.push(colorSourceTrial);
      } else if (blockType === "position") {
        sourceConditionalNode.timeline.push(posSourceTrial);
      } else if (blockType === "both") {
        // Both条件時は色と場所の設問順序を完全ランダム化
        const order = localShuffle([colorSourceTrial, posSourceTrial]);
        sourceConditionalNode.timeline.push(order[0], order[1]);
      }

      // 固定インターバルブランク
      const postTrialBlank = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '', choices: "NO_KEYS", trial_duration: 1000
      };

      trials.push(sourceConditionalNode);
      trials.push(postTrialBlank);
    });

    return trials;
  }

  // 3. 時系列順序記憶課題のビルド構造
  function buildOrderTimeline(jsPsych, finalOrderPool, blockType, isPractice = false) {
    const trials = [];

    finalOrderPool.forEach((pair, idx) => {
      // 左右の提示位置を50%の確率でカウンターバランス
      const isLeftFirst = Math.random() < 0.5;
      const leftItem = isLeftFirst ? pair.first : pair.second;
      const rightItem = isLeftFirst ? pair.second : pair.first;

      trials.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: () => makePairHTML(leftItem.src, rightItem.src) + `
          <p style="margin-top:30px;">提示された2枚の画像のうち、どちらが<strong>「先」</strong>に表示されていましたか？</p>
          <p style="font-weight:bold; font-size:24px;">F：左の画像が先 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; J：右の画像が先</p>
        `,
        choices: ['f', 'j'],
        data: {
          Task: "retrieval",
          Phase: "retrieval_order",
          Block_type: blockType,
          Pair_type: pair.type, // "within" or "across"
          Trial_index_in_task: idx + 1,
          Left_id: leftItem.id,
          Right_id: rightItem.id,
          Left_item: leftItem.src,
          Right_item: rightItem.src,
          Earlier_id: pair.first.id,
          Later_id: pair.second.id,
          Correct_side: isLeftFirst ? "left" : "right",
          Is_practice: isPractice,
          Id: null, Test_type: null, Frame_color: null, Position_index: null
        },
        on_finish: function(d) {
          d.Order_response = d.response;
          d.Order_RT = d.rt;
          if (d.response !== null) {
            const respondedSide = (d.response === 'f') ? "left" : "right";
            d.Correctness = (respondedSide === d.Correct_side) ? 1 : 0;
          } else {
            d.Correctness = null;
          }
        }
      });

      // 試行間インターバル
      trials.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '', choices: "NO_KEYS", trial_duration: 1000
      });
    });

    return trials;
  }

  // ==========================================
  // 練習ブロックのトータルパッケージ生成
  // ==========================================
  function buildPracticeBlock(jsPsych, practiceList, config) {
    const tl = [];
    
    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="inst-wrap"><h2>練習課題の開始</h2><p>これより練習課題（計12試行）を行います。可食判断のF/Jキーへの反応速度に慣れてください。</p></div>',
      choices: ['練習を開始する'],
      on_load: () => ExpUtils.showCursor(),
      // 【バグ防止セーフティ】全画面が不意に外れていたら、ボタン押下時に自動で再要求して戻す
      on_finish: function() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const target = document.documentElement;
          if (target.requestFullscreen) target.requestFullscreen();
        }
      }
    });

    // 記銘練習の注入
    tl.push(...buildEncodingTrials(jsPsych, practiceList, config, true));

    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="inst-wrap"><h2>練習テストフェーズの開始</h2><p>続いて記憶テストの練習を行います。画面の指示に従ってキー入力してください。</p></div>',
      choices: ['テスト練習を開始する'],
      on_load: () => ExpUtils.showCursor()
    });

    // --- 練習想起刺激の厳密なサンプリング抽出 ---
    // 再認・ソース練習：2試行
    const practicePool = localShuffle([...practiceList]).slice(0, 2).map(x => ({ ...x, test_type: "within" }));
    
    // 順序練習：指定の「2枚目と6枚目」「5枚目と9枚目」の2試行
    const pSorted = [...practiceList].sort((a, b) => a.encoding_index - b.encoding_index);
    const practiceOrderPool = [
      { type: "within", first: pSorted[1], second: pSorted[5] }, // 2枚目(idx 1) と 6枚目(idx 5)
      { type: "across", first: pSorted[4], second: pSorted[8] }  // 5枚目(idx 4) と 9枚目(idx 8)
    ];

    tl.push(...buildRecognitionAndSource(jsPsych, practicePool, "both", config, true));
    tl.push(...buildOrderTimeline(jsPsych, practiceOrderPool, "both", true));

    return tl;
  }

  // ==========================================
  // 本番セットブロックのパッケージ生成
  // ==========================================
  function buildMainBlock(jsPsych, blockList, blockType, setIndex, config) {
    const tl = [];

    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="inst-wrap">
          <h2>本番第 ${setIndex} / 3 セット</h2>
          <p>準備ができたら開始ボタンを押してください。可食判断（ステップ1）から始まります。</p>
          <p style="color:#e74c3c; font-weight:bold;">※開始するとマウスカーソルは自動で非表示になります。</p>
        </div>
      `,
      choices: ['このセットを開始する'],
      on_load: () => {
        ExpUtils.showCursor();
        ExpUtils.setupFullscreenMonitoring(); // 離脱監視の有効化
      },
      // 【バグ防止セーフティ】全画面が不意に外れていたらボタン押下時に自動で再要求して戻す
      on_finish: function() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const target = document.documentElement;
          if (target.requestFullscreen) target.requestFullscreen();
        }
      }
    });

    // 1. 本番記銘フェーズ (ルアーは内部で自動除外される)
    tl.push(...buildEncodingTrials(jsPsych, blockList, config, false));

    // 2 & 3. 本番再認・ソース記憶フェーズの構築
    // 境界直後(1枚目)から4枚、境界内4枚目から4枚、ルアーから4枚を厳密サンプリング
    const oldItems = blockList.filter(x => !x.is_lure);
    const lures = blockList.filter(x => x.is_lure);

    const boundaryItems = localShuffle(oldItems.filter(x => x.order_in_context === 1)).slice(0, 4);
    const withinItems = localShuffle(oldItems.filter(x => x.order_in_context === 4)).slice(0, 4);
    const chosenLures = localShuffle(lures).slice(0, 4);

    const mainTestPool = localShuffle([
      ...boundaryItems.map(x => ({ ...x, test_type: "boundary" })),
      ...withinItems.map(x => ({ ...x, test_type: "within" })),
      ...chosenLures.map(x => ({ ...x, test_type: "lure" }))
    ]);

    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="inst-wrap"><h2>記憶テスト（再認・背景属性）</h2><p>画像が表示されていたかの判断と、その属性に関する回答タスクです。</p><p style="text-align:center; font-weight:bold; color:blue;">【F】キーを押すとテスト画面が始まります。</p></div>',
      choices: ['f'],
      on_load: () => ExpUtils.showCursor()
    });
    tl.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: "NO_KEYS", trial_duration: 1000 });
    
    // ビルドした配列を展開注入
    tl.push(...buildRecognitionAndSource(jsPsych, mainTestPool, blockType, config, false));

    // 4. 本番時系列順序記憶フェーズの構築
    const oldItemsSorted = [...oldItems].sort((a, b) => a.encoding_index - b.encoding_index);
    const blocks = [];
    for (let i = 0; i < oldItemsSorted.length; i += 6) {
      blocks.push(oldItemsSorted.slice(i, i + 6));
    }

    const withinPairs = [];
    const acrossPairs = [];

    blocks.forEach((block, idx) => {
      if (block.length < 6) return;
      // Within: 各文脈の2枚目(idx:1) と 6枚目(idx:5)
      withinPairs.push({ type: "within", first: block[1], second: block[5] });

      // Across: n番目の5枚目(idx:4) と n+1番目の3枚目(idx:2)
      const nextBlock = blocks[idx + 1];
      if (nextBlock && nextBlock.length >= 3) {
        acrossPairs.push({ type: "across", first: block[4], second: nextBlock[2] });
      }
    });

    const selectedWithin = localShuffle(withinPairs).slice(0, 4);
    const selectedAcross = localShuffle(acrossPairs).slice(0, 4);
    const mainOrderPool = localShuffle([...selectedWithin, ...selectedAcross]);

    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="inst-wrap"><h2>記憶テスト（時系列順序判断）</h2><p>同時に表示される2枚の画像のうち、どちらが先に提示されていたかを回答するタスクです。</p><p style="text-align:center; font-weight:bold; color:blue;">【F】キーを押すとテスト画面が始まります。</p></div>',
      choices: ['f']
    });
    tl.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: "NO_KEYS", trial_duration: 1000 });
    
    // ビルドした配列を展開注入
    tl.push(...buildOrderTimeline(jsPsych, mainOrderPool, blockType, false));

    // 5. 休憩（3セット目の後は不要なため条件分岐処理）
    if (setIndex < 3) {
      tl.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div class="inst-wrap">
            <h2>休憩（セット終了）</h2>
            <p>お疲れ様でした。これで本番の第 ${setIndex} セットが終了です。</p>
            <p>十分に休憩をとって、次のセットの準備が整いましたら【次へ進む】を押してください。</p>
          </div>
        `,
        choices: ['次へ進む'],
        on_load: () => ExpUtils.showCursor()
      });
    }

    return tl;
  }

  return { buildPracticeBlock, buildMainBlock };
})();
