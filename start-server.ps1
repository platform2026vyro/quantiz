# QuantX server — start automatico + restart se crasha
$svcDir = "C:\Users\walte\Documents\Default Project\quantx"
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = "C:\Program Files\nodejs\node.exe" }
Set-Location $svcDir
while ($true) {
    Write-Host ("[QuantX] Start server " + (Get-Date -Format s))
    & $node "$svcDir\server.js" *>> "$svcDir\server-run.log"
    Write-Host "[QuantX] Server e uscito - restart fra 3s $(Get-Date -Format s)"
    Start-Sleep -Seconds 3
}