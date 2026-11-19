/* ==========================================================================
   SCRIPTORIUM CMS — ADMIN ENGINE (Password: finefilo)
   Manages Hermetic Gate Mode, Custom Musical Sequence, & All 72 Artworks
   ========================================================================== */
(() => {
  "use strict";

  const ADMIN_PASS = "finefilo";
  const NOTE_META = [
    { id: 0, label: "☉ SOL 432Hz", freq: 432 },
    { id: 1, label: "☽ LUNA 528Hz", freq: 528 },
    { id: 2, label: "☿ MERCURIUS 639Hz", freq: 639 },
    { id: 3, label: "♀ VENUS 741Hz", freq: 741 },
  ];
  const STAGES = [
    { key: "NIGREDO", short: "NIG" },
    { key: "ALBEDO", short: "ALB" },
    { key: "CITRINITAS", short: "CIT" },
    { key: "RUBEDO", short: "RUB" },
  ];

  let db = {
    config: { activeGate: "sound", soundSequence: [0, 2, 1, 3], showCuratorBypass: true },
    artworks: [],
  };
  let activeFilter = "ALL";
  let searchQuery = "";
  let selectedId = null;
  let audioCtx = null;

  function showToast(msg) {
    const el = document.getElementById("cms-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), 3200);
  }

  function playNote(freq) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.09, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0005, audioCtx.currentTime + 0.9);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.95);
  }

  /* ------------------------------------------------------------------------
     AUTH GATE
  ------------------------------------------------------------------------ */
  function initAuth() {
    const lock = document.getElementById("admin-lock");
    if (sessionStorage.getItem("codex_admin_auth") === "1") {
      lock?.classList.add("is-hidden");
      return;
    }
    document.getElementById("admin-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = (document.getElementById("admin-pwd-input")?.value || "").trim();
      if (val === ADMIN_PASS) {
        sessionStorage.setItem("codex_admin_auth", "1");
        lock?.classList.add("is-hidden");
      } else {
        document.getElementById("admin-login-err").textContent = "Parola d'ordine errata.";
      }
    });
  }

  /* ------------------------------------------------------------------------
     LOAD / SAVE / RESCAN
  ------------------------------------------------------------------------ */
  async function loadData() {
    try {
      const res = await fetch("/api/manifest", { cache: "no-store" });
      if (res.ok) {
        db = await res.json();
      } else {
        throw new Error("static");
      }
    } catch (_) {
      db = window.ARTWORKS_MANIFEST || db;
    }
    db.config = { activeGate: "sound", soundSequence: [0, 2, 1, 3], showCuratorBypass: true, ...(db.config || {}) };
    renderGateConfig();
    renderGrid();
    updateStatus();
  }

  function updateStatus() {
    const el = document.getElementById("cms-status-text");
    if (!el) return;
    const total = db.artworks.length;
    const vids = db.artworks.filter((a) => a.video).length;
    el.textContent = `${total} LAMINE · ${vids} VIDEO VIVENTI · PORTA: ${(db.config.activeGate || "sound").toUpperCase()}`;
  }

  async function saveData() {
    if (!db.config.soundSequence || db.config.soundSequence.length < 2) {
      showToast("⚠ Inserisci almeno 2 note nella sequenza musicale.");
      return;
    }
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(db),
      });
      const json = await res.json();
      if (json.ok) {
        db = json.data;
        // Reset session unlock so gate changes are visible immediately when opening the portal
        sessionStorage.removeItem("codex_unlocked");
        updateStatus();
        showToast("✦ Codice Ermetico salvato direttamente su disco!");
      } else {
        showToast("Errore salvataggio: " + (json.error || "sconosciuto"));
      }
    } catch (_) {
      showToast("⚠ Server locale non rilevato: avvia Avvia-Admin.command per salvare su disco.");
    }
  }

  async function rescanFolders() {
    showToast("🔄 Sincronizzazione cartelle 2025/2026 in corso...");
    try {
      const res = await fetch("/api/rescan", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        db = json.data;
        renderGateConfig();
        renderGrid();
        updateStatus();
        showToast("✦ " + json.message);
      } else {
        showToast("Errore sincronizzazione: " + json.error);
      }
    } catch (_) {
      showToast("⚠ Server locale non attivo: avvia Avvia-Admin.command.");
    }
  }

  /* ------------------------------------------------------------------------
     GATE CONFIGURATOR & MELODY COMPOSER
  ------------------------------------------------------------------------ */
  function renderGateConfig() {
    document.querySelectorAll("[data-gate-opt]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.gateOpt === db.config.activeGate);
    });
    const cb = document.getElementById("cfg-curator-bypass");
    if (cb) cb.checked = db.config.showCuratorBypass !== false;

    const pills = document.getElementById("melody-preview-pills");
    if (pills) {
      pills.innerHTML = "";
      (db.config.soundSequence || []).forEach((nIdx, i) => {
        const meta = NOTE_META[nIdx] || NOTE_META[0];
        const span = document.createElement("span");
        span.className = "melody-pill";
        span.textContent = `${i + 1}. ${meta.label}`;
        pills.appendChild(span);
      });
    }
  }

  function initGateConfigEvents() {
    document.querySelectorAll("[data-gate-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        db.config.activeGate = btn.dataset.gateOpt;
        renderGateConfig();
        updateStatus();
        showToast(`Chiave attiva impostata su: ${btn.dataset.gateOpt.toUpperCase()} (ricorda di salvare)`);
      });
    });

    document.getElementById("cfg-curator-bypass")?.addEventListener("change", (e) => {
      db.config.showCuratorBypass = e.target.checked;
    });

    document.querySelectorAll(".melody-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const note = Number(btn.dataset.note);
        if ((db.config.soundSequence || []).length >= 6) {
          showToast("Massimo 6 note per sequenza.");
          return;
        }
        db.config.soundSequence.push(note);
        playNote(NOTE_META[note].freq);
        renderGateConfig();
      });
    });

    document.getElementById("btn-clear-melody")?.addEventListener("click", () => {
      db.config.soundSequence = [];
      renderGateConfig();
    });

    document.getElementById("btn-test-melody")?.addEventListener("click", () => {
      (db.config.soundSequence || []).forEach((nIdx, i) => {
        setTimeout(() => playNote(NOTE_META[nIdx].freq), i * 520);
      });
    });
  }

  /* ------------------------------------------------------------------------
     ARTWORKS GRID & INSPECTOR
  ------------------------------------------------------------------------ */
  function renderGrid() {
    const grid = document.getElementById("cms-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const q = searchQuery.toLowerCase();
    const list = db.artworks.filter((a) => {
      if (activeFilter === "celestiale" && a.era !== "celestiale") return false;
      if (activeFilter === "grimorio" && a.era !== "grimorio") return false;
      if (activeFilter === "VIDEO" && !a.video) return false;
      if (q && !(a.title || "").toLowerCase().includes(q) && !(a.roman || "").toLowerCase().includes(q)) return false;
      return true;
    });

    list.forEach((art) => {
      const card = document.createElement("article");
      card.className = "cms-card" + (art.id === selectedId ? " is-selected" : "");
      card.innerHTML = `
        <div class="cms-card__thumb">
          <img src="${art.thumb}" alt="${art.title}" loading="lazy" />
          ${art.video ? `<span class="cms-card__vid">▶ MP4</span>` : ""}
        </div>
        <div class="cms-card__title">${art.roman} · ${art.title}</div>
        <div class="cms-card__stages">
          ${STAGES.map((st) => `<button type="button" class="q-stage ${art.stage === st.key ? "is-active" : ""}" data-qstage="${st.key}">${st.short}</button>`).join("")}
        </div>
      `;

      card.querySelectorAll("[data-qstage]").forEach((sBtn) => {
        sBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          art.stage = sBtn.dataset.qstage;
          renderGrid();
          if (selectedId === art.id) openInspector(art.id);
        });
      });

      card.addEventListener("click", () => openInspector(art.id));
      grid.appendChild(card);
    });
  }

  function openInspector(id) {
    selectedId = id;
    const art = db.artworks.find((a) => a.id === id);
    if (!art) return;

    document.getElementById("inspector-empty").style.display = "none";
    document.getElementById("inspector-form").style.display = "flex";
    document.getElementById("ins-thumb").src = art.thumb;

    const badges = document.getElementById("ins-badges");
    badges.innerHTML = `<span>${(art.zoomLayers || []).length} STRATI ZOOM</span>` + (art.video ? `<span>▶ VIDEO ATTIVO</span>` : "");

    document.getElementById("ins-title").value = art.title || "";
    document.getElementById("ins-roman").value = art.roman || "";
    document.getElementById("ins-year").value = art.year || 2026;
    document.getElementById("ins-era").value = art.era || "celestiale";
    document.getElementById("ins-stage").value = art.stage || "NIGREDO";
    document.getElementById("ins-formula").value = art.formula || "";
    document.getElementById("ins-oracle").value = art.oracle || "";
    document.getElementById("ins-notes").value = art.notes || "";

    // Populate audio track selector & preview
    const audioSelect = document.getElementById("ins-audio-select");
    const audioPreview = document.getElementById("ins-audio-preview");
    if (audioSelect) {
      const lib = db.audioLibrary || [];
      audioSelect.innerHTML = `<option value="">— Nessuna traccia audio —</option>`;
      lib.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p.split("/").pop();
        audioSelect.appendChild(opt);
      });
      if (art.audio && !lib.includes(art.audio)) {
        const opt = document.createElement("option");
        opt.value = art.audio;
        opt.textContent = art.audio.split("/").pop();
        audioSelect.appendChild(opt);
      }
      audioSelect.value = art.audio || "";
    }
    if (audioPreview) {
      if (art.audio) {
        audioPreview.src = art.audio;
        audioPreview.style.display = "block";
      } else {
        audioPreview.pause();
        audioPreview.style.display = "none";
      }
    }

    renderGrid();
  }

  function bindInspectorInputs() {
    const map = [
      ["ins-title", "title"],
      ["ins-roman", "roman"],
      ["ins-year", "year"],
      ["ins-era", "era"],
      ["ins-stage", "stage"],
      ["ins-formula", "formula"],
      ["ins-oracle", "oracle"],
      ["ins-notes", "notes"],
    ];
    map.forEach(([elId, field]) => {
      document.getElementById(elId)?.addEventListener("input", (e) => {
        const art = db.artworks.find((a) => a.id === selectedId);
        if (!art) return;
        art[field] = field === "year" ? Number(e.target.value) : e.target.value;
        if (field === "title" || field === "roman" || field === "stage" || field === "era") {
          renderGrid();
        }
      });
    });

    // Audio selector change
    document.getElementById("ins-audio-select")?.addEventListener("change", (e) => {
      const art = db.artworks.find((a) => a.id === selectedId);
      if (!art) return;
      art.audio = e.target.value || null;
      const audioPreview = document.getElementById("ins-audio-preview");
      if (audioPreview) {
        if (art.audio) {
          audioPreview.src = art.audio;
          audioPreview.style.display = "block";
        } else {
          audioPreview.pause();
          audioPreview.style.display = "none";
        }
      }
      showToast("Traccia audio associata (ricorda di cliccare 💾 SALVA CODICE)");
    });

    // Audio MP3 Upload button
    document.getElementById("btn-upload-audio")?.addEventListener("click", async () => {
      const art = db.artworks.find((a) => a.id === selectedId);
      const fileInput = document.getElementById("ins-audio-file");
      const file = fileInput?.files?.[0];
      if (!art) { showToast("Seleziona prima una lamina."); return; }
      if (!file) { showToast("Scegli un file .mp3 / .m4a / .wav prima di caricare."); return; }

      showToast(`⬆ Caricamento ${file.name} in corso...`);
      try {
        const buf = await file.arrayBuffer();
        const res = await fetch("/api/upload-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Filename": file.name,
            "X-Artwork-Id": art.id,
          },
          body: buf,
        });
        const json = await res.json();
        if (json.ok) {
          if (json.data) db = json.data;
          else art.audio = json.path;
          fileInput.value = "";
          openInspector(art.id);
          showToast(`✦ ${json.message} — salvata e associata!`);
        } else {
          showToast("Errore upload: " + (json.error || "sconosciuto"));
        }
      } catch (_) {
        showToast("⚠ Server locale non attivo: avvia Avvia-Admin.command per caricare MP3.");
      }
    });
  }

  function init() {
    initAuth();
    initGateConfigEvents();
    bindInspectorInputs();

    document.querySelectorAll(".flt-btn").forEach((b) => {
      b.addEventListener("click", () => {
        activeFilter = b.dataset.flt;
        document.querySelectorAll(".flt-btn").forEach((x) => x.classList.toggle("is-active", x === b));
        renderGrid();
      });
    });

    document.getElementById("search-input")?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderGrid();
    });

    document.getElementById("btn-save")?.addEventListener("click", saveData);
    document.getElementById("btn-rescan")?.addEventListener("click", rescanFolders);
    document.getElementById("btn-publish")?.addEventListener("click", async () => {
      await saveData();
      showToast("🚀 Pubblicazione su GitHub Pages in corso...");
      try {
        const res = await fetch("/api/publish", { method: "POST" });
        const json = await res.json();
        if (json.ok) showToast("✦ " + json.message);
        else showToast("Errore pubblicazione: " + (json.error || "sconosciuto"));
      } catch (_) {
        showToast("⚠ Server locale non attivo: avvia Avvia-Admin.command.");
      }
    });

    loadData();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
