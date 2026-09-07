$file = "src\lib\i18n\translations.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$bom = $false
if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bom = $true
    $bytes = $bytes[3..($bytes.Length-1)]
}
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$nl = "`n"

# We need to find the line numbers / byte positions of:
# - The corrupted EN tickets block (currently has both EN and AR keys mixed)
# - The clean EN tickets section end (before "schools": {)
# - The EN "schools": { start
# - The AR tickets section end (before AR "schools": {)

# Find first "directManager": "Direct Manager"
$firstEnDm = $content.IndexOf('"directManager": "Direct Manager"')
Write-Output "First EN directManager at: $firstEnDm"

# Find the EN schools
$enSchools = $content.IndexOf('"schools": {')
Write-Output "EN schools at: $enSchools"

# Find the line start of the line containing firstEnDm
$lineStart = $firstEnDm
while ($lineStart -gt 0 -and $content.Substring($lineStart - 1, 1) -ne "`n") {
    $lineStart--
}

# Find the line containing enSchools - find line start
$enSchoolsLineStart = $enSchools
while ($enSchoolsLineStart -gt 0 -and $content.Substring($enSchoolsLineStart - 1, 1) -ne "`n") {
    $enSchoolsLineStart--
}

# The corrupted area is from lineStart to enSchoolsLineStart
Write-Output "Corrupted from: $lineStart to: $enSchoolsLineStart"
Write-Output "Length: $($enSchoolsLineStart - $lineStart)"

# Remove the entire corrupted area
$content = $content.Substring(0, $lineStart) + $content.Substring($enSchoolsLineStart)
Write-Output "Removed corrupted area"

# Now re-insert EN keys at the EN section (before EN schools)
$enSchools = $content.IndexOf('"schools": {')
$enKeys = $nl + '      "directManager": "Direct Manager",' + $nl + '      "directManagerDesc": "The ticket will be automatically sent to your direct manager.",' + $nl + '      "noDirectManager": "No direct manager is configured for your account.",' + $nl + '      "noDirectManagerBlock": "You cannot create a ticket because your direct manager is not assigned. Please contact an administrator to assign your direct manager.",' + $nl + '      "managerDisabledBlock": "You cannot create a ticket because your assigned direct manager is disabled. Please contact an administrator.",' + $nl + '      "assignedByYou": "You have been assigned a new ticket by {name}.",' + $nl + '      "initialAssignment": "Initial Assignment",' + $nl + '      "initialAssignmentDesc": "Ticket Created and Assigned to Direct Manager",' + $nl + '      "createTicketAssign": "Create Ticket",' + $nl + '      "schoolOptional": "School (optional)",' + $nl + '      "taskTypeOptional": "Task Type (optional)",' + $nl + '      "subjectPlaceholder": "Subject / Task Title",' + $nl + '      "initialNotePlaceholder": "Add an initial note (optional)...",' + $nl + '      "ticketSubject": "Subject",' + $nl + '      "initialNote": "Initial Note",' + $nl + '      "validationRequired": "Required",' + $nl + '      "notEligibleManager": "The assigned direct manager is not eligible to receive tickets.",'
$content = $content.Substring(0, $enSchools) + $enKeys + $content.Substring($enSchools)
Write-Output "Inserted EN keys at $enSchools"

# Now insert AR keys at the AR section (before AR schools)
# AR schools is the SECOND occurrence of "schools": {
$arSchools = $content.IndexOf('"schools": {', $enSchools + $enKeys.Length + 1)
Write-Output "AR schools at: $arSchools"
$arKeys = $nl + '      "directManager": "المسؤول المباشر",' + $nl + '      "directManagerDesc": "سيتم إرسال التذكرة تلقائيًا إلى مسؤولك المباشر.",' + $nl + '      "noDirectManager": "لم يتم تحديد مسؤول مباشر لحسابك.",' + $nl + '      "noDirectManagerBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر غير محدد لحسابك. يرجى التواصل مع المسؤول لإضافة المسؤول المباشر.",' + $nl + '      "managerDisabledBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر المحدد لحسابك غير مفعّل. يرجى التواصل مع المسؤول.",' + $nl + '      "assignedByYou": "تم تكليفك بتذكرة جديدة بواسطة {name}.",' + $nl + '      "initialAssignment": "التكليف الأولي",' + $nl + '      "initialAssignmentDesc": "تم إنشاء التذكرة وتكليف المسؤول المباشر",' + $nl + '      "createTicketAssign": "إنشاء التذكرة",' + $nl + '      "schoolOptional": "المدرسة (اختياري)",' + $nl + '      "taskTypeOptional": "نوع المهمة (اختياري)",' + $nl + '      "subjectPlaceholder": "موضوع التذكرة / عنوان المهمة",' + $nl + '      "initialNotePlaceholder": "أضف ملاحظة أولية (اختياري)...",' + $nl + '      "ticketSubject": "الموضوع",' + $nl + '      "initialNote": "ملاحظة أولية",' + $nl + '      "validationRequired": "حقل مطلوب",' + $nl + '      "notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر.",'
$content = $content.Substring(0, $arSchools) + $arKeys + $content.Substring($arSchools)
Write-Output "Inserted AR keys at $arSchools"

$newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
if ($bom) {
    $newBytes = @(0xEF, 0xBB, 0xBF) + $newBytes
}
[System.IO.File]::WriteAllBytes($file, $newBytes)
Write-Output "Done"