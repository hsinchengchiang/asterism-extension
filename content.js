/**
 * Asterism ✦ — Content Script
 * 黑石碑注入面板：loading → success+tagging → dismiss
 */

if (window.__asterismInjected) { throw new Error("already injected"); }
window.__asterismInjected = true;

const API_BASE = "https://asterism.art";
const PANEL_ID = "asterism-panel";

let dismissTimer = null;
let currentAssetId = null;

// ── 面板操作 ──────────────────────────────────────────────────────────────────

function getOrCreatePanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  // 注入样式（只注入一次）
  if (!document.getElementById("asterism-styles")) {
    const style = document.createElement("style");
    style.id = "asterism-styles";
    style.textContent = `
      #asterism-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        width: 240px;
        padding: 16px 18px;
        background: #050505;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 6px;
        font-family: -apple-system, system-ui, sans-serif;
        box-sizing: border-box;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
      }
      #asterism-panel.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      #asterism-panel.dismissing {
        opacity: 0;
        transform: translateY(-4px);
      }
      #asterism-status {
        font-size: 12px;
        letter-spacing: 0.04em;
        color: rgba(255, 255, 255, 0.45);
        user-select: none;
        transition: color 0.3s ease;
      }
      #asterism-panel.success #asterism-status {
        color: rgba(212, 163, 115, 0.85);
      }
      #asterism-panel.error #asterism-status {
        color: rgba(220, 80, 80, 0.85);
      }
      #asterism-divider {
        display: none;
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
        margin: 12px 0 10px;
      }
      #asterism-tag-input {
        display: none;
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 12px;
        font-family: inherit;
        letter-spacing: 0.02em;
        caret-color: rgba(212, 163, 115, 0.9);
        padding: 0;
      }
      #asterism-tag-input::placeholder {
        color: rgba(255, 255, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
  }

  panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div id="asterism-status">✦ 视界捕获中...</div>
    <div id="asterism-divider"></div>
    <input id="asterism-tag-input" type="text" placeholder="Add tags... (Enter 确认)" autocomplete="off" spellcheck="false" />
  `;
  document.body.appendChild(panel);

  // 强制 reflow 后触发动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => panel.classList.add("visible"));
  });

  return panel;
}

function showTagInput(assetId) {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  panel.classList.add("success");
  document.getElementById("asterism-status").textContent = "✦ 已坠入星图";
  document.getElementById("asterism-divider").style.display = "block";

  const input = document.getElementById("asterism-tag-input");
  input.style.display = "block";
  input.focus();

  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const raw = input.value.trim();
    if (raw) {
      const tags = raw.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
      await patchTags(assetId, tags);
    }
    dismiss();
  });
}

async function patchTags(assetId, tags) {
  try {
    const { token } = await chrome.storage.local.get("token");
    if (!token) return;
    await fetch(`${API_BASE}/api/items/${assetId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ tags }),
    });
  } catch (_) {}
}

function dismiss() {
  clearTimeout(dismissTimer);
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.classList.remove("visible");
  panel.classList.add("dismissing");
  setTimeout(() => panel.remove(), 300);
}

function resetDismissTimer() {
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(dismiss, 3000);
}

// ── 消息监听 ──────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.status === "loading") {
    getOrCreatePanel();
    resetDismissTimer();
  } else if (msg.status === "success" && msg.asset_id) {
    currentAssetId = msg.asset_id;
    getOrCreatePanel();
    showTagInput(msg.asset_id);
    resetDismissTimer();
  } else if (msg.status === "error") {
    const panel = getOrCreatePanel();
    panel.classList.add("error");
    document.getElementById("asterism-status").textContent = `✦ ${msg.msg}`;
    resetDismissTimer();
  }
});
