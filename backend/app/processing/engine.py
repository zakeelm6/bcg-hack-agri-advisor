"""Decision engine: rules and a simple water balance.

Doses, dates and quantities are COMPUTED here from data. A language model (later) may only explain
what this module decides; it never invents a number.
"""
from datetime import date, datetime, timedelta

TARGET_MOISTURE = 0.28   # volumetric fraction the topsoil should reach after irrigation
TRIGGER_MOISTURE = 0.23  # below this a zone needs water if no useful rain is coming
ROOT_DEPTH_MM = 300      # depth over which the deficit is converted to millimetres of water
MAX_IRRIGATION_MM = 30
TARGET_NDVI = 0.70       # vigor target for this crop stage (demo value)
UREA_N_SHARE = 0.46
MANUAL_MOISTURE_MAX_AGE_DAYS = 3   # a moisture value typed from a soil sample is a measurement for a few days
SOIL_TEST_MAX_AGE_DAYS = 120       # pH and organic matter change slowly
PH_OK = (5.5, 7.5)
YIELD_T_HA = {"Potato": 35.0, "Tomato": 60.0, "Onion": 40.0, "Wheat": 4.0}


WEEKDAYS = {"en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "fr": ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
            "ar": ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
            "ary": ["التنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت", "الحد"]}

