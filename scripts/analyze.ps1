param(
    [string]$ManagedDirectory = 'C:\Program Files (x86)\WeDo 2.0\WeDo 2.0_Data\Managed',
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$node = Join-Path $workspace 'tools\rea\node_modules\node\bin\node.exe'
$rea = Join-Path $workspace 'tools\rea\node_modules\rea-agents\scripts\rea.mjs'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $workspace 'analysis' }

foreach ($required in @($node, $rea, (Join-Path $ManagedDirectory 'Assembly-CSharp.dll'), (Join-Path $ManagedDirectory 'LegoDeviceSDK.dll'))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required file missing: $required" }
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$jobs = @(
    @{ Command = 'inspect-managed-artifact'; Assembly = 'Assembly-CSharp.dll'; Output = 'app-artifact.json' },
    @{ Command = 'inspect-managed-members'; Assembly = 'Assembly-CSharp.dll'; Output = 'app-members.json' },
    @{ Command = 'inspect-managed-members'; Assembly = 'LegoDeviceSDK.dll'; Output = 'sdk-members.json' }
)

# Static inspections only: no target DLL is loaded or executed.
# Capture each complete Evidence record; write only after valid JSON is returned.
foreach ($job in $jobs) {
    $target = Join-Path $ManagedDirectory $job.Assembly
    Write-Host "REA $($job.Command): $target"
    $output = & $node $rea $job.Command $target --format json
    if ($LASTEXITCODE -ne 0) { throw "REA failed: $($job.Command) ($LASTEXITCODE)" }
    $json = $output -join [Environment]::NewLine
    $record = $json | ConvertFrom-Json
    if (-not $record.evidence_id) { throw 'REA response did not contain an Evidence ID.' }
    $destination = Join-Path $OutputDirectory $job.Output
    [System.IO.File]::WriteAllText($destination, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Saved $destination ($($record.evidence_id))"
}
Write-Host 'Evidence refreshed. findings.json is a separate interpretation: review its IDs and hashes before reusing it.'
