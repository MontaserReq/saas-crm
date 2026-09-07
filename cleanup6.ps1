$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# Remove misplaced AR block at 55202
# It starts with "    `n    `n      "directManager":" 
# Let me find it precisely

# Find all "directManager": "المسؤول المباشر" occurrences
$matches = [regex]::Matches($content, "`"directManager`": `"المسؤول")
Write-Output "AR directManager count: $($matches.Count)"
foreach ($m in $matches) {
    Write-Output "  at $($m.Index)"
}

# We expect 2: one in correct AR tickets (around 53728), one in misplaced (around 55202 + 1400)
# Let me find the misplaced block boundaries
# Start: at the orphan block, starts after "},\n    \n"
# End: at the "schools": { that follows

# Find the orphan block: look for pattern `},\n    \n      "directManager": "المسؤول` that is NOT in tickets
$dmMatches = [regex]::Matches($content, "`"directManager`": `"المسؤول")
foreach ($m in $dmMatches) {
    $start = [Math]::Max(0, $m.Index - 200)
    $end = [Math]::Min($content.Length, $m.Index + 1800)
    $sub = $content.Substring($start, $end - $start)
    Write-Output "--- DirectManager at $($m.Index) ---"
    Write-Output $sub.Substring(0, [Math]::Min(300, $sub.Length))
}