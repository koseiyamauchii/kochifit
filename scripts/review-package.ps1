$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDir = Join-Path $repoRoot 'review_packages'
[IO.Directory]::CreateDirectory($outputDir) | Out-Null
$jst = [DateTime]::UtcNow.AddHours(9)
$outputPath = Join-Path $outputDir ($jst.ToString('yyyyMMddHHmm') + '_kochifit_review.zip')
if (Test-Path -LiteralPath $outputPath) { throw "Package already exists: $outputPath" }
# Explicit allowlist: never recurse over the repository root or hidden caches.
$rootFiles = @('README.md','AGENTS.md','AGENT.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml',
  'next.config.ts','next-env.d.ts','tsconfig.json','vitest.config.mts','eslint.config.mjs','postcss.config.mjs','proxy.ts','.gitignore')
$folders = @('app','components','lib','docs','supabase/migrations','supabase/verification','scripts','.github/workflows','public')
$extensions = @('.ts','.tsx','.mts','.js','.mjs','.json','.md','.sql','.yaml','.yml','.ps1','.css','.png','.svg','.webmanifest')
$files = @($rootFiles | ForEach-Object {
  $path = Join-Path $repoRoot $_
  if (Test-Path -LiteralPath $path -PathType Leaf) { Get-Item -LiteralPath $path }
})
foreach ($folder in $folders) {
  $path = Join-Path $repoRoot $folder
  if (Test-Path -LiteralPath $path) {
    $files += Get-ChildItem -LiteralPath $path -File -Recurse | Where-Object {
      $_.Extension -in $extensions -and $_.Name -notlike 'client_secret*' -and
      $_.Name -notlike '.env*' -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
    }
  }
}
$archive = [IO.Compression.ZipFile]::Open($outputPath, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in ($files | Sort-Object FullName -Unique)) {
    $relative = $file.FullName.Substring($repoRoot.Length + 1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
Write-Output $outputPath
