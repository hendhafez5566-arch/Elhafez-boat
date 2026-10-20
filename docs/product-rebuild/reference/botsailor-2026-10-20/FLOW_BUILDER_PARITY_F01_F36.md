# Elhafez Boat — تدقيق احترافي شامل لمصمم البوت ومواصفات تطوير موحدة

**التاريخ:** 20 أكتوبر 2026  
**النطاق:** Flow Builder فقط وما يتصل به من محرك محادثات وتجربة عميل، دون إعادة تصميم باقي المنصة في هذه الدفعة.  
**المقارنة:** وثائق Manychat الرسمية، ووثائق وتحديثات BotSailor الرسمية، والكود الفعلي لـ Elhafez Boat في فرع `feat/stage0-foundation` (آخر HEAD معروف `cc702b795f1c7aa0d0b75fec6655574f4f2ec57b`).  
**حدود الإثبات:** تمت مراجعة المصدر والتوثيق، **لكن لم يتم إجراء اختبار تفاعلي جديد داخل جلسة المتصفح المنشورة بعد النشر الأخير**. وجود دوال في الكود لا يثبت كفاءتها أو راحة استخدامها في الإنتاج. وثائق المنافسين دليل على المزايا المعلنة، وليست فحصًا لحساباتهم المدفوعة.

## الحكم التنفيذي

الحاجة ليست «إعادة رسم أسهم وبلوكات» فحسب، بل رفع المحرر إلى منظومة متكاملة: **إنشاء، إدارة تفاعلات، ضبط سلوك المحادثة، اختبار، نشر، متابعة وتشخيص**. يجب أن تعمل الواجهة البسيطة والمتقدمة على نفس تعريف البيانات، مع توافق خلفي للبوتات المنشورة سابقًا. لا يصح إعلان التعادل الوظيفي قبل اختبار المستخدم الحقيقي.

## ملاحظات مثبتة من الكود الحالي

- `apps/web/public/flow-canvas.js`: يوجد Zoom/Pan وFit وAuto-layout وPointer dragging، لكن المقياس قد ينخفض إلى `0.02`؛ لا تظهر نسبة التكبير، ولا Minimap. `flow-lines` غير قابلة للتفاعل `pointer-events:none` في `flow-builder.css`؛ لا توجد في مسار العرض أداة مباشرة لاختيار الوصلة وإعادة توجيهها أو حذفها منفردة. السحب من المخرج لا يرسم وصلة حية أثناء الحركة؛ يوضع إطار CSS حول المخرج.
- `apps/api/src/flow-engine.ts`: أنواع العقد تدعم START/TEXT/BUTTONS/LIST/INPUT/CONDITION/TAG/MEDIA/LINK/HANDOFF/END/DELAY/SUBFLOW/WEBHOOK/CONNECTOR/AI وغيرها؛ لا توجد عقد مستقلة لـ RANDOMIZER/SET_FIELD/GOAL/USER_CONSENT/STOP_AUTOMATION/ON_TIMEOUT/RETRY أو رسالة متعددة المحتويات. `FlowNode.CONDITION` يقتصر على مقارنة مفردة (`equals|contains|exists`) مع `yes/no`.
- `apps/api/src/flow-engine.ts`: نوع INPUT يحمل `text/field/next` فقط؛ التحقق المتخصص الحالي متعلق برقم الهاتف إذا طابق اسم الحقل، ولا توجد إعدادات مهيكلة للتاريخ/البريد/الموقع/الملف، أو عدد المحاولات، التخطي، المهلة، التذكير وفروع الفشل.
- `apps/api/src/triggers.ts`: التريجرز المسجلة للمنظومة الأساسية `KEYWORD` و`FIRST_MESSAGE` فقط؛ توجد وظائف قنوات أخرى حول المشروع، لكن لا يجوز اعتبارها كلها متصلة بعقدة START من المحرر.
- `apps/web/public/flow-builder.js`: توجد Undo/Redo، معاينة، حوار إضافة خطوات، Simple/Canvas modes، مسودات وإصدارات واستيراد، وخصائص سياقية؛ لا يجب إعادة بناء هذه الوظائف من الصفر أو إلغاء التوافق؛ مطلوب استكمالها وتحسينها واختبارها.
- `apps/api/src/flow-service.ts`: توجد مسودات مستقلة عن النسخ المنشورة، وفحص بنية وعزل بوتات؛ يتم الحفاظ عليها ومراقبة النسخ المفعلة، وعدم إطلاق تكامل أو إرسال تلقائي أثناء الاختبارات.

