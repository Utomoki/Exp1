// window.BuildIntroduction に公開
window.BuildIntroduction = (() => {

  // Instruction (pp1~7)
  const INTRO_PAGES = [
  `
  <div class="inst-wrap">
    <h2>実験説明・注意事項</h2>
    <p>これは<strong>「画像順序の記憶力についての調査」の実験画面</strong>です。</p>
    <ul>
      <li>PC画面に表示される画像について判断・記憶する課題を行います。</li>
      <li>実験は説明を含めて <strong>約20分</strong> で完了します。</li>
      <li>スマホやタブレットではなく、<strong>必ずPC</strong>で行ってください。</li>
      <li>動作に影響するため、他のタブやページはできるだけ閉じてください。</li>
    </ul>
    <div class="contact">
      <div><strong>連絡先</strong>（問題が生じた場合、以下にご連絡ください。）</div>
      <div>九州大学大学院 人間環境学府 行動システム専攻 修士2年　上野 友幹</div>
      <div>ueno.tomoki.921@s.kyushu-u.ac.jp ／ 080-4318-6402</div>
    </div>
  </div>
  `,
  `
  <div class="inst-wrap">
    <h2>同意の取得</h2>
    <div style="text-align: left;">
    本実験にご協力いただきありがとうございます。<br>
    始めに実験内容について、下までスクロールしながらご確認ください。</div>
    <ol style="text-align: left; padding-left: 1.5em; margin: 0; font-size: .9em;">
      <li><b>研究目的と内容</b></li>
        <span>
          本研究は、画像順序の記憶とその時間的な感覚について明らかにすることを目的としております。
          提示される画像について簡単な判断を行い、その後で画像の出てきたタイミングについて回答してもらいます。
          実験は説明を含めて20分程度で終了します。
        </span>
      <li><b>参加者の権利</b></li>
        <span>
          本研究の参加は自由意志によるものであり、参加への同意はいつでも撤回することができます。
          同意を撤回しても、いかなる不利益を受けることはありません。
          途中で参加の同意を撤回し実験を中止する場合は、そのままウェブブラウザを閉じてください。
          そのデータは研究では使用いたしません。
        </span>
      <li><b>謝礼</b></li>
        <span>
          謝礼はYahoo!クラウドソーシングを通して支払われます。
          実験終了後、最後の画面に<strong>6桁の確認番号（作業完了コード）</strong>が表示されます。
          必ず記録し、Yahoo!クラウドソーシングの画面に戻って入力してください。
          入力ミスや、定員への到達などによって謝礼が受け取れなかった場合の補償はいたしかねますので、あらかじめご了承ください。
        </span>
      <li><b>研究結果の使用およびプライバシーの保護</b></li>
        <span>
          本研究で得られたデータは、研究の再現性の保証と研究分野のさらなる発展のために、インターネット上のサイトにおいて公開する可能性があります。
          本研究では匿名でデータを収集するため、公開されるのは実験内で選択された回答と年齢、性別のみで、個人が特定されることはありません。
          また、研究の成果は学術論文や学会発表などを通じて公表される可能性がありますが、データは全体の傾向として統計的に処理・分析されるため、個人が特定されることはありませんのでご安心ください。
        </span>
      <li><b>倫理委員会</b></li>
        <span>この実験は、九州大学大学院人間環境学研究院の研究倫理委員会の承認を得て実施しています（申請番号：2025-027）。</span>
    </ol>
    <div style="text-align: left;">
      以上の内容に同意し、実験に参加いただける場合は下のチェックボックスに☑をして「次へ」を押して下さい。
      同意されない場合はウィンドウを閉じて終了してください。
    </div>
    <div class="consent-box">
      <label style="display:flex;gap:.5em;align-items:center;">
        <input type="checkbox" id="consent-check">
        <span><strong>説明事項をよく読み理解した上で、研究参加に同意します</strong></span>
      </label>
    </div>
  </div>
  `,
  `
  <div class="inst-wrap">
    <h2>実験の説明</h2>
    <p>実験は休憩をはさみながら、<strong>3セット</strong>行われます。</p>
    <div class="flow">
      <div>〜 1セットの流れ 〜</div>
      <ol>
        <li>食べられるか否かを判断する課題</li>
        <li>画像の時間情報を思い出す課題</li>
        <li>休憩</li>
      </ol>
    </div>
    <p>それぞれの課題について、次の画面から詳しく説明します。</p>
  </div>
  `,
  `
  <div class="inst-wrap">
    <h2>1.  食べられるか否かを判断する課題</h2>
    <img src="img/inst-1.png" class="inst-img">
    <ul>
      <li>「＋」マークの後に画像が表示されます。「＋」マークの間は中心を見てください。</li>
      <li>画像をよく見て、その画像が<strong>「食べられるか否か（食品であるかどうか）」</strong>を判断してください。</li>
      <li>キーボードを用いて、<strong>食べられる</strong>場合は<strong> "F"キー</strong>、<strong>食べられない</strong>場合は<strong> "J"キー</strong>を押してください。</li>
      <li>できるだけ正確に、はやく判断してください。一定時間で次の画面に移ります。</li>
    </ul>
  </div>
  `,
  `
  <div class="inst-wrap">
    <h2>2. 画像の時間情報を思い出す課題</h2>
    
    <div class="img-pair">
      <img src="img/inst-2-1.png" class="inst-img" alt="A">
      <img src="img/inst-2-2.png" class="inst-img" alt="B">
    </div>

    <ul>
      <li>「＋」マークに続いて、<strong>判断課題の中から</strong>2枚の画像が表示されます。</li>
      <li>
        まず、<strong>「2枚の画像が出てきたタイミングの時間距離」</strong>の印象を回答します（左図）。<br>
        先ほどの『食べられるか否かを判断する課題』において、2枚の画像が表示される間にどれくらいの時間間隔があったかを思い出しながら回答してください。
      </li>
      <li>
        次に、<strong>「2枚の画像のうちどちらが先に表示されたか」</strong>を回答します（右図）。<br>
        先ほどの『食べられるか否かを判断する課題』において、どちらの画像が先に表示されたかを思い出しながら回答してください。
      </li>
      <li>回答は、画面の指示にしたがって、キーボードの<strong> "F", "G", "H", "J"キー</strong>で答えてください。</li>
      <li>できるだけ正確に、はやく回答してください。</li>
    </ul>
  </div>
  `,
  `
  <div class="inst-wrap">
    <h2>内容の確認</h2>
    <div class="flow">
      <ol>
        <li>食べられるか否かを判断する課題：食べられる（"F"）or 食べられない（"J"）</li>
        <li>画像の時間情報を思い出す課題：4択（"F", "G", "H", "J"）</li>
        <li>休憩</li>
      </ol>
    </div>
    <div style="text-align: left;">
      以上の内容を1セットとし、本番課題は<strong>3セット</strong>行います。
    </div>
    <p style="text-align: left;">
      まずは練習課題から始めます。<br>
      内容が確認出来たら、【次へ】を押してください。
    </p>
  </div>
  `,
  ];

  // 同意必須
  function gateNextButtonByConsent() {
    const nextBtn =
      document.querySelector(".jspsych-instructions-next") ||
      Array.from(document.querySelectorAll(".jspsych-btn")).slice(-1)[0];
    const consent = document.querySelector("#consent-check");
    if (!nextBtn) return;
    if (consent) {
      nextBtn.disabled = !consent.checked;
      const toggle = () => { nextBtn.disabled = !consent.checked; };
      consent.addEventListener("change", toggle);
      const nav = document.querySelector(".jspsych-instructions-nav");
      if (nav) {
        const handler = (e) => {
          if (e.target.closest("button")) {
            consent.removeEventListener("change", toggle);
            nav.removeEventListener("click", handler, true);
          }
        };
        nav.addEventListener("click", handler, true);
      }
    } else {
      nextBtn.disabled = false;
    }
  }

  function build(jsPsych, { buttonNext="次へ", buttonPrev="前へ" } = {}) {
    const tl =[];

    // 1〜2枚目（同意画面まで）
    tl.push({
      type: jsPsychInstructions,
      pages: [INTRO_PAGES[0], INTRO_PAGES[1]], 
      show_clickable_nav: true,
      allow_backward: true,
      button_label_next: buttonNext,
      button_label_previous: buttonPrev,
      on_load: () => {
        // ページが切り替わるたびにチェックを走らせる
        const container = document.querySelector(".jspsych-content-wrapper") || document.body;
        const mo = new MutationObserver(() => {
          // 同意チェックボックスのときだけ制御
          setTimeout(gateNextButtonByConsent, 0);
        });
        mo.observe(container, { childList: true, subtree: true });
        setTimeout(gateNextButtonByConsent, 0);
      }
    });

    // 基本情報入力
    tl.push({
      type: jsPsychSurveyHtmlForm,
      html: `
        <div class="inst-wrap">
          <h2>基本情報の入力</h2>
          <p>以下の項目に回答してください。</p>

          <label>性別：</label><br>
          <label><input type="radio" name="gender" value="M" required> 男性</label><br>
          <label><input type="radio" name="gender" value="W"> 女性</label><br>
          <label><input type="radio" name="gender" value="N"> その他 / 回答しない</label><br><br>

          <label>年齢：</label><br>
          <input name="age" type="number" min="10" max="59" required>
        </div>
      `,
      button_label: "次へ",
      data: { component: "basic_info" },
      on_finish: function(data) {
        // data.response は JSオブジェクトのまま
        const resp = data.response;

        const myrandID = jsPsych.randomization.randomID(8);
        jsPsych.data.addProperties({
          participant_id: myrandID,
          gender: resp.gender ?? null,
          age: resp.age ?? null
        });
      }
    });

    // 実験内容説明
    tl.push({
      type: jsPsychInstructions,
      pages: INTRO_PAGES.slice(2),
      show_clickable_nav: true,
      allow_backward: true,
      button_label_next: buttonNext,
      button_label_previous: buttonPrev
    });

    return tl;
  }

  return { build };
})();
