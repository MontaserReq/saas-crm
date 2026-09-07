$content = [System.IO.File]::ReadAllText("src\lib\i18n\translations.ts", [System.Text.Encoding]::UTF8)
$nl = "`n"

$vpMatches = [regex]::Matches($content, "`"viewPendingRequest`":")
Write-Output "viewPendingRequest count: $($vpMatches.Count)"
foreach ($m in $vpMatches) {
    Write-Output "  at: $($m.Index)"
}