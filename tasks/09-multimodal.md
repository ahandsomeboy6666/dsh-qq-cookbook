# 任务 09：图片入站与媒体上限

## 目标

QQ 发图能理解，超限给人话，内网地址被拒。

## 输入

- 任务 02 的回环、任务 05 的 SSRF 防护
- [ADR-009](../docs/decisions/ADR-009-model-routing.md) 已接受
- 协议端图片事件字段（NapCat / SnowLuma 各一份 fixture）

## 输出

- 新增 `src/media/download.mjs`（SSRF 防护、字节/像素/数量上限）
- 新增 `src/media/encode.mjs`（转 base64 + mimeType，交给 DSH）
- 新增 `tests/media.test.mjs`、`tests/fixtures/image-event.json`
- 新增 `npm run test:vision`

## 验收

- [ ] `npm run test:vision` → 3 张测试图（截图/照片/表情）都能描述正确
- [ ] `npm test -- media` → 超 8MB / 64MP / 5 张被拒并给人话
- [ ] `node checks/check-ssrf.mjs` → 内网地址、带凭据 URL、非 http(s) 被拒
- [ ] `npm test` → 全绿

## 人工验收

- 手机发一张截图问「这写的啥」，确认能读到文字。
- 发一张 10MB 的图，确认提示「图有点大，压缩一下再发」。

## 不做什么

- 不做语音入站/出站、不做表情（M4 后续任务）。
- 不做视频与文件传输。
- 不把图片存进 `state/`（只存 DSH 附件引用）。
