param(
  [int]$ExceptPid = 0,
  [switch]$IncludePyLaunchers
)

$names = @('python.exe')
if ($IncludePyLaunchers) {
  $names += 'py.exe'
}

$stopped = 0

Get-CimInstance Win32_Process |
  Where-Object {
    if ($_.ProcessId -eq $ExceptPid) { return $false }
    if ($_.Name -notin $names) { return $false }
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    return $cmd -like '*main.py*'
  } |
  ForEach-Object {
    Write-Host "Stopping bot PID $($_.ProcessId): $($_.Name)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $stopped++
  }

if ($stopped -gt 0) {
  Write-Host "Stopped $stopped duplicate bot process(es)."
  Start-Sleep -Seconds 1
}
