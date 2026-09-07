$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# Show context around each duplicate
foreach ($idx in @(12330, 30386, 53668, 55202, 72347)) {
    Write-Output "=== Around $idx ==="
    $start = [Math]::Max(0, $idx - 300)
    $end = [Math]::Min($content.Length, $idx + 50)
    Write-Output $content.Substring($start, $end - $start)
    Write-Output ""
}