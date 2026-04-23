const API = 'https://asterism.art'

const loginView    = document.getElementById('login-view')
const connectedView = document.getElementById('connected-view')
const emailInput   = document.getElementById('email')
const passwordInput = document.getElementById('password')
const enterBtn     = document.getElementById('enter-btn')
const errEl        = document.getElementById('err')
const displayEmail = document.getElementById('display-email')
const logoutBtn    = document.getElementById('logout-btn')

// ── 初始化：检查已保存的 token ────────────────────────────────────────────────
chrome.storage.local.get(['token', 'email'], ({ token, email }) => {
  if (token) showConnected(email)
})

// ── 登录 ──────────────────────────────────────────────────────────────────────
enterBtn.addEventListener('click', handleLogin)
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin()
})

async function handleLogin() {
  const email = emailInput.value.trim()
  const password = passwordInput.value
  errEl.textContent = ''

  if (!email || !password) {
    errEl.textContent = '请填写邮箱和密码'
    return
  }

  enterBtn.disabled = true
  enterBtn.textContent = '...'

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      errEl.textContent = res.status === 401 ? '账号或密码错误' : `错误 ${res.status}`
      return
    }

    const { access_token } = await res.json()
    await chrome.storage.local.set({ token: access_token, email })
    showConnected(email)
  } catch {
    errEl.textContent = '网络错误，请稍后重试'
  } finally {
    enterBtn.disabled = false
    enterBtn.textContent = '进入'
  }
}

// ── 登出 ──────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'email'])
  showLogin()
})

// ── 状态切换 ──────────────────────────────────────────────────────────────────
function showConnected(email) {
  loginView.style.display = 'none'
  connectedView.style.display = 'block'
  displayEmail.textContent = email ?? ''
}

function showLogin() {
  connectedView.style.display = 'none'
  loginView.style.display = 'block'
  emailInput.value = ''
  passwordInput.value = ''
  errEl.textContent = ''
}