## مقارنة المزايا — حالة كل بند مقابل الكود الحالي

الرموز: **موجود جزئيًا** تعني يوجد أساس برمجي لكن تجربة أو تفرعات أو التغطية ليست مكافئة؛ **غير ظاهر بالنموذج** تعني لا تظهر البنية المطلوبة في تعريف عقدة المحرر الحالي، وقد توجد وظيفة مستقلة في شاشة أخرى؛ **غير مثبت** تعني لا تتوفر أدلة كافية للحكم؛ **قيد مزود** يعني يلزمه اتصال/اعتماد خارجي.

| ID | مجال المقارنة | دليل Manychat/BotSailor | وضع Elhafez في الكود | المطلوب | أولوية |
|---|---|---|---|---|---|
| F01 | Zoom + pan + cursor focus | Manychat توثّق أدوات الزوم والتنقل | موجود جزئيًا | نسبة ظاهرة، 100%، حدود مقروءة، Zoom-to-cursor، سلاسة عجلة الماوس واللمس | P0 |
| F02 | وصل وفصل وتغيير وجهة الخط | BotSailor تحديث 2026 يذكر حذف الوصلة عند التحويم | موجود جزئيًا | drag line ghost، hit targets، اختيار/حذف/إعادة وصل الخط مع Undo/Redo | P0 |
| F03 | تحديد متعدد ومحاذاة | Manychat تقدم التعامل مع خطوات متعددة | موجود جزئيًا | rectangle/lasso + copy/paste/move/alignment/snap + collision-safe layout | P0 |
| F04 | سهولة بدء عقدة | BotSailor فتح الإعدادات فور الربط | موجود جزئيًا | الضغط على (+) من المخرج يفتح منتقيًا سياقيًا ثم إعدادات العقدة الجديدة تلقائيًا | P0 |
| F05 | محرر رسالة مركبة | Manychat Content Blocks: نص وصورة وأزرار وCard/Gallery حسب القناة | غير ظاهر بالنموذج | `MESSAGE` مع blocks مرتبة وقواعد القناة، انتقال تدريجي من العقد الحالية | P0 |
| F06 | أنواع أزرار متعددة | Manychat buttons: node, URL, actions, ... | BUTTONS قائمة تحويل إلى node فقط؛ LINK منفصل | زر يوجّه لمسار أو رابط أو action مرخص وفق القناة | P0 |
| F07 | Quick Replies وبدائل الخطأ | Manychat Quick Replies + retry | موجود جزئيًا | retry on unexpected text، fallback branch، limits، تمييز القنوات | P0 |
| F08 | جامع بيانات مهيكل | Manychat Data Collection وBotSailor validation | موجود جزئيًا (هاتف فقط) | أنواع حقول، حفظ في CRM، retry/no-reply/skip/time-limit، تحديد required/optional | P0 |
| F09 | شروط مركبة | BotSailor وManychat: multiple conditions | شرط مفرد محدود | مجموعات AND/OR وعمليات مقارنة للنص والعدد والتاريخ والوسم والحقول | P0 |
| F10 | التريجر داخل START | Manychat `+ New Trigger` | التريجرز في شاشة مستقلة بنطاق محدود | اختيار وضبط تريجر من البداية مع اختيار القناة والأولوية والتعارضات | P0 |
| F11 | إدارة المتغيرات وأنواعها | Manychat CUF/Bot Fields وBotSailor # suggestions | متغيرات نصية ضمن inputs؛ محدود | مكتبة typed variables، الاقتراحات، scope/consent، preview values | P0 |
| F12 | أفعال CRM | Manychat Actions + BotSailor labels/fields/assignee | TAG/HANDOFF وبعض موصلات محدودة | SET_FIELD، add/remove tag، assign agent، lead stage، stop/pause/resume | P0 |
| F13 | تشغيل مسارات فرعية | Manychat Start Automation | SUBFLOW موجود | اختيار مسار قابل لإعادة الاستخدام، عقود الإدخال/الإخراج، النسخة المثبتة والعودة | P0 |
| F14 | الاستثناءات والمهل | Manychat data-collection no reply/retry | لا تظهر كعقد تشغيلية | timeout/retry/error/default paths لكل خطوة حساسة | P0 |
| F15 | المعاينة واختبار كل فرع | Manychat simulator داخل النظام مع حدود واضحة | موجود جزئيًا | اختبار قنوات/شخصيات وقيم بيانات، إبراز المسار المتبع واختبار الانقطاعات | P0 |
| F16 | النشر الآمن | Manychat Preview & Set Live | draft/publish/version موجود | preflight lint شامل، قوائم blocking/warnings، مقارنة ونشر واعٍ بالقناة، rollback | P0 |
| F17 | قابلية نقل القوالب | Manychat templates | معالج/مكتبة أولية + JSON | مكتبة مهام + تصدير/استيراد آمن + إعادة تعيين المراجع الخارجية | P0 |
| F18 | وضع البوت والتحويل البشري | Hand-off موجود في النظام | موجود جزئيًا | pause on human takeover, resume policy, inactivity/reset semantics, race-safety | P0 |
| F19 | Channel compatibility matrix | Manychat تختلف عناصره حسب القناة | غير مثبت اكتمالها لكل عنصر | Capability contract مصدّق على الخادم، preview مختلف، حظر عناصر غير مدعومة | P0 |
| F20 | Consent/opt-out | Manychat actions and data collection opt-in | قواعد عامة غير كافية للتدليل على عقد Flow | فروع STOP/UNSUBSCRIBE، تسجيل الموافقة، منع التسويق غير المسموح | P0 |
| F21 | Smart Delay بتوقيت العميل | Manychat smart delay: duration/date/hours/weekdays | DELAY بالثواني فقط | يوم/وقت محدد أو متغير، timezone، business hours، cancellation | P1 |
| F22 | Randomizer وA/B | Manychat randomizer | غير ظاهر بالنموذج | توزيع بنسب محددة، تثبيت فرع أو إعادة عشوائية، قياس النتائج | P1 |
| F23 | API ديناميكي قابل للاختبار | Manychat External Request, BotSailor HTTP API | WEBHOOK/CONNECTOR موجودان | request editor، secret-safe headers، response mapping، timeout/retry/error routes | P1 |
| F24 | WhatsApp Flows متعددة الشاشات | BotSailor WhatsApp Flows | غير ظاهر بالنموذج | تصميم/مرجع لنماذج رسمية، تحقق توافق وموافقة Meta قبل تشغيل حي | P1/قيد مزود |
| F25 | بطاقات ومعارض | Manychat card/gallery وBotSailor Interactive | MEDIA/LINK موجودان منفصلين | Cards/Gallery/Carousel ومعاينة محدودة حسب القناة | P1 |
| F26 | موقع وإحداثيات ومواعيد | Manychat Data Collection, BotSailor Location | غير ظاهر كنموذج إدخال مهيكل | types location/date/datetime مع fallback للقنوات غير الداعمة | P1 |
| F27 | أداء العقد داخل الرسم | Manychat تعرض تقارير نشاط الأتمتة (تتبّع القمع أمر مرغوب) | analytics على مستوى البوت موجود؛ مستوى عقدة غير مثبت | events step-enter/success/fail، conversion goal والانسحاب داخل المخطط | P1 |
| F28 | فرق العمل والملاحظات | احتياج منتج مؤسسي، لا نزعم مطابقته حرفيًا لدى المنافس | conflict/version آلية موجودة | تعليقات على العقد، مراجعة تغيير، نسخة أولية قبل النشر، الصلاحيات | P1 |
| F29 | AI إنشاء البوت | Manychat AI Flow Builder Assistant | معالج قوالب ثابت وليس AI مولد فعلي | AI opt-in توليد Draft Definition مع فحص/مراجعة، لا نشر آلي | P1/مزود |
| F30 | AI تحسين صياغة الرسالة | Manychat AI Text Improver | غير ظاهر بالمحرر | اقتراح لغة/أسلوب وملخص قابل للقبول أو الرفض، لا يعدّل دون موافقة | P2/مزود |
| F31 | رؤية مخطط كبير | Manychat zoom/arrange | zoom/auto-layout موجود | Minimap، search node by text/ID، breadcrumbs، folding groups، focus path | P1 |
| F32 | استقرار UX | توصية هندسية لا ندعي أنها نسخ لمنافس | CSS layers وعدة تبعيات DOM | تباين واضح، حالات loading/empty/error، tooltips، keyboard/screen readers | P0 |
| F33 | الأداء مع مسارات كبيرة | حاجة تجارية | الاختبارات الحالية تشمل 48 node graph و100 geometry fixtures | 100+ step render budget، no jank، lazy/virtualized edges، memory leak guard | P0 |
| F34 | مرونة لغوية | Both supports global customers | لغة الواجهة عربية وRTL | المتغيرات والقيم متعددة اللغة، عناوين مزدوجة واتجاه RTL/LTR مضبوط | P1 |
| F35 | مراقبة الأحداث والأخطاء | متطلب موثوقية | توجد سجلات ونشاط في أجزاء من النظام | per-session trace، زمن الخطوة، سبب الفرع، فشل التنفيذ، correlation IDs بلا بيانات حساسة | P0 |
| F36 | قفل المسودة والتعافي | Manychat undo & redo؛ منتجنا يدعم conflict review | موجود جزئيًا | autosave server debounced اختياري، lost draft recovery، local dirty state، no silent overwrite | P0 |

