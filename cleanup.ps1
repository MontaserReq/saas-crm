$f = "src\lib\i18n\translations.ts"
$content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
$nl = "`n"

# Remove both misplaced AR blocks
# Block 1 starts after "confirmCloseAction": "تأكيد إغلاق التذكرة",`n`n
# Find each misplaced block and remove it

# Pattern 1: after "confirmCloseAction": "تأكيد إغلاق التذكرة",`n`n there is a misplaced block
$pattern1 = '"confirmCloseAction": "تأكيد إغلاق التذكرة",' + $nl + $nl + '      "directManager": "المسؤول المباشرة",' + $nl + '      "directManagerDesc": "سيتم إرسال التذكرة تلقائيًا إلى مسؤولك المباشر.",' + $nl + '      "noDirectManager": "لم يتم تحديد مسؤول مباشر لحسابك.",' + $nl + '      "noDirectManagerBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر غير محدد لحسابك. يرجى التواصل مع المسؤول لإضافة المسؤول المباشر.",' + $nl + '      "managerDisabledBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر المحدد لحسابك غير مفعّل. يرجى التواصل مع المسؤول.",' + $nl + '      "assignedByYou": "تم تكليفك بتذكرة جديدة بواسطة {name}.",' + $nl + '      "initialAssignment": "التكليف الأولى",' + $nl + '      "initialAssignmentDesc": "تم إنشاء التذكرة وتكليف المسؤول المباشر",' + $nl + '      "createTicketAssign": "إنشاء التذكرة",' + $nl + '      "schoolOptional": "المدرسة (اختياري)",' + $nl + '      "taskTypeOptional": "نوع المهمة (اختياري)",' + $nl + '      "subjectPlaceholder": "موضوع التذكرة / عنوان المهمة",' + $nl + '      "initialNotePlaceholder": "أضف ملاحظة أولية (اختياري)...",' + $nl + '      "ticketSubject": "الموضوع",' + $nl + '      "initialNote": "ملاحظة أولية",' + $nl + '      "validationRequired": "حقل مطلوب",' + $nl + '      "notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر.",' + $nl + '      "followUp": "موعد المتابعة",' + $nl + '      "oldNewValuesSavedInActivity": "سيتم حفظ القيم القديمة والجديدة في سجل النشاط.",' + $nl + '      "rejectedCorrectTitle": "تصحيح المعلومات",' + $nl + '      "rejectedCorrectInfo": "تصحيح المعلومات",' + $nl + '      "resubmitTicket": "إعادة إرسال التذكرة",' + $nl + '      "viewPendingRequest": "عرض الطلب المعلق",'

# Pattern 2 (slightly different): after },
$pattern2 = '    },' + $nl + '    ' + $nl + '      "directManager": "المسؤول المباشرة",' + $nl + '      "directManagerDesc": "سيتم إرسال التذكرة تلقائيًا إلى مسؤولك المباشر.",' + $nl + '      "noDirectManager": "لم يتم تحديد مسؤول مباشر لحسابك.",' + $nl + '      "noDirectManagerBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر غير محدد لحسابك. يرجى التواصل مع المسؤول لإضافة المسؤول المباشر.",' + $nl + '      "managerDisabledBlock": "لا يمكن إنشاء التذكرة لأن المسؤول المباشر المحدد لحسابك غير مفعّل. يرجى التواصل مع المسؤول.",' + $nl + '      "assignedByYou": "تم تكليفك بتذكرة جديدة بواسطة {name}.",' + $nl + '      "initialAssignment": "التكليف الأولى",' + $nl + '      "initialAssignmentDesc": "تم إنشاء التذكرة وتكليف المسؤول المباشر",' + $nl + '      "createTicketAssign": "إنشاء التذكرة",' + $nl + '      "schoolOptional": "المدرسة (اختياري)",' + $nl + '      "taskTypeOptional": "نوع المهمة (اختياري)",' + $nl + '      "subjectPlaceholder": "موضوع التذكرة / عنوان المهمة",' + $nl + '      "initialNotePlaceholder": "أضف ملاحظة أولية (اختياري)...",' + $nl + '      "ticketSubject": "الموضوع",' + $nl + '      "initialNote": "ملاحظة أولية",' + $nl + '      "validationRequired": "حقل مطلوب",' + $nl + '      "notEligibleManager": "المسؤول المباشر المحدد غير مؤهل لاستلام التذاكر.",' + $nl + '      "followUp": "موعد المتابعة",' + $nl + '      "oldNewValuesSavedInActivity": "سيتم حفظ القيم القديمة والجديدة في سجل النشاط.",' + $nl + '      "rejectedCorrectTitle": "تصحيح المعلومات",' + $nl + '      "rejectedCorrectInfo": "تصحيح المعلومات",' + $nl + '      "resubmitTicket": "إعادة إرسال التذكرة",' + $nl + '      "viewPendingRequest": "عرض الطلب المعلق",'

# Check what's there
$count1 = ([regex]::Matches($content, [regex]::Escape($pattern1))).Count
Write-Output "Pattern 1 matches: $count1"

# Find pattern of misplaced blocks - look for  'directManager": "المسؤول' occurrences
$allMatches = [regex]::Matches($content, '"directManager": "المسؤول المباشرة",')
Write-Output "Total AR directManager occurrences: $($allMatches.Count)"

foreach ($m in $allMatches) {
    $start = [Math]::Max(0, $m.Index - 500)
    $end = [Math]::Min($content.Length, $m.Index + 1500)
    $sub = $content.Substring($start, $end - $start)
    Write-Output "--- Match at $($m.Index) ---"
    Write-Output $sub.Substring(0, [Math]::Min(800, $sub.Length))
}