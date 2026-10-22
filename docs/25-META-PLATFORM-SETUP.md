# إعداد Meta مرة واحدة لمالك المنصة

## الحالة وحدود التحقق

التكامل برمجيًا وليس اعتمادًا من Meta. لم نسجل الدخول أو نربط رقمًا أو نرسل رسالة حقيقية. حاولنا قراءة الصفحات الرسمية المباشرة في 2026-10-18؛ أعادت 429. أمكن قراءة مجموعة Meta الرسمية على Postman، ونسخة مسترجعة من الصفحة الأصلية عبر Context7 لعقود Coexistence. لذلك لا ندعي تحققًا مباشرًا من أحدث سياسة أو أهلية. يجب مطابقة الإعدادات والعقود داخل لوحة Meta قبل رفع أعلام التفعيل. لا يُفعّل الربط تلقائيًا بمجرد وجود app ID.

المراجع الأصلية المطلوب مراجعتها عند التفعيل:
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
- https://developers.facebook.com/docs/app-review/
- مجموعة Meta: https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup
- نسخة العقود المسترجعة، ليست إثباتًا لآخر سياسة حية: https://context7.com/websites/developers_facebook_business-messaging_whatsapp_embedded-signup_onboarding-business-app-users/llms.txt?tokens=10000

## الإعداد الخارجي مرة واحدة

1. يجهز المالك بنفسه Meta Business وتطبيقه ونوع تكامل Tech Provider/الشريك المناسب. التحقق التجاري وApp Review وAdvanced Access متطلبات خارجية؛ إتمام الكود لا يمنحها. لا يقدّم هذا التنفيذ طلبات باسم الشركة ولا يشارك حد ائتمان ولا ينشئ فوترة.
2. جهّز Facebook Login for Business Configuration لرقم Cloud جديد، وConfiguration يتيح Business App onboarding / Coexistence. استخدم إعدادات Embedded Signup الحالية المعتمدة في Meta، وراجع أهلية التطبيق والرقم والدولة وإصدار تطبيق الهاتف؛ لا يوجد ضمان أهلية لكل رقم. المجموعة الرسمية تذكر business_management وwhatsapp_business_management؛ مسار الرسائل يحتاج whatsapp_business_messaging. افحص الصلاحيات الفعلية في App Review؛ لا تفترض منحها تلقائيًا.
3. اعتمد نطاق HTTPS للمنصة في App Domains وAllowed Domains وOAuth إعدادات Login بحسب شاشة Meta الحالية. SDK يعيد code إلى callback في المتصفح؛ الخادم يستبدله مرة واحدة. لا توجد صفحة callback عامة تسجل الرمز في العنوان ولا يقبل الخادم Access Token من رحلة العميل العادية.
4. اضبط Webhook التطبيق على `<HTTPS-origin>/api/v1/whatsapp/webhook` ومفتاح التحقق السري الخاص بالخادم. فعّل حقول messages وsmb_message_echoes وhistory وsmb_app_state_sync وaccount_update حسب الإتاحة الفعلية. الاشتراك في WABA يتم بعد تفويض الشركة؛ هذا لا يغني عن إعداد الحقول على مستوى التطبيق.
5. احفظ في Secret Store: META_APP_SECRET وMETA_WEBHOOK_VERIFY_TOKEN ومفتاح WHATSAPP_TOKEN_ENCRYPTION_KEY الأصلي. القيم العامة: META_APP_ID وMETA_GRAPH_VERSION وMETA_EMBEDDED_CONFIG_ID وMETA_COEXISTENCE_CONFIG_ID وAPP_PUBLIC_ORIGIN. لا تغير مفتاح التشفير دون إعادة تشفير الرموز القديمة ونسخ المفتاح احتياطيًا.
6. بعد مراجعة الدعم الرسمي والاعتماد فقط: META_ONBOARDING_REVIEWED=true وMETA_EMBEDDED_SIGNUP_ENABLED=true؛ وMETA_COEXISTENCE_ENABLED=true عند توافر المسار. هذه بوابات نشر يضبطها مشغل المنصة وليست بديلًا عن App Review. القيم الافتراضية false وتظهر للشركات رسالة انتظار واضحة.

## آلية العمل والحدود

تُحفظ محاولة العشر دقائق داخل RLS بهوية الشركة والمالك وhash لملف cookie من نوع HttpOnly/Secure/SameSite=Strict. فحص Origin دقيق، وAuthorization المستخدم لا يأتي من postMessage. يتم فحص app_id وصلاحية الرمز وscopes وWABA ضمن granular targets، ثم عضوية الرقم داخل WABA. اختيار الرقم يعرض الأرقام المفوضة فقط؛ الرمز المؤقت يظل مشفرًا بالخادم. لا يجري تبادل code أو تسجيل رقم Coexistence مرتين تلقائيًا.

Coexistence يتحقق من is_on_biz_app. Cloud لديه عملية register مستقلة تطلب PIN حماية جديدًا، لا OTP؛ Coexistence لا يستدعي register. وصول platform_type=CLOUD_API ونجاح الاشتراك لا يثبت وصول الرسائل. لا يتم إرسال رسالة اختبار آليًا أو حملة أو قالب مدفوع.

مزامنة history وsmb_app_state_sync تحتاج ضغطة وموافقة واضحة، وتُطالب مرة واحدة لكل عملية onboarding. نتائج الكتابة المجهولة تبقى UNCERTAIN؛ لا تكررها تلقائيًا. راجع نافذة طلب المزامنة الرسمية في Meta عند التفعيل؛ التطبيق لا يزعم تمديدها. محتوى الوسائط في السجل يُعرض كنوع رسالة، ولا تُنزّل الملفات القديمة تلقائيًا. حذف جهة من دفتر الهاتف لا يمحو CRM. أحداث edit/revoke غير المكتملة ليست محرك أفعال/ردود، وتحتاج قبولًا حيًا منفصلًا قبل ادعاء مزامنة تحرير/حذف شاملة.

الفصل محلي: يوقف التوجيه والرسائل المنتظرة ولا يحذف حساب Business ولا يلغي تسجيل الرقم أو كل اشتراكات تطبيقات Meta. أحداث ACCOUNT_OFFBOARDED وACCOUNT_RECONNECTED لا تعيد تفعيل الإرسال آليًا؛ تحتاج تفويضًا جديدًا. التشخيص يفحص إلغاء التفويض وانتهاءه، والعامل لا يرسل برمز معروف الانتهاء. لا يمكن سحب طلب أُرسل بالفعل إلى المزود؛ تبقى أدلته للمراجعة.
