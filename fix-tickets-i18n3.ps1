$file = "src\lib\i18n\translations.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$bom = $false
if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bom = $true
    $bytes = $bytes[3..($bytes.Length-1)]
}
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$nl = "`n"

# The broken block in the file (read from previous output):
# Line 231: `    ` (just spaces)
# Line 232: `      "directManager": "Direct Manager",`
# ... EN keys ...
# Line 248: `      "notEligibleManager": "The assigned direct manager is not eligible to receive tickets.",`
# Line 249: `      "directManager": "المسؤول المباشر",`
# ... AR keys ...
# Line 265: `      "notEligibleManager": "...","schools": {`  (this is concatenated!)

# So the broken block starts at the newline before `      "directManager": "Direct Manager",`
# Find EN directManager start position
$enDmPos = $content.IndexOf('"directManager": "Direct Manager"')
Write-Output "EN directManager at: $enDmPos"

# Find the start of the line containing EN directManager
$lineStart = $enDmPos
while ($lineStart -gt 0 -and $content.Substring($lineStart - 1, 1) -ne "`n") {
    $lineStart--
}
Write-Output "Line starts at: $lineStart"

# Find the end of the broken block: it ends right before "schools": { in EN section
$enSchoolsPos = $content.IndexOf('"schools": {', $enDmPos)
Write-Output "EN schools at: $enSchoolsPos"

# Find the newline before schools
$enSchoolsLineStart = $enSchoolsPos
while ($enSchoolsLineStart -gt 0 -and $content.Substring($enSchoolsLineStart - 1, 1) -ne "`n") {
    $enSchoolsLineStart--
}

# We want to remove from lineStart to enSchoolsLineStart
# But first, separate EN and AR keys

# Find where Arabic keys start (after EN `notEligibleManager`)
$enNotEligiblePos = $content.IndexOf('"notEligibleManager": "The assigned direct manager is not eligible to receive tickets."')
Write-Output "EN notEligibleManager at: $enNotEligiblePos"

# Find where AR keys end
$arNotEligiblePos = $content.IndexOf('"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."')
$arBlockEnd = $arNotEligiblePos + '"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."'.Length
Write-Output "AR block ends at: $arBlockEnd"

# Now extract EN keys (from lineStart to enNotEligiblePos + length of EN notEligible line)
$enBlockStart = $lineStart
$enBlockEnd = $enNotEligiblePos + '"notEligibleManager": "The assigned direct manager is not eligible to receive tickets."'.Length
# Find the newline after
if ($content.Substring($enBlockEnd, 1) -eq "`n") { $enBlockEnd++ }
$enKeys = $content.Substring($enBlockStart, $enBlockEnd - $enBlockStart)
Write-Output "EN block length: $($enKeys.Length)"

# Extract AR keys
$arBlockStart = $content.LastIndexOf('      "directManager": "المسؤول المباشر"', $enSchoolsPos)
# Actually find the line start
$arBlockStart = $arBlockStart
while ($arBlockStart -gt 0 -and $content.Substring($arBlockStart - 1, 1) -ne "`n") {
    $arBlockStart--
}
$arBlockEndFinal = $arBlockEnd
if ($content.Substring($arBlockEndFinal, 1) -eq "`n") { $arBlockEndFinal++ }
$arKeys = $content.Substring($arBlockStart, $arBlockEndFinal - $arBlockStart)
Write-Output "AR block length: $($arKeys.Length)"

# Now remove the entire broken block: from lineStart to enSchoolsLineStart
$brokenEnd = $enSchoolsLineStart
Write-Output "Removing block from $lineStart to $brokenEnd"
$content = $content.Substring(0, $lineStart) + $content.Substring($brokenEnd)

# Insert EN keys before "schools": {
$enSchoolsPos = $content.IndexOf('"schools": {', $lineStart)
$content = $content.Substring(0, $enSchoolsPos) + $enKeys + $content.Substring($enSchoolsPos)
Write-Output "Inserted EN keys at $enSchoolsPos"

# Insert AR keys before AR "schools": {
$arSchoolsPos = $content.IndexOf('"schools": {', $enSchoolsPos + $enKeys.Length)
$content = $content.Substring(0, $arSchoolsPos) + $arKeys + $content.Substring($arSchoolsPos)
Write-Output "Inserted AR keys at $arSchoolsPos"

$newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
if ($bom) {
    $newBytes = @(0xEF, 0xBB, 0xBF) + $newBytes
}
[System.IO.File]::WriteAllBytes($file, $newBytes)
Write-Output "Done"