' QuantX server — avvio nascosto al login
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\walte\Documents\Default Project\quantx\start-server.ps1""", 0, False