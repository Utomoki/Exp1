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

  // ソースメモリー課題：Color用の選択肢HTML生成
  function makeMiniColorHTML(src, colorHex) {
    return `
      <div style="width: 160px; height: 160px; border: 10px solid ${colorHex}; background: white; margin: 0 auto 15px auto; display: flex; justify-content: center; align-items: center; box-sizing: border-box;">
        <img src="${src}" style="width: 100px; height: 100px; object-fit: contain;" />
      </div>
    `;
  }

  // ソースメモリー課題：Position用の統合HTML生成（1つの画面内に2箇所提示 ＋ 黒枠 ＋ 中央十字）
  function makeCombinedPositionHTML(src, posF, posJ, config) {
    const getTransform = (posIndex) => {
      let dx = 0, dy = 0;
      if (config && config.position_map) {
        const entry = config.position_map[String(posIndex)];
        if (entry && entry.type !== 'center') {
          const a = entry.polar.angle_deg * Math.PI / 180;
          const r = (entry.polar.radius_px || 250) * 0.6; 
          dx = Math.round(Math.cos(a) * r);
          dy = Math.round(Math.sin(a) * r);
        }
      }
      return { dx, dy };
    };

    const tf = getTransform(posF);
    const tj = getTransform(posJ);

    return `
      <div style="width: 600px; height: 450px; border: 3px solid #000; background: white; margin: 0 auto; position: relative; overflow: hidden; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 2px; background: #aaa;"></div>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 2px; height: 20px; background: #aaa;"></div>

        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) translate(${tf.dx}px, ${tf.dy}px); display: flex; flex-direction: column; align-items: center;">
          <img src="${src}" style="width: 80px; height: 80px; object-fit: contain; display: block; border: 2px solid #000; background: white; box-sizing: border-box;" />
          <span style="font-weight: bold; font-size: 24px; margin-top: 5px; color: #333; background: rgba(255,255,255,0.8); padding: 0 8px; border-radius: 4px;">F</span>
        </div>

        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) translate(${tj.dx}px, ${tj.dy}px); display: flex; flex-direction: column; align-items: center;">
          <img src="${src}" style="width: 80px; height: 80px; object-fit: contain; display: block; border: 2px solid #000; background: white; box-sizing: border-box;" />
          <span style="font-weight: bold; font-size: 24px; margin-top: 5px; color: #333; background: rgba(255,255,255,0.8); padding: 0 8px; border-radius: 4px;">J</span>
        </div>

      </div>
    `;
  }

  // 1. 記銘試行 (Encoding) の動的構築
  function buildEncodingTrials(jsPsych, list, config, isPractice = false) {
    const encodingTimeline = [];
    const encodingList = list.filter(x => !x.is_lure);

    encodingList.forEach((item, idx) => {
      // 注視点（解析対象外: 0）
      encodingTimeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div class="fixation">+</div>',
        choices: "NO_KEYS",
        trial_duration: 500,
        data: { Is_analytic_trial: 0 },
        on_start: () => { 
          if (idx === 0) ExpUtils.hideCursor(); 
        }
      });

      // ブランク（解析対象外: 0）
      encodingTimeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '',
        choices: "NO_KEYS",
        trial_duration: 2000,
        data: { Is_analytic_trial: 0 }
      });

      // 刺激提示・可食判断ノード（【JASP最適化】解析対象フラグ: 1）
      encodingTimeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: () => ExpUtils.makeFramedImageHTMLWithPos(item.src, item.frame_color, item.position_index, config),
        choices: ['f', 'j'],
        response_ends_trial: false, 
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
          Test_type: null,
          Is_analytic_trial: isPractice ? 0 : 1 // 【JASP最適化】本番の反応行のみ1
        },
        on_finish: function(data) {
          data.Encoding_response = data.response;
          data.Encoding_RT = data.rt;
          
          if (data.response !== null) {
            const isF = (data.response === 'f');
            data.Correctness = (isF === item.eatable) ? 1 : 0;
          } else {
            data.Correctness = null; // 【JASP最適化】空欄＝欠損値
            data.Encoding_RT = null;
          }
          data.Encoding_correctness = data.Correctness;
        }
      });
    });

    return encodingTimeline;
  }

  // 2. 再認 ＆ ソースメモリー課題のビルド構造
  function buildRecognitionAndSource(jsPsych, testPool, blockType, config, isPractice = false) {
    const trials = [];

    testPool.forEach((item, idx) => {
      // 再認試行ノード（【JASP最適化】解析対象フラグ: 1）
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
          Test_type: item.test_type, 
          Is_practice: isPractice,
          Pair_type: null,
          Is_analytic_trial: isPractice ? 0 : 1 // 【JASP最適化】
        },
        on_finish: function(d) {
          d.Recognition_response = d.response;
          if (d.response !== null) {
            const isOldResponse = (d.response === 'f');
            const isTrueOld = (d.Test_type !== "lure");
            d.Correctness = (isOldResponse === isTrueOld) ? 1 : 0;
          } else {
            d.Correctness = null; // 【JASP最適化】
          }
        }
      };
      trials.push(recognitionTrial);

      let colorChoices = [];
      let posChoices = [];

      if (item.test_type !== "lure") {
        colorChoices = [item.frame_color, item.wrong_color];
        posChoices = [item.position_index, item.wrong_position];
      } else {
        const allColors = config.colors.filter(c => c !== 'black');
        const allPositions = config.positions;
        
        const randColor1 = allColors[Math.floor(Math.random() * allColors.length)];
        let randColor2 = allColors[Math.floor(Math.random() * allColors.length)];
        while (randColor1 === randColor2) randColor2 = allColors[Math.floor(Math.random() * allColors.length)];
        
        const randPos1 = allPositions[Math.floor(Math.random() * allPositions.length)];
        let randPos2 = allPositions[Math.floor(Math.random() * allPositions.length)];
        while (randPos1 === randPos2) randPos2 = allPositions[Math.floor(Math.random() * allPositions.length)];

        colorChoices = [randColor1, randColor2];
        posChoices = [randPos1, randPos2];
      }

      // 【修正】ExpUtils.shuffle へ一元化
      const finalColorOptions = ExpUtils.shuffle([...new Set(colorChoices)]);
      const finalPosOptions = ExpUtils.shuffle([...new Set(posChoices)]);

      const color0_hex = config.color_map[finalColorOptions[0]] ?? finalColorOptions[0];
      const color1_hex = config.color_map[finalColorOptions[1]] ?? finalColorOptions[1];

      // カラーソース設問ノード（【JASP最適化】解析対象フラグ: 1）
      const colorSourceTrial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <p style="font-size: 24px; margin-bottom: 40px;">この画像は、どの<strong>「枠の色」</strong>で表示されていましたか？</p>
          <div style="display:flex; justify-content:center; gap:80px; align-items:flex-end;">
            <div style="text-align:center;">
              ${makeMiniColorHTML(item.src, color0_hex)}
              <span style="font-weight:bold; font-size:24px;">F</span>
            </div>
            <div style="text-align:center;">
              ${makeMiniColorHTML(item.src, color1_hex)}
              <span style="font-weight:bold; font-size:24px;">J</span>
            </div>
          </div>
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
          Pair_type: null,
          Is_analytic_trial: isPractice ? 0 : 1 // 【JASP最適化】
        },
        on_finish: function(d) {
          d.Source_response = d.response;
          if (d.response !== null) {
            const chosen = (d.response === 'f') ? d.Opt_left : d.Opt_right;
            d.Correctness = (item.test_type !== "lure" && chosen === d.Correct_value) ? 1 : 0;
          } else {
            d.Correctness = null; // 【JASP最適化】
          }
        }
      };

      // 位置ソース設問ノード（【JASP最適化】解析対象フラグ: 1）
      const posSourceTrial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          ${makeCombinedPositionHTML(item.src, finalPosOptions[0], finalPosOptions[1], config)}
          <p style="font-size: 24px; margin-top: 40px;">この画像は、画面のどの<strong>「配置位置」</strong>に表示されていましたか？</p>
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
          Pair_type: null,
          Is_analytic_trial: isPractice ? 0 : 1 // 【JASP最適化】
        },
        on_finish: function(d) {
          d.Source_response = d.response;
          if (d.response !== null) {
            const chosen = (d.response === 'f') ? d.Opt_left : d.Opt_right;
            d.Correctness = (item.test_type !== "lure" && chosen === d.Correct_value) ? 1 : 0;
          } else {
            d.Correctness = null; // 【JASP最適化】
          }
        }
      };

      const sourceConditionalNode = {
        timeline: [],
        conditional_function: function() {
          const lastTrialData = jsPsych.data.get().filter({ Phase: "retrieval_recognition", Id: item.id }).values()[0];
          return !!(lastTrialData && lastTrialData.Recognition_response === 'f');
        }
      };

      if (blockType === "color") {
        sourceConditionalNode.timeline.push(colorSourceTrial);
      } else if (blockType === "position") {
        sourceConditionalNode.timeline.push(posSourceTrial);
      } else if (blockType === "both") {
        // 【修正】ExpUtils.shuffle へ一元化
        const order = ExpUtils.shuffle([colorSourceTrial, posSourceTrial]);
        sourceConditionalNode.timeline.push(order[0], order[1]);
      }

      // 固定インターバル（解析対象外: 0）
      const postTrialBlank = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '', choices: "NO_KEYS", trial_duration: 1000,
        data: { Is_analytic_trial: 0 }
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
      const isLeftFirst = Math.random() < 0.5;
      const leftItem = isLeftFirst ? pair.first : pair.second;
      const rightItem = isLeftFirst ? pair.second : pair.first;

      // 順序判断試行ノード（【JASP最適化】解析対象フラグ: 1）
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
          Pair_type: pair.type, 
          Trial_index_in_task: idx + 1,
          Left_id: leftItem.id,
          Right_id: rightItem.id,
          Left_item: leftItem.src,
          Right_item: rightItem.src,
          Earlier_id: pair.first.id,
          Later_id: pair.second.id,
          Correct_side: isLeftFirst ? "left" : "right",
          Is_practice: isPractice,
          Id: null, Test_type: null, Frame_color: null, Position_index: null,
          Is_analytic_trial: isPractice ? 0 : 1 // 【JASP最適化】
        },
        on_finish: function(d) {
          d.Order_response = d.response;
          d.Order_RT = d.rt;
          if (d.response !== null) {
            const respondedSide = (d.response === 'f') ? "left" : "right";
            d.Correctness = (respondedSide === d.Correct_side) ? 1 : 0;
          } else {
            d.Correctness = null; // 【JASP最適化】
            d.Order_RT = null;
          }
        }
      });

      // 試行間インターバル（解析対象外: 0）
      trials.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '', choices: "NO_KEYS", trial_duration: 1000,
        data: { Is_analytic_trial: 0 }
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
      data: { Is_analytic_trial: 0 },
      on_load: () => ExpUtils.showCursor(),
      on_finish: function() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const target = document.documentElement;
          if (target.requestFullscreen) target.requestFullscreen();
        }
      }
    });

    tl.push(...buildEncodingTrials(jsPsych, practiceList, config, true));

    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="inst-wrap"><h2>練習テストフェーズの開始</h2><p>続いて記憶テストの練習を行います。画面の指示に従ってキー入力してください。</p></div>',
      choices: ['テスト練習を開始する'],
      data: { Is_analytic_trial: 0 },
      on_load: () => ExpUtils.showCursor()
    });

    const pSorted = [...practiceList].sort((a, b) => a.encoding_index - b.encoding_index);

    const practiceSourcePool = [
      { ...pSorted[6], test_type: "within", wrong_color: pSorted[5].frame_color, wrong_position: pSorted[5].position_index },
      { ...pSorted[8], test_type: "within", wrong_color: pSorted[7].frame_color, wrong_position: pSorted[7].position_index }
    ];
    
    const practiceOrderPool = [
      { type: "within", first: pSorted[1], second: pSorted[5] }, 
      { type: "across", first: pSorted[4], second: pSorted[8] }  
    ];

    tl.push(...buildRecognitionAndSource(jsPsych, practiceSourcePool, "both", config, true));
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
      data: { Is_analytic_trial: 0 },
      on_load: () => {
        ExpUtils.showCursor();
        ExpUtils.setupFullscreenMonitoring(); 
      },
      on_finish: function() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const target = document.documentElement;
          if (target.requestFullscreen) target.requestFullscreen();
        }
      }
    });

    tl.push(...buildEncodingTrials(jsPsych, blockList, config, false));

    const oldItems = blockList.filter(x => !x.is_lure);
    const lures = blockList.filter(x => x.is_lure);

    // 【修正】ExpUtils.shuffle へ一元化
    const boundaryItems = ExpUtils.shuffle(oldItems.filter(x => x.context_order > 1 && x.order_in_context === 1)).slice(0, 4);
    const withinItems = ExpUtils.shuffle(oldItems.filter(x => x.context_order > 1 && x.order_in_context === 4)).slice(0, 4);
    const chosenLures = ExpUtils.shuffle(lures).slice(0, 4);

    const addWrongBg = (item) => {
      const prevContext = item.context_order - 1;
      const prevItem = oldItems.find(x => x.context_order === prevContext);
      return { ...item, wrong_color: prevItem.frame_color, wrong_position: prevItem.position_index };
    };

    // 【修正】ExpUtils.shuffle へ一元化
    const mainTestPool = ExpUtils.shuffle([
      ...boundaryItems.map(x => ({ ...addWrongBg(x), test_type: "boundary" })),
      ...withinItems.map(x => ({ ...addWrongBg(x), test_type: "within" })),
      ...chosenLures.map(x => ({ ...x, test_type: "lure" }))
    ]);

    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="inst-wrap"><h2>記憶テスト（再認・背景属性）</h2><p>画像が表示されていたかの判断と、その属性に関する回答タスクです。</p><p style="text-align:center; font-weight:bold; color:blue;">【F】キーを押すとテスト画面が始まります。</p></div>',
      choices: ['f'],
      data: { Is_analytic_trial: 0 },
      on_load: () => ExpUtils.showCursor()
    });
    tl.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: "NO_KEYS", trial_duration: 1000, data: { Is_analytic_trial: 0 } });
    
    tl.push(...buildRecognitionAndSource(jsPsych, mainTestPool, blockType, config, false));

    const oldItemsSorted = [...oldItems].sort((a, b) => a.encoding_index - b.encoding_index);
    const blocks = [];
    for (let i = 0; i < oldItemsSorted.length; i += 6) {
      blocks.push(oldItemsSorted.slice(i, i + 6));
    }

    const withinPairs = [];
    const acrossPairs = [];

    blocks.forEach((block, idx) => {
      if (block.length < 6) return;
      withinPairs.push({ type: "within", first: block[1], second: block[5] });

      const nextBlock = blocks[idx + 1];
      if (nextBlock && nextBlock.length >= 3) {
        acrossPairs.push({ type: "across", first: block[4], second: nextBlock[2] });
      }
    });

    // 【修正】ExpUtils.shuffle へ一元化
    const selectedWithin = ExpUtils.shuffle(withinPairs).slice(0, 4);
    const selectedAcross = ExpUtils.shuffle(acrossPairs).slice(0, 4);
    const mainOrderPool = ExpUtils.shuffle([...selectedWithin, ...selectedAcross]);

    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="inst-wrap"><h2>記憶テスト（時系列順序判断）</h2><p>同時に表示される2枚 of 画像のうち、どちらが先に提示されていたかを回答するタスクです。</p><p style="text-align:center; font-weight:bold; color:blue;">【F】キーを押すとテスト画面が始まります。</p></div>',
      choices: ['f'],
      data: { Is_analytic_trial: 0 }
    });
    tl.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: "NO_KEYS", trial_duration: 1000, data: { Is_analytic_trial: 0 } });
    
    tl.push(...buildOrderTimeline(jsPsych, mainOrderPool, blockType, false));

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
        data: { Is_analytic_trial: 0 },
        on_load: () => ExpUtils.showCursor()
      });
    }

    return tl;
  }

  return { buildPracticeBlock, buildMainBlock };
})();
