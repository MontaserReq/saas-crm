$f = "src\lib\i18n\translations.ts"
$content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
$nl = "`n"

$enTicketKeys = @(
    "      `"directManager`": `"Direct Manager`","
    "      `"directManagerDesc`": `"The ticket will be automatically sent to your direct manager.`","
    "      `"noDirectManager`": `"No direct manager is configured for your account.`","
    "      `"noDirectManagerBlock`": `"You cannot create a ticket because your direct manager is not assigned. Please contact an administrator to assign your direct manager.`","
    "      `"managerDisabledBlock`": `"You cannot create a ticket because your assigned direct manager is disabled. Please contact an administrator.`","
    "      `"assignedByYou`": `"You have been assigned a new ticket by {name}.`","
    "      `"initialAssignment`": `"Initial Assignment`","
    "      `"initialAssignmentDesc`": `"Ticket Created and Assigned to Direct Manager`","
    "      `"createTicketAssign`": `"Create Ticket`","
    "      `"schoolOptional`": `"School (optional)`","
    "      `"taskTypeOptional`": `"Task Type (optional)`","
    "      `"subjectPlaceholder`": `"Subject / Task Title`","
    "      `"initialNotePlaceholder`": `"Add an initial note (optional)...`","
    "      `"ticketSubject`": `"Subject`","
    "      `"initialNote`": `"Initial Note`","
    "      `"validationRequired`": `"Required`","
    "      `"notEligibleManager`": `"The assigned direct manager is not eligible to receive tickets.`","
    "      `"followUp`": `"Follow-up`","
    "      `"oldNewValuesSavedInActivity`": `"Old and new values are preserved in the activity timeline.`","
    "      `"rejectedCorrectTitle`": `"Correct Ticket Information`","
    "      `"rejectedCorrectInfo`": `"Correct Information`","
    "      `"resubmitTicket`": `"Resubmit Ticket`","
    "      `"viewPendingRequest`": `"View Pending Request`","
)

$arTicketKeys = @(
    "      `"directManager`": `"المسؤول المباشر`","
    "      `"directManagerDesc`": `"سيتم إرسال التذكرة تلقائيًا إلى مسؤولك المباشر.`","
    "      `"noDirectManager`": `"لم يتم تحديد مسؤول مباشر لحسابك.`","
    "      `"noDirectManagerBlock`": `"لا يمكن إنشاء التذكرة لأن المسؤول المباشر غير محدد لحسابك. يرجى التواصل مع المسؤول لإضافة المسؤول المباشر.`","
    "      `"managerDisabledBlock`": `"لا يمكن إنشاء التذكرة لأن المسؤول المباشر المحدد لحسابك غير مفعّل. يرجى التواصل مع المسؤول.`","
    "      `"assignedByYou`": `"تم تكليفك بتذكرة جديدة بواسطة {name}.`","
    "      `"initialAssignment`": `"التكليف الأولى`","
    "      `"initialAssignmentDesc`": `"تم إنشاء التذكرة وتكليف المسؤول المباشر`","
    "      `"createTicketAssign`": `"إنشاء التذكرة`","
    "      `"schoolOptional`": `"المدرسة (اختياري)`","
    "      `"taskTypeOptional`": `"نوع المهمة (اختياري)`","
    "      `"subjectPlaceholder`": `"موضوع التذكرة / عنوان المهمة`","
    "      `"initialNotePlaceholder`": `"أضف ملاحظة أولية (اختياري)...`","
    "      `"ticketSubject`": `"الموضوع`","
    "      `"initialNote`": `"ملاحظة أولية`","
    "      `"validationRequired`": `"حقل مطلوب`","
    "      `"notEligibleManager`": `"المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر.`","
    "      `"followUp`": `"موعد المتابعة`","
    "      `"oldNewValuesSavedInActivity`": `"سيتم حفظ القيم القديمة والجديدة في سجل النشاط.`","
    "      `"rejectedCorrectTitle`": `"تصحيح المعلومات`","
    "      `"rejectedCorrectInfo`": `"تصحيح المعلومات`","
    "      `"resubmitTicket`": `"إعادة إرسال التذكرة`","
    "      `"viewPendingRequest`": `"عرض الطلب المعلق`","
)

$enInsert = $nl + ($enTicketKeys -join $nl) + $nl
$arInsert = $nl + ($arTicketKeys -join $nl) + $nl

# 1. Find AR confirmCloseAction position FIRST (higher offset)
$arConfirmIdx = $content.IndexOf('"confirmCloseAction": "تأكيد إغلاق التذكرة"')
if ($arConfirmIdx -lt 0) { Write-Output "AR not found"; exit 1 }
$arLineEnd = $content.IndexOf($nl, $arConfirmIdx) + $nl.Length
Write-Output "AR insert at: $arLineEnd"

# 2. Insert AR first
$newContent = $content.Substring(0, $arLineEnd) + $arInsert + $content.Substring($arLineEnd)

# 3. Now find EN confirmCloseAction (its position hasn't changed)
$enConfirmIdx = $newContent.IndexOf('"confirmCloseAction": "Confirm Ticket Closure"')
if ($enConfirmIdx -lt 0) { Write-Output "EN not found"; exit 1 }
$enLineEnd = $newContent.IndexOf($nl, $enConfirmIdx) + $nl.Length
Write-Output "EN insert at: $enLineEnd"

# 4. Insert EN
$newContent = $newContent.Substring(0, $enLineEnd) + $enInsert + $newContent.Substring($enLineEnd)

# Save
[System.IO.File]::WriteAllText($f, $newContent, [System.Text.Encoding]::UTF8)
Write-Output "Done"