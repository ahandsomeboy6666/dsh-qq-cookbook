# 一键启动肥鱼：NapCat + DSH + 桥接自检
$ErrorActionPreference = 'Continue'
$tools = $PSScriptRoot
$root = Split-Path -Parent $tools
$napcatDir = Join-Path $tools 'napcat\NapCat.52892.Shell'
$napcatQuick = Join-Path $napcatDir 'napcat.quick.bat'
$dshCandidates = @('E:\dsh桌面端\DeepSeek Harness.exe','C:\Program Files\DeepSeek Harness\DeepSeek Harness.exe')
$dshExe = $dshCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

function Test-Port([int]$port) {
  # Test-NetConnection 每次要 1-2 秒；直接用 TcpClient，300ms 超时。
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
  $lines = @(Get-Content $log -Tail 30 -ErrorAction SilentlyContinue)
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

Write-Host '[1/3] NapCat（6700）...' -NoNewline
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

Write-Host '[2/3] DSH 桌面端 ...' -NoNewline
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

Write-Host '[3/3] 桥接状态 ...' -NoNewline
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