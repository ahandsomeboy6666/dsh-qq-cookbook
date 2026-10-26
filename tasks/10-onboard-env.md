# 任务 D0：环境就绪

## 目标

确认 NapCat、DSH、插件三件事就绪，输出一份事实清单。

## 输入

- 已安装 NapCat，并扫码登录 QQ 小号
- NapCat 已开启 WebSocket 服务端与 HTTP API（记下端口与 token）
- 本机 DSH `0.2.0-rc.2`
- cheems135/dsh-qq-bridge 仓库路径

## 输出

- 探针输出（`probe-dsh`、`probe-onebot`、`check-install`）
- 一份「还缺什么」的 TODO（未装插件时由 `check-install` 给出）

## 验收

- [ ] `node checks/probe-onebot.mjs --json` → `connected=true` 且 `selfId` 非空
- [ ] `node checks/probe-dsh.mjs --json` → `dshVersion` 非空、`profiles` 含 `web`
- [ ] `node checks/check-install.mjs --json` → 输出 `installed` 布尔值（未装时给 TODO）
- [ ] `node checks/check-assets.mjs` → 全绿

## 人工验收

- NapCat 扫码登录成功，QQ 小号在线。
- 用小号给另一个号发一条消息，确认账号能正常收发。

## 不做什么

- 不装插件、不改 profile（那是 D1）。
- 不动 `D:\qqaibot` 的 AstrBot/NapCat 实例。
- 不把 token 写进任何会提交的文件。
