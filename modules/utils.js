// window.ExpUtils に公開
window.ExpUtils = (() => {
  // CSS
  const baseCSS = `
    html, body{height:100%; margin:0;}
    body.hide-cursor{ cursor: none !important; }
    #jspsych-target{min-height: 100vh;}
    .inst-wrap{max-width:840px; margin:0 auto; line-height:1.75; font-size:20px}
    .inst-wrap h2{margin-bottom:.2em}
    .inst-note{font-size:.95em; color:#444; margin-top:.6em}
    .contact{margin-top:.8em; padding:.8em; border:1px solid #ccc; border-radius:8px}
    .kbd{display:inline-block; border:1px solid #aaa;border-radius:4px; padding:0 .35em; font-family:ui-monospace}
    .flow{background:#f7f7f7; border:1px solid #e5e5e5; border-radius:8px; padding:.8em; margin:.4em 0; text-align:left;}
    .flow ol{text-align:left; margin-left:0;}
    .choice-keys{display:grid; grid-template-columns:1fr 1fr; gap:.6em; margin:.6em 0}
    .consent-box{margin-top:.8em; text-align:center;}
    .consent-box label{display:inline-flex; justify-content:center; align-items:center;}
    .inst-wrap ul {text-align:left; margin-left:1.2em;}
    .inst-img {display:block; max-width:40%; margin:1em auto; height:auto;  border: 2px solid #000;}
    .img-pair{display:flex; justify-content:center; align-items:center; gap:24px; margin:1em 0; flex-wrap:wrap;}
    .img-pair .inst-img{max-width:45%; height:auto; display:block;}
    .jspsych-html-button-response-button{ display:block; margin:1em auto; font-size:20px }
    .jspsych-content-wrapper{min-height:100vh; display:grid; place-items:center; padding:16px; box-sizing:border-box;}
    .jspsych-content{max-width:1200px; width:min(96vw, 1200px); font-size: 24px;}
    .fixation{font-size:clamp(80px, 10vh, 200px); font-weight:50; line-height:1; text-align:center;}
    `;
  let injected = false;
  function injectBaseCSS() {
    if (injected) return; injected = true;
    const s = document.createElement('style');
    s.textContent = baseCSS;
    document.head.appendChild(s);
  }

  // 「開始」ボタン
  function makeStartButton({ title='', html='', label='開始', data={}, minDisplayMs=0 } = {}) {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="inst-wrap">${title ? `<h2>${title}</h2>` : ''}${html}</div>`,
      choices: [label],
      on_load: () => {
        ExpUtils.showCursor();
        if (minDisplayMs > 0) {
          const btn = document.querySelector('.jspsych-html-button-response-button');
          if (btn) { btn.disabled = true; setTimeout(() => { btn.disabled = false; }, minDisplayMs); }
        }
      },
      data: { component: 'start_button', ...data }
    };
  }

  /** config/experiment.config.json を読む */
  async function loadConfig(url = './config/experiment.config.json') {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`loadConfig failed: ${res.status} ${res.statusText} @ ${url}`);
    return await res.json();
  }

  /** JSONL: 1行=1 JSON オブジェクト（順序保持） */
  async function loadJsonl(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`loadJsonl failed: ${res.status} ${res.statusText} @ ${url}`);
    const text = await res.text();
    return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  }

  function imagePaths(items) {
    return (items ?? []).map(s => s.src);
  }
  function makePreloadNode(preloadPlugin, images, opts = {}) {
    if (!preloadPlugin) throw new Error('makePreloadNode: preloadPlugin is required (e.g., jsPsychPreload).');
    return {
      type: preloadPlugin,
      images,
      show_progress_bar: opts.show_progress_bar ?? true,
      max_load_time: opts.max_load_time ?? 60000,
    };
  }

  function makeDefaultPreloadPlan(preloadPlugin, practiceList, mainList) {
    const p1 = makePreloadNode(preloadPlugin, imagePaths(practiceList), { show_progress_bar: true });
    const p2 = makePreloadNode(preloadPlugin, imagePaths(mainList),     { show_progress_bar: false });
    return { preloadPractice: p1, preloadMainBg: p2 };
  }

  // デコレータ（順序維持・6枚ブロック付与）
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

  // 描画ヘルパ
  const FRAME_COLOR_MAP = {
    'red': '#ff0000',
    'lime': '#00ff00',
    'blue': '#0000ff',
    'yellow': '#ffff00',
    'aqua': '#00ffff',
    'fuchsia': '#ff00ff',
    'black': '#000000',
    'silver': '#C0C0C0'
  };
  function normalizeFrameColor(name='', config) {
    const key = String(name).toLowerCase().trim();
    const cmap = (config && config.color_map) || FRAME_COLOR_MAP;
    return cmap[key] ?? key;
  }

  // 角度(0/60/.../360) → CSS translate(px) に変換（中心基準、上方向がマイナス）
  function positionToTranslate(posIndex, config) {
    if (!config || !config.position_map){
      return 'translate(0px, 0px)';
    }
    const entry = config.position_map[String(posIndex)];
    if (!entry || entry.type === 'center'){
       return 'translate(0px, 0px)';
    }
    const a = entry.polar.angle_deg * Math.PI / 180;
    const r = entry.polar.radius_px || 0;
    const x = Math.round(Math.cos(a) * r);
    const y = Math.round(Math.sin(a) * r);
    return `translate(${x}px, ${y}px)`;
  }

  // 枠＋位置つきの画像HTML（frame=240px / img=200px を中心から translate）
  function makeFramedImageHTML(src, frameColor, {frameSize=240, imageSize=200} = {}, config) {
    const pad = Math.max(0, (frameSize - imageSize) /2);
    const color = normalizeFrameColor(frameColor, config);
    return `
      <div style="
        width:${frameSize}px; height:${frameSize}px;
        border:${pad}px solid ${color};
        margin:0 auto; display:flex; align-items:center; justify-content:center;
      ">
        <img src="${src}" width="${imageSize}" height="${imageSize}"
             style="display:block; object-fit:contain;" />
      </div>
    `;
  }

  // 枠＋位置つき
  function makeFramedImageHTMLWithPos(src,color,posIndex,opt={},config){
    const inner = makeFramedImageHTML(src,color,opt,config);
    const t = positionToTranslate(posIndex,config);
    return `<div style="transform:${t};">${inner}</div>`;
  }

  // 実験中だけスクロール禁止
  function lockScroll() {
    document.body.dataset._scroll_prev = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }

  // 実験終了時に元に戻す
  function unlockScroll() {
    const prev = document.body.dataset._scroll_prev ?? 'auto';
    document.body.style.overflow = prev;
  }

  // カーソル非表示/表示
  function hideCursor() {
    document.body.classList.add('hide-cursor');
  }
  function showCursor() {
    document.body.classList.remove('hide-cursor');
  }

  return {
    injectBaseCSS,
    lockScroll,
    unlockScroll,
    hideCursor,
    showCursor,
    makeStartButton,
    loadConfig,
    loadJsonl,
    imagePaths,
    makePreloadNode,
    makeDefaultPreloadPlan,
    repeatToLength,
    decorateByBlocks,
    normalizeFrameColor,
    positionToTranslate,
    makeFramedImageHTML,
    makeFramedImageHTMLWithPos
  };
})();
