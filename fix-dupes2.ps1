$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# Remove the duplicated block by finding the second occurrence of directManager
$matches = [regex]::Matches($content, "`"directManager`": `"Direct Manager`",")
Write-Output "Total: $($matches.Count)"

if ($matches.Count -gt 1) {
    $secondStart = $matches[1].Index
    $blockStart = $content.LastIndexOf($nl, $secondStart) + 1
    # Find end - look for viewPendingRequest in this EN block
    $vpPos = $content.IndexOf("`"viewPendingRequest`": `"View Pending Request`",", $secondStart)
    $endPos = $vpPos + 41 + 1 # length of "viewPendingRequest": "View Pending Request",
    Write-Output "Removing from $blockStart to $endPos"
    $newContent = $content.Substring(0, $blockStart) + $content.Substring($endPos)
    [System.IO.File]::WriteAllText("src\lib\i18n\translations.ts", $newContent, [System.Text.Encoding]::UTF8)
    Write-Output "Done"
}

# Now check AR too
$arMatches = [regex]::Matches($content, "`"directManager`": `"المسؤول")
Write-Output "AR directManager count: $($arMatches.Count)"
if ($arMatches.Count -gt 1) {
    # Only keep the one inside the proper tickets section (the first one)
    $secondStart = $arMatches[1].Index
    $blockStart = $content.LastIndexOf($nl, $secondStart) + 1
    $vpPos = $content.IndexOf("`"viewPendingRequest`": `"عرض", $secondStart)
    if ($vpPos -gt 0) {
        $endPos = $vpPos + 35 + 1
        Write-Output "Removing AR from $blockStart to $endPos"
        $newContent = $content.Substring(0, $blockStart) + $content.Substring($endPos)
        [System.IO.File]::WriteAllText("src\lib\i18n\translations.ts", $newContent, [System.Text.Encoding]::UTF8)
        Write-Output "Done AR"
    }
}