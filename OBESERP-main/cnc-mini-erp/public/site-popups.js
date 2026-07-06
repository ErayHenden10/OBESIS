(function () {
  "use strict";

  if (window.__obesPopupLoaded) return;
  window.__obesPopupLoaded = true;

  const TYPES = {
    success: {
      title: "Basarili",
      icon: "fa-circle-check",
      tone: "#16a34a",
      soft: "#eaf8ef"
    },
    error: {
      title: "Hata",
      icon: "fa-circle-xmark",
      tone: "#dc2626",
      soft: "#fee2e2"
    },
    warning: {
      title: "Onay",
      icon: "fa-triangle-exclamation",
      tone: "#d97706",
      soft: "#fff7e6"
    },
    info: {
      title: "Bilgi",
      icon: "fa-circle-info",
      tone: "#2563eb",
      soft: "#eef5ff"
    }
  };

  let overlay = null;
  let toast = null;
  let activeDialogResolver = null;

  function injectStyles() {
    if (document.getElementById("obes-popup-style")) return;

    const style = document.createElement("style");
    style.id = "obes-popup-style";
    style.textContent = `
      .obes-popup-overlay{
        position:fixed;
        inset:0;
        z-index:100000;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(7,20,40,.58);
        backdrop-filter:blur(8px);
        opacity:0;
        visibility:hidden;
        transition:opacity .18s ease, visibility .18s ease;
      }
      .obes-popup-overlay.show{
        opacity:1;
        visibility:visible;
      }
      .obes-popup-card{
        width:min(460px,100%);
        background:#fff;
        color:#172033;
        border:1px solid #e5eaf2;
        border-radius:18px;
        box-shadow:0 28px 90px rgba(7,20,40,.30);
        overflow:hidden;
        transform:translateY(10px) scale(.98);
        transition:transform .18s ease;
        font-family:"Inter",Arial,sans-serif;
      }
      .obes-popup-overlay.show .obes-popup-card{
        transform:translateY(0) scale(1);
      }
      .obes-popup-topbar{
        height:4px;
        background:#2563eb;
      }
      .obes-popup-header{
        display:flex;
        align-items:center;
        gap:14px;
        padding:22px 24px 12px;
      }
      .obes-popup-icon{
        width:48px;
        height:48px;
        border-radius:14px;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
        font-size:21px;
        background:#eef5ff;
        color:#2563eb;
      }
      .obes-popup-heading{
        min-width:0;
      }
      .obes-popup-title{
        margin:0;
        font-size:19px;
        line-height:1.25;
        font-weight:800;
        color:#172033;
      }
      .obes-popup-subtitle{
        margin-top:4px;
        font-size:12px;
        font-weight:700;
        color:#7a8799;
        text-transform:uppercase;
        letter-spacing:.08em;
      }
      .obes-popup-message{
        padding:0 24px 20px;
        color:#536176;
        font-size:14px;
        line-height:1.65;
        white-space:pre-wrap;
      }
      .obes-popup-input-wrap{
        display:none;
        padding:0 24px 20px;
      }
      .obes-popup-input{
        width:100%;
        height:46px;
        border:1px solid #dce3ee;
        border-radius:12px;
        padding:0 13px;
        color:#172033;
        background:#fff;
        outline:none;
        font:600 14px "Inter",Arial,sans-serif;
        transition:border-color .18s ease, box-shadow .18s ease;
      }
      .obes-popup-input:focus{
        border-color:#2f7cff;
        box-shadow:0 0 0 4px rgba(47,124,255,.10);
      }
      .obes-popup-actions{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        padding:16px 24px 22px;
        border-top:1px solid #edf1f7;
        background:#fbfcfe;
      }
      .obes-popup-btn{
        min-width:96px;
        height:42px;
        border:0;
        border-radius:12px;
        padding:0 16px;
        font:800 13px "Inter",Arial,sans-serif;
        cursor:pointer;
        transition:transform .16s ease, box-shadow .16s ease, background .16s ease;
      }
      .obes-popup-btn:hover{
        transform:translateY(-1px);
      }
      .obes-popup-btn.secondary{
        background:#eef2f7;
        color:#36465b;
      }
      .obes-popup-btn.primary{
        color:#fff;
        background:linear-gradient(135deg,#1262f3,#3182ff);
        box-shadow:0 12px 24px rgba(47,124,255,.20);
      }
      .obes-toast-stack{
        position:fixed;
        right:22px;
        bottom:22px;
        z-index:100001;
        display:flex;
        flex-direction:column;
        gap:10px;
        width:min(390px,calc(100vw - 44px));
        pointer-events:none;
      }
      .obes-toast{
        position:relative;
        display:flex;
        align-items:flex-start;
        gap:12px;
        overflow:hidden;
        padding:14px 15px 16px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:14px;
        color:#fff;
        background:#071428;
        box-shadow:0 20px 55px rgba(7,20,40,.28);
        transform:translateY(10px);
        opacity:0;
        animation:obesToastIn .18s ease forwards;
        pointer-events:auto;
        font-family:"Inter",Arial,sans-serif;
      }
      .obes-toast-icon{
        width:34px;
        height:34px;
        border-radius:10px;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
        background:rgba(255,255,255,.14);
        font-size:16px;
      }
      .obes-toast-content{
        min-width:0;
        flex:1;
      }
      .obes-toast-title{
        font-size:13px;
        line-height:1.25;
        font-weight:800;
        margin-bottom:4px;
      }
      .obes-toast-message{
        font-size:13px;
        line-height:1.45;
        color:rgba(255,255,255,.86);
        white-space:pre-wrap;
      }
      .obes-toast-close{
        width:28px;
        height:28px;
        border:0;
        border-radius:9px;
        color:#fff;
        background:rgba(255,255,255,.10);
        cursor:pointer;
        flex-shrink:0;
      }
      .obes-toast-progress{
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        height:3px;
        background:rgba(255,255,255,.16);
      }
      .obes-toast-progress span{
        display:block;
        width:100%;
        height:100%;
        background:rgba(255,255,255,.86);
        transform-origin:left;
        animation:obesToastProgress linear forwards;
      }
      @keyframes obesToastIn{
        to{opacity:1;transform:translateY(0)}
      }
      @keyframes obesToastOut{
        to{opacity:0;transform:translateY(8px)}
      }
      @keyframes obesToastProgress{
        from{transform:scaleX(1)}
        to{transform:scaleX(0)}
      }
      @media(max-width:560px){
        .obes-popup-overlay{align-items:flex-end;padding:14px}
        .obes-popup-card{border-radius:18px}
        .obes-popup-actions{flex-direction:column-reverse}
        .obes-popup-btn{width:100%}
        .obes-toast-stack{right:14px;bottom:14px;width:calc(100vw - 28px)}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBodyReady(callback) {
    if (document.body) {
      callback();
      return;
    }
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  }

  function ensureElements() {
    injectStyles();

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "obes-popup-overlay";
      overlay.innerHTML = `
        <div class="obes-popup-card" role="dialog" aria-modal="true">
          <div class="obes-popup-topbar"></div>
          <div class="obes-popup-header">
            <div class="obes-popup-icon"><i class="fa-solid fa-circle-info"></i></div>
            <div class="obes-popup-heading">
              <h3 class="obes-popup-title">Bilgi</h3>
              <div class="obes-popup-subtitle">OBES ERP</div>
            </div>
          </div>
          <div class="obes-popup-message"></div>
          <div class="obes-popup-input-wrap">
            <input class="obes-popup-input" type="text" autocomplete="off">
          </div>
          <div class="obes-popup-actions">
            <button class="obes-popup-btn secondary" type="button" data-obes-cancel>Vazgec</button>
            <button class="obes-popup-btn primary" type="button" data-obes-ok>Tamam</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener("click", function (event) {
        if (event.target === overlay && activeDialogResolver) {
          activeDialogResolver(false);
        }
      });
    }

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "obes-toast-stack";
      document.body.appendChild(toast);
    }
  }

  function typeData(type) {
    return TYPES[type] || TYPES.info;
  }

  function guessType(message) {
    const text = String(message || "").toLowerCase();
    if (text.includes("basar") || text.includes("kaydedildi") || text.includes("olusturuldu") || text.includes("onaylandi")) return "success";
    if (text.includes("hata") || text.includes("basarisiz") || text.includes("alÄ±namadÄ±") || text.includes("alinamadi") || text.includes("silinemedi")) return "error";
    if (text.includes("zorunlu") || text.includes("emin") || text.includes("uyari") || text.includes("yetki")) return "warning";
    return "info";
  }

  function showToast(message, type, duration) {
    ensureBodyReady(function () {
      ensureElements();

      const data = typeData(type || guessType(message));
      const item = document.createElement("div");
      item.className = "obes-toast";
      item.style.background = data.tone;
      item.innerHTML = `
        <div class="obes-toast-icon"><i class="fa-solid ${data.icon}"></i></div>
        <div class="obes-toast-content">
          <div class="obes-toast-title">${data.title}</div>
          <div class="obes-toast-message"></div>
        </div>
        <button class="obes-toast-close" type="button" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
        <div class="obes-toast-progress"><span></span></div>
      `;
      item.querySelector(".obes-toast-message").textContent = message == null ? "" : String(message);
      item.querySelector(".obes-toast-progress span").style.animationDuration = `${duration || 3200}ms`;

      function close() {
        item.style.animation = "obesToastOut .16s ease forwards";
        setTimeout(function () {
          item.remove();
        }, 170);
      }

      item.querySelector(".obes-toast-close").addEventListener("click", close);
      toast.appendChild(item);
      setTimeout(close, duration || 3200);
    });
  }

  function openDialog(type, message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      ensureBodyReady(function () {
        ensureElements();

        const data = typeData(type);
        const icon = overlay.querySelector(".obes-popup-icon");
        const topbar = overlay.querySelector(".obes-popup-topbar");
        const title = overlay.querySelector(".obes-popup-title");
        const messageEl = overlay.querySelector(".obes-popup-message");
        const inputWrap = overlay.querySelector(".obes-popup-input-wrap");
        const input = overlay.querySelector(".obes-popup-input");
        const cancel = overlay.querySelector("[data-obes-cancel]");
        const ok = overlay.querySelector("[data-obes-ok]");

        icon.style.background = data.soft;
        icon.style.color = data.tone;
        icon.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
        topbar.style.background = data.tone;
        title.textContent = options.title || data.title;
        messageEl.textContent = message == null ? "" : String(message);
        ok.textContent = options.okText || "Tamam";
        cancel.textContent = options.cancelText || "Vazgec";
        cancel.style.display = options.confirm || options.prompt ? "inline-flex" : "none";
        inputWrap.style.display = options.prompt ? "block" : "none";
        input.value = options.defaultValue || "";

        function close(value) {
          overlay.classList.remove("show");
          activeDialogResolver = null;
          ok.removeEventListener("click", onOk);
          cancel.removeEventListener("click", onCancel);
          document.removeEventListener("keydown", onKey);
          resolve(value);
        }

        function onOk() {
          close(options.prompt ? input.value : true);
        }

        function onCancel() {
          close(options.prompt ? null : false);
        }

        function onKey(event) {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && (options.confirm || options.prompt)) onOk();
        }

        activeDialogResolver = close;
        ok.addEventListener("click", onOk);
        cancel.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKey);
        overlay.classList.add("show");
        setTimeout(function () {
          (options.prompt ? input : ok).focus();
        }, 30);
      });
    });
  }

  window.appAlert = function (message, type) {
    showToast(message, type);
  };

  window.appInfo = function (message) {
    return openDialog("info", message, { title: "Bilgi" });
  };

  window.appSuccess = function (message) {
    return openDialog("success", message, { title: "Basarili" });
  };

  window.appError = function (message) {
    return openDialog("error", message, { title: "Hata" });
  };

  window.appWarning = function (message) {
    return openDialog("warning", message, { title: "Uyari" });
  };

  window.appConfirm = function (message, title) {
    return openDialog("warning", message, {
      title: title || "Onay",
      confirm: true,
      okText: "Evet",
      cancelText: "Vazgec"
    });
  };

  window.appPrompt = function (message, defaultValue, title) {
    return openDialog("info", message, {
      title: title || "Bilgi Girisi",
      prompt: true,
      defaultValue: defaultValue || "",
      okText: "Tamam",
      cancelText: "Vazgec"
    });
  };

  window.alert = function (message) {
    window.appAlert(message, guessType(message));
  };

  window.OBESPopup = {
    alert: window.appAlert,
    info: window.appInfo,
    success: window.appSuccess,
    error: window.appError,
    warning: window.appWarning,
    confirm: window.appConfirm,
    prompt: window.appPrompt
  };
})();
