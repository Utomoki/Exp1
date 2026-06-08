// window.BuildTrials に公開
window.BuildTrials = (() => {

  // 想起課題の画像ペアHTMLを作る（左右ランダム）
  function makePairHTML(leftSrc, rightSrc) {
    return `
      <div style="display:flex; justify-content:center; gap:60px; align-items:center; margin-bottom:24px;">
        <img src="${leftSrc}" width="200" height="200">
        <img src="${rightSrc}" width="200" height="200">
      </div>
    `;
  }

  // 想起課題の Within/Across 4ペアずつ生成
  function buildPairs(jsPsych, list) {
    const blockSize = 6;

    // encoding_index 順にソート
    const sorted = [...list].sort(
      (a, b) => a.encoding_index - b.encoding_index
    );

    // 6枚ずつブロックに分割
    const blocks = [];
    for (let i = 0; i < sorted.length; i += blockSize) {
      blocks.push(sorted.slice(i, i + blockSize));
    }

    const within = [];
    const across = [];

    blocks.forEach((block, idx) => {
      if (block.length < blockSize) return;

      // Within：2枚目 & 6枚目
      const a = block[1]; // index 1 = 2枚目
      const b = block[5]; // index 5 = 6枚目
      if (a && b) {
        within.push({ type: "within", first: a, second: b });
      }

      // Across：5枚目 & 次ブロック3枚目
      const nextBlock = blocks[idx + 1];
      if (nextBlock && nextBlock.length >= 3) {
        const c1 = block[4];      // 5枚目
        const c2 = nextBlock[2];  // 次ブロック3枚目
        if (c1 && c2) {
          across.push({ type: "across", first: c1, second: c2 });
        }
      }
    });

    const selectedWithin = jsPsych.randomization.shuffle(within).slice(0, 4);
    const selectedAcross = jsPsych.randomization.shuffle(across).slice(0, 4);

    return jsPsych.randomization.shuffle([
      ...selectedWithin,
      ...selectedAcross
    ]);
  }

  // Retrieval 試行セット（1ペア分）
  function buildRetrievalTrials(jsPsych, pair, idx, pairDuration) {
    const LR = jsPsych.randomization.shuffle([pair.first, pair.second]);
    const left = LR[0];
    const right = LR[1];
    const html = makePairHTML(left.src, right.src);

    const tl = [];

    // 時間距離印象
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        ${html}
        <p style="margin-top: 100px;">
          2枚の画像が出てきたタイミングはどれくらい離れていましたか。<br>
          感じられた時間間隔の長さを選んでください。<br>
          <br>
          F：とても短い　G：やや短い　H：やや長い　J：とても長い
        </p>
      `,
      choices: ['f', 'g', 'h', 'j'],
      response_ends_trial: true,
      data: {
        task: "retrieval",
        phase: "retrieval_interval",
        pair_index: idx + 1,
        pair_type: pair.type,
        first_encoding_index: pair.first.encoding_index,
        second_encoding_index: pair.second.encoding_index,
        left_id: left.id,
        right_id: right.id,
        left_item_name: left.src,
        right_item_name: right.src,
        timestamp: Date.now()
      },
      on_finish: (d) => {
        d.distance_response = d.response;
        d.distance_RT = d.rt;
      }
    });

    // ブランク 0.5秒
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div style="height:40px;"></div>',
      choices: "NO_KEYS",
      trial_duration: 500
    });

    // 時系列判断
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        ${html}
        <p style="margin-top: 100px;">
          2枚の画像のうち、どちらが<strong>先</strong>に出てきましたか？<br>
          <br>
          F：確実に左　G：おそらく左　H：おそらく右　J：確実に右
        </p>
      `,
      choices: ['f', 'g', 'h', 'j'],
      response_ends_trial: true,
      data: {
        task: "retrieval",
        phase: "retrieval_order",
        pair_index: idx + 1,
        pair_type: pair.type,
        left_id: left.id,
        right_id: right.id,
        earlier_id:
          (pair.first.encoding_index < pair.second.encoding_index)
            ? pair.first.id
            : pair.second.id,
        left_item_name: left.src,
        right_item_name: right.src,
        timestamp: Date.now()
      },
      on_finish: (d) => {
        d.order_response = d.response;
        d.order_RT = d.rt;
        d.correct_side = (d.earlier_id === d.left_id) ? "left" : "right";
        d.correctness = (
          (d.response === 'f' || d.response === 'g') && d.correct_side === "left"
        )||(
          (d.response === 'h' || d.response === 'j') && d.correct_side === "right"
        )? 1 : 0; 
      }
    });

    // ブランク 1.0秒
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div style="height:80px;"></div>',
      choices: "NO_KEYS",
      trial_duration: 1000
    });

    return tl;
  }

  // Encoding（練習・本番共通）
  function buildEncodingTrials(jsPsych, list, {
    fixationMs = 500,
    blankMs = 2000, //2000
    imgMs = 2500   //2500
  } = {}) {

    return list.flatMap((item, idx) => {
      const html = ExpUtils.makeFramedImageHTMLWithPos(
        item.src, item.frame_color, item.position_index,
        { frameSize: 240, imageSize: 200 },
        window.__expConfig
      );

      return [
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: '<div class="fixation">+</div>',
          on_start: () => {
            if (idx === 0)ExpUtils.hideCursor();
          },
          choices: "NO_KEYS",
          trial_duration: fixationMs
        },
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: '<div style="height:80px;"></div>',
          choices: "NO_KEYS",
          trial_duration: blankMs
        },
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: html,
          choices: ['f', 'j'],
          response_ends_trial: false,
          trial_duration: imgMs,
          data: {
            task: "encoding",
            phase: "encoding",
            id: item.id,
            item_name: item.src,
            eatable: item.eatable,
            context_order: item.context_order,
            order_in_context: item.order_in_context,
            frame_color: item.frame_color,
            position_index: item.position_index,
            timestamp: Date.now()
          },
          on_finish: (d) => {
            d.encoding_response = d.response;
            d.encoding_RT = d.rt;
            d.timeout = (d.response == null);
            if (d.response != null) {
              const judgedEatable = (d.response === 'f');
              d.correctness = (judgedEatable === d.eatable) ? 1 : 0;
            } else {
              d.correctness = null;
            }
          }
        }
      ];
    });
  }

  // buildPracticeBlock
  function buildPracticeBlock(jsPsych, practiceList) {
    const tl = [];

    // 練習 Encoding-intro
    tl.push(
      ExpUtils.makeStartButton({
        title: '',
        html: `
          <div class="inst-wrap">
            <h2>練習課題</h2>
            <p>表示された画像が<strong>食べられるなら F</strong>、<strong>食べられないなら J</strong>を押してください。</p>
            <p>準備ができたら【開始】を押してください。</p>
          </div>
        `,
        label: '開始',
        data: { phase: 'practice_encoding_intro' }
      })
    );

    // 練習 Encoding
    tl.push(...buildEncodingTrials(jsPsych, practiceList));

    // 練習 Retrieval-intro
    tl.push(
      ExpUtils.makeStartButton({
        title: '',
        html: `
          <div class="inst-wrap">
            <p>判断課題が終了しました。</p>
            <p>続いて、時間情報を思い出す課題です。</p>
          </div>
        `,
        label: '開始',
        data: { phase: 'practice_retrieval_intro' }
      })
    );

    // --- Retrieval-Intro 後のブランク 1秒 ---
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div style="height:80px;"></div>',
      choices: "NO_KEYS",
      trial_duration: 1000,
      on_start: () => ExpUtils.hideCursor(),
    });

    // Retrieval pairs
    const allPairs = buildPairs(jsPsych, practiceList);
    const WithinPairs = allPairs.filter(p => p.type === "within").slice(0, 1);
    const AcrossPairs = allPairs.filter(p => p.type === "across").slice(0, 1);
    const pairs = jsPsych.randomization.shuffle([...WithinPairs, ...AcrossPairs]);
    pairs.forEach((pair, idx) => {
      tl.push(...buildRetrievalTrials(jsPsych, pair, idx, 10000));
    });
    return tl;
  }

  // buildMainBlock（本番1セット）
  function buildMainBlock(jsPsych, mainList, setIndex) {
    const tl = [];

    // Encoding intro
    tl.push(
      ExpUtils.makeStartButton({
        title: '',
        html: `
          <div class="inst-wrap">
            <p>${setIndex === 1 ? '練習は終了です。' : `${setIndex - 1}セット目終了です。`}</p>
            <p>${setIndex}セット目を始めます。少し休憩をはさんで、準備ができたら【開始】を押してください。</p>
            <p>表示された画像が<strong>食べられるなら F</strong>、<strong>食べられないなら J</strong>を押してください。</p>
          </div>
        `,
        label: '開始',
        data: { phase: `main_intro_set${setIndex}` }
      })
    );

    // Encoding
    tl.push(...buildEncodingTrials(jsPsych, mainList));

    // Retrieval intro
    tl.push(
      ExpUtils.makeStartButton({
        title: '',
        html: `
          <div class="inst-wrap">
            <p>判断課題が終了しました。</p>
            <p>続いて、画像の時間情報を思い出す課題です。</p>
          </div>
        `,
        label: '開始',
        data: { phase: 'main_retrieval_intro' }
      })
    );

    // --- Retrieval-Intro 後のブランク 1秒 ---
    tl.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div style="height:80px;"></div>',
      choices: "NO_KEYS",
      trial_duration: 1000,
      on_start: () => ExpUtils.hideCursor()
    });

    // Retrieval pairs
    const pairs = buildPairs(jsPsych, mainList);
    pairs.forEach((pair, idx) => {
      tl.push(...buildRetrievalTrials(jsPsych, pair, idx));
    });
    return tl;
  }

  return {
    buildPracticeBlock,
    buildMainBlock
  };
})();
