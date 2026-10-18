# Test prelievo sotto soglia: deve essere istantaneo (fiducia)
$base = 'http://localhost:3000'
$reg = Invoke-RestMethod -Method Post -Uri "$base/api/register" -ContentType 'application/json' -Body '{"name":"Marco Verdi","email":"marco@low.it","password":"pass1234"}'
$tok = $reg.token
$dep = Invoke-RestMethod -Method Post -Uri "$base/api/deposit" -ContentType 'application/json' -Headers @{Authorization="Bearer $tok"} -Body '{"amount":10}'
"DEPOSIT: $($dep.user.balance)"
$wd = Invoke-RestMethod -Method Post -Uri "$base/api/withdraw" -ContentType 'application/json' -Headers @{Authorization="Bearer $tok"} -Body '{"amount":10}'
"PRELIEVO €10 status: $($wd.withdrawal.status)"