## بنود سبق اعتمادها وتتداخل مع المقارنة

متطلبات Canvas (التكبير/التوصيل/المحاذاة)، المكوّنات الأساسية، جمع البيانات، الشروط، المتغيرات، المحاكاة، الحفظ/الإصدارات، مكتبة القوالب، ساعات العمل، التشخيص/المساعد الذكي **ليست بنودًا جديدة مستقلة**؛ تُدمج داخل F01–F36 لتجنّب تنفيذ مكرر. البنود التي أضافتها المقارنة فعليًا: F05–F08، F10–F12، F14، F18–F20، F23–F26، F28، F30، F34–F36.

## معايير القبول الحاسمة

1. **Navigation:** في مخطط من 100 عقدة، تظهر نسبة زوم مفهومة، تحرك وتركز وتلائم وتبحث بدون صغر غير مقروء؛ إعادة التحميل تحافظ على Layout.
2. **Edges:** المستخدم يوصل، يقطع، يعيد التوجيه، ويلغي العملية، ويعمل Undo/Redo لخط واحد بدون تأثير على باقي الفروع؛ خط لا يمكن أن يشير إلى عقدة محذوفة.
3. **Conversation:** رسالة ذات مكونات متعددة، أزرار بأنواعها، شرط مركب، جمع بيانات متحقق ورسائل خطأ، تخطي ومهلة مع بقاء المسار سليمًا.
4. **No reply:** بعد انتهاء مهلة حقيقية ينتقل لمسار محدد؛ العودة بعد المهلة لا تنتج إرسالًا مكررًا أو استكمالًا خاطئًا.
5. **Integration:** API ناجح/فاشل/Timeout/429، إعداد الرؤوس مؤمن، استجابة JSON للمتغيرات، لا تسريب أسرار، لا SSRF.
6. **Channel:** اختيار WhatsApp يمنع الرسائل المدعومة في Messenger فقط والعكس؛ الرسائل ذات نافذة الخدمة المقيّدة لا تُرسل خارجها.
7. **Migration:** كل بوت ومسودة وإصدار قديم يحتفظ بهويته ونسخه، no data loss؛ أي upgrade يقدم ترحيلًا idempotent وروابط الإصدار الحالية لا تنكسر.
8. **Team & safety:** صلاحيات Owner/Manager/Agent/Viewer وtenant isolation؛ منع تعديل أو نشر من غير الصلاحيات؛ التحديث المتزامن لا يضيع العمل.
9. **Publish:** تمرير حفظ المسودة ثم preflight validation ثم نشر قناة مؤهلة فقط؛ النشر لا يعني اتصال Meta؛ rollback للإصدارات.
10. **Real visual acceptance:** Chromium لسطح المكتب والجوال الفعلي و200% zoom، لقطات فعلية من المنتج ومراجعة المستخدم؛ ليس فقط API pass.

