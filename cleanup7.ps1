$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# The misplaced AR block starts at 52316 and ends just before "schools": { at 55230 or so
# Find the exact end - after "viewPendingRequest": "..." line, next should be `n` then "schools":
$startIdx = 52316
# Find the end of misplaced block - it ends at "schools": {
$endIdx = $content.IndexOf('"schools": {', $startIdx)
Write-Output "Removing misplaced AR block from $startIdx to $endIdx"
$removed = $endIdx - $startIdx
Write-Output "Length: $removed"

# Verify
$misplaced = $content.Substring($startIdx, $removed)
Write-Output "First 200 chars: $($misplaced.Substring(0, 200))"

# Remove it - but we need to keep the closing "    }," of tickets
# Look at the text just before the misplaced block
$before = $content.Substring($startIdx - 50, 50)
Write-Output "Before: ...$before"

# The misplaced block ends with "viewPendingRequest": ...`n      },`n      "schools": {
# We want to keep "    }," from the tickets close

# Remove from $startIdx to right before "schools":
$newContent = $content.Substring(0, $startIdx) + $content.Substring($endIdx)
[System.IO.File]::WriteAllText("src\lib\i18n\translations.ts", $newContent, [System.Text.Encoding]::UTF8)
Write-Output "Removed"