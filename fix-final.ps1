$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# Remove the duplicate block: from the second initialAssignment to viewPendingRequest
# First find the line where second initialAssignment starts
$secondIA = $content.IndexOf("initialAssignment", $content.IndexOf("initialAssignment") + 1)
Write-Output "Second initialAssignment at: $secondIA"

# Find the newline before it (back to start of line)
$blockStart = $content.LastIndexOf($nl, $secondIA) + 1

# Find end - viewPendingRequest line
$vpPos = $content.IndexOf("viewPendingRequest", $secondIA)
$vpEnd = $content.IndexOf($nl, $vpPos) + 1

Write-Output "Removing from $blockStart to $vpEnd"
$removed = $content.Substring($blockStart, $vpEnd - $blockStart)
Write-Output "Will remove: $($removed.Substring(0, [Math]::Min(300, $removed.Length)))"

$newContent = $content.Substring(0, $blockStart) + $content.Substring($vpEnd)
[System.IO.File]::WriteAllText("src\lib\i18n\translations.ts", $newContent, [System.Text.Encoding]::UTF8)
Write-Output "Done"