# Texts shown to the farmer, in English (reference) and French. Numbers are never in the catalogue: they are inserted.
TEXTS = {
    "en": {
        "r_watered": " Counts your {mm} mm of watering on {day}.",
        "watered_est_body": "You recorded {what} on {day}. The topsoil is now estimated at {pct}% (watering is advised below {trigger}%), so none is needed yet.",
        "watered_title": "Watering recorded", "watered_some": "watering",
        "watered_body": "You recorded {what} on {day}. No new watering is advised for {days} days, so the soil has time to show it.",
        "today": "Today", "tomorrow": "Tomorrow", "morning": "morning", "before_rain": "before the rain",
        "r_sensor": "A sensor in this zone measures it.", "r_sample": "Measured from the soil sample you entered.",
        "r_none": "No sensor data yet.", "k_sensor": "sensor in zone {z}", "k_sample": "soil sample in zone {z}", "and": " and ",
        "r_est": "Estimated from the {names} and crop vigor seen from space.",
        "r_offset": "Estimated from the shared sensor in zone {s} plus the gap learned from your {n} soil samples in this zone (about {d} points).",
        "r_bad": "The sensor in this zone gives unreliable readings ({flags}). No dose is computed until a soil sample or a repair.",
        "sensor_title": "Sensor in zone {z} unreliable", "sensor_body": "Its readings are flagged: {flags}. A soil sample is recommended; no water dose is given from it.",
        "anom_title": "Inspect zone {z}", "anom_what": "Walk to the marked spot in zone {z} and check the plants",
        "anom_why": "Satellite: a patch of about {ha} ha in zone {z} stayed {dev} below the rest of the field on {n} passes (last {date}).",
        "anom_conf": "The satellite shows where, not why (water, disease, pests, soil). Only a visit or a sample can tell.",
        "rain_next": "Next useful rain: {mm} mm on {day}.", "rain_none": "No useful rain in the 5-day forecast.",
        "irr_title": "Irrigate Zone {z}, {mm} mm", "irr_what": "Irrigate zone {z}, {mm} mm",
        "irr_why": "Topsoil moisture is about {m}% (target {t}%). {rain}",
        "irr_cost": "Pump time for about {mm} mm over {ha} ha ({m3} m3 of water).",
        "raise": " A soil sample would raise it.",
        "irr_planb": "If you cannot water every zone, water zone {z} first; the others can wait a day.",
        "sample_title": "Soil sample needed in zone {z}", "sample_body": "The irrigation advice there is estimated. A soil sample would sharpen it.",
        "fert_title": "Fertilize Zone {z}, {dose} kg N/ha", "fert_what": "Apply {dose} kg N per ha in zone {z}",
        "fert_why": "Crop vigor in zone {z} is {ndvi}, below the {target} target. No heavy rain in the next 2 days, so the nitrogen stays in the soil.",
        "om_rich": " Your soil test shows rich soil (organic matter {om}%), so the dose is 10 kg lower.",
        "om_poor": " Your soil test shows poor soil (organic matter {om}%), so the dose is 10 kg higher.",
        "om_ok": " Your soil test shows organic matter {om}%: no change to the dose.",
        "fert_cost": "About {urea} kg of urea (46% N) for this zone.",
        "fert_conf_test": "Uses your soil test from {d} day(s) ago.",
        "fert_conf_none": "Based on crop vigor from space only, with no soil test. A soil test would raise it.",
        "fert_planb": "If fertilizer is not available, wait for the next delivery or ask your cooperative for a smaller dose.",
        "insp_title": "Inspect point P", "insp_what": "Walk to point P in zone {z} and check the leaves",
        "insp_why": "Vigor in zone {z} fell from {a} to {b} over the last 3 satellite passes.",
        "insp_cost": "Free: about 15 minutes in the field.",
        "insp_conf": "Vigor can fall for many reasons (water, disease, pests). Only a visit can tell.",
        "insp_planb": "If you see pests or disease, take a photo and add it in the follow-up.",
        "stress_title": "Possible stress at point P", "stress_body": "Vigor in zone {z} fell for 3 passes. Go and check.",
        "ph_title": "Soil pH {ph} in zone {z}",
        "ph_body": "Outside {lo} to {hi}: nutrient uptake can suffer. Ask a local advisor about a correction.",
        "frost_title": "Frost possible on {day}", "frost_body": "Minimum {t} C expected. Protect young plants.",
        "rain_title": "Rain on {day}: {mm} mm", "rain_body": "Fertilizer timing is set around it.",
        "norain_title": "No useful rain for 5 days", "norain_body": "Irrigation tasks are based on this forecast.",
        "h_known": "Simple estimate from crop vigor and a reference yield. Not validated yet.",
        "h_unknown": "Placeholder: the crop is not identified, so the reference yield and the harvest date are generic. Not validated.",
        "h_advice": "Agree on a buyer before the harvest window so the produce does not wait in the field.",
        "wi_short": "The forecast is too short to look that far ahead.",
    },
    "fr": {
        "r_watered": " Tient compte de votre arrosage de {mm} mm le {day}.",
        "watered_est_body": "Vous avez noté {what} le {day}. Le sol de surface est maintenant estimé à {pct}% (l'arrosage est conseillé sous {trigger}%), il n'en faut donc pas encore.",
        "watered_title": "Arrosage noté", "watered_some": "un arrosage",
        "watered_body": "Vous avez noté {what} le {day}. Aucun nouvel arrosage n'est conseillé pendant {days} jours, le temps que le sol le montre.",
        "today": "Aujourd'hui", "tomorrow": "Demain", "morning": "matin", "before_rain": "avant la pluie",
        "r_sensor": "Un capteur de cette zone la mesure.", "r_sample": "Mesurée d'après l'échantillon de sol que vous avez saisi.",
        "r_none": "Pas encore de données de capteur.", "k_sensor": "du capteur de la zone {z}", "k_sample": "de l'échantillon de sol de la zone {z}", "and": " et ",
        "r_est": "Estimée à partir {names} et de la vigueur de la culture vue depuis l'espace.",
        "r_offset": "Estimée à partir du capteur partagé de la zone {s} et de l'écart appris sur vos {n} échantillons de sol dans cette zone (environ {d} points).",
        "r_bad": "Le capteur de cette zone donne des mesures peu fiables ({flags}). Aucune dose n'est calculée avant un échantillon de sol ou une réparation.",
        "sensor_title": "Capteur de la zone {z} peu fiable", "sensor_body": "Ses mesures sont signalées : {flags}. Un échantillon de sol est recommandé ; aucune dose d'eau n'en est déduite.",
        "anom_title": "Inspecter la zone {z}", "anom_what": "Allez à l'endroit marqué dans la zone {z} et vérifiez les plantes",
        "anom_why": "Satellite : une tache d'environ {ha} ha dans la zone {z} est restée {dev} sous le reste du champ sur {n} passages (dernier le {date}).",
        "anom_conf": "Le satellite montre où, pas pourquoi (eau, maladie, ravageurs, sol). Seule une visite ou un échantillon peut le dire.",
        "rain_next": "Prochaine pluie utile : {mm} mm {day}.", "rain_none": "Aucune pluie utile dans les prévisions à 5 jours.",
        "irr_title": "Irriguer la zone {z}, {mm} mm", "irr_what": "Irriguer la zone {z}, {mm} mm",
        "irr_why": "L'humidité du sol en surface est d'environ {m} % (objectif {t} %). {rain}",
        "irr_cost": "Temps de pompe pour environ {mm} mm sur {ha} ha ({m3} m3 d'eau).",
        "raise": " Un échantillon de sol la renforcerait.",
        "irr_planb": "Si vous ne pouvez pas arroser toutes les zones, arrosez d'abord la zone {z} ; les autres peuvent attendre un jour.",
        "sample_title": "Échantillon de sol nécessaire dans la zone {z}", "sample_body": "Le conseil d'irrigation est estimé à cet endroit. Un échantillon de sol le rendrait plus précis.",
        "fert_title": "Fertiliser la zone {z}, {dose} kg N/ha", "fert_what": "Apporter {dose} kg d'azote par ha dans la zone {z}",
        "fert_why": "La vigueur de la culture dans la zone {z} est de {ndvi}, sous l'objectif de {target}. Pas de forte pluie dans les 2 prochains jours : l'azote reste dans le sol.",
        "om_rich": " Votre analyse de sol montre un sol riche (matière organique {om} %), donc la dose est inférieure de 10 kg.",
        "om_poor": " Votre analyse de sol montre un sol pauvre (matière organique {om} %), donc la dose est supérieure de 10 kg.",
        "om_ok": " Votre analyse de sol indique une matière organique de {om} % : pas de changement de dose.",
        "fert_cost": "Environ {urea} kg d'urée (46 % N) pour cette zone.",
        "fert_conf_test": "Utilise votre analyse de sol d'il y a {d} jour(s).",
        "fert_conf_none": "Fondé uniquement sur la vigueur de la culture vue de l'espace, sans analyse de sol. Une analyse de sol la renforcerait.",
        "fert_planb": "Si l'engrais n'est pas disponible, attendez la prochaine livraison ou demandez une dose plus faible à votre coopérative.",
        "insp_title": "Inspecter le point P", "insp_what": "Allez au point P de la zone {z} et vérifiez les feuilles",
        "insp_why": "La vigueur dans la zone {z} est passée de {a} à {b} sur les 3 derniers passages du satellite.",
        "insp_cost": "Gratuit : environ 15 minutes sur le terrain.",
        "insp_conf": "La vigueur peut baisser pour de nombreuses raisons (eau, maladie, ravageurs). Seule une visite permet de le savoir.",
        "insp_planb": "Si vous voyez des ravageurs ou une maladie, prenez une photo et ajoutez-la dans le suivi.",
        "stress_title": "Stress possible au point P", "stress_body": "La vigueur de la zone {z} a baissé sur 3 passages. Allez vérifier.",
        "ph_title": "pH du sol {ph} dans la zone {z}",
        "ph_body": "Hors de {lo} à {hi} : l'absorption des nutriments peut en souffrir. Demandez à un conseiller local comment le corriger.",
        "frost_title": "Gel possible {day}", "frost_body": "Minimum de {t} C prévu. Protégez les jeunes plants.",
        "rain_title": "Pluie {day} : {mm} mm", "rain_body": "Le moment de l'engrais est calé sur cette pluie.",
        "norain_title": "Pas de pluie utile pendant 5 jours", "norain_body": "Les tâches d'irrigation reposent sur cette prévision.",
        "h_known": "Estimation simple à partir de la vigueur et d'un rendement de référence. Pas encore validée.",
        "h_unknown": "Valeur provisoire : la culture n'est pas identifiée, donc le rendement de référence et la date de récolte sont génériques. Non validé.",
        "h_advice": "Convenez d'un acheteur avant la période de récolte pour que la production n'attende pas au champ.",
        "wi_short": "Les prévisions sont trop courtes pour regarder si loin.",
    },
    "ar": {
        "r_watered": " تُحتسب فيها سقيتك {mm} مم يوم {day}.",
        "watered_est_body": "سجّلتَ {what} يوم {day}. رطوبة التربة السطحية مقدَّرة الآن بـ {pct}% (يُنصح بالسقي تحت {trigger}%)، فلا حاجة إليه بعد.",
        "watered_title": "تم تسجيل السقي", "watered_some": "سقيًا",
        "watered_body": "سجّلتَ {what} يوم {day}. لا يُنصح بسقي جديد في الأيام القليلة القادمة ليظهر أثره في التربة.",
        "today": "اليوم", "tomorrow": "غدًا", "morning": "صباحًا", "before_rain": "قبل المطر",
        "r_sensor": "يقيسها مستشعر في هذه المنطقة.", "r_sample": "مقيسة من عيّنة التربة التي أدخلتها.",
        "r_none": "لا توجد بيانات مستشعر بعد.", "k_sensor": "مستشعر المنطقة {z}", "k_sample": "عيّنة تربة المنطقة {z}", "and": " و",
        "r_est": "مقدَّرة انطلاقًا من {names} ومن قوة النبات المرصودة من الفضاء.",
        "r_offset": "مقدَّرة من المستشعر المشترك في المنطقة {s} مع الفارق المتعلَّم من {n} عيّنات تربة في هذه المنطقة (حوالي {d} نقاط).",
        "r_bad": "مستشعر هذه المنطقة يعطي قراءات غير موثوقة ({flags}). لا تُحسب أي جرعة قبل عيّنة تربة أو إصلاح.",
        "sensor_title": "مستشعر المنطقة {z} غير موثوق", "sensor_body": "قراءاته موسومة: {flags}. يُنصح بعيّنة تربة؛ لا تُعطى جرعة ماء منه.",
        "anom_title": "تفقّد المنطقة {z}", "anom_what": "اذهب إلى الموضع المحدد في المنطقة {z} وافحص النباتات",
        "anom_why": "القمر الصناعي: بقعة بحوالي {ha} هكتار في المنطقة {z} بقيت أقل بـ {dev} من بقية الحقل خلال {n} مرور (آخرها {date}).",
        "anom_conf": "القمر الصناعي يُظهر الموضع لا السبب (ماء، مرض، آفات، تربة). الزيارة أو العيّنة وحدها تحسم.",
        "rain_next": "أقرب مطر مفيد: {mm} مم يوم {day}.", "rain_none": "لا مطر مفيد في توقعات 5 أيام.",
        "irr_title": "سقي المنطقة {z}، {mm} مم", "irr_what": "سقي المنطقة {z}، {mm} مم",
        "irr_why": "رطوبة التربة السطحية حوالي {m}% (الهدف {t}%). {rain}",
        "irr_cost": "وقت المضخة لحوالي {mm} مم على {ha} هكتار ({m3} م³ من الماء).",
        "raise": " عيّنة تربة ترفع الثقة.",
        "irr_planb": "إن لم تستطع سقي كل المناطق، اسقِ المنطقة {z} أولًا؛ يمكن للأخرى أن تنتظر يومًا.",
        "sample_title": "المنطقة {z} تحتاج عيّنة تربة", "sample_body": "نصيحة السقي هناك تقديرية. عيّنة تربة تجعلها أدق.",
        "fert_title": "تسميد المنطقة {z}، {dose} كغ N/هكتار", "fert_what": "أضف {dose} كغ من الأزوت للهكتار في المنطقة {z}",
        "fert_why": "قوة النبات في المنطقة {z} هي {ndvi}، أقل من الهدف {target}. لا مطر غزير في اليومين القادمين، فيبقى الأزوت في التربة.",
        "om_rich": " تحليل تربتك يُظهر تربة غنية (مادة عضوية {om}%)، لذلك الجرعة أقل بـ 10 كغ.",
        "om_poor": " تحليل تربتك يُظهر تربة فقيرة (مادة عضوية {om}%)، لذلك الجرعة أكثر بـ 10 كغ.",
        "om_ok": " تحليل تربتك يُظهر مادة عضوية {om}%: لا تغيير في الجرعة.",
        "fert_cost": "حوالي {urea} كغ من اليوريا (46% N) لهذه المنطقة.",
        "fert_conf_test": "يعتمد على تحليل تربتك قبل {d} يوم.",
        "fert_conf_none": "يعتمد فقط على قوة النبات المرصودة من الفضاء، دون تحليل تربة. تحليل التربة يرفع الثقة.",
        "fert_planb": "إن لم يتوفر السماد، انتظر التسليم القادم أو اطلب من تعاونيتك جرعة أقل.",
        "insp_title": "تفقّد النقطة P", "insp_what": "اذهب إلى النقطة P في المنطقة {z} وافحص الأوراق",
        "insp_why": "قوة النبات في المنطقة {z} انخفضت من {a} إلى {b} خلال آخر 3 مرور للقمر الصناعي.",
        "insp_cost": "مجاني: حوالي 15 دقيقة في الحقل.",
        "insp_conf": "قد تنخفض قوة النبات لأسباب كثيرة (ماء، مرض، آفات). الزيارة وحدها تحسم الأمر.",
        "insp_planb": "إن رأيت آفات أو مرضًا، صوّر ثم أضف الصورة في المتابعة.",
        "stress_title": "إجهاد محتمل عند النقطة P", "stress_body": "انخفضت قوة النبات في المنطقة {z} عبر 3 مرات. اذهب وتحقق.",
        "ph_title": "حموضة التربة {ph} في المنطقة {z}",
        "ph_body": "خارج المجال {lo} إلى {hi}: قد يتأثر امتصاص العناصر. اسأل مستشارًا محليًا عن التصحيح.",
        "frost_title": "احتمال صقيع يوم {day}", "frost_body": "الحد الأدنى المتوقع {t} درجة. احمِ الشتلات الصغيرة.",
        "rain_title": "مطر يوم {day}: {mm} مم", "rain_body": "توقيت السماد مضبوط حسب هذا المطر.",
        "norain_title": "لا مطر مفيد لمدة 5 أيام", "norain_body": "مهام السقي مبنية على هذه التوقعات.",
        "h_known": "تقدير بسيط من قوة النبات ومردودية مرجعية. لم يتم التحقق منه بعد.",
        "h_unknown": "قيمة مؤقتة: المحصول غير محدد، لذلك المردودية المرجعية وتاريخ الحصاد عامّان. غير مؤكد.",
        "h_advice": "اتفق مع مشترٍ قبل فترة الحصاد حتى لا ينتظر المحصول في الحقل.",
        "wi_short": "التوقعات قصيرة جدًا للنظر إلى هذا المدى.",
    },
    "ary": {   # Darija (Moroccan Arabic) in Arabic script. Needs a native speaker's review before real use.
        "r_watered": " فيها السقي ديالك {mm} مم نهار {day}.",
        "watered_est_body": "سجلتي {what} نهار {day}. رطوبة التربة من فوق دابا تقريبا {pct}% (كنقترحو السقي تحت {trigger}%)، يعني باقي ما خاصش.",
        "watered_title": "تسجل السقي", "watered_some": "شي سقي",
        "watered_body": "سجلتي {what} نهار {day}. ما غاديش نقترحو سقي جديد فالأيام الجايين باش التربة تبين.",
        "today": "اليوم", "tomorrow": "غدا", "morning": "الصباح", "before_rain": "قبل الشتا",
        "r_sensor": "كاين مستشعر فهاد المنطقة كيقيسها.", "r_sample": "تقاسات من عينة التربة اللي دخلتي.",
        "r_none": "ما كايناش بيانات من المستشعر دابا.", "k_sensor": "مستشعر المنطقة {z}", "k_sample": "عينة تربة المنطقة {z}", "and": " و",
        "r_est": "تقدير من {names} ومن قوة النبات اللي كتبان من الفضاء.",
        "r_offset": "تقدير من المستشعر المشترك فالمنطقة {s} مع الفرق اللي تعلمناه من {n} عينات تربة فهاد المنطقة (تقريبا {d} نقط).",
        "r_bad": "مستشعر هاد المنطقة كيعطي قراءات ما يمكنش نعتامدو عليها ({flags}). ما غاديش نعطيو جرعة حتى تدير عينة تربة ولا يتصلح.",
        "sensor_title": "مستشعر المنطقة {z} ما فيهش الثقة", "sensor_body": "القراءات ديالو معلمة: {flags}. الأحسن تدير عينة تربة؛ ما غاديش نعطيو جرعة ماء منو.",
        "anom_title": "شوف المنطقة {z}", "anom_what": "سير للبلاصة المحددة فالمنطقة {z} وشوف النبات",
        "anom_why": "القمر الصناعي: بقعة تقريبا {ha} هكتار فالمنطقة {z} بقات تحت باقي الحقل ب {dev} فـ {n} ديال المرات (آخرها {date}).",
        "anom_conf": "القمر الصناعي كيبين فين ماشي علاش (ماء، مرض، حشرات، تربة). غير الزيارة ولا العينة كتحسم.",
        "rain_next": "أقرب شتا مفيدة: {mm} مم نهار {day}.", "rain_none": "ماكاينة حتى شتا مفيدة فتوقعات 5 أيام.",
        "irr_title": "سقي المنطقة {z}، {mm} مم", "irr_what": "اسقي المنطقة {z}، {mm} مم",
        "irr_why": "رطوبة التربة من فوق تقريبا {m}% (الهدف {t}%). {rain}",
        "irr_cost": "وقت المضخة لتقريبا {mm} مم على {ha} هكتار ({m3} م³ ديال الما).",
        "raise": " عينة تربة كتزيد الثقة.",
        "irr_planb": "إلا ما قدرتيش تسقي كاع المناطق، بدا بالمنطقة {z}؛ الأخرى تقدر تستنى نهار.",
        "sample_title": "المنطقة {z} خاصها عينة تربة", "sample_body": "نصيحة السقي تما تقديرية. عينة تربة كتخليها أدق.",
        "fert_title": "تسميد المنطقة {z}، {dose} كغ N/هكتار", "fert_what": "زيد {dose} كغ ديال الأزوت فالهكتار فالمنطقة {z}",
        "fert_why": "قوة النبات فالمنطقة {z} هي {ndvi}، أقل من الهدف {target}. ماكاينة حتى شتا قوية فالنهارين الجايين، يعني الأزوت غيبقى فالتربة.",
        "om_rich": " تحليل التربة ديالك كيبين تربة غنية (مادة عضوية {om}%)، علاش الجرعة أقل ب 10 كغ.",
        "om_poor": " تحليل التربة ديالك كيبين تربة ضعيفة (مادة عضوية {om}%)، علاش الجرعة أكثر ب 10 كغ.",
        "om_ok": " تحليل التربة ديالك كيبين مادة عضوية {om}%: ما كاين حتى تغيير فالجرعة.",
        "fert_cost": "تقريبا {urea} كغ ديال اليوريا (46% N) لهاد المنطقة.",
        "fert_conf_test": "معتمد على تحليل التربة ديالك من {d} نهار.",
        "fert_conf_none": "معتمد غير على قوة النبات اللي كتبان من الفضاء، بلا تحليل تربة. تحليل التربة كيزيد الثقة.",
        "fert_planb": "إلا ما لقيتيش السماد، تسنى التسليم الجاي ولا طلب من التعاونية ديالك جرعة أقل.",
        "insp_title": "شوف النقطة P", "insp_what": "سير للنقطة P فالمنطقة {z} وشوف الورق",
        "insp_why": "قوة النبات فالمنطقة {z} نقصات من {a} ل {b} فآخر 3 مرات داز فيها القمر الصناعي.",
        "insp_cost": "بلاش: تقريبا 15 دقيقة فالحقل.",
        "insp_conf": "قوة النبات تقدر تنقص بزاف ديال الأسباب (ماء، مرض، حشرات). غير الزيارة كتحسم.",
        "insp_planb": "إلا شفتي حشرات ولا مرض، صور وزيد الصورة فالمتابعة.",
        "stress_title": "إجهاد محتمل فالنقطة P", "stress_body": "قوة النبات فالمنطقة {z} نقصات 3 ديال المرات. سير تشوف.",
        "ph_title": "حموضة التربة {ph} فالمنطقة {z}",
        "ph_body": "خارج المجال {lo} حتى {hi}: ممكن النبات ما يمتصش مزيان العناصر. سول مستشار محلي على التصحيح.",
        "frost_title": "احتمال الصقيع نهار {day}", "frost_body": "أدنى حرارة متوقعة {t} درجة. دير الحماية للشتلات الصغار.",
        "rain_title": "شتا نهار {day}: {mm} مم", "rain_body": "وقت السماد مضبوط على هاد الشتا.",
        "norain_title": "ماكاينة حتى شتا مفيدة ل 5 أيام", "norain_body": "مهام السقي مبنية على هاد التوقعات.",
        "h_known": "تقدير بسيط من قوة النبات ومردودية مرجعية. باقي ما تحققناش منو.",
        "h_unknown": "قيمة مؤقتة: المحصول ما معروفش، علاش المردودية المرجعية وتاريخ الحصاد عامين. ماشي مؤكد.",
        "h_advice": "تفاهم مع شاري قبل وقت الحصاد باش المحصول ما يبقاش كيتسنى فالحقل.",
        "wi_short": "التوقعات قصيرة بزاف باش نشوفو هاد المدى.",
    },
}


