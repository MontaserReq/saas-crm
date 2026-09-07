$file = "src\lib\i18n\translations.ts"
$bytes = [System.IO.File]::ReadAllBytes($file)
$bom = $false
if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bom = $true
    $bytes = $bytes[3..($bytes.Length-1)]
}
$content = [System.Text.Encoding]::UTF8.GetString($bytes)
$nl = "`n"

$enTicketsStart = $content.IndexOf("`"tickets`": {")
$enSchoolsStart = $content.IndexOf("`"schools`": {", $enTicketsStart)
Write-Output "EN tickets start: $enTicketsStart, EN schools start: $enSchoolsStart"

$enKeys = $nl + '      "directManager": "Direct Manager",' + $nl + '      "directManagerDesc": "The ticket will be automatically sent to your direct manager.",' + $nl + '      "noDirectManager": "No direct manager is configured for your account.",' + $nl + '      "noDirectManagerBlock": "You cannot create a ticket because your direct manager is not assigned. Please contact an administrator to assign your direct manager.",' + $nl + '      "managerDisabledBlock": "You cannot create a ticket because your assigned direct manager is disabled. Please contact an administrator.",' + $nl + '      "assignedByYou": "You have been assigned a new ticket by {name}.",' + $nl + '      "initialAssignment": "Initial Assignment",' + $nl + '      "initialAssignmentDesc": "Ticket Created and Assigned to Direct Manager",' + $nl + '      "createTicketAssign": "Create Ticket",' + $nl + '      "schoolOptional": "School (optional)",' + $nl + '      "taskTypeOptional": "Task Type (optional)",' + $nl + '      "subjectPlaceholder": "Subject / Task Title",' + $nl + '      "initialNotePlaceholder": "Add an initial note (optional)...",' + $nl + '      "ticketSubject": "Subject",' + $nl + '      "initialNote": "Initial Note",' + $nl + '      "validationRequired": "Required",' + $nl + '      "notEligibleManager": "The assigned direct manager is not eligible to receive tickets.",'

$arKeys = $nl + '      "directManager": "المسؤول المباشر",' + $nl + '      "directManagerDesc": "سيتم إرسال التذكرة تلقائيًا إلى مسؤولك المباشر.",' + $nl + '      "noDirectManager": "لم يتم تحديد مسؤول مباشر لحسابك.",' + $nl + '      "noDirectManagerBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر غير محدد لحسابك. يرجى التواصل مع المسؤول لإضافة المسؤول المباشر.",' + $nl + '      "managerDisabledBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر المحدد لحسابك غير مفعّل. يرجى التواصل مع المسؤول.",' + $nl + '      "assignedByYou": "تم تكليفك بتذكرة جديدة بواسطة {name}.",' + $nl + '      "initialAssignment": "التكليف الأولي",' + $nl + '      "initialAssignmentDesc": "تم إنشاء التذكرة وتكليف المسؤول المباشر",' + $nl + '      "createTicketAssign": "إنشاء التذكرة",' + $nl + '      "schoolOptional": "المدرسة (اختياري)",' + $nl + '      "taskTypeOptional": "نوع المهمة (اختياري)",' + $nl + '      "subjectPlaceholder": "موضوع التذكرة / عنوان المهمة",' + $nl + '      "initialNotePlaceholder": "أضف ملاحظة أولية (اختياري)...",' + $nl + '      "ticketSubject": "الموضوع",' + $nl + '      "initialNote": "ملاحظة أولية",' + $nl + '      "validationRequired": "حقل مطلوب",' + $nl + '      "notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر.",'

$content = $content.Substring(0, $enSchoolsStart) + $enKeys + $content.Substring($enSchoolsStart)
$arSchoolsStart = $content.IndexOf('"schools": {', $enSchoolsStart)
$content = $content.Substring(0, $arSchoolsStart) + $arKeys + $content.Substring($arSchoolsStart)

$newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
if ($bom) {
    $newBytes = @(0xEF, 0xBB, 0xBF) + $newBytes
}
[System.IO.File]::WriteAllBytes($file, $newBytes)
Write-Output "Done"