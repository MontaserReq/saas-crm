$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# Remove duplicates of these keys from the second insertion block
# Find the second `directManager`: "Direct Manager" position
$matches = [regex]::Matches($content, "`"directManager`": `"Direct Manager`",")
Write-Output "Total EN directManager: $($matches.Count)"

if ($matches.Count -gt 1) {
    # Remove from second occurrence to end of our insertion block
    # The second block is from second directManager to viewPendingRequest
    $secondStart = $matches[1].Index
    # Find the line start (back to newline)
    $blockStart = $content.LastIndexOf($nl, $secondStart)
    if ($blockStart -lt 0) { $blockStart = 0 }
    $blockStart++ # after the newline
    
    # Find end of this block - it's "viewPendingRequest": "View Pending Request",
    $endPos = $content.IndexOf("viewPendingRequest`": `"View Pending Request`",",", $secondStart) + ("viewPendingRequest`": `"View Pending Request`",").Length + 1
    Write-Output "Removing from $blockStart to $endPos"
    
    $newContent = $content.Substring(0, $blockStart) + $content.Substring($endPos)
    [System.IO.File]::WriteAllText("src\lib\i18n\translations.ts", $newContent, [System.Text.Encoding]::UTF8)
    Write-Output "Done"
}