window.ExpUtils = (() => {
  const baseCSS = `
    html, body { height: 100%; margin: 0; background: #ffffff; color: #333; font-family: sans-serif; }
    body.hide-cursor { cursor: none !important; }
    #jspsych-target { min-height: 100vh; }
    .inst-wrap { max-width: 840px; margin: 0 auto; line-height: 1.75; font-size: 20px; text-align: left; }
    .inst-wrap h2 { margin-bottom: .4em; text-align: center; border-bottom: 2px solid #333; padding-bottom: 4px; }
    .contact { margin-top: .8em; padding: .8em; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; background: #fdfdfd; }
    .flow { background: #f7f7f7; border: 1px solid #e5e5e5; border-radius: 8px; padding: .8em; margin: .4em 0; text-align: left; }
    .scroll-box { height: 250px; overflow-y: scroll; border: 1px solid #aaa; padding: 12px; margin-bottom: 15px; background: #fafafa; border-radius: 4px; }
    .consent-box { margin-top: .8em; text-align: center; display: flex; justify-content: center; align-items: center; gap: 8px; }
    .inst-img { display: block; max-width: 40%; margin: 1em auto; height: auto; border: 2px solid #000; }
    .img-pair { display: flex; justify-content: center; align-items: center; gap: 24px; margin: 1em 0; flex-wrap: wrap; }
    .jspsych-content { max-width: 1200px; width: min(96vw, 1200px); font-size: 24px; }
    .fixation { font-size: clamp(80px, 10vh, 200px); font-weight: bold; line-height: 1; text-align: center; }
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

  function setupFullscreenMonitoring() {
    const btnContainer = document.getElementById('fullscreen-recovery-container');
    const recoverBtn = document.getElementById('btn-recover-fs');
    
    const checkFS = () => {
      if (!document.fullscreenElement) {
        btnContainer.style.display = 'block';
      } else {
        btnContainer.style.display = 'none';
      }
    };

    document.removeEventListener('fullscreenchange', checkFS);
    document.addEventListener('fullscreenchange', checkFS);

    recoverBtn.onclick = () => {
      const target = document.documentElement;
      if (target.requestFullscreen) target.requestFullscreen();
    };
  }

  function disableFullscreenMonitoring() {
    document.getElementById('fullscreen-recovery-container').style.display = 'none';
  }

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
    
    return `
      <div style="transform: ${t}; transition: transform 0.1s ease; display: flex; justify-content: center; align-items: center; min-height: 400px;">
        <div style="width: 240px; height: 240px; border: 20px solid ${hexColor}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: white;">
          <img src="${src}" style="width: 200px; height: 200px; object-fit: contain; display: block;" />
        </div>
      </div>
    `;
  }

  function lockScroll() { document.body.style.overflow = 'hidden'; }
  function unlockScroll() { document.body.style.overflow = 'auto'; }
  function hideCursor() { document.body.classList.add('hide-cursor'); }
  function showCursor() { document.body.classList.remove('hide-cursor'); }

  return {
    injectBaseCSS, lockScroll, unlockScroll, hideCursor, showCursor,
    loadConfig, loadJsonl, decorateByBlocks, makeFramedImageHTMLWithPos,
    setupFullscreenMonitoring, disableFullscreenMonitoring
  };
})();