FALLBACK = {"ary": ("ary", "ar", "en"), "ar": ("ar", "en"), "fr": ("fr", "en")}   # Darija falls back to standard Arabic, then English


def tr(lang, key, **kw):
    """Look up a text in the farmer's language (following the fallback chain, English last) and insert the numbers."""
    for l in FALLBACK.get(lang, ("en",)):
        if key in TEXTS.get(l, {}):
            return TEXTS[l][key].format(**kw)
    return TEXTS["en"][key].format(**kw)


def _wd(iso, lang="en"):
    return WEEKDAYS.get(lang, WEEKDAYS["en"])[date.fromisoformat(iso).weekday()]



def next_rain(days, min_mm=3.0):
    for d in days:
        if d["rain"] >= min_mm:
            return d
    return None


OFFSET_MIN_SAMPLES = 3     # soil samples needed before a learned offset replaces the nearest-sensor guess
OFFSET_GOOD_SDRD = 0.03    # spread of the learned gap under which the offset is considered transferable (sensor layer)


def estimate_moisture(zones, sensors, manual=None, lang="en", bad=None, offsets=None):
    """sensors / manual: {zone_code: moisture} from reliable readings. A sensor beats a hand measurement in the same zone.
    bad: {zone_code: [flags]} sensors whose recent readings are flagged: no number, low confidence, no dose.
    offsets: {zone_code: {sentinel, delta, sdrd, n}} learned gap to a shared sensor, used before the nearest-sensor guess.
    Returns {zone_code: {moisture, source, confidence, reason}}."""
    manual = manual or {}
    bad = bad or {}
    offsets = offsets or {}
    points = dict(manual)
    points.update(sensors)
    kind = {c: ("sensor" if c in sensors else "sample") for c in points}
    out = {}
    by_code = {z["code"]: z for z in zones}
    for z in zones:
        c = z["code"]
        if c in points:
            out[c] = {"moisture": points[c], "source": kind[c], "confidence": "High",
                      "reason": tr(lang, "r_sensor" if kind[c] == "sensor" else "r_sample")}
            continue
        if c in bad:   # a flagged sensor never turns into a dose: the farmer is told why instead
            out[c] = {"moisture": None, "source": "sensor_flagged", "confidence": "Low",
                      "reason": tr(lang, "r_bad", flags=", ".join(bad[c]))}
            continue
        o = offsets.get(c)
        if o and o.get("sentinel") in sensors and o.get("n", 0) >= OFFSET_MIN_SAMPLES:
            est = max(0.05, min(0.45, sensors[o["sentinel"]] + o["delta"]))
            out[c] = {"moisture": round(est, 3), "source": "offset",
                      "confidence": "High" if o.get("sdrd", 1) < OFFSET_GOOD_SDRD and o["n"] >= 5 else "Medium",
                      "reason": tr(lang, "r_offset", s=o["sentinel"], n=o["n"], d=round(abs(o["delta"]) * 100))}
            continue
        near, best = [], None   # nearest measured zones (several when tied); their estimates are averaged
        for pc, m in points.items():
            s_ = by_code[pc]
            dist = abs(s_["col"] - z["col"]) + abs(s_["row"] - z["row"])
            if best is None or dist < best:
                best, near = dist, []
            if dist == best:
                near.append((pc, m + 0.25 * (z["ndvi"] - s_["ndvi"])))
        if best is None:
            out[c] = {"moisture": None, "source": "none", "confidence": "Low", "reason": tr(lang, "r_none")}
            continue
        est = max(0.08, min(0.40, sum(v for _, v in near) / len(near)))
        names = tr(lang, "and").join(tr(lang, "k_" + kind[pc], z=pc) for pc, _ in near)
        out[c] = {"moisture": round(est, 3), "source": "estimate", "confidence": "Medium" if best == 1 else "Low",
                  "reason": tr(lang, "r_est", names=names)}
    return out


