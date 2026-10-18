# Test end-to-end del flusso referral QuantX
$base = 'http://localhost:3000'
$r1 = Invoke-RestMethod -Method Post -Uri "$base/api/register" -ContentType 'application/json' -Body '{"email":"alfa@test.it","password":"test123","name":"Alpha"}'
$r2 = Invoke-RestMethod -Method Post -Uri "$base/api/register" -ContentType 'application/json' -Body ('{"email":"bravo@test.it","password":"test123","name":"Bravo","ref":"' + $r1.user.referralCode + '"}')
"ALFA code: $($r1.user.referralCode)"
"BRAVO referredBy: $($r2.user.referredBy)"
$d = Invoke-RestMethod -Method Post -Uri "$base/api/deposit" -ContentType 'application/json' -Headers @{Authorization='Bearer ' + $r2.token} -Body '{"amount":1000}'
"Bravo balance: $($d.user.balance)"
$me = Invoke-RestMethod -Uri "$base/api/me" -Headers @{Authorization='Bearer ' + $r1.token}
"ALFA bonus: $($me.user.balance) (refEarned $($me.user.refEarned))"
