# 一键启动肥鱼：NapCat + DSH + TTS（火山引擎豆包语音）+ 桥接自检
$ErrorActionPreference = 'Continue'
$tools = $PSScriptRoot
$root = Split-Path -Parent $tools

# 个人配置：缺失时从模板生成（不覆盖已有）
$localCfg = Join-Path $root 'config.local.json'
if (-not (Test-Path $localCfg)) {
  Copy-Item (Join-Path $root 'config.example.json') $localCfg
  Write-Host '  [提示] 已生成 config.local.json，请把 <...> 占位符替换成你的值' -ForegroundColor Yellow
}
$napcatDir = Join-Path $tools 'napcat\NapCat.52892.Shell'
$napcatQuick = Join-Path $napcatDir 'napcat.quick.bat'
$dshCandidates = @('E:\dsh桌面端\DeepSeek Harness.exe','C:\Program Files\DeepSeek Harness\DeepSeek Harness.exe')
$dshExe = $dshCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$ttsDir = 'E:\workspace\audio.cpp'
$ttsServer = Join-Path $ttsDir 'audiocpp_server.exe'
$ttsConfig = Join-Path $ttsDir 'server-all.json'
$gateway = Join-Path $ttsDir 'gateway-volc.mjs'

function Test-Port([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect('127.0.0.1', $port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(300)) { return $false }
    $client.EndConnect($iar)
    return $true
  } catch { return $false } finally { $client.Close() }
}

function Test-DshRunning {
  $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match 'DeepSeek|dsh' }
  return [bool]$procs
}

function Get-BridgeState {
  $log = Join-Path $env:USERPROFILE '.dsh\im-bridge\bridge.log'
  if (-not (Test-Path $log)) { return 'no-log' }
  $lines = @(Get-Content $log -Tail 200 -ErrorAction SilentlyContinue)
  $lastConnected = -1; $lastClosed = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'onebot websocket connected') { $lastConnected = $i }
    if ($lines[$i] -match 'onebot websocket closed') { $lastClosed = $i }
  }
  if ($lastConnected -gt $lastClosed) { return 'connected' }
  if ($lastClosed -ge 0) { return 'refused' }
  return 'unknown'
}

Write-Host ''
Write-Host '  肥鱼一键启动' -ForegroundColor Cyan
Write-Host '  ----------------------------'

Write-Host '[1/4] NapCat（6700）...' -NoNewline
if (Test-Port 6700) {
  Write-Host ' 已在运行' -ForegroundColor Green
} else {
  Write-Host ' 启动中' -ForegroundColor Yellow
  if (-not (Test-Path $napcatQuick)) {
    Write-Host "  x 找不到 $napcatQuick" -ForegroundColor Red
  } else {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"$napcatQuick`"" -WorkingDirectory $napcatDir
    $ready = $false
    Write-Host ' 等待端口…' -NoNewline
    for ($i = 0; $i -lt 90; $i++) {
      Start-Sleep -Seconds 1
      if (Test-Port 6700) { $ready = $true; break }
      if ($i -gt 0 -and $i % 15 -eq 0) { Write-Host '.' -NoNewline }
    }
    if ($ready) { Write-Host '  ok 已启动' -ForegroundColor Green }
    else {
      Write-Host '  x 90 秒内没起来' -ForegroundColor Red
      Write-Host '    如果 QQ 要重新登录，改用 napcat.bat 扫码' -ForegroundColor Yellow
    }
  }
}

Write-Host '[2/4] DSH 桌面端 ...' -NoNewline
if (Test-DshRunning) {
  Write-Host ' 已在运行' -ForegroundColor Green
} else {
  Write-Host ' 启动中' -ForegroundColor Yellow
  if ($dshExe) {
    Start-Process -FilePath $dshExe
    Start-Sleep -Seconds 10
    Write-Host '  ok 已启动' -ForegroundColor Green
  } else {
    Write-Host '  x 找不到 DeepSeek Harness.exe' -ForegroundColor Red
  }
}

Write-Host '[3/4] TTS（火山引擎豆包语音）...' -NoNewline
$ttsServerOk = $true
if (-not (Test-Port 8080)) {
  if ((Test-Path $ttsServer) -and (Test-Path $ttsConfig)) {
    Start-Process -FilePath $ttsServer -ArgumentList @('--config',$ttsConfig,'--log','--log-file','server.log') -WorkingDirectory $ttsDir -WindowStyle Hidden
    $srvReady = $false
    for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Seconds 1; if (Test-Port 8080) { $srvReady = $true; break } }
    if (-not $srvReady) { $ttsServerOk = $false }
  } else { $ttsServerOk = $false }
}
if ($ttsServerOk -and -not (Test-Port 8090)) {
  if (Test-Path $gateway) { Start-Process -FilePath 'node' -ArgumentList @('gateway.mjs') -WorkingDirectory $ttsDir -WindowStyle Hidden; Start-Sleep -Seconds 2 }
}
if ((Test-Port 8080) -and (Test-Port 8090)) {
  Write-Host '  ok 8080 + 8090' -ForegroundColor Green
} else {
  Write-Host '  x 未就绪（看 E:\workspace\audio.cpp\server.log）' -ForegroundColor Red
}

Write-Host '[4/4] 桥接状态 ...' -NoNewline
$state = 'unknown'
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Seconds 2
  $state = Get-BridgeState
  if ($state -eq 'connected') { break }
}
switch ($state) {
  'connected' { Write-Host ' ok 已连接' -ForegroundColor Green }
  'refused'   { Write-Host ' x NapCat 未连上（看 bridge.log）' -ForegroundColor Red }
  'no-log'    { Write-Host ' ? 还没有日志（DSH 可能仍在加载）' -ForegroundColor Yellow }
  default     { Write-Host ' ? 未知' -ForegroundColor Yellow }
}

Write-Host ''
Write-Host '  实测 probe-onebot ...' -NoNewline
$probe = Join-Path $root 'checks\probe-onebot.mjs'
if (Test-Path $probe) {
  $out = & node $probe --json 2>$null | Out-String
  if ($out -match '"connected":\s*true') {
    $self = if ($out -match '"selfId":\s*"(\d+)"') { $Matches[1] } else { '?' }
    Write-Host " ok connected，selfId=$self" -ForegroundColor Green
  } else {
    Write-Host ' x 未连接' -ForegroundColor Red
  }
} else {
  Write-Host ' 找不到 probe-onebot.mjs' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '  现在可以在 QQ 里私聊肥鱼了。窗口别关。' -ForegroundColor Cyan
Write-Host ''