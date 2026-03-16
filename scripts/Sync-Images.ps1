param(
  [string]$SourceRoot = "assets/image-sources",
  [string]$OutputRoot = "assets/images"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$rulesPath = Join-Path $PSScriptRoot "image-rules.json"
$resolvedSourceRoot = Join-Path $repoRoot $SourceRoot
$resolvedOutputRoot = Join-Path $repoRoot $OutputRoot

if (-not (Test-Path $resolvedSourceRoot)) {
  throw "Source folder not found: $resolvedSourceRoot"
}

if (-not (Test-Path $rulesPath)) {
  throw "Rule file not found: $rulesPath"
}

Add-Type -AssemblyName System.Drawing

$rules = Get-Content $rulesPath -Raw | ConvertFrom-Json

function Get-NormalizedRelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [string]$ChildPath
  )

  $baseUri = New-Object System.Uri(((Resolve-Path $BasePath).Path.TrimEnd("\") + "\"))
  $childUri = New-Object System.Uri((Resolve-Path $ChildPath).Path)
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($childUri).ToString()).Replace("\", "/")
}

function Get-OutputPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  return Join-Path $BasePath ($RelativePath.Replace("/", [System.IO.Path]::DirectorySeparatorChar))
}

function Get-RuleForPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  foreach ($rule in $rules) {
    if ($RelativePath -like $rule.pattern) {
      return $rule
    }
  }

  return $null
}

function Ensure-ParentDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath
  )

  $parent = Split-Path -Parent $FilePath
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
}

function Save-JpegVariant {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [int]$MaxWidth,
    [Parameter(Mandatory = $true)]
    [long]$Quality
  )

  $image = [System.Drawing.Image]::FromFile($InputPath)
  try {
    $newWidth = [Math]::Min($image.Width, $MaxWidth)
    $newHeight = [int][Math]::Round($image.Height * ($newWidth / [double]$image.Width))

    if ($newWidth -eq $image.Width) {
      $bitmap = New-Object System.Drawing.Bitmap($image)
    } else {
      $bitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)
      } finally {
        $graphics.Dispose()
      }
    }

    try {
      $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageDecoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" } |
        Select-Object -First 1
      $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality,
        $Quality
      )

      $tempPath = "$OutputPath.tmp"
      $bitmap.Save($tempPath, $encoder, $encoderParams)
    } finally {
      $bitmap.Dispose()
    }
  } finally {
    $image.Dispose()
  }

  if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
  }

  Move-Item $tempPath $OutputPath
}

function Save-PngVariant {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [int]$MaxLongestSide
  )

  $image = [System.Drawing.Image]::FromFile($InputPath)
  try {
    $longestSide = [Math]::Max($image.Width, $image.Height)
    if ($longestSide -le $MaxLongestSide) {
      Copy-Item $InputPath $OutputPath -Force
      return
    }

    if ($image.Width -ge $image.Height) {
      $newWidth = $MaxLongestSide
      $newHeight = [int][Math]::Round($image.Height * ($newWidth / [double]$image.Width))
    } else {
      $newHeight = $MaxLongestSide
      $newWidth = [int][Math]::Round($image.Width * ($newHeight / [double]$image.Height))
    }

    $bitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)

      $tempPath = "$OutputPath.tmp"
      $bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $image.Dispose()
  }

  if ((Get-Item $tempPath).Length -ge (Get-Item $InputPath).Length) {
    Remove-Item $tempPath -Force
    Copy-Item $InputPath $OutputPath -Force
    return
  }

  if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
  }

  Move-Item $tempPath $OutputPath
}

function Copy-Variant {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  Copy-Item $InputPath $OutputPath -Force
}

$summary = New-Object System.Collections.Generic.List[object]
$sourceFiles = Get-ChildItem $resolvedSourceRoot -Recurse -File | Sort-Object FullName

foreach ($sourceFile in $sourceFiles) {
  $relativePath = Get-NormalizedRelativePath -BasePath $resolvedSourceRoot -ChildPath $sourceFile.FullName
  $outputPath = Get-OutputPath -BasePath $resolvedOutputRoot -RelativePath $relativePath
  $rule = Get-RuleForPath -RelativePath $relativePath

  Ensure-ParentDirectory -FilePath $outputPath

  if ($null -eq $rule) {
    Copy-Variant -InputPath $sourceFile.FullName -OutputPath $outputPath
    $operation = "copy"
  } elseif ($rule.operation -eq "jpeg") {
    Save-JpegVariant -InputPath $sourceFile.FullName -OutputPath $outputPath -MaxWidth $rule.maxWidth -Quality $rule.quality
    $operation = "jpeg"
  } elseif ($rule.operation -eq "png") {
    Save-PngVariant -InputPath $sourceFile.FullName -OutputPath $outputPath -MaxLongestSide $rule.maxLongestSide
    $operation = "png"
  } else {
    Copy-Variant -InputPath $sourceFile.FullName -OutputPath $outputPath
    $operation = "copy"
  }

  $summary.Add(
    [pscustomobject]@{
      RelativePath = $relativePath
      Operation = $operation
      SourceKB = [math]::Round($sourceFile.Length / 1KB, 1)
      OutputKB = [math]::Round((Get-Item $outputPath).Length / 1KB, 1)
    }
  ) | Out-Null
}

$totals = $summary | Measure-Object -Property OutputKB -Sum
$sourceTotals = $summary | Measure-Object -Property SourceKB -Sum
$saved = [math]::Round($sourceTotals.Sum - $totals.Sum, 1)

$summary | Format-Table -AutoSize
Write-Host ""
Write-Host ("Source total: {0} KB" -f [math]::Round($sourceTotals.Sum, 1))
Write-Host ("Output total: {0} KB" -f [math]::Round($totals.Sum, 1))
Write-Host ("Saved: {0} KB" -f $saved)
