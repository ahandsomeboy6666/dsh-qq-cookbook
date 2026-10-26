# 任务 01：DSH 环境探针

## 目标

确认 DSH 版本、profile、鉴权、协议端四个事实，输出机读 JSON。

## 输入

- 本机 `dsh` CLI（`dsh --version`）
- `~/.dsh/`（`.credentials.yaml`、`profiles/`）
- 协议端配置（NapCat 或 SnowLuma 的 WS/HTTP 地址与 token）
- 工作区 `deepseek-harness/packages/` 的能力文档（只读）

## 输出

- 新增 `checks/probe-dsh.mjs`，支持 `--json`
- 输出字段：`dshVersion`、`nodeVersion`、`profiles[]`、`auth.credentialsFileExists`、`auth.cookieMinted`、`webApi.reachable`、`onebot.connected`、`onebot.selfId`
- 回填 [能力矩阵](../docs/references/dsh-capability-matrix.md) 的「本机实测」表

## 验收

- [ ] `node checks/probe-dsh.mjs --json` → 退出码 0，`dshVersion` 非空
- [ ] `node checks/probe-dsh.mjs --json` → `profiles` 含 `web`
- [ ] `node checks/probe-dsh.mjs --json` → `auth.credentialsFileExists` 为布尔值
- [ ] `node checks/check-assets.mjs` → 全绿

## 人工验收

- 把探针输出的 `dshVersion` 与 `dsh --version` 对比，必须一致。
- 把 `profiles` 与 `~/.dsh/profiles` 目录对比，必须一致。

## 不做什么

- 不启动/停止 DSH、NapCat、AstrBot 任何服务。
- 不修改 `~/.dsh` 下任何文件。
- 不写桥接业务代码（那是 02、03 的事）。
- 不把协议端 token 写进探针输出（只报「有无」）。
