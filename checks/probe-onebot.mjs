#!/usr/bin/env node
/**
 * OneBot 环境探针：确认 NapCat 是否可达、账号是否在线。
 *
 * 用法：
 *   node checks/probe-onebot.mjs
 *   node checks/probe-onebot.mjs --json
 *   node checks/probe-onebot.mjs --url http://127.0.0.1:3000 --token xxx
 *
 * 退出码：0 = 探测完成（连不上也返回 0，只报告事实）；1 = 参数错误。
 */
const args = process.argv.slice(2)
const JSON_MODE = args.includes('--json')
const REQUIRE = args.includes('--require')
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const URL_BASE = (opt('--url') ?? process.env.ONEBOT_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')
const TOKEN = opt('--token') ?? process.env.ONEBOT_TOKEN ?? ''

async function call(path) {
  const headers = {}
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  try {
    const res = await fetch(`${URL_BASE}${path}`, { headers, signal: AbortSignal.timeout(3000) })
    const text = await res.text()
    let body = null
    try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    return { ok: false, status: null, error: err.cause?.code ?? err.name }
  }
}

const login = await call('/get_login_info')
const status = await call('/get_status')

const out = {
  generatedAt: new Date().toISOString(),
  url: URL_BASE,
  connected: Boolean(login.ok && login.body?.status === 'ok'),
  selfId: login.body?.data?.user_id ? String(login.body.data.user_id) : null,
  nickname: login.body?.data?.nickname ?? null,
  status: status.ok ? status.body?.data ?? status.body : null,
  error: login.error ?? (login.ok ? null : `HTTP ${login.status}`),
  hint: null
}

if (!out.connected) {
  out.hint = '检查：NapCat 是否启动、HTTP API 端口是否 3000（不是 WS 的 3001）、accessToken 是否一致'
}

if (JSON_MODE) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log('\nOneBot 探针\n')
  console.log(`  URL        ${out.url}`)
  console.log(`  连接       ${out.connected ? '正常' : '失败'}`)
  if (out.selfId) console.log(`  账号       ${out.nickname ?? ''} (${out.selfId})`)
  if (out.error) console.log(`  错误       ${out.error}`)
  if (out.hint) console.log(`  提示       ${out.hint}`)
  console.log('')
}

process.exit(REQUIRE && !out.connected ? 1 : 0)
