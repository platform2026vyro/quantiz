# Svuota la porta 3000 per il riavvio del server QuantX
$conns = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
"OK: porta 3000 liberata"