RECENT_WATERING_DAYS = 2   # after the farmer recorded watering, wait this long before advising it again


def build_advice(field, zones, sensors, weather, now=None, soil=None, lang="en", bad_sensors=None, offsets=None, anomalies=None, waterings=None, measured_on=None):
    """Returns (zone_estimates, tasks, alerts). Pure function: easy to test.
    `lang` only changes the wording; every number and decision is identical in every language.
    Phase 2 inputs (all optional): bad_sensors {zone: [flags]} from the quality checks, offsets {zone: {...}} learned per plot,
    anomalies [{zone, severity, persistence, deviation, area_ha, x, y, last_date}] from the satellite detector."""
    now = now or datetime.now()
    soil = soil or {}   # {zone_code: {ph, om_pct, moisture, age_days}} latest soil test per zone
    bad_sensors = bad_sensors or {}
    anomalies = anomalies or []
    waterings = waterings or []   # [{date, zone (None = whole field), mm}] recorded by the farmer in the last days
    measured_on = measured_on or {}   # {zone: date of the reading the moisture rests on}: water given after it is not in the reading yet
    days = weather["days"]
    today = date.fromisoformat(days[0]["date"])
    manual = {c: t["moisture"] for c, t in soil.items()
              if t.get("moisture") is not None and t["age_days"] <= MANUAL_MOISTURE_MAX_AGE_DAYS}
    est = estimate_moisture(zones, sensors, manual, lang, bad=bad_sensors, offsets=offsets)
    # Water the farmer recorded with its amount is added to what the reading says, then fades with the crop's water use.
    # (Crop use since then is taken as the forecast's evapotranspiration per day; rain is ignored, which errs on the side of watering.)
    et0_day = (sum(d["et0"] for d in days[:3]) / max(1, len(days[:3]))) or 3.0
    pre_water = {}
    for z in zones:
        c, e = z["code"], est[z["code"]]
        if e["moisture"] is None:
            continue
        gain, latest = 0.0, None
        for w in waterings:
            if not w.get("mm") or w.get("zone") not in (None, "", c):
                continue
            wd, md = date.fromisoformat(w["date"]), measured_on.get(c)
            ago = (today - wd).days
            if ago < 0 or (md is not None and wd <= md):
                continue
            gain += max(0.0, w["mm"] / ROOT_DEPTH_MM - ago * et0_day / ROOT_DEPTH_MM)
            latest = max(latest, w, key=lambda x: x["date"]) if latest else w
        if gain > 0 and latest:
            pre_water[c] = (e["moisture"], latest)
            e["moisture"] = round(min(0.45, e["moisture"] + gain), 3)
            e["reason"] += tr(lang, "r_watered", mm=f"{latest['mm']:g}", day=_wd(latest["date"], lang))
            if e["confidence"] == "High":
                e["confidence"] = "Medium"   # a measurement plus a calculation is less sure than the measurement alone
    nr = next_rain(days)
    rain3 = sum(d["rain"] for d in days[:3])
    rain2 = sum(d["rain"] for d in days[:2])
    go_date = today if now.hour < 9 else today + timedelta(days=1)
    go_word = tr(lang, "today" if go_date == today else "tomorrow")
    morning = f"{go_word} {tr(lang, 'morning')}"
    rain_txt = (tr(lang, "rain_next", mm=f"{nr['rain']:.0f}", day=_wd(nr["date"], lang)) if nr else tr(lang, "rain_none"))
    tasks, alerts, watered_note = [], [], None

    # --- Irrigation (water balance rule) ---
    for z in zones:
        e = est[z["code"]]
        m = e["moisture"]
        if m is not None and z["code"] in pre_water and m >= TRIGGER_MOISTURE > pre_water[z["code"]][0] and rain3 < 5:
            w = pre_water[z["code"]][1]   # it would have needed water without the farmer's watering
            watered_note = {"key": "watered", "kind": "water", "title": tr(lang, "watered_title"),
                            "body": tr(lang, "watered_est_body", what=f"{w['mm']:g} mm", day=_wd(w["date"], lang), pct=round(m * 100), trigger=round(TRIGGER_MOISTURE * 100))}
        if m is None or m >= TRIGGER_MOISTURE or rain3 >= 5:
            continue
        seen = [w for w in waterings if not w.get("mm") and w.get("zone") in (None, "", z["code"]) and 0 <= (today - date.fromisoformat(w["date"])).days <= RECENT_WATERING_DAYS]
        if seen:   # the farmer watered this zone a moment ago: wait, and say why
            w = max(seen, key=lambda x: x["date"])
            what = f"{w['mm']:g} mm" if w.get("mm") else tr(lang, "watered_some")
            watered_note = {"key": "watered", "kind": "water", "title": tr(lang, "watered_title"),
                            "body": tr(lang, "watered_body", what=what, day=_wd(w["date"], lang), days=RECENT_WATERING_DAYS)}
            continue
        mm = int(min(MAX_IRRIGATION_MM, max(5, round((TARGET_MOISTURE - m) * ROOT_DEPTH_MM / 5) * 5)))
        m3 = round(mm * z["area_ha"] * 10)
        tasks.append({
            "key": f"irrigate:{z['code']}", "type": "irrigate", "zone": z["code"], "qty": mm, "unit": "mm",
            "title": tr(lang, "irr_title", z=z["code"], mm=mm), "what": tr(lang, "irr_what", z=z["code"], mm=mm),
            "when_text": f"{go_word} 07:00", "when_date": go_date.isoformat(),
            "why": tr(lang, "irr_why", m=round(m * 100), t=round(TARGET_MOISTURE * 100), rain=rain_txt),
            "cost": tr(lang, "irr_cost", mm=mm, ha=z["area_ha"], m3=m3),
            "confidence": e["confidence"],
            "conf_reason": e["reason"] + ("" if e["confidence"] == "High" else tr(lang, "raise")),
            "plan_b": tr(lang, "irr_planb", z=z["code"]),
            "x": (z["col"] + 0.5) / 2, "y": (z["row"] + 0.5) / 2 + 0.1,
        })
        if e["confidence"] != "High":   # only ask for a sample when the zone has no measurement
            alerts.append({"key": f"sample:{z['code']}", "kind": "data", "title": tr(lang, "sample_title", z=z["code"]),
                           "body": tr(lang, "sample_body")})

    if watered_note:
        alerts.append(watered_note)

    # --- Fertilizer (nitrogen from vigor gap), only if no heavy rain would wash it away ---
    for z in zones:
        if not (0.45 <= z["ndvi"] < 0.62) or rain2 >= 10:
            continue
        dose = int(min(60, max(20, round((TARGET_NDVI - z["ndvi"]) * 400 / 5) * 5)))
        st = soil.get(z["code"])
        om = st["om_pct"] if st and st.get("om_pct") is not None and st["age_days"] <= SOIL_TEST_MAX_AGE_DAYS else None
        om_txt = ""
        if om is not None:
            if om >= 3:
                dose, om_txt = max(20, dose - 10), tr(lang, "om_rich", om=f"{om:g}")
            elif om < 1.5:
                dose, om_txt = min(60, dose + 10), tr(lang, "om_poor", om=f"{om:g}")
            else:
                om_txt = tr(lang, "om_ok", om=f"{om:g}")
        urea = round(dose * z["area_ha"] / UREA_N_SHARE)
        fdate = go_date
        when = morning
        if nr and (date.fromisoformat(nr["date"]) - go_date).days in (1, 2):
            fdate = date.fromisoformat(nr["date"]) - timedelta(days=1)
            when = f"{_wd(fdate.isoformat(), lang)}, {tr(lang, 'before_rain')}"
        tasks.append({
            "key": f"fertilize:{z['code']}", "type": "fertilize", "zone": z["code"], "qty": dose, "unit": "kg_n_ha",
            "title": tr(lang, "fert_title", z=z["code"], dose=dose), "what": tr(lang, "fert_what", z=z["code"], dose=dose),
            "when_text": when, "when_date": fdate.isoformat(),
            "why": tr(lang, "fert_why", z=z["code"], ndvi=f"{z['ndvi']:.2f}", target=f"{TARGET_NDVI:.2f}") + om_txt,
            "cost": tr(lang, "fert_cost", urea=urea),
            "confidence": "High" if om is not None else "Medium",
            "conf_reason": tr(lang, "fert_conf_test", d=st["age_days"]) if om is not None else tr(lang, "fert_conf_none"),
            "plan_b": tr(lang, "fert_planb"),
            "x": (z["col"] + 0.5) / 2, "y": (z["row"] + 0.5) / 2 - 0.04,
        })

    # --- Unreliable sensors: say so, recommend a sample, never a dose ---
    for z in zones:
        if z["code"] in bad_sensors and z["code"] not in manual:
            alerts.append({"key": f"sensor:{z['code']}", "kind": "data", "title": tr(lang, "sensor_title", z=z["code"]),
                           "body": tr(lang, "sensor_body", flags=", ".join(bad_sensors[z["code"]]))})

    # --- Inspection from the satellite anomaly detector (persistent patch below its own baseline) ---
    anomaly_zones = set()
    for a in anomalies:
        z = next((zz for zz in zones if zz["code"] == a["zone"]), None)
        if z is None or a["zone"] in anomaly_zones:
            continue
        anomaly_zones.add(a["zone"])
        tasks.append({
            "key": f"inspect:{z['code']}", "type": "inspect", "zone": z["code"], "qty": None, "unit": None,
            "title": tr(lang, "anom_title", z=z["code"]), "what": tr(lang, "anom_what", z=z["code"]),
            "when_text": morning, "when_date": go_date.isoformat(),
            "why": tr(lang, "anom_why", z=z["code"], ha=f"{a['area_ha']:.2f}", dev=f"{abs(a['deviation']):.2f}", n=a["persistence"],
                      date=a.get("last_date") or ""),
            "cost": tr(lang, "insp_cost"),
            "confidence": "Medium" if a["persistence"] >= 3 else "Low",
            "conf_reason": tr(lang, "anom_conf"),
            "plan_b": tr(lang, "insp_planb"),
            "x": a["x"], "y": a["y"],
        })
        alerts.append({"key": f"stress:{z['code']}", "kind": "crop", "title": tr(lang, "anom_title", z=z["code"]),
                       "body": tr(lang, "stress_body", z=z["code"])})

    # --- Inspection (vigor drop over 3 satellite passes, zone means) when the detector has nothing for the zone ---
    for z in zones:
        h = z["ndvi_hist"]
        if z["code"] in anomaly_zones:
            continue
        if len(h) >= 4 and h[-1] - h[-4] <= -0.08:
            tasks.append({
                "key": f"inspect:{z['code']}", "type": "inspect", "zone": z["code"],
                "title": tr(lang, "insp_title"), "what": tr(lang, "insp_what", z=z["code"]),
                "when_text": morning, "when_date": go_date.isoformat(),
                "why": tr(lang, "insp_why", z=z["code"], a=f"{h[-4]:.2f}", b=f"{h[-1]:.2f}"),
                "cost": tr(lang, "insp_cost"),
                "confidence": "Medium",
                "conf_reason": tr(lang, "insp_conf"),
                "plan_b": tr(lang, "insp_planb"),
                "x": (z["col"] + 0.5) / 2, "y": (z["row"] + 0.5) / 2 - 0.09,
            })
            alerts.append({"key": f"stress:{z['code']}", "kind": "crop", "title": tr(lang, "stress_title"),
                           "body": tr(lang, "stress_body", z=z["code"])})

    # --- Soil pH from soil tests ---
    for z in zones:
        st = soil.get(z["code"])
        if st and st.get("ph") is not None and st["age_days"] <= SOIL_TEST_MAX_AGE_DAYS and not (PH_OK[0] <= st["ph"] <= PH_OK[1]):
            alerts.append({"key": f"ph:{z['code']}", "kind": "data", "title": tr(lang, "ph_title", ph=f"{st['ph']:g}", z=z["code"]),
                           "body": tr(lang, "ph_body", lo=PH_OK[0], hi=PH_OK[1])})

    # --- Weather alerts ---
    cold = next((d for d in days[:3] if d["tmin"] is not None and d["tmin"] <= 3), None)
    if cold:
        day = _wd(cold["date"], lang)
        alerts.append({"key": "frost", "kind": "weather", "title": tr(lang, "frost_title", day=("le " + day) if lang == "fr" else day),
                       "body": tr(lang, "frost_body", t=f"{cold['tmin']:.0f}")})
    if nr and (date.fromisoformat(nr["date"]) - today).days <= 3:
        alerts.append({"key": "rain", "kind": "weather", "title": tr(lang, "rain_title", day=_wd(nr["date"], lang), mm=f"{nr['rain']:.0f}"),
                       "body": tr(lang, "rain_body")})
    else:
        alerts.append({"key": "rain", "kind": "weather", "title": tr(lang, "norain_title"), "body": tr(lang, "norain_body")})
    return est, tasks, alerts


