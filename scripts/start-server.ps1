$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$node = Join-Path $workspace 'tools/rea/node_modules/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $node)) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) { throw 'Instala Node.js 22 o posterior y vuelve a ejecutar start.cmd.' }
    $node = $nodeCommand.Source
}
$probe = "fetch('http://127.0.0.1:8080/original/',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
$ready = $false
& $node -e $probe
$ready = $LASTEXITCODE -eq 0
if (-not $ready) {
    $server = Join-Path $workspace 'server.mjs'
    Start-Process -FilePath $node -ArgumentList ('"' + $server + '"') -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $workspace 'server.log') -RedirectStandardError (Join-Path $workspace 'server-error.log')
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        & $node -e $probe
        if ($LASTEXITCODE -eq 0) { Write-Host 'WeDo disponible: http://localhost:8080/'; exit 0 }
        Start-Sleep -Milliseconds 250
    } catch { Start-Sleep -Milliseconds 250 }
}
throw 'El servidor no responde. Revisa server-error.log o si otro programa ocupa el puerto 8080.'
