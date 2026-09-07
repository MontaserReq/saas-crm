$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

# Find all viewPendingRequest and show context
$vpMatches = [regex]::Matches($content, "`"viewPendingRequest`":")
foreach ($m in $vpMatches) {
    $lineStart = $content.LastIndexOf($nl, $m.Index) + 1
    $lineEnd = $content.IndexOf($nl, $m.Index)
    Write-Output "At $($m.Index): $($content.Substring($lineStart, $lineEnd - $lineStart))"
}