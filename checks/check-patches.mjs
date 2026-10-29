#!/usr/bin/env node
/**
 * 本地补丁检查：确认 vendor/dsh-im-bridge 的 fork 补丁还在，且群聊唤醒配置在有效区间。
 *
 * vendor 不在（CI / 别人 clone / 未装插件）→ 输出 SKIP，退出码 0。
 * 用法：node checks/check-patches.mjs [--json]
 */
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const ROOT = join(import.meta.dirname, '..')
const VENDOR = join(ROOT, 'vendor', 'dsh-im-bridge', 'index.js')
const VENDOR_CTX = join(ROOT, 'vendor', 'dsh-im-bridge', 'operation-context.js')
const VENDOR_FEATURES = join(ROOT, 'vendor', 'dsh-im-bridge', 'bridge-features.js')
const PROFILE = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'desktop', 'cordis.patch.yml')
const json = process.argv.includes('--json')

let code = null
let ctxCode = ''
let featuresCode = ''
try { code = await readFile(VENDOR, 'utf8') } catch { /* 未安装 */ }
try { ctxCode = await readFile(VENDOR_CTX, 'utf8') } catch { /* 老版本没有这个文件 */ }
try { featuresCode = await readFile(VENDOR_FEATURES, 'utf8') } catch { /* 老版本没有这个文件 */ }

if (code === null) {
  if (json) console.log(JSON.stringify({ skipped: true, reason: 'vendor/dsh-im-bridge 不存在' }, null, 2))
  else console.log('\n补丁检查\n\n  SKIP  vendor/dsh-im-bridge 不存在（CI 或本机未装插件）\n')
  process.exit(0)
}

const PATCHES = [
  ['P1 群聊空 @ 占位', '（只 @ 了你，没说话）'],
  ['P2 群预设跳过 whale', "persona.preset !== 'whale'"],
  ['P3 学习检索用 standard', "agentPreset:'standard'"],
  ['P4 群聊唤醒层', 'ambient: buffered'],
  ['P5 群回复不 @ 人', 'groupReplyAt === true'],
  ['P6 语音标签兜底', '\\|\\s*语音\\s*\\|'],
  ['P7 情境判断宽容解析', 'const block=String(text).match'],
  ['P8 @别人时不插嘴', '@ 的是别人，且没叫她'],
  ['P9 昵称只在像叫她时算', '像在叫她'],
  ['P10 群聊放行只读联网', 'group allowed read-only web tool'],
  ['P11 群聊 guard 放行联网', '群里只开放只读联网查询'],
  ['P12 @别人还原昵称', 'resolveMemberName'],
  ['P13 她问过问题后的等回答窗口', 'groupAwaitingAnswer'],
  ['P14 按长度控制发话节奏', 'prevLen * 38'],
  ['P15 刚被提到后接问句', 'groupMentionedAt'],
  ['P16 短促呼叫也接', 'looksSummon'],
  ['P17 模型判断是否在跟她说话', 'groupIntentToMe'],
  ['P18 你开头的短句直接接', 'directYou'],
  ['P19 群图片记成[图片]', "image:'[图片]'"],
  ['P20 唤醒时带上缓冲里的图', '_bridgeContextImages'],
  ['P21 空缓冲返回统一形状', "return { text: '', images: [] }"],
  ['P22 异步入口不吞异常', 'handlePayloadCore failed'],
]
const patchResults = PATCHES.map(([name, needle]) => ({ name, ok: (code + ctxCode + featuresCode).includes(needle) }))

// ---- 配置：cordis.patch.yml 里的 im-bridge 段 ----
let config = ''
try { config = await readFile(PROFILE, 'utf8') } catch { /* 没有 profile */ }
const wakeBlock = config.match(/groupWake:[\s\S]{0,400}/)?.[0] ?? ''
const probability = Number(wakeBlock.match(/probability:\s*([0-9.]+)/)?.[1] ?? NaN)
const nicknames = wakeBlock.includes('肥鱼')
const napcatDir = config.match(/dir:\s*['"]?([^'"\n]+NapCat[^'"\n]*)['"]?/)?.[1] ?? ''
let napcatExists = false
if (napcatDir !== '') {
  try { napcatExists = (await stat(napcatDir.replaceAll('/', '\\'))).isDirectory() } catch { napcatExists = false }
}

const configChecks = [
  { name: '配置 groupWake 存在', ok: wakeBlock !== '' },
  { name: '唤醒概率在 (0,1]', ok: Number.isFinite(probability) && probability > 0 && probability <= 1, detail: String(probability) },
  { name: '昵称含「肥鱼」', ok: nicknames },
  { name: 'napcat.dir 指向存在的目录', ok: napcatExists, detail: napcatDir || '(未配置)' },
]

const all = [...patchResults, ...configChecks]
const ok = all.every((r) => r.ok)

if (json) {
  console.log(JSON.stringify({ vendor: VENDOR, profile: PROFILE, patches: patchResults, config: configChecks, ok }, null, 2))
} else {
  console.log('\n本地补丁检查\n')
  console.log(`  插件      ${VENDOR}`)
  console.log(`  配置      ${PROFILE === '' ? '(未找到)' : PROFILE}`)
  console.log('')
  for (const r of patchResults) console.log(`  ${r.ok ? 'OK  ' : 'MISS'}  ${r.name}`)
  for (const r of configChecks) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.name}${r.detail ? `  ${r.detail}` : ''}`)
  console.log('')
  if (!ok) console.log('  补丁缺失不影响仓库门禁，但群里会出现：@ 不理、Unknown agent preset、重复 @ 人等旧毛病。\n')
}
process.exit(ok ? 0 : 1)
