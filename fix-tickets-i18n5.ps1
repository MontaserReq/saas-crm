$file = "src\lib\i18n\translations.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$bom = $false
if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bom = $true
    $bytes = $bytes[3..($bytes.Length-1)]
}
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$nl = "`n"

# Find the orphaned AR `notEligibleManager` at line 232 - this is the actual START of corruption
# The string: `      "notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."`
# is the last Arabic key from a previous insertion, now orphaned at line 232

# Find the orphaned AR notEligibleManager (before EN directManager)
$arNotEligibleBeforeEN = $content.IndexOf('"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."', 0)
# Find the first EN directManager
$enDm = $content.IndexOf('"directManager": "Direct Manager"')
Write-Output "Orphaned AR notEligible at: $arNotEligibleBeforeEN"
Write-Output "EN directManager at: $enDm"

# Find the line start of the orphaned line
$orphanLineStart = $arNotEligibleBeforeEN
while ($orphanLineStart -gt 0 -and $content.Substring($orphanLineStart - 1, 1) -ne "`n") {
    $orphanLineStart--
}
Write-Output "Orphaned line starts at: $orphanLineStart"

# Remove the orphaned line (including the newline after it)
$orphanLineEnd = $arNotEligibleBeforeEN + '"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."'.Length
if ($content.Substring($orphanLineEnd, 1) -eq "`n") { $orphanLineEnd++ }
Write-Output "Orphaned line ends at: $orphanLineEnd"

$content = $content.Substring(0, $orphanLineStart) + $content.Substring($orphanLineEnd)
Write-Output "Removed orphaned AR key"

# Now fix the missing comma at line 249 (was EN notEligibleManager)
# After orphan removal, the line is at "      "notEligibleManager": "The assigned direct manager is not eligible to receive tickets.","
# This needs to be checked

$enNotEligibleEn = $content.IndexOf('"notEligibleManager": "The assigned direct manager is not eligible to receive tickets."')
$enLineEnd = $enNotEligibleEn + '"notEligibleManager": "The assigned direct manager is not eligible to receive tickets."'.Length
# Check if next char is `,`
$nextChar = $content.Substring($enLineEnd, 1)
Write-Output "Char after EN notEligibleManager: $nextChar"
if ($nextChar -ne ",") {
    $content = $content.Substring(0, $enLineEnd) + "," + $content.Substring($enLineEnd)
    Write-Output "Added comma after EN notEligibleManager"
}

# Fix the missing comma at the AR end (was at line 266)
$arNotEligibleAr = $content.IndexOf('"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."', $enLineEnd)
$arLineEnd = $arNotEligibleAr + '"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."'.Length
$nextCharAr = $content.Substring($arLineEnd, 1)
Write-Output "Char after AR notEligibleManager: $nextCharAr"
if ($nextCharAr -ne ",") {
    $content = $content.Substring(0, $arLineEnd) + "," + $content.Substring($arLineEnd)
    Write-Output "Added comma after AR notEligibleManager"
}

$newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
if ($bom) {
    $newBytes = @(0xEF, 0xBB, 0xBF) + $newBytes
}
[System.IO.File]::WriteAllBytes($file, $newBytes)
Write-Output "Done"