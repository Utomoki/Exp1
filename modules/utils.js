window.ExpUtils = (() => {
  // デバイス間のサイズ差異を吸収し、全体スクロールを禁止する堅牢なCSSレイアウト
  // 【修正】.hide-cursor の影響範囲を *（すべての子要素）に広げ強制力をアップ
  const baseCSS = `
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: #ffffff; color: #333; font-family: sans-serif; overflow: hidden; overscroll-behavior: none; touch-action: pan-y; }
    body.hide-cursor, body.hide-cursor * { cursor: none !important; }
    #jspsych-target { width: 100vw; height: 100vh; overflow: hidden; }
    .jspsych-display-element { overflow: hidden; }
    .inst-wrap { max-width: 840px; width: 95%; margin: 0 auto; line-height: 1.75; font-size: clamp(16px, 2vw, 20px); text-align: left; max-height: 90vh; overflow-y: auto; padding: 1em; box-sizing: border-box; }
    .inst-wrap h2 { margin-bottom: .4em; text-align: center; border-bottom: 2px solid #333; padding-bottom: 4px; }
    .contact { margin-top: .8em; padding: .8em; border: 1px solid #ccc; border-radius: 8px; font-size: 0.8em; background: #fdfdfd; }
    .flow { background: #f7f7f7; border: 1px solid #e5e5e5; border-radius: 8px; padding: .8em; margin: .4em 0; text-align: left; }
    .scroll-box { height: clamp(150px, 30vh, 250px); overflow-y: auto; border: 1px solid #aaa; padding: 12px; margin-bottom: 15px; background: #fafafa; border-radius: 4px; }
    .consent-box { margin-top: .8em; text-align: center; display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; }
    .inst-img { display: block; max-width: 100%; max-height: 35vh; margin: 1em auto; height: auto; border: 2px solid #000; object-fit: contain; }
    .img-pair { display: flex; justify-content: center; align-items: center; gap: 24px; margin: 1em 0; flex-wrap: wrap; }
    .jspsych-content { max-width: 100%; width: 100%; }
    .fixation { font-size: clamp(80px, 10vh, 200px); font-weight: bold; line-height: 1; text-align: center; display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw; }
    .task-area { display: flex; justify-content: center; align-items: center; width: 100vw; height: 100vh; overflow: hidden; position: relative; }
  `;

  let injected = false;
  function injectBaseCSS() {
    if (injected) return; injected = true;
    const s = document.createElement('style');
    s.textContent = baseCSS;
    document.head.appendChild(s);
  }

  async function loadConfig(url = './config/experiment.config.json') {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`loadConfig failed: ${res.status}`);
    return await res.json();
  }

  async function loadJsonl(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`loadJsonl failed: ${res.status}`);
    const text = await res.text();
    return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  }

  function lockScroll() { document.body.style.overflow = 'hidden'; }
  function unlockScroll() { document.body.style.overflow = 'auto'; }

  // 【修正】インラインスタイルも強制的に上書きしてカーソル制御を確実にする
  function hideCursor() {
    document.body.classList.add('hide-cursor');
    document.body.style.setProperty('cursor', 'none', 'important');
  }
  function showCursor() {
    document.body.classList.remove('hide-cursor');
    document.body.style.setProperty('cursor', 'auto', 'important');
  }

  // リカバリーボタンを表示するかどうかのフラグ
  let isMonitorActive = true; 

  function setupFullscreenMonitoring() {
    isMonitorActive = true;
  }

  function disableFullscreenMonitoring() {
    isMonitorActive = false;
    const btnContainer = document.getElementById('fullscreen-recovery-container');
    if (btnContainer) btnContainer.style.display = 'none';
  }

  // 【修正】DOMロード時に一度だけリスナーを登録し、練習ブロック含め常に監視を稼働させる
  document.addEventListener('DOMContentLoaded', () => {
    const btnContainer = document.getElementById('fullscreen-recovery-container');
    const recoverBtn = document.getElementById('btn-recover-fs');

    const checkFS = () => {
      // フルスクリーンが解除された（nullになった）瞬間
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        showCursor(); // 【重要】監視ステータスに関わらず、解除時は絶対に戻す
        
        if (isMonitorActive && btnContainer) {
          btnContainer.style.display = 'block';
        }
      } else {
        if (btnContainer) {
          btnContainer.style.display = 'none';
        }
      }
    };

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(evt => {
      document.addEventListener(evt, checkFS);
    });

    // 【重要】フェイルセーフ：Escキー直押しを検知して強制的にカーソルを表示
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        showCursor();
        if (isMonitorActive && btnContainer && !document.fullscreenElement) {
           btnContainer.style.display = 'block';
        }
      }
    });

    if (recoverBtn) {
      recoverBtn.onclick = () => {
        const target = document.documentElement;
        if (target.requestFullscreen) target.requestFullscreen();
        else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
      };
    }
  });

  function repeatToLength(a, N) {
    const out = [];
    while (out.length < N) out.push(...a);
    return out.slice(0, N);
  }

  function decorateByBlocks(items, { blockSize, colorsSeq, posSeq }) {
    const out = [];
    const nBlocks = Math.ceil(items.length / blockSize);
    const colors = repeatToLength(colorsSeq, nBlocks);
    const poses  = repeatToLength(posSeq,   nBlocks);

    for (let b = 0; b < nBlocks; b++) {
      const chunk = items.slice(b * blockSize, (b + 1) * blockSize);
      const color = colors[b];
      const pos   = poses[b];
      chunk.forEach((it, k) => {
        out.push({
          ...it,
          frame_color: color,
          position_index: pos,
          context_order: b + 1,
          order_in_context: k + 1
        });
      });
    }
    return out;
  }

  function positionToTranslate(posIndex, config) {
    if (!config || !config.position_map) return 'translate(0px, 0px)';
    const entry = config.position_map[String(posIndex)];
    if (!entry || entry.type === 'center') return 'translate(0px, 0px)';
    const a = entry.polar.angle_deg * Math.PI / 180;
    const r = entry.polar.radius_px || 0;
    const x = Math.round(Math.cos(a) * r);
    const y = Math.round(Math.sin(a) * r);
    return `translate(${x}px, ${y}px)`;
  }

  function makeFramedImageHTMLWithPos(src, frameColor, posIndex, config) {
    const cmap = (config && config.color_map) || {};
    const hexColor = cmap[frameColor] ?? frameColor;
    const t = positionToTranslate(posIndex, config);
    
    // 【修正】画面幅を完全固定するコンテナ（.task-area）で囲み、スクロールのはみ出しを防止
    return `
      <div class="task-area">
        <div style="transform: ${t}; transition: transform 0.1s ease; display: flex; justify-content: center; align-items: center;">
          <div style="width: 240px; height: 240px; border: 20px solid ${hexColor}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: white;">
            <img src="${src}" style="width: 190px; height: 190px; object-fit: contain; display: block;" />
          </div>
        </div>
      </div>
    `;
  }

  return {
    injectBaseCSS, lockScroll, unlockScroll, hideCursor, showCursor,
    loadConfig, loadJsonl, decorateByBlocks, makeFramedImageHTMLWithPos,
    setupFullscreenMonitoring, disableFullscreenMonitoring
  };
})();
