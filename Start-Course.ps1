$ErrorActionPreference = 'Stop'
$courseEntry = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path -LiteralPath $courseEntry -PathType Leaf)) {
    throw 'Missing index.html. Build the course using the README instructions.'
}
Invoke-Item -LiteralPath $courseEntry
