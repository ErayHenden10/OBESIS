(function () {
  if (document.getElementById("universalSearchOverlay")) return;

  const style = document.createElement("style");
  style.innerHTML = `
    .us-overlay{
      position:fixed;inset:0;background:rgba(7,20,40,.56);
      z-index:9999;display:none;align-items:flex-start;justify-content:center;
      padding-top:90px;backdrop-filter:blur(5px)
    }
    .us-overlay.show{display:flex}
    .us-box{
      width:min(760px,92vw);background:#fff;border-radius:24px;
      box-shadow:0 30px 90px rgba(0,0,0,.25);overflow:hidden;
      border:1px solid #e5eaf2
    }
    .us-input-wrap{
      height:74px;display:flex;align-items:center;gap:14px;
      padding:0 22px;border-bottom:1px solid #edf1f7
    }
    .us-input-wrap i{font-size:20px;color:#2f7cff}
    .us-input{
      border:none;outline:none;font-size:20px;width:100%;color:#172033
    }
    .us-hint{
      font-size:12px;color:#7a8799;background:#f1f5fb;
      border:1px solid #e2e8f2;padding:6px 9px;border-radius:10px;
      white-space:nowrap
    }
    .us-results{max-height:520px;overflow:auto;padding:12px}
    .us-item{
      display:flex;align-items:center;gap:14px;padding:14px;
      border-radius:16px;cursor:pointer;border:1px solid transparent
    }
    .us-item:hover,.us-item.active{
      background:#eef5ff;border-color:rgba(47,124,255,.28)
    }
    .us-icon{
      width:46px;height:46px;border-radius:14px;background:#eef5ff;
      color:#2f7cff;display:flex;align-items:center;justify-content:center;
      font-size:18px;flex-shrink:0
    }
    .us-main{flex:1;min-width:0}
    .us-title{font-weight:900;color:#172033;margin-bottom:4px}
    .us-sub{font-size:13px;color:#7a8799;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .us-type{
      font-size:11px;font-weight:900;padding:6px 9px;border-radius:999px;
      background:#f1f5f9;color:#475569;white-space:nowrap
    }
    .us-empty{
      padding:35px;text-align:center;color:#7a8799
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "universalSearchOverlay";
  overlay.className = "us-overlay";
  overlay.innerHTML = `
    <div class="us-box">
      <div class="us-input-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="universalSearchInput" class="us-input" placeholder="ERP içinde ara... Müşteri, stok, iş emri, teklif, fatura">
        <span class="us-hint">ESC</span>
      </div>
      <div id="universalSearchResults" class="us-results">
        <div class="us-empty">Aramak için en az 2 karakter yaz.</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById("universalSearchInput");
  const results = document.getElementById("universalSearchResults");

  let timer = null;
  let items = [];
  let activeIndex = -1;

  function openSearch() {
    overlay.classList.add("show");
    input.value = "";
    items = [];
    activeIndex = -1;
    results.innerHTML = `<div class="us-empty">Aramak için en az 2 karakter yaz.</div>`;
    setTimeout(() => input.focus(), 50);
  }

  function closeSearch() {
    overlay.classList.remove("show");
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function search(q) {
    if (!q || q.length < 2) {
      results.innerHTML = `<div class="us-empty">Aramak için en az 2 karakter yaz.</div>`;
      return;
    }

    results.innerHTML = `<div class="us-empty">Aranıyor...</div>`;

    try {
      const r = await fetch(`/api/universal-search?q=${encodeURIComponent(q)}`);
      const d = await r.json();

      if (!d.success) throw new Error(d.message || "Arama hatası");

      items = d.data || [];
      activeIndex = -1;

      if (!items.length) {
        results.innerHTML = `<div class="us-empty">Sonuç bulunamadı.</div>`;
        return;
      }

      results.innerHTML = items.map((x, i) => `
        <div class="us-item" data-index="${i}">
          <div class="us-icon"><i class="fa-solid ${escapeHtml(x.icon || "fa-circle")}"></i></div>
          <div class="us-main">
            <div class="us-title">${escapeHtml(x.title || "-")}</div>
            <div class="us-sub">${escapeHtml(x.subtitle || "")} ${x.extra ? "• " + escapeHtml(x.extra) : ""}</div>
          </div>
          <div class="us-type">${escapeHtml(x.type || "-")}</div>
        </div>
      `).join("");

      document.querySelectorAll(".us-item").forEach(el => {
        el.addEventListener("click", () => {
          const index = Number(el.dataset.index);
          goItem(index);
        });
      });
    } catch (err) {
      results.innerHTML = `<div class="us-empty">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderActive() {
    document.querySelectorAll(".us-item").forEach((el, i) => {
      el.classList.toggle("active", i === activeIndex);
    });
  }

  function goItem(index) {
    const item = items[index];
    if (!item) return;
    window.location.href = item.url;
  }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => search(input.value.trim()), 250);
  });

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
      return;
    }

    if (!overlay.classList.contains("show")) return;

    if (e.key === "Escape") {
      closeSearch();
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      renderActive();
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderActive();
    }

    if (e.key === "Enter") {
      if (activeIndex >= 0) goItem(activeIndex);
    }
  });

  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeSearch();
  });
})();