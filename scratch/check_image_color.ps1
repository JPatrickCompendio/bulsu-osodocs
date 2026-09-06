Add-Type -AssemblyName System.Drawing
$path = "C:\Users\User\.gemini\antigravity-ide\brain\8dd2e020-83b2-4c0e-a31f-70b6fddb5a92\.user_uploaded\media_1788650046951.png"
$bmp = New-Object System.Drawing.Bitmap($path)
$w = $bmp.Width
$h = $bmp.Height
Write-Output "Image Size: $w x $h"
$xL = [int]($w * 0.25)
$xR = [int]($w * 0.75)
$y = [int]($h * 0.5)
$pL = $bmp.GetPixel($xL, $y)
$pR = $bmp.GetPixel($xR, $y)
Write-Output "Left Pixel ($xL, $y): R=$($pL.R) G=$($pL.G) B=$($pL.B) Hex=#$($pL.R.ToString('X2'))$($pL.G.ToString('X2'))$($pL.B.ToString('X2'))"
Write-Output "Right Pixel ($xR, $y): R=$($pR.R) G=$($pR.G) B=$($pR.B) Hex=#$($pR.R.ToString('X2'))$($pR.G.ToString('X2'))$($pR.B.ToString('X2'))"
$bmp.Dispose()
