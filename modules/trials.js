window.BuildTrials = (() => {
  
  // 順序課題用の左右画像HTML生成
  function makePairHTML(leftSrc, rightSrc) {
    return `
      <div style="display:flex; justify-content:center; gap:80px; align-items:center; margin-top:40px;">
        <div style="border:1px solid #ccc; padding:10px; background:white;">
          <img src="${leftSrc}" width="200" height="200" style="object-fit:contain;">
        </div>
        <div style="border:1px solid #ccc; padding:10px; background:white;">
          <img src="${rightSrc}" width="200" height="200" style="object-fit:contain;">
        </div>
      </div>
    `;
  }

  // 1. 記銘試行 (Encoding) の動的構築
  function buildEncodingTrials(jsPsych, list, config) {
    return list.flatMap((item, idx) => {
      return [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: '<div class="fixation">+</div>',
          choices: "NO_KEYS",
          trial_duration: 500,
          on_start: () => { if (idx === 0) ExpUtils.hideCursor(); }
        },
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: '',
          choices: "NO_KEYS",
          trial_duration: 2000
        },
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: () => ExpUtils.makeFramedImageHTMLWithPos(item.src, item.frame_color, item.position_index, config),
          choices: ['f', 'j'],
          response_ends_trial: false, // 5秒固定制御（2.5s提示＋未入力タイムアウト込み）
          trial_duration: 2500,
          data: {
            task: "encoding",
            id: item.id,
            item_name: item.src,
            eatable: item.eatable,
            block_type: item.block_type,
            context_order: item.context_order,
            order_in_context: item.order_in_context,
            frame_color: item.frame_color,
            position_index: item.position_index,
            encoding_index: item.encoding_index
          },
          on_finish: function(data) {
            data.encoding_response = data.response;
            data.encoding_RT = data.rt;
            data.timeout = (data.response === null);
            if (!data.timeout) {
              const isF = (data.response === 'f');
              data.correctness = (isF === data.eatable) ? 1 : 0;
            } else {
              data.correctness = null;
            }
          }
        }
      ];
    });
  }

  // 2. 再認 ＆ ソースメモリー課題の動的タイムライン生成
  function buildRecognitionAndSource(jsPsych, blockList, blockType, config) {
    const subsetTimeline = {
      timeline: [],
      on_start: function() {
        // 実験進行中に呼び出され、この時点の最新の物理提示リストから安全にテスト刺激を選定
        if (subsetTimeline.timeline.length > 0) return; // 重複生成防止

        const oldItems = blockList.filter(x => !x.is_lure);
        const lures = blockList.filter(x => x.is_lure);

        // ターゲット選定 (仕様：境界直後[1番目]から4枚、文脈内4枚目から4枚)
        const boundaryItems = jsPsych.randomization.shuffle(oldItems.filter(x => x.order_in_context === 1)).slice(0, 4);
        const withinItems = jsPsych.randomization.shuffle(oldItems.filter(x => x.order_in_context === 4)).slice(0, 4);
        const chosenLures = jsPsych.randomization.shuffle(lures).slice(0, 4);

        // 全全選択刺激のシャッフル
        const testPool = jsPsych.randomization.shuffle([
          ...boundaryItems.map(x => ({ ...x, test_type: "boundary" })),
          ...withinItems.map(x => ({ ...x, test_type: "within" })),
          ...chosenLures.map(x => ({ ...x, test_type: "lure" }))
        ]);

        // 各テスト刺激の試行ノードを動的インジェクト
        testPool.forEach(item => {
          
          // 再認試行ノード
          const recognitionTrial = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
              <div style="border:1px solid #ccc; padding:10px; width:200px; height:200px; margin:0 auto; background:white;">
                <img src="${item.src}" style="width:200px; height:200px; object-fit:contain;" />
              </div>
              <p style="margin-top:40px;">この画像は、このセットの中に提示されていましたか？</p>
              <p style="font-weight:bold;">F：表示されていた (Old) &nbsp;&nbsp;&nbsp;&nbsp; J：表示されていなかった (New)</p>
            `,
            choices: ['f', 'j'],
            data: {
              task: "recognition",
              block_type: blockType,
              test_type: item.test_type,
              id: item.id,
              src: item.src,
              true_color: item.frame_color,
              true_position: item.position_index
            },
            on_finish: function(d) {
              d.recognition_response = d.response;
              d.is_old_response = (d.response === 'f');
            }
          };
          
          // 条件付きソースメモリーノード構造
          const sourceConditionalNode = {
            timeline: [],
            conditional_function: function() {
              // 直前の再認で Old（Fキー）と答えた場合のみ実行
              const lastTrialData = jsPsych.data.get().last(1).values()[0];
              return !!(lastTrialData && lastTrialData.is_old_response);
            }
          };

          // 属性選択肢構築ロジック（誤認候補の選定）
          let colorChoices = [];
          let posChoices = [];
          const allColors = config.colors.filter(c => c !== 'black');
          const allPositions = config.positions;

          if (item.test_type !== "lure") {
            // Old画像：1つ前の文脈属性を誤認候補にする
            const currentContext = item.context_order; // 1~6
            const prevContext = (currentContext === 1) ? 6 : currentContext - 1;

            // 当該ブロック全体の文脈構造マップから前文脈の正解を逆引き
            const prevContextItem = oldItems.find(x => x.context_order === prevContext);
            
            colorChoices = [item.frame_color, prevContextItem ? prevContextItem.frame_color : allColors[0]];
            posChoices = [item.position_index, prevContextItem ? prevContextItem.position_index : allPositions[0]];
          } else {
            // Lure画像：ランダムに2つの文脈を抽出しその属性を選択肢にする
            const randContexts = jsPsych.randomization.shuffle([1, 2, 3, 4, 5, 6]).slice(0, 2);
            const item1 = oldItems.find(x => x.context_order === randContexts[0]);
            const item2 = oldItems.find(x => x.context_order === randContexts[1]);

            colorChoices = [item1.frame_color, item2.frame_color];
            posChoices = [item1.position_index, item2.position_index];
          }

          // 重複していた場合のセーフガード
          if (colorChoices[0] === colorChoices[1]) {
            colorChoices[1] = allColors.find(c => c !== colorChoices[0]) ?? 'red';
          }
          if (posChoices[0] === posChoices[1]) {
            posChoices[1] = allPositions.find(p => p !== posChoices[0]) ?? 60;
          }

          // 各2択用シャッフル
          const finalColorOptions = jsPsych.randomization.shuffle([...new Set(colorChoices)]);
          const finalPosOptions = jsPsych.randomization.shuffle([...new Set(posChoices)]);

          // カラー設問ノード
          const colorSourceTrial = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: () => `
              <div style="border:1px solid #ccc; padding:10px; width:200px; height:200px; margin:0 auto; background:white;">
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
            data: { task: "source_color", id: item.id, opt_left: finalColorOptions[0], opt_right: finalColorOptions[1], correct: item.frame_color },
            on_finish: function(d) {
              const chosen = (d.response === 'f') ? d.opt_left : d.opt_right;
              d.chosen_color = chosen;
              d.source_color_correctness = (chosen === d.correct) ? 1 : 0;
            }
          };

          // 位置設問ノード
          const posSourceTrial = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: () => `
              <div style="border:1px solid #ccc; padding:10px; width:200px; height:200px; margin:0 auto; background:white;">
                <img src="${item.src}" style="width:200px; height:200px; object-fit:contain;" />
              </div>
              <p style="margin-top:40px;">この画像は、画面のどの<strong>「配置位置（角度）」</strong>に表示されていましたか？</p>
              <p style="font-weight:bold; font-size:24px;">F：左選択肢 [ ${finalPosOptions[0]}° ] &nbsp;&nbsp;&nbsp;&nbsp; J：右選択肢 [ ${finalPosOptions[1]}° ]</p>
            `,
            choices: ['f', 'j'],
            data: { task: "source_position", id: item.id, opt_left: finalPosOptions[0], opt_right: finalPosOptions[1], correct: item.position_index },
            on_finish: function(d) {
              const chosen = (d.response === 'f') ? d.opt_left : d.opt_right;
              d.chosen_position = chosen;
              d.source_pos_correctness = (chosen === d.correct) ? 1 : 0;
            }
          };

          // ブロックタイプに応じたソース設問のインジェクト構造
          if (blockType === "color") {
            sourceConditionalNode.timeline.push(colorSourceTrial);
          } else if (blockType === "position") {
            sourceConditionalNode.timeline.push(posSourceTrial);
          } else if (blockType === "both") {
            // both条件時は色と場所の設問提示順を参加者内（試行ごと）に完全ランダム化
            const order = jsPsych.randomization.shuffle([colorSourceTrial, posSourceTrial]);
            sourceConditionalNode.timeline.push(order[0], order[1]);
          }

          // 固定インタバルブランク
          const postTrialBlank = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: '', choices: "NO_KEYS", trial_duration: 1000
          };

          // メインタールタイムラインへ展開結合
          subsetTimeline.timeline.push(recognitionTrial);
          subsetTimeline.timeline.push(sourceConditionalNode);
          subsetTimeline.timeline.push(postTrialBlank);
        });
      }
    };

    return [subsetTimeline];
  }

  // 3. 時系列順序記憶課題の動的ペア生成
  function buildOrderTimeline(jsPsych, blockList, blockType) {
    const orderTimeline = {
      timeline: [],
      on_start: function() {
        if (orderTimeline.timeline.length > 0) return;

        const oldItems = [...blockList.filter(x => !x.is_lure)].sort((a, b) => a.encoding_index - b.encoding_index);
        
        // 6枚ずつのブロック2次元構造に分解
        const blocks = [];
        for (let i = 0; i < oldItems.length; i += 6) {
          blocks.push(oldItems.slice(i, i + 6));
        }

        const withinPairs = [];
        const acrossPairs = [];

        blocks.forEach((block, idx) => {
          if (block.length < 6) return;
          // Within: 各文脈の2枚目(idx:1) と 6枚目(idx:5)
          withinPairs.push({ type: "within", first: block[1], second: block[5] });

          // Across: $n$番目の5枚目(idx:4) と $n+1$番目の3枚目(idx:2)
          const nextBlock = blocks[idx + 1];
          if (nextBlock && nextBlock.length >= 3) {
            acrossPairs.push({ type: "across", first: block[4], second: nextBlock[2] });
          }
        });

        // それぞれから4試行分を上限サンプリングして結合
        const selectedWithin = jsPsych.randomization.shuffle(withinPairs).slice(0, 4);
        const selectedAcross = jsPsych.randomization.shuffle(acrossPairs).slice(0, 4);
        const finalOrderPool = jsPsych.randomization.shuffle([...selectedWithin, ...selectedAcross]);

        // タイムライン展開
        finalOrderPool.forEach((pair, idx) => {
          // 左右提示位置の50%等確率カウンターバランス
          const isLeftFirst = Math.random() < 0.5;
          const leftItem = isLeftFirst ? pair.first : pair.second;
          const rightItem = isLeftFirst ? pair.second : pair.first;

          orderTimeline.timeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: () => makePairHTML(leftItem.src, rightItem.src) + `
              <p style="margin-top:30px;">提示された2枚の画像のうち、どちらが<strong>「先」</strong>に表示されていましたか？</p>
              <p style="font-weight:bold; font-size:24px;">F：左の画像が先 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; J：右の画像が先</p>
            `,
            choices: ['f', 'j'],
            data: {
              task: "temporal_order",
              block_type: blockType,
              pair_type: pair.type,
              pair_index: idx + 1,
              left_id: leftItem.id,
              right_id: rightItem.id,
              earlier_id: pair.first.id,
              later_id: pair.second.id,
              correct_side: isLeftFirst ? "left" : "right"
            },
            on_finish: function(d) {
              const respondedSide = (d.response === 'f') ? "left" : "right";
              d.correctness = (respondedSide === d.correct_side) ? 1 : 0;
            }
          });

          // 試行間インタバル
          orderTimeline.timeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: '', choices: "NO_KEYS", trial_duration: 1000
          });
        });
      }
    };

    return [orderTimeline];
  }

  // 練習ブロックのトータルパッケージ生成
  function buildPracticeBlock(jsPsych, practiceList, config) {
    const tl = [];
    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="inst-wrap"><h2>練習課題の開始</h2><p>これより練習課題（計12試行）を行います。可食判断のF/Jキーへの反応速度に慣れてください。</p></div>',
      choices: ['練習を開始する'],
      on_load: () => ExpUtils.showCursor()
    });

    tl.push(...buildEncodingTrials(jsPsych, practiceList, config));

    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="inst-wrap"><h2>練習テストフェーズの開始</h2><p>続いて記憶テストの練習を行います。画面の指示に従ってキー入力してください。</p></div>',
      choices: ['テスト練習を開始する'],
      on_load: () => ExpUtils.showCursor()
    });

    tl.push(...buildRecognitionAndSource(jsPsych, practiceList, "both", config));
    tl.push(...buildOrderTimeline(jsPsych, practiceList, "both"));

    return tl;
  }

  // 本番セットブロックのパッケージ生成
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
      }
    });

    // 1. 記銘フェーズ
    tl.push(...buildEncodingTrials(jsPsych, blockList, config));

    // 2 & 3. 再認＆ソースメモリーフェーズ説明
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="inst-wrap"><h2>記憶テスト（再認・環境属性）</h2><p>画像が表示されていたかの判断と、その属性に関する回答タスクです。</p><p style="text-align:center; font-weight:bold; color:blue;">【F】キーを押すとテスト画面が始まります。</p></div>',
      choices: ['f'],
      on_load: () => ExpUtils.showCursor()
    });
    tl.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: "NO_KEYS", trial_duration: 1000 });
    tl.push(...buildRecognitionAndSource(jsPsych, blockList, blockType, config));

    // 4. 時系列記憶フェーズ説明
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div class="inst-wrap"><h2>記憶テスト（時系列順序判断）</h2><p>同時に表示される2枚の画像のうち、どちらが先に提示されていたかを回答するタスクです。</p><p style="text-align:center; font-weight:bold; color:blue;">【F】キーを押すとテスト画面が始まります。</p></div>',
      choices: ['f']
    });
    tl.push({ type: jsPsychHtmlKeyboardResponse, stimulus: '', choices: "NO_KEYS", trial_duration: 1000 });
    tl.push(...buildOrderTimeline(jsPsych, blockList, blockType));

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
