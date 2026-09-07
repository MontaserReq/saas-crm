$file = "src\lib\i18n\translations.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$bom = $false
if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bom = $true
    $bytes = $bytes[3..($bytes.Length-1)]
}
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$nl = "`n"

# Find the broken block: starts with the newline + spaces + "directManager" EN, ends with the last Arabic key
# Look for the duplicate "directManager" keys
$firstDM = $content.IndexOf('"directManager": "Direct Manager"')
$lastDM = $content.IndexOf('"directManager": "المسؤول المباشر"')
Write-Output "First DM at: $firstDM"
Write-Output "Last DM at: $lastDM"

# Find the end of the broken block (after the last Arabic "notEligibleManager": "...")
$endArabic = $content.IndexOf('"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."')
$endPos = $endArabic + '"notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر."'.Length
# Skip newline after
if ($content.Substring($endPos, 1) -eq "`n") { $endPos++ }
Write-Output "End position: $endPos"

# Find the start of the broken block (the newline before "directManager" EN)
# It starts with `n      "directManager":`
$startPos = $content.LastIndexOf($nl + '      "directManager"', $firstDM)
Write-Output "Start position: $startPos"

# Extract the Arabic portion only (after the English directManager line)
# Find where Arabic starts
$arabicStart = $content.IndexOf('"directManager": "المسؤول المباشر"')
$arabicStartPos = $content.LastIndexOf($nl + '      "directManager"', $arabicStart)
Write-Output "Arabic block start: $arabicStartPos"

# Now we need to:
# 1. Keep English keys only at the start (lines from startPos to arabicStartPos exclusive)
# 2. Remove Arabic keys block (from arabicStartPos to endPos)
# 3. Then we need to insert Arabic keys into the AR tickets section

# Actually the simplest approach: just remove ALL the broken block, then add properly
$brokenStart = $startPos
$brokenEnd = $endPos
Write-Output "Removing broken block: $brokenStart to $brokenEnd"
$content = $content.Substring(0, $brokenStart) + $content.Substring($brokenEnd)

# Now insert EN keys at the right place (before "schools": {)
$enSchoolsStart = $content.IndexOf("`"schools`": {")
$enKeys = $nl + '      "directManager": "Direct Manager",' + $nl + '      "directManagerDesc": "The ticket will be automatically sent to your direct manager.",' + $nl + '      "noDirectManager": "No direct manager is configured for your account.",' + $nl + '      "noDirectManagerBlock": "You cannot create a ticket because your direct manager is not assigned. Please contact an administrator to assign your direct manager.",' + $nl + '      "managerDisabledBlock": "You cannot create a ticket because your assigned direct manager is disabled. Please contact an administrator.",' + $nl + '      "assignedByYou": "You have been assigned a new ticket by {name}.",' + $nl + '      "initialAssignment": "Initial Assignment",' + $nl + '      "initialAssignmentDesc": "Ticket Created and Assigned to Direct Manager",' + $nl + '      "createTicketAssign": "Create Ticket",' + $nl + '      "schoolOptional": "School (optional)",' + $nl + '      "taskTypeOptional": "Task Type (optional)",' + $nl + '      "subjectPlaceholder": "Subject / Task Title",' + $nl + '      "initialNotePlaceholder": "Add an initial note (optional)...",' + $nl + '      "ticketSubject": "Subject",' + $nl + '      "initialNote": "Initial Note",' + $nl + '      "validationRequired": "Required",' + $nl + '      "notEligibleManager": "The assigned direct manager is not eligible to receive tickets.",'
$content = $content.Substring(0, $enSchoolsStart) + $enKeys + $content.Substring($enSchoolsStart)

# Now insert AR keys before AR schools section
$arSchoolsStart = $content.IndexOf('"schools": {', $enSchoolsStart)
$arKeys = $nl + '      "directManager": "المسؤول المباشر",' + $nl + '      "directManagerDesc": "سيتم إرسال التذكرة تلقائيًا إلى مسؤولك المباشر.",' + $nl + '      "noDirectManager": "لم يتم تحديد مسؤول مباشر لحسابك.",' + $nl + '      "noDirectManagerBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر غير محدد لحسابك. يرجى التواصل مع المسؤول لإضافة المسؤول المباشر.",' + $nl + '      "managerDisabledBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر المحدد لحسابك غير مفعّل. يرجى التواصل مع المسؤول.",' + $nl + '      "assignedByYou": "تم تكليفك بتذكرة جديدة بواسطة {name}.",' + $nl + '      "initialAssignment": "التكليف الأولي",' + $nl + '      "initialAssignmentDesc": "تم إنشاء التذكرة وتكليف المسؤول المباشر",' + $nl + '      "createTicketAssign": "إنشاء التذكرة",' + $nl + '      "schoolOptional": "المدرسة (اختياري)",' + $nl + '      "taskTypeOptional": "نوع المهمة (اختياري)",' + $nl + '      "subjectPlaceholder": "موضوع التذكرة / عنوان المهمة",' + $nl + '      "initialNotePlaceholder": "أضف ملاحظة أولية (اختياري)...",' + $nl + '      "ticketSubject": "الموضوع",' + $nl + '      "initialNote": "ملاحظة أولية",' + $nl + '      "validationRequired": "حقل مطلوب",' + $nl + '      "notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر.",'
$content = $content.Substring(0, $arSchoolsStart) + $arKeys + $content.Substring($arSchoolsStart)

$newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
if ($bom) {
    $newBytes = @(0xEF, 0xBB, 0xBF) + $newBytes
}
[System.IO.File]::WriteAllBytes($file, $newBytes)
Write-Output "Done"