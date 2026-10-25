param(
    [string]$AssemblyPath = 'C:\Program Files (x86)\WeDo 2.0\WeDo 2.0_Data\Managed\Assembly-CSharp.dll'
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$decompiler = Join-Path $workspace 'tools\ilspy\ilspycmd.exe'
$output = Join-Path $workspace 'analysis\managed-reconstruction'
$retainedEvidence = Get-Content -LiteralPath (Join-Path $workspace 'analysis\app-members.json') -Raw | ConvertFrom-Json
$actualHash = (Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $retainedEvidence.subject.digest.sha256) { throw 'Selected assembly differs from the retained REA evidence. Refresh evidence before decompiling.' }
if (-not (Test-Path -LiteralPath $decompiler)) { throw 'Install local ILSpy first: dotnet tool install ilspycmd --version 11.1.0.9782 --tool-path tools/ilspy' }
New-Item -ItemType Directory -Force -Path $output | Out-Null
$types = @(
    'Hardware.Motors.MotorController', 'Hardware.Motors.MotorOptions',
    'Execution.InstructionInterpreter', 'Execution.Execution', 'Execution.ExecutionEngine',
    'Model.Instruction', 'Model.InstructionTypeDefinition', 'Model.InstructionFactory',
    'Model.InstructionType', 'Model.InstructionCategory', 'Managers.SnapRuleManager',
    'SnapRule', 'UI.Snap', 'Views.BlockView', 'Views.InstructionBlockView', 'Views.InstructionBlockViewFactory',
    'Views.PaletteViewFactory', 'UI.PalettePanel', 'ProgrammingCanvas',
    'LEGODeviceUnitySDK.LEGOMotor', 'LEGODeviceUnitySDK.LEGORGBLight', 'RGBLightController'
)
foreach ($type in $types) {
    & $decompiler -t $type $AssemblyPath -o $output
    if ($LASTEXITCODE -ne 0) { throw "ILSpy failed for $type" }
}
& node (Join-Path $PSScriptRoot 'import-managed-reconstruction.mjs')
if ($LASTEXITCODE -ne 0) { throw 'REA import failed.' }
