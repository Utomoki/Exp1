window.BuildIntroduction = (() => {
  function build(jsPsych, config) {
    const tl = [];

    // 1. 実験説明画面と同意取得画面を1つのノードに統合（行き来できる動的制御）
    tl.push({
      type: jsPsychInstructions,
      pages: [
        // ページ0：実験説明画面
        `
        <div class="inst-wrap">
          <h2>実験説明・注意事項</h2>
          <p>これは<strong>「画像順序の記憶力についての調査」の実験画面</strong>です。</p>
          <ul>
            <li>PC画面に表示される画像について判断・記憶する課題を行います。</li>
            <li>実験は説明を含めて <strong>約25分</strong> で完了します。</li>
            <li>スマホやタブレットではなく、<strong>必ずPC（マウス・キーボードが使える環境）</strong>で行ってください。</li>
            <li>測定精度を保つため、他のタブやバックグラウンドページはできるだけ閉じてください。</li>
          </ul>
          <div class="contact">
            <div><strong>連絡先</strong>（問題が生じた場合、以下にご連絡ください。）</div>
            <div>${config.investigator.affiliation} ${config.investigator.name}</div>
            <div>${config.investigator.email} ／ ${config.investigator.phone}</div>
          </div>
        </div>
        `,
        // ページ1：説明事項に基づく研究参加同意書（スクロール・チェック連動）
        `
        <div class="inst-wrap">
          <h2>説明事項に基づく研究参加同意書</h2>
          <div class="scroll-box" id="consent-scroll-zone">
            <p style="color:red; font-weight:bold; text-align:center;">--- スクロールして最後まで確認すると同意チェックが可能です ---</p>  
            <p><strong>1. 研究目的と内容</strong><br>本研究は、画像とその順序の記憶を明らかにすることを目的としています。提示される画像への簡単な可食判断ののち、画像に関する複数の記憶テスト（再認、背景、順序）を行います。</p>
            <p><strong>2. 参加者の権利</strong><br>参加は自由意志によるものであり、いつでも中断できます。中断する場合はブラウザをそのまま閉じてください。データは使用されず不利益も一切ありません。</p>
            <p><strong>3. 謝礼について</strong><br>Yahoo!クラウドソーシングを通じて支払われます。終了画面に表示される6桁の作業完了コードを必ず控えて入力してください。</p>
            <p><strong>4. プライバシー保護</strong><br>データは完全に匿名化され、統計的にのみ処理されます。オープンサイエンス推進のため、匿名データが公開される場合がありますが、個人情報が含まれることはありません。</p>
            <p><strong>5. 倫理審査</strong><br>九州大学大学院人間環境学研究院研究倫理審査委員会の承認（承認番号：${config.investigator.ethics_approval_number}）を得て実施しています。</p>
          </div>
          <div class="consent-box">
            <input type="checkbox" id="consent-check" disabled />
            <label for="consent-check"><strong>説明事項をよく読み理解した上で、研究参加に同意します</strong></label>
          </div>
        </div>
        `
      ],
      show_clickable_nav: true,
      allow_backward: true,
      button_label_next: "次へ",
      button_label_previous: "前へ",
      on_page_change: (page_index) => {
        // jsPsychによるDOM更新完了後に確実にロックを効かせるため遅延処理
        setTimeout(() => {
          const nextBtn = document.getElementById('jspsych-instructions-next');
          
          if (page_index === 1) {
            // 同意画面（ページ1）に到達したときの動的制御
            const scrollZone = document.getElementById('consent-scroll-zone');
            const checkbox = document.getElementById('consent-check');
            
            if (nextBtn && checkbox) {
              // 同意チェックの状態を「次へ」ボタンに即座に同期（強制ロック）
              nextBtn.disabled = !checkbox.checked;
              
              checkbox.onchange = (e) => {
                nextBtn.disabled = !e.target.checked;
              };
            }

            if (scrollZone && checkbox) {
              const checkScroll = () => {
                // デバイス間の描画誤差を吸収するため余裕を5pxにして判定
                if (scrollZone.scrollHeight - scrollZone.scrollTop <= scrollZone.clientHeight + 5) {
                  checkbox.disabled = false;
                  scrollZone.removeEventListener('scroll', checkScroll);
                }
              };
              
              scrollZone.addEventListener('scroll', checkScroll);
              checkScroll(); // 初期状態でスクロールバーがない場合のフェイルセーフ
            }
          } else {
            // 実験説明画面（ページ0）に戻ったときは、次へボタンのロックを解除
            if (nextBtn) {
              nextBtn.disabled = false;
            }
          }
        }, 10);
      }
    });

    // 3. 属性取得画面（全回答必須化）
    tl.push({
      type: jsPsychSurveyHtmlForm,
      html: `
        <div class="inst-wrap">
          <h2>基本情報の入力</h2>
          <p>以下のすべての項目に回答してください（入力必須）。</p>
          
          <div style="margin-bottom:20px;">
            <label style="font-weight:bold;">性別：</label><br>
            <input type="radio" name="gender" id="g-m" value="M" required> <label for="g-m" style="margin-right:15px;">男性</label>
            <input type="radio" name="gender" id="g-w" value="W"> <label for="g-w" style="margin-right:15px;">女性</label>
            <input type="radio" name="gender" id="g-o" value="O"> <label for="g-o" style="margin-right:15px;">その他</label>
            <input type="radio" name="gender" id="g-n" value="N"> <label for="g-n">回答しない</label>
          </div>

          <div>
            <label style="font-weight:bold;" for="age-input">年齢：</label><br>
            <input name="age" id="age-input" type="number" min="10" max="99" style="font-size:18px; padding:4px; width:100px;" required>
          </div>
        </div>
      `,
      button_label: "次へ",
      data: { Component: "basic_info" },
      on_finish: (data) => {
        const resp = data.response;
        // Rでの解析を見据えてプロパティ名を大文字始まりで付与
        jsPsych.data.addProperties({
          Participant_id: jsPsych.randomization.randomID(8),
          Gender: resp.gender,
          Age: parseInt(resp.age, 10)
        });
      }
    });

    // 4. 実験共通インストラクション（各ステップに対応する画像付き仕様へアップデート）
    tl.push({
      type: jsPsychInstructions,
      pages: [
        // 共通ページ0：実験の流れ
        `
        <div class="inst-wrap">
          <h2>実験の流れ</h2>
          <p>実験は、練習ブロック（1回）のあと、本番ブロックを<strong>3セット</strong>行います。</p>
          <div class="flow">
            <strong>【1セット内で行う課題ステップ】</strong>
            <ol>
              <li><strong>可食判断課題</strong>：物品が食べ物か否かを判断します。</li>
              <li><strong>画像有無を思い出す課題</strong>：画像が表示されていたか否かを回答します。</li>
              <li><strong>画像背景を思い出す課題</strong>：画像がどの背景（色や場所）にあったかを回答します。</li>
              <li><strong>画像順序を思い出す課題</strong>：2つの画像の提示順序を回答します。</li>
              <li><strong>休憩</strong></li>
            </ol>
          </div>
          <p>次の画面から、それぞれの詳しい進め方を説明します。</p>
        </div>
        `,
        // 共通ページ1：ステップ1（inst_encoding.png を追加）
        `
        <div class="inst-wrap">
          <h2>ステップ1：可食判断課題（判断課題）</h2>
          <p>画面中央に「＋」が表示されたのち、<strong>枠のついた画像</strong>が1枚ずつ表示されます。</p>
          <ul>
            <li>画像が<strong>「食べられるもの（食品）」なら左手で【F】キー</strong>を、<strong>「食べられないもの」なら右手で【J】キー</strong>を押してください。</li>
            <li>画像はキー入力の有無にかかわらず自動で次に進みます。必ず提示されている間に素べく正確に回答してください。</li>
          </ul>
          <img src="./img/inst_encoding.png" class="inst-img" alt="可食判断課題の説明">
        </div>
        `,
        // 共通ページ2：ステップ2,3（inst-2-1.pngとinst-2-2.png を追加）
        `
        <div class="inst-wrap">
          <h2>ステップ2,3：画像の有無と背景を思い出す課題</h2>
          <p>判断課題の終了後、いくつかの記憶テストを行います。</p>
          <ul>
            <li><strong>画像の有無を思い出す課題</strong>：<br>画像を見て、その画像が判断課題で「表示されていた(=F)」か「表示されていなかった(=J)」かを回答します。</li>
            <li><strong>画像の背景を思い出す課題</strong>：<br>表示されていた(=F)と答えた画像について、それが「どの枠色」または「どの位置」に提示されていたかを2択で回答します。</li>
          </ul>
          <p>練習課題では、ダミー（非表示画像）を含みません。</p>
          
          <div class="img-pair">
            <img src="./img/inst-2-1.png" style="max-width: 45%; height: auto; border: 2px solid #000;" alt="画像の有無を思い出す課題の説明">
            <img src="./img/inst-2-2.png" style="max-width: 45%; height: auto; border: 2px solid #000;" alt="画像の背景を思い出す課題の説明">
          </div>
        </div>
        `,
        // 共通ページ3：ステップ4（inst_1.png を追加）
        `
        <div class="inst-wrap">
          <h2>ステップ4：画像の順序を思い出す課題</h2>
          <p>続いて、2枚の画像の順序を思い出す課題を行います。</p>
          <ul>
            <li><strong>画像の順序を思い出す課題</strong>：<br>同時に提示される2枚の画像のうち、「判断課題でどちらが先に表示されたか」を【F=左】【J=右】で回答します。</li>
          </ul>
          <p>それでは、練習課題から開始します。</p>
          <img src="./img/inst-1.png" class="inst-img" alt="画像の順序を思い出す課題の説明">
        </div>
        `
      ],
      show_clickable_nav: true,
      allow_backward: true,
      button_label_next: "次へ",
      button_label_previous: "前へ"
    });

    return tl;
  }

  return { build };
})();
