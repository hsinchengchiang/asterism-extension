/**
 * Asterism ✦ — Background Service Worker
 * 注册右键菜单，图片使用 Blob 二进制直传；页面使用 FormData 表单。
 */

const API = "https://asterism.art/api/collect";

// ── 注册右键菜单 ──────────────────────────────────────────────────────────────
function registerMenu() {
  console.log("[Asterism] registerMenu called");
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error("[Asterism] removeAll error:", chrome.runtime.lastError.message);
    }
    chrome.contextMenus.create({
      id: "send-to-asterism",
      title: "Add to Asterism",
      contexts: ["image"],
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("[Asterism] create error:", chrome.runtime.lastError.message);
      } else {
        console.log("[Asterism] context menu registered OK");
      }
    });
  });
}

console.log("[Asterism] service worker loaded");
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Asterism] onInstalled:", details.reason);
  registerMenu();
});
chrome.runtime.onStartup.addListener(() => {
  console.log("[Asterism] onStartup");
  registerMenu();
});

// ── 发送消息（每次先动态注入，content.js 顶部有冪等守卫）──────────────────
async function sendMsg(tabId, msg) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // chrome:// 等受保护页面无法注入，静默忽略
  }
}

// ── 监听点击 ──────────────────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "send-to-asterism" || !tab) return;

  // 阶段 1：立即触发 loading 状态
  await sendMsg(tab.id, { status: "loading" });

  const { token } = await chrome.storage.local.get("token");
  const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};

  const isImageIntent = !!info.srcUrl;

  try {
    let res;

    if (isImageIntent) {
      // ── 图片意图：Blob 二进制直传 ──────────────────────────────────────────
      // 1. 在插件端直接下载图片 Blob（避免后端服务器被防盗链拦截）
      const imgRes = await fetch(info.srcUrl);
      if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
      const blob = await imgRes.blob();

      // 2. 组装 FormData（不手动设置 Content-Type，让浏览器自动生成 boundary）
      const fd = new FormData();
      fd.append("asset_type", "image");
      fd.append("source_url", info.pageUrl ?? "");
      fd.append("title", tab.title ?? "");
      fd.append("file", blob, "image.jpg");

      res = await fetch(API, {
        method: "POST",
        headers: authHeaders,   // 只传 Authorization，不传 Content-Type
        body: fd,
      });
    } else {
      // ── 页面意图：FormData 表单（无文件）──────────────────────────────────
      const fd = new FormData();
      fd.append("asset_type", "page");
      fd.append("source_url", info.pageUrl ?? tab.url ?? "");
      fd.append("title", tab.title ?? "");

      res = await fetch(API, {
        method: "POST",
        headers: authHeaders,
        body: fd,
      });
    }

    if (res.ok) {
      const data = await res.json();
      await sendMsg(tab.id, { status: "success", asset_id: data.asset_id });
    } else if (res.status === 401) {
      await sendMsg(tab.id, { status: "error", msg: "登录已过期，请重新登录" });
    } else {
      await sendMsg(tab.id, { status: "error", msg: `收录失败 (${res.status})` });
    }
  } catch (_) {
    await sendMsg(tab.id, { status: "error", msg: "网络错误，请检查连接" });
  }
});
