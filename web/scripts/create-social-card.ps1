Add-Type -AssemblyName System.Drawing
$taskOutput = Join-Path $PSScriptRoot '..\dist\social-card.png'
$taskBitmap = [System.Drawing.Bitmap]::new(1200,630)
$taskCanvas = [System.Drawing.Graphics]::FromImage($taskBitmap)
$taskCanvas.SmoothingMode = 'AntiAlias'
$taskCanvas.TextRenderingHint = 'AntiAliasGridFit'
function Brush([string]$hex) { [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function Pen([string]$hex,[single]$width) { $p=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($hex),$width);$p.StartCap='Round';$p.EndCap='Round';return $p }
function Text([string]$value,[single]$size,[string]$color,[single]$x,[single]$y,[bool]$bold=$false) {
  $style=if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
  $font=[System.Drawing.Font]::new('Segoe UI',$size,$style,[System.Drawing.GraphicsUnit]::Pixel)
  $brush=Brush $color
  $taskCanvas.DrawString($value,$font,$brush,$x,$y)
  $font.Dispose();$brush.Dispose()
}
try {
  $taskCanvas.Clear([System.Drawing.ColorTranslator]::FromHtml('#101916'))
  $dim=Brush '#25342a'
  for($r=0;$r -lt 12;$r++){for($c=0;$c -lt 25;$c++){$taskCanvas.FillEllipse($dim,[single](25+$c*49),[single](22+$r*52),2,2)}}
  $panel=Brush '#18231e';$taskCanvas.FillRectangle($panel,652,56,492,508)
  $outline=Pen '#354a3a' 2;$taskCanvas.DrawRectangle($outline,652,56,492,508)
  $green=Brush '#b9ef81';$peach=Brush '#f5b398'
  $grid=Pen '#6d866d' 4;$lime=Pen '#b9ef81' 5;$pink=Pen '#f5b398' 5
  # Small stepped diamond mark, matching the site's logo.
  foreach($cell in @(@(1,0),@(0,1),@(1,1),@(2,1),@(1,2))){
    $x=64+$cell[0]*13;$y=48+$cell[1]*13
    $p=if($cell[0] -eq 1 -and $cell[1] -eq 1){$pink}else{$lime}
    $taskCanvas.DrawRectangle($p,$x,$y,13,13)
  }
  Text 'GridClash' 31 '#eff3e9' 122 48 $true
  Text 'DOTS & BOXES. REIMAGINED.' 14 '#a4b59f' 64 124 $true
  Text 'Small lines.' 69 '#eff3e9' 56 174 $true
  Text 'Big rivalries.' 69 '#b9ef81' 56 252 $true
  Text 'Connect the dots. Claim the boxes.' 23 '#bdcbbf' 63 366
  Text 'Can you outsmart the computer?' 23 '#bdcbbf' 63 402
  $taskCanvas.FillRectangle($green,64,466,194,43)
  Text 'PLAY IN YOUR BROWSER' 13 '#182614' 79 477 $true
  Text 'gridclashweb.vercel.app' 18 '#b9ef81' 64 558
  Text 'ONE LINE. YOUR MOVE.' 13 '#b9ef81' 684 79 $true
  Text 'DIAMOND BOARD' 11 '#a4b59f' 1000 82 $true
  # An illustrated diamond board, using the same 25-cell mask as the game.
  $ox=724;$oy=122;$step=49;$dots=@{}
  $limeFill=Brush '#31462b';$pinkFill=Brush '#49372e'
  for($r=0;$r -lt 7;$r++){for($c=0;$c -lt 7;$c++){
    if([Math]::Abs($r-3)+[Math]::Abs($c-3) -gt 3){continue}
    $x=$ox+$c*$step;$y=$oy+$r*$step
    $owner=if(($r -eq 0) -or ($r -eq 3 -and $c -le 1) -or ($r -eq 2 -and $c -eq 3)){0}elseif(($r -eq 6) -or ($r -eq 3 -and $c -ge 5) -or ($r -eq 4 -and $c -eq 3)){1}else{-1}
    if($owner -ge 0){$fill=if($owner -eq 0){$limeFill}else{$pinkFill};$taskCanvas.FillRectangle($fill,$x+5,$y+5,$step-10,$step-10)}
    $taskCanvas.DrawRectangle($grid,$x,$y,$step,$step)
    if($owner -ge 0){$p=if($owner -eq 0){$lime}else{$pink};$taskCanvas.DrawRectangle($p,$x,$y,$step,$step)}
    foreach($point in @(@($x,$y),@(($x+$step),$y),@($x,($y+$step)),@(($x+$step),($y+$step)))){$dots["$($point[0]),$($point[1])"]=$point}
  }}
  $dotBrush=Brush '#e2ebd9'
  foreach($point in $dots.Values){$taskCanvas.FillEllipse($dotBrush,[single]($point[0]-4),[single]($point[1]-4),8,8)}
  Text 'YOU' 12 '#b9ef81' 689 509 $true
  Text 'vs' 12 '#a4b59f' 881 509
  Text 'COMPUTER' 12 '#f5b398' 1019 509 $true
  $taskBitmap.Save($taskOutput,[System.Drawing.Imaging.ImageFormat]::Png)
  foreach($item in @($dim,$panel,$outline,$green,$peach,$grid,$lime,$pink,$limeFill,$pinkFill,$dotBrush)){$item.Dispose()}
} finally {$taskCanvas.Dispose();$taskBitmap.Dispose()}