def harvest_forecast(field, zones, now=None, lang="en"):
    """Very simple yield model: crop reference yield scaled by mean vigor. NOT validated: shown as an estimate."""
    total = sum(z["area_ha"] for z in zones)
    mean = sum(z["ndvi"] * z["area_ha"] for z in zones) / total
    factor = max(0.3, min(1.0, (mean - 0.2) / 0.5))
    known = field["crop"] in YIELD_T_HA
    mid = YIELD_T_HA.get(field["crop"], 20.0) * factor * field["area_ha"]
    ready = date.fromisoformat(field["sowing_date"]) + timedelta(days=field["cycle_days"])
    return {
        "crop": field["crop"], "qty_min_t": round(mid * 0.9, 1), "qty_max_t": round(mid * 1.1, 1),
        "window_start": (ready - timedelta(days=3)).isoformat(), "window_end": (ready + timedelta(days=3)).isoformat(),
        "confidence": "Low", "mean_vigor": round(mean, 2),
        "note": tr(lang, "h_known" if known else "h_unknown"),
        "advice": tr(lang, "h_advice"),
    }


def what_if_wait(field, zones, sensors, weather, soil, days, now=None, lang="en"):
    """What if the farmer waits `days` days? Soil loses water to evapotranspiration and gains rain, the forecast
    window moves forward, and the engine is run again. Returns a comparison of irrigation depths per zone."""
    days = max(1, min(4, int(days)))
    wd = weather["days"]
    if len(wd) <= days:
        return {"days": days, "available": False, "reason": tr(lang, "wi_short")}
    rain = round(sum(d["rain"] for d in wd[:days]), 1)
    et0 = round(sum(d["et0"] for d in wd[:days]), 1)
    delta = max(-0.1, min(0.1, (rain - et0) / ROOT_DEPTH_MM))   # volumetric change of topsoil moisture
    sensors2 = {c: max(0.05, m + delta) for c, m in sensors.items()}
    soil2 = {c: {**t, "age_days": t["age_days"] + days,
                 "moisture": None if t.get("moisture") is None else max(0.05, t["moisture"] + delta)} for c, t in soil.items()}
    later = {**weather, "days": wd[days:]}
    _, now_tasks, _ = build_advice(field, zones, sensors, weather, now, soil)          # always English: titles are parsed below
    _, later_tasks, later_alerts = build_advice(field, zones, sensors2, later, now, soil2)

    def mm(tasks):
        return {t["zone"]: int(t["title"].split(",")[1].split()[0]) for t in tasks if t["type"] == "irrigate"}
    a, b = mm(now_tasks), mm(later_tasks)
    rows = [{"zone": z, "now_mm": a.get(z), "after_mm": b.get(z)} for z in sorted(set(a) | set(b))]
    return {"days": days, "available": True, "rain_mm": rain, "et0_mm": et0, "moisture_change_pct": round(delta * 100, 1),
            "irrigation": rows, "capped": [r["zone"] for r in rows if r["after_mm"] == MAX_IRRIGATION_MM]}
