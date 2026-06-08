(async () => {

  function shuffle(array) {
    return array
      .map(x => ({ x, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map(e => e.x);
  }

  // CSS
  ExpUtils.injectBaseCSS();

  // jsPsych 初期化
  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: () => {

    // 実験終了時刻
    const end = new Date();
    const hh = String(end.getHours()).padStart(2,'0');
    const mm = String(end.getMinutes()).padStart(2,'0');
    const ss = String(end.getSeconds()).padStart(2,'0');
    const endTime = `${hh}${mm}${ss}`;

    // 実施日：YYYYMMDD
    const y = end.getFullYear();
    const m = String(end.getMonth()+1).padStart(2,'0');
    const d = String(end.getDate()).padStart(2,'0');
    const date8 = `${y}${m}${d}`;
    }
  });

  // config読み込み
  const config = await ExpUtils.loadConfig('./config/experiment.config.json');
  window.__expConfig = config;

  const practiceRaw = await ExpUtils.loadJsonl(config.lists.practice.file);
  const mainARaw    = await ExpUtils.loadJsonl(config.lists.mainA.file);
  const mainBRaw    = await ExpUtils.loadJsonl(config.lists.mainB.file);
  const mainCRaw    = await ExpUtils.loadJsonl(config.lists.mainC.file);

  // Practice: デコレーション
  const blockSize = config.block_size;
  
  const practiceShuffled = shuffle(practiceRaw);
  const practiceDecorated = ExpUtils.decorateByBlocks(
    practiceShuffled,
    { blockSize, colorsSeq: ['black','silver'], posSeq: [360,180] }
  );
  const practiceList = practiceDecorated.map((item, idx) => ({
    ...item,
    encoding_index: idx + 1
  }));


  // Main: 色枠・ポジション・セットへのランダム割り当て
  const chroma = ['red','lime','blue','yellow','aqua','fuchsia'];
  const circle = [60,120,180,240,300,360];
  const allCenter = [0];

  const setTypes = shuffle([1,2,3]);  // A,B,Cに割り当てる3タイプ

  function decorateSet(items, type, blockSize) {
    const chromaRand = shuffle(chroma);
    const circleRand = shuffle(circle);

    let colorsSeq;
    let posSeq;

    if (type === 1) {
      colorsSeq = chromaRand;
      posSeq = allCenter;
    } else if (type === 2) {
      colorsSeq = ['black'];
      posSeq = circleRand;
    } else {
      colorsSeq = chromaRand;
      posSeq = circleRand;
    }

    return ExpUtils.decorateByBlocks(items, {
      blockSize,
      colorsSeq,
      posSeq
    });
  }

  // 本番リスト構築（A/B/C の順番ランダム）
  const rawMap = { A: mainARaw, B: mainBRaw, C: mainCRaw };
  const listOrder = shuffle(['A', 'B', 'C']);

  let mainList = [];
  listOrder.forEach((key, i) => {
    const type = setTypes[i];

    const shuffledRaw = shuffle(rawMap[key]);
    const decoratedRaw = decorateSet(shuffledRaw, type, blockSize);
    const decorated = decoratedRaw.map((item, idx) => ({
      ...item,
      context_set: i + 1,
      encoding_index: idx + 1
    }));

    decorated.forEach(item => {
      mainList.push(item);
    });
  });

  // 画像刺激プリロード
  const preloadPractice = {
    type: jsPsychPreload,
    images: practiceList.map(x => x.src),
    show_progress_bar: true
  };

  const preloadMainBg = {
    type: jsPsychPreload,
    images: mainList.map(x => x.src),
    show_progress_bar: false
  };

  // タイムライン
  const timeline = [];

  // 全体Introduction
  timeline.push(...BuildIntroduction.build(jsPsych, {
    buttonNext: "次へ",
    buttonPrev: "前へ"
  }));

  // フルスクリーン開始
  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    message:
      '【練習課題へ】を押すと全画面になります。<br>中止したい場合のみ Esc で解除できます。',
    button_label: '練習課題へ'
  });

  // スクロールロック
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '',
    choices: "NO_KEYS",
    trial_duration: 10,
    on_load: () => {
      ExpUtils.lockScroll();
    }
  });

  // Practice
  timeline.push(preloadPractice);
  timeline.push(...BuildTrials.buildPracticeBlock(jsPsych, practiceList));

  // Main
  timeline.push(preloadMainBg);
  listOrder.forEach((setKey, i) => {
    const setIndex = i + 1;
    const subset = mainList.filter(x => x.context_set === setIndex);
    timeline.push(...BuildTrials.buildMainBlock(jsPsych, subset, setIndex));
  });

  // フルスクリーン解除
  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: false
  });

  // スクロールロック解除
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '',
    choices: "NO_KEYS",
    trial_duration: 10,
    on_load: () => {
      ExpUtils.showCursor();
      ExpUtils.unlockScroll();
    }
  });

  
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p>データを保存しています。しばらくお待ちください...</p>',
    choices: "NO_KEYS",
    trial_duration: 2000,
  });

  var save_trial = {
  type: jsPsychCallFunction,
  async: true,
  func: function(done){
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'write_data.php');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if(xhr.status == 200){
          var response = JSON.parse(xhr.responseText);
          console.log(response.success);
        }
        done(); // invoking done() causes experiment to progress to next trial.
      };
      xhr.send(jsPsych.data.get().json());
    }
  }
  timeline.push(save_trial);

  const end_msg = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
        <p>お疲れ様でした。以上で調査を終了いたします。</p>
        <p>以下に表示される完了コードを必ずメモしてから、画面を閉じてください。</p>
        <h2>完了コード：<strong>145215</strong></h2>
        <div class="contact">
          <div><strong>連絡先</strong>（問題が生じた場合、以下にご連絡ください。）</div>
          <div>九州大学大学院 人間環境学府 行動システム専攻 修士1年　上野 友幹</div>
          <div>ueno.tomoki.921@s.kyushu-u.ac.jp ／ 080-4318-6402</div>
        </div>
        `,
        choices: "NO_KEYS"
    }
  timeline.push(end_msg);

  // 実行
  jsPsych.run(timeline);

})();
