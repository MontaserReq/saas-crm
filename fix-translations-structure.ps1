# Fix the translations.ts structure - move misplaced keys into the tickets object

$f = "src\lib\i18n\translations.ts"
$content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
$nl = "`n"

# === FIX EN SECTION ===
# Find the position of "} ," after "confirmCloseAction" in EN
$enTicketsIdx = $content.IndexOf('"tickets": {')
$endOfEnTickets = $content.IndexOf('"confirmCloseAction"', $enTicketsIdx)
$enTicketsCloseBrace = $content.IndexOf('},', $endOfEnTickets)
Write-Output "EN tickets close brace at: $enTicketsCloseBrace"

# Find where the misplaced EN block starts (it should start with `,` + `n` + ` ` + ` ` + ` ` + ` `)
# The pattern is: },\n    \n      "directManager": ...
$enMisplacedStart = $content.IndexOf('"directManager"', $enTicketsCloseBrace)
Write-Output "EN directManager at: $enMisplacedStart"

# Find where the misplaced EN block ENDS - look for "schools": {
$enMisplacedEnd = $content.IndexOf('"schools": {', $enTicketsCloseBrace)
Write-Output "EN schools start (end of misplaced): $enMisplacedEnd"

# Extract the misplaced block (from `,\n    \n      "directManager":` to just before "schools": {)
$misplacedEnRaw = $content.Substring($enTicketsCloseBrace + 2, $enMisplacedEnd - ($enTicketsCloseBrace + 2))
Write-Output "Misplaced EN block (raw):"
Write-Output $misplacedEnRaw

# Now extract just the keys (skip the leading `,\n    \n`)
# It looks like ",\n    \n      "directManager": ..." (note: leading is `,\n    \n` then keys with proper indentation)
# Let me get the keys one by one
$keys = @()
$lines = $misplacedEnRaw -split "`n"
foreach ($line in $lines) {
    if ($line -match '^\s*"([^"]+)":\s*"', $line) {
        $key = $matches[1]
        $value = $matches[2]
        # Get the full line
        $keys += @{ key = $key; line = $line.TrimEnd() }
    }
}
Write-Output "Found $($keys.Count) misplaced EN keys"

# Remove the misplaced block
$newContent = $content.Substring(0, $enTicketsCloseBrace + 2) + $content.Substring($enMisplacedEnd)

# Now insert each key properly inside the tickets section
# We insert right after "confirmCloseAction" line (which ends with ",`n")
# Find the line of confirmCloseAction
$confirmLinePos = $newContent.IndexOf('"confirmCloseAction": "Confirm Ticket Closure"')
# Find end of that line (next newline)
$confirmLineEnd = $newContent.IndexOf("`n", $confirmLinePos) + 1
Write-Output "Insertion point: $confirmLineEnd"

# Build the keys to insert (each line with proper 6-space indent)
$keysToInsert = ""
foreach ($k in $keys) {
    # Remove any extra whitespace from the line
    $line = $k.line.Trim()
    # Re-add proper indentation
    $keysToInsert += "      " + $line + "`n"
}

# Insert the keys
$newContent = $newContent.Substring(0, $confirmLineEnd) + $keysToInsert + $newContent.Substring($confirmLineEnd)
Write-Output "EN section fixed"

[System.IO.File]::WriteAllText($f, $newContent, [System.Text.Encoding]::UTF8)
Write-Output "Done"