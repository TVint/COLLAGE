/* ==========================================================================
   CODEX HERMETICUS — FULL ENGINE
   - Elaborated Cymatic Musical Sequence Gate (default) + All 4 Admin-Selectable Keys
   - Oculus Trismegisti (3-Level Optical Zoom Immersion: Macro / Meso / Micro)
   - Living Fullscreen Breakout (Artwork lifts off paper & awakens fullscreen)
   - Infinite Constellation Map + 3D Venetian Grimoire + Oracle + Web Audio Synth
   ========================================================================== */
(() => {
  "use strict";

  const MANIFEST = window.ARTWORKS_MANIFEST || {
    config: { activeGate: "sound", soundSequence: [0, 2, 1, 3], showCuratorBypass: true },
    counts: { celestiale: 0, grimorio: 0, videos: 0 },
    artworks: [],
  };
  const CONFIG = {
    activeGate: "sound",
    soundSequence: [0, 2, 1, 3],
    showCuratorBypass: true,
    ...(MANIFEST.config || {}),
  };
  const ARTWORKS = MANIFEST.artworks || [];

  const GATE_TITLES = {
    sound: ["LA FREQUENZA ERMETICA", "«Ascolta la vibrazione delle sfere e ripeti l'accordo per schiudere il portale.»"],
    astrolabe: ["L'ASTROLABIO DI ERMETE", "«Allinea Sole, Luna e Mercurio sullo Zenith per rivelare l'archivio.»"],
    mirror: ["LA TAVOLA SMERALDINA", "«Ciò che è in basso è come ciò che è in alto — riallinea lo specchio celeste.»"],
    sigil: ["IL SIGILLO TRACCIATO", "«Unisci le cinque stelle della costellazione con un unico tratto rituale.»"],
    all: ["LA SOGLIA DI ERMETE", "«Scegli una delle quattro chiavi ermetiche per varcare la soglia.»"],
  };

  const state = {
    unlocked: sessionStorage.getItem("codex_unlocked") === "1",
    realm: "celestiale",
    view: "map",
    stageFilter: "ALL",
    audioEnabled: false,
    lbList: [],
    lbIndex: 0,
    lbZoomIdx: 0,
    lbBufferA: true,
    map: { x: 0, y: 0, scale: 0.78, dragging: false, moved: false, startX: 0, startY: 0 },
  };

  /* ========================================================================
     1. WEB AUDIO API — CELESTIAL BOWLS, RESONANCE & AWAKENING SWELL
  ======================================================================== */
  let audioCtx = null;
  let droneOsc1 = null;
  let droneOsc2 = null;
  let droneGain = null;

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // Rich harmonic singing-bowl chime (fundamental + octave + slight beating overtone)
  function playMysticBell(freq = 432, duration = 1.6, vol = 0.085) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const partials = [
      { mult: 1.0, gain: 1.0, type: "sine" },
      { mult: 2.0, gain: 0.28, type: "sine" },
      { mult: 2.996, gain: 0.12, type: "triangle" },
    ];
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq * p.mult, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol * p.gain, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0004, now + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });
  }

  function playUnlockChord() {
    [432, 540, 648, 864, 1080].forEach((f, i) => {
      setTimeout(() => playMysticBell(f, 2.4, 0.06), i * 105);
    });
  }

  function playAwakenSwell() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [216, 324, 432, 648].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 1.6);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.035, now + 0.85);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 2.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.3);
    });
  }

  function toggleAmbientDrone() {
    const btn = document.getElementById("toggle-audio-btn");
    state.audioEnabled = !state.audioEnabled;
    if (btn) {
      btn.textContent = state.audioEnabled ? "♪ ON" : "♪ OFF";
      btn.setAttribute("aria-pressed", String(state.audioEnabled));
    }
    const ctx = ensureAudio();
    if (!ctx) return;

    if (state.audioEnabled) {
      droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      droneGain.gain.linearRampToValueAtTime(0.024, ctx.currentTime + 1.4);
      droneGain.connect(ctx.destination);

      droneOsc1 = ctx.createOscillator();
      droneOsc2 = ctx.createOscillator();
      droneOsc1.type = "sine";
      droneOsc2.type = "triangle";
      droneOsc1.frequency.value = 108;
      droneOsc2.frequency.value = 162;
      droneOsc1.connect(droneGain);
      droneOsc2.connect(droneGain);
      droneOsc1.start();
      droneOsc2.start();
    } else if (droneGain) {
      droneGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      setTimeout(() => {
        try { droneOsc1.stop(); droneOsc2.stop(); } catch (_) {}
      }, 550);
    }
  }

  /* ========================================================================
     2. AMBIENT STARFIELD CANVAS
  ======================================================================== */
  function initStarfield() {
    const canvas = document.getElementById("celestial-bg");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let stars = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * Math.PI * 2,
        s: Math.random() * 0.01 + 0.003,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of stars) {
        st.a += st.s;
        const alpha = 0.2 + Math.abs(Math.sin(st.a)) * 0.72;
        ctx.fillStyle = `rgba(230, 198, 119, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    draw();
  }

  /* ========================================================================
     3. LA SOGLIA ERMETICA (CONFIG-DRIVEN: DEFAULT MUSICAL CYMATICS)
  ======================================================================== */
  function unlockPortal() {
    state.unlocked = true;
    sessionStorage.setItem("codex_unlocked", "1");
    playUnlockChord();
    document.getElementById("hermetic-gate")?.classList.add("is-unlocked");
    document.body.classList.remove("is-locked");
  }

  function lockPortal() {
    state.unlocked = false;
    sessionStorage.removeItem("codex_unlocked");
    document.getElementById("hermetic-gate")?.classList.remove("is-unlocked");
    document.body.classList.add("is-locked");
  }

  function activateRitualPanel(key) {
    document.querySelectorAll(".gate-tab").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.ritual === key);
    });
    document.querySelectorAll(".ritual-panel").forEach((p) => {
      p.classList.toggle("is-active", p.id === `ritual-${key}`);
    });
    const pair = GATE_TITLES[key] || GATE_TITLES.sound;
    const tEl = document.getElementById("gate-title");
    const sEl = document.getElementById("gate-subtitle");
    if (tEl) tEl.textContent = pair[0];
    if (sEl) sEl.textContent = pair[1];
  }

  function initGate() {
    if (state.unlocked) {
      document.getElementById("hermetic-gate")?.classList.add("is-unlocked");
      document.body.classList.remove("is-locked");
    }

    // Apply Admin-configured Gate Mode
    const activeGate = CONFIG.activeGate || "sound";
    const tabsEl = document.getElementById("gate-tabs");
    if (activeGate === "all") {
      if (tabsEl) tabsEl.style.display = "grid";
      activateRitualPanel("sound");
    } else {
      if (tabsEl) tabsEl.style.display = "none";
      activateRitualPanel(activeGate);
    }

    // Curator bypass visibility from Admin config
    const footerEl = document.getElementById("gate-footer");
    if (footerEl && CONFIG.showCuratorBypass === false) {
      footerEl.style.display = "none";
    }

    document.querySelectorAll(".gate-tab").forEach((tab) => {
      tab.addEventListener("click", () => activateRitualPanel(tab.dataset.ritual));
    });

    document.getElementById("curator-bypass-btn")?.addEventListener("click", unlockPortal);
    document.getElementById("relock-gate-btn")?.addEventListener("click", lockPortal);

    // ------------------------------------------------------------------
    // RITUALE PRINCIPALE: FREQUENZA ERMETICA + CYMATICS CANVAS
    // ------------------------------------------------------------------
    const bellFreqs = [432, 528, 639, 741];
    // Positions on 360x360 canvas for bell indices: 0=North(Sol), 1=South(Luna), 2=East(Mercurius), 3=West(Venus)
    const bellCoords = [
      { x: 180, y: 45 },
      { x: 180, y: 315 },
      { x: 315, y: 180 },
      { x: 45, y: 180 },
    ];
    const targetSeq = Array.isArray(CONFIG.soundSequence) && CONFIG.soundSequence.length >= 2
      ? CONFIG.soundSequence
      : [0, 2, 1, 3];
    const ROMAN_SLOTS = ["I", "II", "III", "IV", "V", "VI"];

    let userSeq = [];
    let isPlayingDemo = false;
    const soundStatus = document.getElementById("sound-status");
    const progressEl = document.getElementById("sound-progress");
    const bellNodes = new Map();
    document.querySelectorAll(".bell-node").forEach((b) => {
      bellNodes.set(Number(b.dataset.bell), b);
    });

    // Build Progress Rune Slots
    function renderRuneSlots(errorFlash = false) {
      if (!progressEl) return;
      progressEl.innerHTML = "";
      targetSeq.forEach((_, idx) => {
        const slot = document.createElement("span");
        slot.className = "rune-slot";
        if (errorFlash) slot.classList.add("is-error");
        else if (idx < userSeq.length) slot.classList.add("is-lit");
        slot.textContent = ROMAN_SLOTS[idx] || String(idx + 1);
        progressEl.appendChild(slot);
      });
    }
    renderRuneSlots();

    // Cymatics Visual Engine
    const cymCanvas = document.getElementById("cymatics-canvas");
    const ripples = [];
    const activeLines = [];
    let cymAngle = 0;

    function spawnRipple(x, y, maxR = 175) {
      ripples.push({ x, y, r: 16, maxR, alpha: 0.9 });
    }

    if (cymCanvas) {
      const cctx = cymCanvas.getContext("2d");
      function renderCymatics() {
        cctx.clearRect(0, 0, 360, 360);
        cymAngle += 0.003;

        // Rotating Sacred Geometry Rings
        cctx.save();
        cctx.translate(180, 180);
        cctx.strokeStyle = "rgba(230, 198, 119, 0.16)";
        cctx.lineWidth = 1;
        cctx.beginPath();
        cctx.arc(0, 0, 134, 0, Math.PI * 2);
        cctx.stroke();

        cctx.rotate(cymAngle);
        cctx.setLineDash([4, 7]);
        cctx.beginPath();
        cctx.arc(0, 0, 102, 0, Math.PI * 2);
        cctx.stroke();
        cctx.setLineDash([]);

        // Rotating inscribed square (alchemical diamond)
        cctx.strokeStyle = "rgba(230, 198, 119, 0.12)";
        cctx.strokeRect(-72, -72, 144, 144);
        cctx.restore();

        // Connecting energy lines between sequence notes
        for (let i = activeLines.length - 1; i >= 0; i--) {
          const ln = activeLines[i];
          ln.alpha -= 0.012;
          if (ln.alpha <= 0) { activeLines.splice(i, 1); continue; }
          cctx.strokeStyle = `rgba(255, 240, 190, ${ln.alpha.toFixed(2)})`;
          cctx.lineWidth = 1.6;
          cctx.beginPath();
          cctx.moveTo(ln.x1, ln.y1);
          cctx.lineTo(ln.x2, ln.y2);
          cctx.stroke();
        }

        // Expanding golden sound ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          rp.r += 2.6;
          rp.alpha *= 0.965;
          if (rp.alpha < 0.02 || rp.r > rp.maxR) { ripples.splice(i, 1); continue; }
          cctx.strokeStyle = `rgba(230, 198, 119, ${rp.alpha.toFixed(2)})`;
          cctx.lineWidth = 1.5;
          cctx.beginPath();
          cctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
          cctx.stroke();
        }

        requestAnimationFrame(renderCymatics);
      }
      renderCymatics();
    }

    function ringBell(idx, prevIdx = null) {
      const btn = bellNodes.get(idx);
      if (btn) {
        btn.classList.add("is-ringing");
        setTimeout(() => btn.classList.remove("is-ringing"), 460);
      }
      const pt = bellCoords[idx] || { x: 180, y: 180 };
      spawnRipple(pt.x, pt.y, 170);
      spawnRipple(180, 180, 150);
      if (prevIdx !== null && bellCoords[prevIdx]) {
        activeLines.push({ x1: bellCoords[prevIdx].x, y1: bellCoords[prevIdx].y, x2: pt.x, y2: pt.y, alpha: 0.85 });
      }
      playMysticBell(bellFreqs[idx], 1.5, 0.09);
    }

    document.getElementById("sound-play-seq")?.addEventListener("click", () => {
      if (isPlayingDemo) return;
      isPlayingDemo = true;
      userSeq = [];
      renderRuneSlots();
      if (soundStatus) soundStatus.innerHTML = "Ascolta la risonanza delle sfere...";

      targetSeq.forEach((bIdx, step) => {
        setTimeout(() => {
          const prev = step > 0 ? targetSeq[step - 1] : null;
          ringBell(bIdx, prev);
          if (step === targetSeq.length - 1) {
            setTimeout(() => {
              isPlayingDemo = false;
              if (soundStatus) soundStatus.innerHTML = `Ora ripeti la sequenza di <strong>${targetSeq.length} note</strong> sugli astri.`;
            }, 420);
          }
        }, step * 620);
      });
    });

    bellNodes.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        if (isPlayingDemo) return;
        const prev = userSeq.length > 0 ? userSeq[userSeq.length - 1] : null;
        ringBell(idx, prev);
        userSeq.push(idx);
        const pos = userSeq.length - 1;

        if (userSeq[pos] !== targetSeq[pos]) {
          renderRuneSlots(true);
          if (soundStatus) soundStatus.innerHTML = "Dissonanza armonica. Tocca <strong>NV · EVOCA</strong> per riascoltare la sequenza.";
          userSeq = [];
          setTimeout(() => renderRuneSlots(false), 550);
          return;
        }

        renderRuneSlots();
        if (userSeq.length === targetSeq.length) {
          spawnRipple(180, 180, 240);
          if (soundStatus) soundStatus.innerHTML = "✦ <strong>ARMONIA COMPIUTA</strong> — LA SOGLIA SI SCHIUDE...";
          setTimeout(unlockPortal, 620);
        }
      });
    });

    // ------------------------------------------------------------------
    // ALTRI 3 RITUALI (DISPONIBILI SE ATTIVATI IN ADMIN)
    // ------------------------------------------------------------------
    // Astrolabe
    const ringAngles = [90, 180, 270];
    const ringEls = [
      document.getElementById("ring-outer"),
      document.getElementById("ring-mid"),
      document.getElementById("ring-inner"),
    ];
    function updateAstrolabe() {
      ringEls.forEach((el, i) => { if (el) el.style.transform = `rotate(${ringAngles[i]}deg)`; });
      if (ringAngles.every((a) => a % 360 === 0)) {
        const st = document.getElementById("astro-status");
        if (st) st.textContent = "✦ ALLINEAMENTO COMPIUTO — LA SOGLIA SI SCHIUDE...";
        setTimeout(unlockPortal, 480);
      }
    }
    function rotateRing(idx) {
      ringAngles[idx] = (ringAngles[idx] + 45) % 360;
      playMysticBell(320 + idx * 110, 0.45, 0.06);
      updateAstrolabe();
    }
    ringEls.forEach((el, i) => el?.addEventListener("click", () => rotateRing(i)));
    document.querySelectorAll("[data-rotate-ring]").forEach((btn) => {
      btn.addEventListener("click", () => rotateRing(Number(btn.dataset.rotateRing)));
    });
    updateAstrolabe();

    // Speculum
    const mirrorSlider = document.getElementById("mirror-slider");
    const mirrorLower = document.getElementById("mirror-lower-svg");
    function updateMirror() {
      if (!mirrorSlider || !mirrorLower) return;
      const val = Number(mirrorSlider.value);
      mirrorLower.style.transform = `translateX(${val}px)`;
      if (Math.abs(val) <= 4) {
        mirrorSlider.value = "0";
        mirrorLower.style.transform = "translateX(0px)";
        const st = document.getElementById("mirror-status");
        if (st) st.textContent = "✦ SPECULUM ALLINEATO — COME IN ALTO, COSÌ IN BASSO.";
        setTimeout(unlockPortal, 480);
      }
    }
    mirrorSlider?.addEventListener("input", updateMirror);
    updateMirror();

    // Sigil Drawing
    const sigilCanvas = document.getElementById("sigil-canvas");
    if (sigilCanvas) {
      const sctx = sigilCanvas.getContext("2d");
      const nodes = [
        { x: 150, y: 36 }, { x: 245, y: 108 }, { x: 208, y: 218 }, { x: 92, y: 218 }, { x: 55, y: 108 },
      ];
      let visited = new Set();
      let path = [];
      let drawing = false;
      function drawSigil() {
        sctx.clearRect(0, 0, sigilCanvas.width, sigilCanvas.height);
        if (path.length > 1) {
          sctx.strokeStyle = "#E6C677";
          sctx.lineWidth = 2.2;
          sctx.beginPath();
          sctx.moveTo(path[0].x, path[0].y);
          for (let i = 1; i < path.length; i++) sctx.lineTo(path[i].x, path[i].y);
          sctx.stroke();
        }
        nodes.forEach((n, idx) => {
          const hit = visited.has(idx);
          sctx.beginPath();
          sctx.arc(n.x, n.y, hit ? 9 : 6, 0, Math.PI * 2);
          sctx.fillStyle = hit ? "#E6C677" : "rgba(230,198,119,0.35)";
          sctx.fill();
          sctx.strokeStyle = "#E6C677";
          sctx.lineWidth = 1.2;
          sctx.stroke();
        });
      }
      function getPos(e) {
        const rect = sigilCanvas.getBoundingClientRect();
        const pt = e.touches ? e.touches[0] : e;
        return {
          x: ((pt.clientX - rect.left) / rect.width) * sigilCanvas.width,
          y: ((pt.clientY - rect.top) / rect.height) * sigilCanvas.height,
        };
      }
      function handleMove(e) {
        if (!drawing) return;
        e.preventDefault();
        const pos = getPos(e);
        path.push(pos);
        nodes.forEach((n, idx) => {
          if (!visited.has(idx) && Math.hypot(pos.x - n.x, pos.y - n.y) < 22) {
            visited.add(idx);
            playMysticBell(432 + idx * 72, 0.5, 0.06);
          }
        });
        drawSigil();
        if (visited.size === nodes.length) {
          drawing = false;
          const st = document.getElementById("sigil-status");
          if (st) st.textContent = "✦ SIGILLO INCISO — LA PORTA È APERTA.";
          setTimeout(unlockPortal, 480);
        }
      }
      sigilCanvas.addEventListener("mousedown", (e) => { drawing = true; path = [getPos(e)]; });
      sigilCanvas.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", () => { drawing = false; });
      sigilCanvas.addEventListener("touchstart", (e) => { drawing = true; path = [getPos(e)]; }, { passive: false });
      sigilCanvas.addEventListener("touchmove", handleMove, { passive: false });
      sigilCanvas.addEventListener("touchend", () => { drawing = false; });
      document.getElementById("sigil-reset-btn")?.addEventListener("click", () => { visited.clear(); path = []; drawSigil(); });
      drawSigil();
    }
  }

  /* ========================================================================
     4. DUAL REALM & VIEW ENGINE
  ======================================================================== */
  function getActiveArtworks() {
    let list = ARTWORKS.filter((a) => a.era === state.realm);
    if (state.view === "grimoire" && state.stageFilter !== "ALL") {
      list = list.filter((a) => a.stage === state.stageFilter);
    }
    return list;
  }

  function setRealm(realm) {
    state.realm = realm;
    document.documentElement.setAttribute("data-realm", realm);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", realm === "celestiale" ? "#060914" : "#EFE7D6");

    document.querySelectorAll(".realm-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.setRealm === realm);
    });

    const sub = document.getElementById("hud-realm-subtitle");
    if (sub) {
      sub.textContent = realm === "celestiale" ? "MAPPA CELESTIALE // 2026" : "GRIMORIO VENEZIANO // ARCHIVIO 2025";
    }
    setView(realm === "celestiale" ? "map" : "grimoire");
  }

  function setView(view) {
    state.view = view;
    document.documentElement.setAttribute("data-view", view);
    document.getElementById("celestial-map-view")?.classList.toggle("is-active", view === "map");
    document.getElementById("grimoire-view")?.classList.toggle("is-active", view === "grimoire");

    const lbl = document.getElementById("toggle-view-label");
    if (lbl) lbl.textContent = view === "map" ? "☷ VISTA GRIMORIO" : "✦ VISTA MAPPA";

    if (view === "map") renderConstellationMap();
    else renderGrimoireGrid();
  }

  /* ========================================================================
     5. INFINITE CONSTELLATION MAP
  ======================================================================== */
  function applyMapTransform() {
    const world = document.getElementById("map-world");
    if (world) {
      world.style.transform = `translate3d(${state.map.x}px, ${state.map.y}px, 0) scale(${state.map.scale})`;
    }
  }

  function centerMap() {
    const vp = document.getElementById("map-viewport");
    if (!vp) return;
    state.map.scale = window.innerWidth < 768 ? 0.56 : 0.78;
    state.map.x = vp.clientWidth / 2;
    state.map.y = vp.clientHeight / 2;
    applyMapTransform();
  }

  function renderConstellationMap() {
    const nodesEl = document.getElementById("map-nodes");
    const svgEl = document.getElementById("constellation-svg");
    if (!nodesEl || !svgEl) return;

    const list = ARTWORKS.filter((a) => a.era === state.realm);
    nodesEl.innerHTML = "";
    svgEl.innerHTML = "";

    const goldenAngle = 2.399963229728653;
    const spacing = 240;
    const coords = [];

    list.forEach((art, i) => {
      const r = i === 0 ? 0 : spacing * Math.sqrt(i + 0.65);
      const theta = i * goldenAngle;
      const cx = Math.cos(theta) * r;
      const cy = Math.sin(theta) * r;
      coords.push({ x: cx, y: cy });

      const hasMultiZoom = (art.zoomLayers || []).length > 1;
      const node = document.createElement("article");
      node.className = "map-node" + (art.video ? " has-video" : "");
      node.style.left = `${cx - 98}px`;
      node.style.top = `${cy - 112}px`;
      node.innerHTML = `
        <div class="map-node__img-wrap">
          <img src="${art.thumb}" alt="${art.title}" loading="lazy" decoding="async" />
          <div class="card-badges">
            ${hasMultiZoom ? `<span class="badge-layers" title="3 Livelli di Profondità">◎ III</span>` : ""}
            ${art.video ? `<button type="button" class="badge-video" title="Risveglia Animazione a Tutto Schermo">▶ VIVA</button>` : ""}
          </div>
        </div>
        <div class="map-node__meta">
          <span class="map-node__roman">${art.roman}</span>
          <span class="map-node__title">${art.title}</span>
        </div>
      `;

      node.querySelector(".badge-video")?.addEventListener("click", (e) => {
        e.stopPropagation();
        awakenArtworkFullscreen(art);
      });

      node.addEventListener("click", (e) => {
        if (state.map.moved) return;
        e.stopPropagation();
        openLightbox(list, i);
      });
      nodesEl.appendChild(node);
    });

    let linesMarkup = "";
    for (let i = 1; i < coords.length; i++) {
      linesMarkup += `<line x1="${coords[i - 1].x}" y1="${coords[i - 1].y}" x2="${coords[i].x}" y2="${coords[i].y}" stroke="rgba(230,198,119,0.24)" stroke-width="1" stroke-dasharray="4 6" />`;
    }
    svgEl.innerHTML = linesMarkup;
    centerMap();
  }

  function initMapInteractions() {
    const vp = document.getElementById("map-viewport");
    if (!vp) return;

    vp.addEventListener("mousedown", (e) => {
      state.map.dragging = true;
      state.map.moved = false;
      state.map.startX = e.clientX - state.map.x;
      state.map.startY = e.clientY - state.map.y;
      vp.classList.add("is-dragging");
    });
    window.addEventListener("mousemove", (e) => {
      if (!state.map.dragging) return;
      const nx = e.clientX - state.map.startX;
      const ny = e.clientY - state.map.startY;
      if (Math.hypot(nx - state.map.x, ny - state.map.y) > 4) state.map.moved = true;
      state.map.x = nx;
      state.map.y = ny;
      applyMapTransform();
    });
    window.addEventListener("mouseup", () => {
      state.map.dragging = false;
      vp.classList.remove("is-dragging");
    });

    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.91;
      state.map.scale = Math.max(0.24, Math.min(2.2, state.map.scale * delta));
      applyMapTransform();
    }, { passive: false });

    let pinchDist = 0;
    let pinchScale = 1;
    vp.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        state.map.dragging = true;
        state.map.moved = false;
        state.map.startX = e.touches[0].clientX - state.map.x;
        state.map.startY = e.touches[0].clientY - state.map.y;
      } else if (e.touches.length === 2) {
        state.map.dragging = false;
        pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchScale = state.map.scale;
      }
    }, { passive: true });

    vp.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && state.map.dragging) {
        e.preventDefault();
        state.map.moved = true;
        state.map.x = e.touches[0].clientX - state.map.startX;
        state.map.y = e.touches[0].clientY - state.map.startY;
        applyMapTransform();
      } else if (e.touches.length === 2 && pinchDist > 0) {
        e.preventDefault();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        state.map.scale = Math.max(0.24, Math.min(2.2, pinchScale * (d / pinchDist)));
        applyMapTransform();
      }
    }, { passive: false });

    vp.addEventListener("touchend", () => { state.map.dragging = false; pinchDist = 0; });

    document.getElementById("map-zoom-in")?.addEventListener("click", () => { state.map.scale = Math.min(2.2, state.map.scale * 1.2); applyMapTransform(); });
    document.getElementById("map-zoom-out")?.addEventListener("click", () => { state.map.scale = Math.max(0.24, state.map.scale * 0.82); applyMapTransform(); });
    document.getElementById("map-center")?.addEventListener("click", centerMap);
  }

  /* ========================================================================
     6. GRIMORIO VENEZIANO 3D DECK
  ======================================================================== */
  function renderGrimoireGrid() {
    const grid = document.getElementById("grimoire-grid");
    if (!grid) return;
    const list = getActiveArtworks();
    grid.innerHTML = "";

    const titleEl = document.getElementById("grimoire-title");
    if (titleEl) {
      titleEl.textContent = state.realm === "grimorio"
        ? "GRIMORIO VENEZIANO · LAMINE 2025"
        : "CODICE CELESTIALE · LAMINE 2026";
    }

    list.forEach((art, idx) => {
      const hasMultiZoom = (art.zoomLayers || []).length > 1;
      const card = document.createElement("article");
      card.className = "arcana-card" + (art.video ? " has-video" : "");
      card.innerHTML = `
        <div class="arcana-inner">
          <div class="arcana-face arcana-face--front">
            <div class="arcana-top">
              <span class="arcana-roman">LAMINA ${art.roman}</span>
              <span class="arcana-stage">${art.stage}</span>
            </div>
            <div class="arcana-media">
              <img src="${art.thumb}" alt="${art.title}" loading="lazy" decoding="async" />
              <div class="card-badges">
                ${hasMultiZoom ? `<span class="badge-layers">◎ III</span>` : ""}
                ${art.video ? `<button type="button" class="badge-video" title="Risveglia Animazione a Tutto Schermo">▶ VIVA</button>` : ""}
              </div>
            </div>
            <div class="arcana-bottom">
              <h3 class="arcana-title">${art.title}</h3>
              <button type="button" class="arcana-flip-btn">↻ RETRO</button>
            </div>
          </div>

          <div class="arcana-face arcana-face--back">
            <div class="arcana-top">
              <span class="arcana-roman">ARCANO ${art.roman}</span>
              <span class="arcana-stage">${art.year}</span>
            </div>
            <p class="arcana-back-oracle">«${art.oracle}»</p>
            <div class="arcana-back-formula">${art.formula}</div>
            <div class="arcana-bottom" style="justify-content:center;">
              <button type="button" class="arcana-flip-btn">↻ FRONTE</button>
            </div>
          </div>
        </div>
      `;

      card.querySelector(".badge-video")?.addEventListener("click", (e) => {
        e.stopPropagation();
        awakenArtworkFullscreen(art);
      });
      card.querySelectorAll(".arcana-flip-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          card.classList.toggle("is-flipped");
          if (state.audioEnabled) playMysticBell(396, 0.35, 0.04);
        });
      });
      card.querySelector(".arcana-media")?.addEventListener("click", () => openLightbox(list, idx));
      grid.appendChild(card);
    });
  }

  /* ========================================================================
     7. L'ORACOLO ("INTERROGA L'ARCHIVIO")
  ======================================================================== */
  function drawOracle(count) {
    const spread = document.getElementById("oracle-spread");
    if (!spread || !ARTWORKS.length) return;
    playMysticBell(528, 1.3, 0.07);

    const pool = [...ARTWORKS].sort(() => Math.random() - 0.5).slice(0, count);
    const labels = count === 3 ? ["I · PASSATO", "II · PRESENTE", "III · FUTURO"] : ["✧ IL RESPONSO DELL'ORACOLO"];

    spread.innerHTML = "";
    pool.forEach((art, i) => {
      const el = document.createElement("article");
      el.className = "oracle-card";
      el.style.animationDelay = `${i * 0.16}s`;
      el.innerHTML = `
        <div class="oracle-pos">${labels[i]}</div>
        <img src="${art.thumb}" alt="${art.title}" />
        <h3>${art.roman} · ${art.title}</h3>
        <p>«${art.oracle}»</p>
      `;
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        closeModal("oracle-modal");
        openLightbox(pool, i);
      });
      spread.appendChild(el);
    });
  }

  /* ========================================================================
     8. LIGHTBOX + OCULUS TRISMEGISTI (3-LEVEL ZOOM IMMERSION)
  ======================================================================== */
  function openLightbox(list, index) {
    state.lbList = list;
    state.lbIndex = index;
    state.lbZoomIdx = 0;
    renderLightboxSlide();
    const modal = document.getElementById("artwork-lightbox");
    modal?.classList.add("is-open");
    modal?.setAttribute("aria-hidden", "false");
  }

  function switchOculusLayer(layerIdx, silent = false) {
    const art = state.lbList[state.lbIndex];
    if (!art) return;
    const layers = art.zoomLayers && art.zoomLayers.length
      ? art.zoomLayers
      : [{ level: 1, label: "I · MACROCOSMOS", subtitle: "Tavola Integrale", src: art.src || art.thumb }];
    const clamped = Math.max(0, Math.min(layers.length - 1, layerIdx));
    state.lbZoomIdx = clamped;
    const layer = layers[clamped];

    const imgA = document.getElementById("lb-img-a");
    const imgB = document.getElementById("lb-img-b");
    const incoming = state.lbBufferA ? imgB : imgA;
    const outgoing = state.lbBufferA ? imgA : imgB;
    state.lbBufferA = !state.lbBufferA;

    if (incoming && outgoing) {
      incoming.src = layer.src;
      incoming.alt = `${art.title} — ${layer.label}`;
      incoming.classList.add("is-visible");
      outgoing.classList.remove("is-visible");
    }

    const iris = document.getElementById("lb-iris-ring");
    if (iris && !silent) {
      iris.classList.remove("is-pulsing");
      void iris.offsetWidth;
      iris.classList.add("is-pulsing");
      playMysticBell(432 + clamped * 114, 0.55, 0.045);
    }

    const badge = document.getElementById("lb-depth-badge");
    if (badge) badge.textContent = `${layer.label} // ${layer.subtitle.toUpperCase()}`;

    document.querySelectorAll(".oculus-btn").forEach((b, i) => {
      b.classList.toggle("is-active", i === clamped);
    });
  }

  function renderLightboxSlide() {
    const art = state.lbList[state.lbIndex];
    if (!art) return;

    document.getElementById("lb-roman").textContent = `LAMINA ${art.roman}`;
    document.getElementById("lb-title").textContent = art.title;
    document.getElementById("lb-stage").textContent = art.stage;
    document.getElementById("lb-era-year").textContent = `${art.era === "celestiale" ? "MAPPA CELESTIALE" : "GRIMORIO VENEZIANO"} · ${art.year}`;
    document.getElementById("lb-formula").textContent = art.formula;
    document.getElementById("lb-oracle").textContent = `«${art.oracle}»`;
    document.getElementById("lb-notes").textContent = art.notes;

    // Awaken Fullscreen Button (only if video exists)
    const awakenBtn = document.getElementById("lb-awaken-btn");
    if (awakenBtn) {
      awakenBtn.style.display = art.video ? "flex" : "none";
      awakenBtn.onclick = () => awakenArtworkFullscreen(art);
    }

    // Build Oculus 3-Layer Dial
    const oculusBar = document.getElementById("oculus-bar");
    const layers = art.zoomLayers || [];
    if (oculusBar) {
      if (layers.length > 1) {
        oculusBar.style.display = "grid";
        oculusBar.innerHTML = "";
        layers.forEach((lay, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "oculus-btn" + (i === 0 ? " is-active" : "");
          btn.innerHTML = `
            <span class="oculus-btn__title">${lay.label}</span>
            <span class="oculus-btn__sub">${lay.subtitle}</span>
          `;
          btn.addEventListener("click", () => switchOculusLayer(i));
          oculusBar.appendChild(btn);
        });
      } else {
        oculusBar.style.display = "none";
      }
    }

    switchOculusLayer(0, true);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
  }

  /* ========================================================================
     9. LIVING FULLSCREEN STAGE ("LA GRAFICA ESCE DALLA CARTA E PRENDE VITA")
  ======================================================================== */
  let livingHudTimer = null;
  let livingParticlesRaf = null;

  function startLivingParticles() {
    const canvas = document.getElementById("living-particles");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pts = Array.from({ length: 65 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vy: -(Math.random() * 0.55 + 0.15),
      r: Math.random() * 1.8 + 0.4,
      a: Math.random() * 0.65 + 0.15,
    }));

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pts) {
        p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        ctx.fillStyle = `rgba(230, 198, 119, ${p.a.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      livingParticlesRaf = requestAnimationFrame(loop);
    }
    loop();
  }

  function showLivingHudTemporarily() {
    const stage = document.getElementById("living-stage");
    if (!stage) return;
    stage.classList.remove("hud-hidden");
    clearTimeout(livingHudTimer);
    livingHudTimer = setTimeout(() => {
      if (stage.classList.contains("is-active")) stage.classList.add("hud-hidden");
    }, 2800);
  }

  function awakenArtworkFullscreen(art) {
    if (!art || !art.video) return;
    const stage = document.getElementById("living-stage");
    const ghostImg = document.getElementById("living-ghost-img");
    const vid = document.getElementById("living-video");
    const playBtn = document.getElementById("living-play-btn");
    const muteBtn = document.getElementById("living-mute-btn");
    const fitBtn = document.getElementById("living-fit-btn");
    if (!stage || !vid) return;

    document.getElementById("living-roman").textContent = `LAMINA ${art.roman} // RISVEGLIO`;
    document.getElementById("living-title").textContent = art.title;
    if (ghostImg) ghostImg.src = art.thumb;

    // Reset state & start paper breakout ritual
    stage.classList.remove("is-playing", "is-awakening", "hud-hidden");
    stage.classList.add("is-active");
    stage.setAttribute("aria-hidden", "false");
    void stage.offsetWidth;
    stage.classList.add("is-awakening");

    playAwakenSwell();
    startLivingParticles();

    vid.classList.remove("is-cover");
    vid.muted = false;
    vid.src = art.video;
    vid.currentTime = 0;

    if (playBtn) playBtn.textContent = "⏸ PAUSA";
    if (muteBtn) muteBtn.textContent = "♪ AUDIO ON";
    if (fitBtn) fitBtn.textContent = "⛶ RIEMPI SCHERMO";

    // Crossfade into living fullscreen video as the paper frame dissolves
    setTimeout(() => {
      stage.classList.add("is-playing");
      vid.play().catch(() => {
        // Fallback muted autoplay if browser blocks unmuted video
        vid.muted = true;
        if (muteBtn) muteBtn.textContent = "🔇 MUTO";
        vid.play().catch(() => {});
      });
    }, 520);

    showLivingHudTemporarily();
  }

  function closeLivingFullscreen() {
    const stage = document.getElementById("living-stage");
    const vid = document.getElementById("living-video");
    if (!stage) return;
    stage.classList.remove("is-active", "is-playing", "is-awakening", "hud-hidden");
    stage.setAttribute("aria-hidden", "true");
    if (vid) { vid.pause(); vid.removeAttribute("src"); vid.load(); }
    if (livingParticlesRaf) cancelAnimationFrame(livingParticlesRaf);
    clearTimeout(livingHudTimer);
  }

  function initLivingControls() {
    const stage = document.getElementById("living-stage");
    const vid = document.getElementById("living-video");
    const playBtn = document.getElementById("living-play-btn");
    const muteBtn = document.getElementById("living-mute-btn");
    const fitBtn = document.getElementById("living-fit-btn");

    stage?.addEventListener("mousemove", showLivingHudTemporarily);
    stage?.addEventListener("touchstart", showLivingHudTemporarily, { passive: true });

    document.getElementById("living-close-btn")?.addEventListener("click", closeLivingFullscreen);

    playBtn?.addEventListener("click", () => {
      if (!vid) return;
      if (vid.paused) { vid.play(); playBtn.textContent = "⏸ PAUSA"; }
      else { vid.pause(); playBtn.textContent = "▶ RIPRENDI"; }
      showLivingHudTemporarily();
    });

    muteBtn?.addEventListener("click", () => {
      if (!vid) return;
      vid.muted = !vid.muted;
      muteBtn.textContent = vid.muted ? "🔇 MUTO" : "♪ AUDIO ON";
      showLivingHudTemporarily();
    });

    fitBtn?.addEventListener("click", () => {
      if (!vid) return;
      const isCover = vid.classList.toggle("is-cover");
      fitBtn.textContent = isCover ? "⊡ ADATTA INTERA" : "⛶ RIEMPI SCHERMO";
      showLivingHudTemporarily();
    });
  }

  /* ========================================================================
     10. BOOTSTRAP
  ======================================================================== */
  function init() {
    const cCel = document.getElementById("count-celestiale");
    const cGri = document.getElementById("count-grimorio");
    if (cCel) cCel.textContent = String(MANIFEST.counts?.celestiale || 0);
    if (cGri) cGri.textContent = String(MANIFEST.counts?.grimorio || 0);

    initStarfield();
    initGate();
    initMapInteractions();
    initLivingControls();

    document.querySelectorAll("[data-set-realm]").forEach((btn) => {
      btn.addEventListener("click", () => setRealm(btn.dataset.setRealm));
    });
    document.getElementById("toggle-view-btn")?.addEventListener("click", () => {
      setView(state.view === "map" ? "grimoire" : "map");
    });
    document.getElementById("toggle-audio-btn")?.addEventListener("click", toggleAmbientDrone);

    document.querySelectorAll(".stage-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        state.stageFilter = chip.dataset.stage;
        document.querySelectorAll(".stage-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
        renderGrimoireGrid();
      });
    });

    document.getElementById("open-oracle-btn")?.addEventListener("click", () => {
      const m = document.getElementById("oracle-modal");
      m?.classList.add("is-open");
      m?.setAttribute("aria-hidden", "false");
    });
    document.getElementById("oracle-draw-one")?.addEventListener("click", () => drawOracle(1));
    document.getElementById("oracle-draw-three")?.addEventListener("click", () => drawOracle(3));

    // Click lightbox media frame to cycle Oculus Zoom Depth (I -> II -> III -> I)
    document.getElementById("lb-media-frame")?.addEventListener("click", () => {
      const art = state.lbList[state.lbIndex];
      const len = (art?.zoomLayers || []).length;
      if (len > 1) switchOculusLayer((state.lbZoomIdx + 1) % len);
    });

    document.getElementById("lb-prev")?.addEventListener("click", () => {
      if (!state.lbList.length) return;
      state.lbIndex = (state.lbIndex - 1 + state.lbList.length) % state.lbList.length;
      state.lbZoomIdx = 0;
      renderLightboxSlide();
    });
    document.getElementById("lb-next")?.addEventListener("click", () => {
      if (!state.lbList.length) return;
      state.lbIndex = (state.lbIndex + 1) % state.lbList.length;
      state.lbZoomIdx = 0;
      renderLightboxSlide();
    });

    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        closeModal(el.dataset.closeModal === "oracle" ? "oracle-modal" : "artwork-lightbox");
      });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (document.getElementById("living-stage")?.classList.contains("is-active")) {
          closeLivingFullscreen();
          return;
        }
        closeModal("oracle-modal");
        closeModal("artwork-lightbox");
      } else if (document.getElementById("artwork-lightbox")?.classList.contains("is-open")) {
        if (e.key === "ArrowRight") {
          state.lbIndex = (state.lbIndex + 1) % state.lbList.length;
          state.lbZoomIdx = 0;
          renderLightboxSlide();
        } else if (e.key === "ArrowLeft") {
          state.lbIndex = (state.lbIndex - 1 + state.lbList.length) % state.lbList.length;
          state.lbZoomIdx = 0;
          renderLightboxSlide();
        } else if (["1", "2", "3"].includes(e.key)) {
          switchOculusLayer(Number(e.key) - 1);
        }
      }
    });

    setRealm("celestiale");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
