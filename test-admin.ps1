# Test piani + pannello admin QuantX
$base = 'http://localhost:3000'
$admKey = 'QUANTX-ADMIN-2026'

# Login bravo per attivare piano
$login = Invoke-RestMethod -Method Post -Uri "$base/api/login" -ContentType 'application/json' -Body '{"email":"bravo@test.it","password":"test123"}'
$plan = Invoke-RestMethod -Method Post -Uri "$base/api/activate-plan" -ContentType 'application/json' -Headers @{Authorization='Bearer ' + $login.token} -Body '{"plan":"titan"}'
"BRAVO piano: $($plan.user.plan)"

# Prelievo grande -> in_verifica
$wd = Invoke-RestMethod -Method Post -Uri "$base/api/withdraw" -ContentType 'application/json' -Headers @{Authorization='Bearer ' + $login.token} -Body '{"amount":200}'
"PRELIEVO status: $($wd.withdrawal.status) fee: $($wd.withdrawal.fee)"

# Admin: overview
$ov = Invoke-RestMethod -Uri "$base/api/admin/overview" -Headers @{'X-Admin-Key'=$admKey}
"ADMIN utenti: $($ov.totalUsers) depositati: $($ov.totalDeposited) pending: $($ov.pendingWithdrawals.Count)"

# Admin: cambia saldo di alfa
$users = Invoke-RestMethod -Uri "$base/api/admin/users" -Headers @{'X-Admin-Key'=$admKey}
$alfa = $users.users | Where-Object { $_.email -eq 'alfa@test.it' }
$sb = Invoke-RestMethod -Method Post -Uri "$base/api/admin/set-balance" -ContentType 'application/json' -Headers @{'X-Admin-Key'=$admKey} -Body ('{"id":"' + $alfa.id + '","balance":5000}')
"ALFA saldo admin-set: $($sb.user.balance)"

# Admin: paga il prelievo pendente di bravo
$pend = $ov.pendingWithdrawals | Where-Object { $_.email -eq 'bravo@test.it' }
$res = Invoke-RestMethod -Method Post -Uri "$base/api/admin/resolve-withdrawal" -ContentType 'application/json' -Headers @{'X-Admin-Key'=$admKey} -Body ('{"email":"bravo@test.it","date":"' + $pend.date + '","status":"pagato"}')
"RESOLVE: $($res.ok)"
