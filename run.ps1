param(
    [ValidateSet('all', 'test', 'demo', 'verify')]
    [string]$Command = 'all',
    [string]$OutputDir = 'output'
)
$ErrorActionPreference = 'Stop'
$demoPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $demoPython)) {
    $demoPython = (Get-Command python -ErrorAction Stop).Source
}
$demoOutput = if ([System.IO.Path]::IsPathRooted($OutputDir)) { $OutputDir } else { Join-Path $PSScriptRoot $OutputDir }
& $demoPython (Join-Path $PSScriptRoot 'demo.py') $Command --output $demoOutput
exit $LASTEXITCODE