## التنفيذ الصحيح في دفعة منطقية واحدة

- **قبل الكود:** تأكيد design contract والداتا موديل وfeature capability matrix ومصفوفة F01–F36 وإقرار مالك المنتج.
- **قلب التنفيذ:** توسيع تعريف FlowDefinition بطريقة versioned compatible؛ update compiler/runtime/provider renderers + graph editor + UX component library؛ عدم الاقتصار على CSS.
- **التحقق:** اختبارات وحدات + PostgreSQL + Browser + فشل الشبكة + محاكاة قناة واقعية محلية دون اتصال مزود.
- **تسليم:** PR مستقل واحد، screenshots وملف PASS/PARTIAL/NOT_RUN لكل F01–F36، وعدم الدمج أو نشر الإنتاج أو تفعيل موفرين قبل تصريح المالك.

## مصادر المقارنة الرسمية

- Manychat Flow Builder: https://help.manychat.com/hc/en-us/articles/14281166306332-How-to-build-a-Manychat-automation
- Manychat Content Blocks: https://help.manychat.com/hc/en-us/articles/14281196200604-Content-Block-types
- Manychat Data Collection (27 أغسطس 2026): https://help.manychat.com/hc/en-us/articles/18362925739932-Data-Collection-Block
- Manychat Buttons: https://help.manychat.com/hc/en-us/articles/14281157003292-Buttons
- Manychat Quick Replies: https://help.manychat.com/hc/en-us/articles/14281157129116-Quick-Reply-Buttons
- Manychat Condition: https://help.manychat.com/hc/en-us/articles/14281142518556-Condition-Block
- Manychat Randomizer: https://help.manychat.com/hc/en-us/articles/14281151100060-Randomizer
- Manychat Smart Delay: https://help.manychat.com/hc/en-us/articles/14281197046812-Smart-Delay
- Manychat External Request: https://help.manychat.com/hc/en-us/articles/14281285374364-Dev-Tools-External-request
- Manychat AI Flow Builder: https://help.manychat.com/hc/en-us/articles/14281200017948-Manychat-AI-Flow-Builder-assistant
- Manychat AI Text Improver: https://help.manychat.com/hc/en-us/articles/14281227827996-Manychat-AI-Text-Improver
- BotSailor Updated Builder (24 مايو 2026): https://botsailor.com/blog/explore-the-upgraded-no-code-chatbot-builder
- BotSailor Flow Builder Elements: https://botsailor.com/help/en/blog/introduction-to-flow-builder-design-chatbot-conversations-easily-botsailor
- BotSailor Input Validation: https://botsailor.com/help/en/blog/input-validation-rules-in-botsailor-collect-clean-whatsapp-data
- BotSailor Conditions: https://botsailor.com/help/en/blog/using-conditions-and-triggers-in-flow-builder-botsailor-automation-guide
- BotSailor Change Log: https://botsailor.com/blog/botsailors-change-log

**تحفظ مهم:** بعض قدرات Manychat تختلف حسب الخطة أو قناة المراسلة. بعض قدرات BotSailor موثقة كوظائف على المنصة عامة، وليس بالضرورة في عقدة المحرر على كل قناة. لا تقلد وظيفة حية أو تعلنها متاحة بدون تحقق وترخيص واعتماد المنصات المعنية.