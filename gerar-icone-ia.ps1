# Gera o ícone do Special IA: fundo escuro, estrela dourada da marca e "IA" embaixo
Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap(512, 512)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

$corA = [System.Drawing.Color]::FromArgb(42, 33, 22)
$corB = [System.Drawing.Color]::FromArgb(20, 19, 17)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Point(0, 0)), (New-Object System.Drawing.Point(512, 512)), $corA, $corB)
$g.FillRectangle($bg, 0, 0, 512, 512)

# Estrela da marca (mesmo desenho dos apps), escalada para o centro
$s = [float]2.1
$cx = [float]256
$cy = [float]212
function Ponto([float]$x, [float]$y) {
  New-Object System.Drawing.PointF(($cx + $x * $s), ($cy + $y * $s))
}
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddBezier((Ponto 0 -55), (Ponto 4 -17), (Ponto 17 -4), (Ponto 46 0))
$path.AddBezier((Ponto 46 0), (Ponto 17 4), (Ponto 4 17), (Ponto 0 55))
$path.AddBezier((Ponto 0 55), (Ponto -4 17), (Ponto -17 4), (Ponto -46 0))
$path.AddBezier((Ponto -46 0), (Ponto -17 -4), (Ponto -4 -17), (Ponto 0 -55))
$path.CloseFigure()

$ouroA = [System.Drawing.Color]::FromArgb(232, 196, 138)
$ouroB = [System.Drawing.Color]::FromArgb(184, 147, 90)
$ouro = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Point(256, 80)), (New-Object System.Drawing.Point(256, 340)), $ouroA, $ouroB)
$g.FillPath($ouro, $path)

$fonte = New-Object System.Drawing.Font('Segoe UI', 96, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'
$fmt.LineAlignment = 'Center'
$g.DrawString('IA', $fonte, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 340, 512, 130)), $fmt)
$g.Dispose()

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$bmp.Save((Join-Path $pasta 'icones\icone-ia-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$peq = New-Object System.Drawing.Bitmap($bmp, 192, 192)
$peq.Save((Join-Path $pasta 'icones\icone-ia-192.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$peq.Dispose()
$bmp.Dispose()
Write-Output 'icones do Special IA gerados'
