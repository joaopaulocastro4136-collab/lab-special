Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\cafeg\AppData\Local\Temp\claude\C--Users-cafeg-OneDrive-Documentos\60a41f31-27fa-40a0-90bc-e3fa6e4d9c85\scratchpad\lab-app\icones"
New-Item -ItemType Directory -Force $dir | Out-Null

$ink = [System.Drawing.Color]::FromArgb(255, 28, 27, 25)
$gold = [System.Drawing.Color]::FromArgb(255, 184, 147, 90)

function Desenhar-Icone($tamanho, $caminho, $comFundo, $escalaTexto) {
    $bmp = New-Object System.Drawing.Bitmap($tamanho, $tamanho)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    if ($comFundo) {
        $g.Clear($ink)
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }
    $fontSize = [int]($tamanho * $escalaTexto)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush($gold)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF(0, ($tamanho * 0.02), $tamanho, $tamanho)
    $g.DrawString("LS", $font, $brush, $rect, $fmt)
    $g.Dispose()
    $bmp.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Ícones quadrados (launcher legado) — fundo preto, texto dourado
foreach ($par in @(@{n='mdpi';t=48}, @{n='hdpi';t=72}, @{n='xhdpi';t=96}, @{n='xxhdpi';t=144}, @{n='xxxhdpi';t=192})) {
    Desenhar-Icone $par.t "$dir\ic_launcher-$($par.n).png" $true 0.42
    Desenhar-Icone $par.t "$dir\ic_launcher_round-$($par.n).png" $true 0.42
}
# Foregrounds adaptativos — transparente, texto dourado menor (zona segura central)
foreach ($par in @(@{n='mdpi';t=108}, @{n='hdpi';t=162}, @{n='xhdpi';t=216}, @{n='xxhdpi';t=324}, @{n='xxxhdpi';t=432})) {
    Desenhar-Icone $par.t "$dir\ic_launcher_foreground-$($par.n).png" $false 0.26
}
Write-Output "Ícones gerados:"
(Get-ChildItem $dir).Name
