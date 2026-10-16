/* Interface translations. English is the source language (app.js writes English); after each render this file
   translates the visible texts to French or Arabic: exact texts first, then patterns for texts that contain numbers.
   Texts that come from the server (advice, alerts, forecast notes) are already translated there and are left alone.
   An unknown text stays English, so a missing entry never breaks the page. */
(() => {
// [English, French, Arabic]
const T = [
  // navigation and general
  ["Field", "Champ", "الحقل"], ["Tasks", "Tâches", "المهام"], ["Sell", "Vente", "البيع"], ["Alerts", "Alertes", "التنبيهات"], ["Me", "Moi", "أنا"],
  ["About", "À propos", "حول"], ["Home", "Accueil", "الرئيسية"], ["Main", "Principal", "الرئيسية"], ["Language", "Langue", "اللغة"],
  ["Loading...", "Chargement...", "جارٍ التحميل..."], ["Field A", "Champ A", "الحقل A"], ["Done", "Fait", "تم"], ["Skipped", "Ignorée", "تم التخطي"],
  ["Save", "Enregistrer", "حفظ"], ["Undo", "Annuler", "تراجع"], ["High", "Élevée", "عالية"], ["Medium", "Moyenne", "متوسطة"], ["Low", "Faible", "ضعيفة"], ["Search", "Rechercher", "بحث"],
  ["Demo", "Démo", "تجريبي"], ["Notes", "Notes", "ملاحظات"],
  // map and layers
  ["Vigor", "Vigueur", "قوة النبات"], ["Moisture", "Humidité", "الرطوبة"], ["Soil", "Sol", "التربة"], ["Trust", "Confiance", "الثقة"],
  ["Field map", "Carte du champ", "خريطة الحقل"], ["low to high", "du plus bas au plus haut", "من الأدنى إلى الأعلى"],
  ["pH 5.5 to 7.5", "pH 5,5 à 7,5", "pH من 5.5 إلى 7.5"], ["pH outside", "pH hors plage", "pH خارج المجال"], ["No test", "Aucune analyse", "بلا تحليل"],
  ["All good", "Tout va bien", "كل شيء على ما يرام"], ["Do this now", "À faire maintenant", "افعل هذا الآن"],
  // field
  ["tasks today", "tâches aujourd'hui", "مهام اليوم"], ["See tasks", "Voir les tâches", "عرض المهام"], ["Soil tests", "Analyses de sol", "تحاليل التربة"],
  ["Add a soil test", "Ajouter une analyse de sol", "أضف تحليل تربة"], ["Vigor over time", "Vigueur dans le temps", "قوة النبات عبر الزمن"],
  ["Not saved on this device yet. Open this page once online.", "Pas encore enregistré sur cet appareil. Ouvrez cette page une fois en ligne.", "غير محفوظ على هذا الجهاز بعد. افتح هذه الصفحة مرة واحدة عند الاتصال."],
  ["No time series yet.", "Pas encore de série temporelle.", "لا توجد سلسلة زمنية بعد."],
  // tasks
  ["No task", "Aucune tâche", "لا مهام"], ["Task", "Tâche", "مهمة"], ["This task is no longer needed.", "Cette tâche n'est plus nécessaire.", "لم تعد هذه المهمة لازمة."],
  ["Why", "Pourquoi", "لماذا"], ["Cost", "Coût", "التكلفة"], ["Plan B", "Plan B", "الخطة البديلة"], ["How sure", "Degré de certitude", "درجة التأكد"],
  ["Cannot do it", "Impossible", "لا أستطيع"], ["Copilot", "Copilot", "المساعد"], ["Soil test", "Analyse de sol", "تحليل التربة"],
  // follow-up
  ["Follow up", "Suivi", "المتابعة"], ["Photo", "Photo", "صورة"], ["Better", "Mieux", "أفضل"], ["Same", "Pareil", "نفسه"], ["Worse", "Moins bien", "أسوأ"],
  ["Note or yield (optional)", "Note ou rendement (facultatif)", "ملاحظة أو المردود (اختياري)"], ["Photo of the field", "Photo du champ", "صورة الحقل"],
  ["Photo notes", "Notes sur la photo", "ملاحظات الصورة"], ["Visible:", "Visible :", "المرئي:"], ["To check:", "À vérifier :", "للتحقق:"],
  ["Nothing clear is visible.", "Rien de net n'est visible.", "لا شيء واضح ظاهر."],
  ["Photo reading is off: no vision model is configured. Your photo is still saved.", "La lecture des photos est désactivée : aucun modèle de vision n'est configuré. Votre photo est quand même enregistrée.", "قراءة الصور متوقفة: لا يوجد نموذج رؤية. صورتك محفوظة رغم ذلك."],
  ["Could not read the photo now. It is still saved.", "Impossible de lire la photo maintenant. Elle est quand même enregistrée.", "تعذّرت قراءة الصورة الآن. هي محفوظة رغم ذلك."],
  ["The photo is not a small JPEG.", "La photo n'est pas un petit JPEG.", "الصورة ليست JPEG صغيرة."],
  ["The model did not answer. Your photo is still saved.", "Le modèle n'a pas répondu. Votre photo est quand même enregistrée.", "لم يجب النموذج. صورتك محفوظة رغم ذلك."],
  ["The model's answer could not be read. Your photo is still saved.", "La réponse du modèle n'a pas pu être lue. Votre photo est quand même enregistrée.", "تعذّرت قراءة جواب النموذج. صورتك محفوظة رغم ذلك."],
  ["Observations only, to be checked in the field. This is not a diagnosis.", "Observations seulement, à vérifier sur le terrain. Ce n'est pas un diagnostic.", "ملاحظات فقط، للتحقق منها في الحقل. هذا ليس تشخيصًا."],
  // soil test
  ["Organic matter (%)", "Matière organique (%)", "المادة العضوية (%)"], ["Moisture (%)", "Humidité (%)", "الرطوبة (%)"], ["Saved tests", "Analyses enregistrées", "التحاليل المحفوظة"],
  ["None yet.", "Aucune pour le moment.", "لا شيء بعد."], ["Type at least one value.", "Saisissez au moins une valeur.", "أدخل قيمة واحدة على الأقل."],
  ["pH must be between 3 and 10.", "Le pH doit être compris entre 3 et 10.", "يجب أن تكون الحموضة بين 3 و10."],
  ["Organic matter must be between 0 and 15 %.", "La matière organique doit être comprise entre 0 et 15 %.", "يجب أن تكون المادة العضوية بين 0 و15 %."],
  ["Moisture must be between 3 and 60 %.", "L'humidité doit être comprise entre 3 et 60 %.", "يجب أن تكون الرطوبة بين 3 و60 %."],
  // alerts
  ["All", "Toutes", "الكل"], ["Weather", "Météo", "الطقس"], ["Crop", "Culture", "المحصول"], ["Data", "Données", "البيانات"], ["No alerts.", "Aucune alerte.", "لا تنبيهات."],
  // sell
  ["Harvest", "Récolte", "الحصاد"], ["Create sale offer", "Créer une offre de vente", "أنشئ عرض بيع"], ["Sale offer published", "Offre de vente publiée", "تم نشر عرض البيع"],
  ["Accept", "Accepter", "قبول"], ["Accepted", "Acceptée", "مقبول"], ["Declined", "Refusée", "مرفوض"],
  ["School canteens network", "Réseau de cantines scolaires", "شبكة المطاعم المدرسية"], ["Local trader", "Négociant local", "تاجر محلي"], ["Village cooperative", "Coopérative du village", "تعاونية القرية"],
  // me
  ["Rule engine", "Moteur de règles", "محرك القواعد"], ["Waiting to sync", "En attente de synchronisation", "بانتظار المزامنة"], ["Sync now", "Synchroniser", "زامن الآن"],
  ["Refresh advice", "Actualiser les conseils", "حدّث النصائح"],
  // about
  ["An AI that reads your land and tells you what to do, when, and why.", "Une IA qui lit votre terre et vous dit quoi faire, quand et pourquoi.", "ذكاء اصطناعي يقرأ أرضك ويخبرك ماذا تفعل ومتى ولماذا."],
  ["How it works", "Comment ça marche", "كيف يعمل"], ["Add your data", "Ajoutez vos données", "أضف بياناتك"], ["Location, soil tests, photos.", "Position, analyses de sol, photos.", "الموقع، تحاليل التربة، الصور."],
  ["We analyze", "Nous analysons", "نحلّل"], ["Satellite, weather, sensors, tests.", "Satellite, météo, capteurs, analyses.", "القمر الصناعي، الطقس، المستشعرات، التحاليل."],
  ["Get advice", "Recevez un conseil", "احصل على نصيحة"], ["What, when, why, cost, plan B.", "Quoi, quand, pourquoi, coût, plan B.", "ماذا، متى، لماذا، التكلفة، الخطة البديلة."],
  ["Act and follow up", "Agissez et suivez", "نفّذ وتابع"], ["Done, photo, result.", "Fait, photo, résultat.", "تم، صورة، نتيجة."],
  ["The AI inside", "L'IA à l'intérieur", "الذكاء الاصطناعي بالداخل"], ["Code decides", "Le code décide", "الكود هو من يقرر"],
  ["Doses and dates come from tested rules. A model never invents a number.", "Les doses et les dates viennent de règles testées. Un modèle n'invente jamais un chiffre.", "الجرعات والمواعيد تأتي من قواعد مُختبَرة. النموذج لا يخترع رقمًا أبدًا."],
  ["Ask by voice or text. It explains and simulates.", "Posez vos questions à la voix ou par écrit. Il explique et simule.", "اسأل بالصوت أو بالكتابة. يشرح ويحاكي."],
  ["Photos described", "Photos décrites", "الصور موصوفة"], ["Observations only, never a diagnosis.", "Des observations seulement, jamais un diagnostic.", "ملاحظات فقط، وليس تشخيصًا أبدًا."],
  ["Always checked", "Toujours contrôlé", "دائمًا مُراجَع"], ["A model answer with a number not in your data is rejected.", "Une réponse du modèle avec un chiffre absent de vos données est rejetée.", "يُرفض جواب النموذج إن احتوى رقمًا غير موجود في بياناتك."],
  ["Find your field", "Trouvez votre champ", "ابحث عن حقلك"], ["Use my location", "Utiliser ma position", "استخدم موقعي"], ["Walk the edge", "Faire le tour du champ", "امشِ على حدود الحقل"],
  ["Village name", "Nom du village", "اسم القرية"], ["What is real in this demo", "Ce qui est réel dans cette démo", "ما هو حقيقي في هذا العرض"],
  ["Real:", "Réel :", "حقيقي:"], ["Simulated:", "Simulé :", "محاكى:"], ["Not validated:", "Non validé :", "غير مؤكد:"],
  ["the harvest forecast. Voice input uses the browser's speech service.", "la prévision de récolte. La voix utilise le service vocal du navigateur.", "توقع الحصاد. الإدخال الصوتي يستخدم خدمة الكلام في المتصفح."],
  ["the two soil sensors, buyers and prices.", "les deux capteurs de sol, les acheteurs et les prix.", "مستشعرا التربة والمشترون والأسعار."],
  ["crop vigor, the two soil sensors, buyers and prices.", "la vigueur des cultures, les deux capteurs de sol, les acheteurs et les prix.", "قوة النبات ومستشعرا التربة والمشترون والأسعار."],
  ["weather (Open-Meteo), Sentinel-2 images, the decision rules, GPS, soil tests, the offline queue.", "météo (Open-Meteo), images Sentinel-2, règles de décision, GPS, analyses de sol, file d'attente hors ligne.", "الطقس (Open-Meteo)، صور Sentinel-2، قواعد القرار، GPS، تحاليل التربة، طابور العمل دون اتصال."],
  ["weather (Open-Meteo), the decision rules, GPS, soil tests, the offline queue.", "météo (Open-Meteo), règles de décision, GPS, analyses de sol, file d'attente hors ligne.", "الطقس (Open-Meteo)، قواعد القرار، GPS، تحاليل التربة، طابور العمل دون اتصال."],
  ["GPS works without internet on a phone.", "Le GPS fonctionne sans internet sur un téléphone.", "يعمل GPS دون إنترنت على الهاتف."], ["Find my position", "Trouver ma position", "حدّد موقعي"],
  ["Walk around the field with your phone.", "Faites le tour du champ avec votre téléphone.", "امشِ حول الحقل ومعك هاتفك."], ["Start walking", "Commencer la marche", "ابدأ المشي"], ["Stop and save", "Arrêter et enregistrer", "أوقف واحفظ"],
  ["Needs a connection.", "Nécessite une connexion.", "يحتاج اتصالًا."],
  ["This device has no GPS.", "Cet appareil n'a pas de GPS.", "هذا الجهاز بلا GPS."], ["Looking for your position...", "Recherche de votre position...", "جارٍ البحث عن موقعك..."],
  ["Location is blocked. Allow it in the browser settings, or type a village.", "La localisation est bloquée. Autorisez-la dans les réglages du navigateur, ou saisissez un village.", "تحديد الموقع محظور. اسمح به في إعدادات المتصفح أو اكتب اسم قرية."],
  ["No GPS fix yet. Try outdoors, or type a village.", "Pas encore de position GPS. Essayez à l'extérieur, ou saisissez un village.", "لا موقع GPS بعد. جرّب في الخارج أو اكتب اسم قرية."],
  ["No GPS signal.", "Pas de signal GPS.", "لا إشارة GPS."], ["Walk a little further: at least 3 points are needed.", "Marchez un peu plus : il faut au moins 3 points.", "امشِ قليلًا أكثر: يلزم 3 نقاط على الأقل."],
  ["Type a name first.", "Saisissez d'abord un nom.", "اكتب اسمًا أولًا."], ["Searching...", "Recherche...", "جارٍ البحث..."], ["No place found with that name.", "Aucun lieu trouvé avec ce nom.", "لم يُعثر على مكان بهذا الاسم."],
  ["No connection. Try again when you are online.", "Pas de connexion. Réessayez une fois en ligne.", "لا اتصال. حاول مجددًا عند الاتصال."],
  // banner and toasts
  ["You are offline", "Vous êtes hors ligne", "أنت دون اتصال"], ["Sending updates", "Envoi des mises à jour", "جارٍ إرسال التحديثات"], ["Everything is synced", "Tout est synchronisé", "تمت المزامنة بالكامل"],
  ["Skipped. We will adjust the plan.", "Tâche ignorée. Nous ajusterons le plan.", "تم التخطي. سنعدّل الخطة."], ["Saved. Thank you.", "Enregistré. Merci.", "تم الحفظ. شكرًا."],
  ["Saved on this device. It will send when you are online.", "Enregistré sur cet appareil. L'envoi se fera une fois en ligne.", "حُفظ على هذا الجهاز. سيُرسل عند الاتصال."],
  ["Soil test saved. The advice is being updated.", "Analyse de sol enregistrée. Le conseil est en cours de mise à jour.", "تم حفظ تحليل التربة. تُحدَّث النصيحة الآن."],
  ["Sale offer published (buyers are simulated)", "Offre de vente publiée (les acheteurs sont simulés)", "تم نشر عرض البيع (المشترون محاكون)"],
  ["Offline: showing saved advice", "Hors ligne : conseils enregistrés affichés", "دون اتصال: عرض النصائح المحفوظة"], ["Advice refreshed", "Conseils actualisés", "تم تحديث النصائح"],
  ["Sell data is not saved on this device yet. Open this page once online.", "Les données de vente ne sont pas encore enregistrées sur cet appareil. Ouvrez cette page une fois en ligne.", "بيانات البيع غير محفوظة على هذا الجهاز بعد. افتح هذه الصفحة مرة واحدة عند الاتصال."],
  // Copilot
  ["Ask me about your field.", "Posez-moi vos questions sur votre champ.", "اسألني عن حقلك."], ["Why?", "Pourquoi ?", "لماذا؟"], ["Plan B?", "Plan B ?", "الخطة البديلة؟"],
  ["What if I wait 2 days?", "Et si j'attends 2 jours ?", "ماذا لو انتظرت يومين؟"], ["My plan for today", "Mon plan pour aujourd'hui", "خطتي لهذا اليوم"],
  ["Ask", "Question", "اسأل"], ["Offline", "Hors ligne", "دون اتصال"], ["Model, checked", "Modèle, contrôlé", "نموذج، مُراجَع"], ["Saved on this device", "Enregistré sur cet appareil", "محفوظ على هذا الجهاز"],
  ["Read my tasks", "Lire mes tâches", "اقرأ مهامي"], ["Talk mode", "Mode conversation", "وضع المحادثة"], ["Talk mode on", "Mode conversation activé", "وضع المحادثة مفعّل"], ["Talk mode off", "Mode conversation arrêté", "توقف وضع المحادثة"],
  ["Stopped", "Arrêté", "تم الإيقاف"], ["Listen", "Écouter", "استمع"], ["No voice for this language on this device", "Pas de voix pour cette langue sur cet appareil", "لا يوجد صوت لهذه اللغة على هذا الجهاز"],
  ["Voice needs a secure page (https)", "La voix nécessite une page sécurisée (https)", "الصوت يحتاج صفحة آمنة (https)"],
  ["Speak", "Parler", "تكلّم"], ["Stop", "Arrêter", "أوقف"], ["Read answers aloud", "Lire les réponses à voix haute", "قراءة الأجوبة بصوت عالٍ"], ["Read aloud", "Lire à voix haute", "قراءة بصوت عالٍ"],
  ["Send", "Envoyer", "إرسال"], ["Close the Copilot", "Fermer le Copilot", "إغلاق المساعد"], ["Open the Copilot", "Ouvrir le Copilot", "فتح المساعد"],
  ["Listening...", "J'écoute...", "أستمع..."], ["Voice needs Chrome or Edge", "La voix nécessite Chrome ou Edge", "الصوت يحتاج Chrome أو Edge"], ["Voice needs internet", "La voix nécessite internet", "الصوت يحتاج اتصالًا بالإنترنت"],
  ["Microphone is blocked", "Le microphone est bloqué", "الميكروفون محظور"], ["I heard nothing", "Je n'ai rien entendu", "لم أسمع شيئًا"], ["Voice did not work", "La voix n'a pas fonctionné", "لم يعمل الصوت"],
  ["I need a connection for that question. Offline I can answer: Why? Plan B? When? How much? How sure are you? My plan for today.", "J'ai besoin d'une connexion pour cette question. Hors ligne, je peux répondre à : Pourquoi ? Plan B ? Quand ? Combien ? Quelle est votre certitude ? Mon plan pour aujourd'hui.", "أحتاج إلى اتصال للإجابة عن هذا السؤال. دون اتصال أستطيع الإجابة عن: لماذا؟ الخطة البديلة؟ متى؟ كم؟ ما درجة التأكد؟ خطتي لهذا اليوم."],
  // audit fixes, October 2026
  ["Back", "Retour", "رجوع"], ["Sensor", "Capteur", "مستشعر"], ["Vigor: simulated", "Vigueur : simulée", "قوة النبات: محاكاة"], ["Sensors: simulated", "Capteurs : simulés", "المستشعرات: محاكاة"],
  ["No task today. We check again tomorrow morning.", "Aucune tâche aujourd'hui. Nous revérifions demain matin.", "لا مهام اليوم. سنتحقق مجددًا صباح الغد."],
  ["Today", "Aujourd'hui", "اليوم"], ["Why not?", "Pourquoi pas ?", "لماذا لا؟"], ["No water or product", "Pas d'eau ou de produit", "لا ماء أو منتج"], ["No time", "Pas le temps", "لا وقت"], ["Not needed", "Pas nécessaire", "غير ضروري"],
  ["How does the field look?", "Comment est le champ ?", "كيف يبدو الحقل؟"], ["Saved without a result.", "Enregistré sans résultat.", "حُفظ دون نتيجة."],
  ["New", "Nouveau", "جديد"], ["Mark as read", "Marquer comme lu", "وضع علامة مقروء"],
  ["The other offers will be declined.", "Les autres offres seront refusées.", "ستُرفض العروض الأخرى."], ["Yes, accept", "Oui, accepter", "نعم، أقبل"], ["No", "Non", "لا"],
  ["Offers", "Offres", "العروض"], ["Buyers simulated", "Acheteurs simulés", "مشترون محاكون"], ["Estimate, not validated", "Estimation, non validée", "تقدير غير مؤكد"], ["Crop: not identified.", "Culture : non identifiée.", "المحصول: غير محدد."],
  ["Offer accepted (buyers are simulated)", "Offre acceptée (les acheteurs sont simulés)", "تم قبول العرض (المشترون محاكون)"], ["MAD/kg", "MAD/kg", "درهم/كغ"],
  ["Answers come from tested rules, no AI model", "Les réponses viennent de règles testées, sans modèle d'IA", "الأجوبة من قواعد مُختبَرة، دون نموذج ذكاء اصطناعي"],
  ["Server voice (Azure), any browser, Arabic included", "Voix serveur (Azure), tout navigateur, arabe compris", "صوت الخادم (Azure)، أي متصفح، بما فيه العربية"],
  ["Voice from the browser (Chrome or Edge), needs internet", "Voix du navigateur (Chrome ou Edge), internet nécessaire", "صوت المتصفح (Chrome أو Edge)، يحتاج إنترنت"],
  ["No voice in this browser: type your questions", "Pas de voix dans ce navigateur : écrivez vos questions", "لا صوت في هذا المتصفح: اكتب أسئلتك"],
  ["Voice:", "Voix :", "الصوت:"], ["the harvest forecast.", "la prévision de récolte.", "توقع الحصاد."],
  ["server voice (Azure), not yet tested with a real key.", "voix serveur (Azure), pas encore testée avec une vraie clé.", "صوت الخادم (Azure)، لم يُختبر بعد بمفتاح حقيقي."],
  ["the browser's speech service (Chrome or Edge).", "le service vocal du navigateur (Chrome ou Edge).", "خدمة الكلام في المتصفح (Chrome أو Edge)."],
  ["Farm Advisor  -  Team 2  -  BCG Platinion Hackathon 2026", "Farm Advisor  -  Équipe 2  -  Hackathon BCG Platinion 2026", "Farm Advisor  -  الفريق 2  -  هاكاثون BCG Platinion 2026"],
  ["Demo data, not agronomic advice for real fields.", "Données de démonstration, pas un conseil agronomique pour de vrais champs.", "بيانات تجريبية، وليست نصيحة زراعية لحقول حقيقية."],
  ["From your saved advice", "D'après vos conseils enregistrés", "من نصائحك المحفوظة"], ["Type your question about your field.", "Écrivez votre question sur votre champ.", "اكتب سؤالك عن حقلك."],
  ["Thinking...", "Je réfléchis...", "أفكر..."], ["Speaking... tap the square to stop", "Je parle... touchez le carré pour arrêter", "أتحدث... المس المربع للإيقاف"],
  ["Offline: type your question, saved answers only", "Hors ligne : écrivez votre question, réponses enregistrées seulement", "دون اتصال: اكتب سؤالك، الأجوبة المحفوظة فقط"],
  ["Microphone is blocked. Allow it, or type your question", "Le microphone est bloqué. Autorisez-le, ou écrivez votre question", "الميكروفون محظور. اسمح به أو اكتب سؤالك"],
  ["No voice in this browser: type your question", "Pas de voix dans ce navigateur : écrivez votre question", "لا صوت في هذا المتصفح: اكتب سؤالك"],
  ["Talk mode on: I listen after each answer. Say \"stop\" to end", "Mode conversation : j'écoute après chaque réponse. Dites « stop » pour finir", "وضع المحادثة: أستمع بعد كل جواب. قل «توقف» للإنهاء"],
  ["Tap the mic and speak", "Touchez le micro et parlez", "المس الميكروفون وتكلّم"], ["Still listening. Tap the square to send.", "J'écoute toujours. Touchez le carré pour envoyer.", "ما زلت أستمع. المس المربع للإرسال."],
  ["Read aloud: on", "Lecture à voix haute : activée", "القراءة بصوت عالٍ: مفعّلة"], ["Read aloud: off", "Lecture à voix haute : désactivée", "القراءة بصوت عالٍ: متوقفة"],
  ["just now", "à l'instant", "الآن"],
];
const EXACT = { fr: {}, ar: {} };
for (const [en, fr, ar] of T) { EXACT.fr[en] = fr; EXACT.ar[en] = ar; }

const DAYS = { fr: { Sun: "dim.", Mon: "lun.", Tue: "mar.", Wed: "mer.", Thu: "jeu.", Fri: "ven.", Sat: "sam." },
               ar: { Sun: "الأحد", Mon: "الاثنين", Tue: "الثلاثاء", Wed: "الأربعاء", Thu: "الخميس", Fri: "الجمعة", Sat: "السبت" } };
const CONF = { fr: { High: "élevée", Medium: "moyenne", Low: "faible" }, ar: { High: "عالية", Medium: "متوسطة", Low: "ضعيفة" } };
const CROP = { fr: { "Not identified": "Non identifiée", Potato: "Pomme de terre" }, ar: { "Not identified": "غير محدد", Potato: "بطاطس" } };
const plural = (n, a, b) => (+n > 1 ? b : a);
const ageFr = a => a === "today" ? "aujourd'hui" : a === "yesterday" ? "hier" : "il y a " + a.replace(" days ago", " jours");
const ageAr = a => a === "today" ? "اليوم" : a === "yesterday" ? "أمس" : "قبل " + a.replace(" days ago", " يوم");
const soilLine = (l, line) => l === "fr"
  ? line.replace(/organic/g, "matière organique").replace(/moisture/g, "humidité").replace(/(\d)%/g, "$1 %")
  : line.replace(/organic/g, "مادة عضوية").replace(/moisture/g, "رطوبة");

const ago = (l, a) => { let m;
  if (a === "just now") return l === "fr" ? "à l'instant" : "الآن";
  if ((m = /^(\d+) min ago$/.exec(a))) return l === "fr" ? `il y a ${m[1]} min` : `قبل ${m[1]} دقيقة`;
  if ((m = /^(\d+) h ago$/.exec(a))) return l === "fr" ? `il y a ${m[1]} h` : `قبل ${m[1]} ساعة`;
  if ((m = /^(\d+) days ago$/.exec(a))) return l === "fr" ? `il y a ${m[1]} jours` : `قبل ${m[1]} يوم`;
  return a; };
// [regex, french function, arabic function]
const PATTERNS = [
  [/^Advice saved (.+)\. What you do is kept on this phone and sent later\.$/, (m, a) => `Conseils enregistrés ${ago("fr", a)}. Ce que vous faites est gardé sur ce téléphone et envoyé plus tard.`, (m, a) => `نصائح محفوظة ${ago("ar", a)}. ما تفعله يُحفظ على هذا الهاتف ويُرسل لاحقًا.`],
  [/^Picture: Sentinel-2, (.+)$/, (m, d) => `Image : Sentinel-2, ${d}`, (m, d) => `الصورة: Sentinel-2، ${d}`],
  [/^Vigor: Sentinel-2, (.+)$/, (m, d) => `Vigueur : Sentinel-2, ${d}`, (m, d) => `قوة النبات: Sentinel-2، ${d}`],
  [/^Soil test, zone (\w)$/, (m, z) => `Analyse de sol, zone ${z}`, (m, z) => `تحليل التربة، المنطقة ${z}`],
  [/^(\d+) to (\d+)$/, (m, a, b) => `${a} à ${b}`, (m, a, b) => `من ${a} إلى ${b}`],
  [/^e\.g\. (.+)$/, (m, v) => `ex. ${v}`, (m, v) => `مثلًا ${v}`],
  [/^([\d.,]+) ha$/, (m, n) => `${n} ha`, (m, n) => `${n} هكتار`],
  [/^Accept ([\d.,]+) MAD\/kg\?$/, (m, p) => `Accepter ${p} MAD/kg ?`, (m, p) => `قبول ${p} درهم/كغ؟`],
  [/^MAD\/kg\s+-\s+([\d\s,.\u202f\u00a0]+) MAD$/, (m, x) => `MAD/kg  -  ${x} MAD`, (m, x) => `درهم/كغ  -  ${x} درهم`],
  [/^(\d+) updates? will sync (when you are online|now)\.$/, (m, n, w) => `${n} ${plural(n, "mise à jour sera envoyée", "mises à jour seront envoyées")} ${w === "now" ? "maintenant" : "une fois en ligne"}.`,
    (m, n, w) => `ستُرسل ${n} ${+n > 2 ? "تحديثات" : "تحديث"} ${w === "now" ? "الآن" : "عند الاتصال"}.`],
  [/^(\d+) updates sent, (\d+) refused by the server$/, (m, a, b) => `${a} mises à jour envoyées, ${b} refusées par le serveur`, (m, a, b) => `أُرسل ${a} وتم رفض ${b} من الخادم`],
  [/^Lowest: zone (\w), ([\d.]+)$/, (m, z, v) => `Le plus bas : zone ${z}, ${v}`, (m, z, v) => `الأدنى: المنطقة ${z}، ${v}`],
  [/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/, (m, d) => DAYS.fr[d], (m, d) => DAYS.ar[d]],
  [/^(\d+) mm$/, (m, n) => `${n} mm`, (m, n) => `${n} مم`],
  [/^(.+) to (.+) t$/, (m, a, b) => `${a} à ${b} t`, (m, a, b) => `${a} إلى ${b} طن`],
  [/^Model: (.+)$/, (m, p) => `Modèle : ${p}`, (m, p) => `النموذج: ${p}`],
  [/^Step (\d)$/, (m, n) => `Étape ${n}`, (m, n) => `الخطوة ${n}`],
  [/^Zone (\w): (.+) \((today|yesterday|\d+ days ago)\)( - waiting to sync)?$/, (m, z, line, a, w) => `Zone ${z} : ${soilLine("fr", line)} (${ageFr(a)})${w ? " - en attente de synchronisation" : ""}`,
    (m, z, line, a, w) => `المنطقة ${z}: ${soilLine("ar", line)} (${ageAr(a)})${w ? " - بانتظار المزامنة" : ""}`],
  [/^Located: (.+)\. You are (\d+) km from the demo field\. The demo field stays fixed for now\.$/, (m, a, k) => `Position : ${a.replace(/ \(about (\d+) m\)/, " (environ $1 m)")}. Vous êtes à ${k} km du champ de démonstration. Le champ de démonstration reste fixe pour l'instant.`,
    (m, a, k) => `الموقع: ${a.replace(/ \(about (\d+) m\)/, " (حوالي $1 م)")}. أنت على بعد ${k} كم من الحقل التجريبي. يبقى الحقل التجريبي ثابتًا حاليًا.`],
  [/^Located: (.+)$/, (m, a) => `Position : ${a.replace(/ \(about (\d+) m\)\./, " (environ $1 m).")}`, (m, a) => `الموقع: ${a.replace(/ \(about (\d+) m\)\./, " (حوالي $1 م).")}`],
  [/^Recording: (\d+) points\. Walk around the edge of your field\.$/, (m, n) => `Enregistrement : ${n} points. Faites le tour de votre champ.`, (m, n) => `جارٍ التسجيل: ${n} نقطة. امشِ حول حدود حقلك.`],
  [/^Outline saved on this device: (\d+) points, about ([\d.]+) ha\.$/, (m, n, a) => `Contour enregistré sur cet appareil : ${n} points, environ ${a} ha.`, (m, n, a) => `حُفظ المحيط على هذا الجهاز: ${n} نقطة، حوالي ${a} هكتار.`],
  [/^Found: (.+)$/, (m, p) => `Trouvé : ${p}`, (m, p) => `وُجد: ${p}`],
  [/^Zone (\w)$/, (m, z) => `Zone ${z}`, (m, z) => `المنطقة ${z}`],
  [/^\+(\d+) more today$/, (m, n) => `+${n} ${plural(n, "autre", "autres")} aujourd'hui`, (m, n) => `+${n} أخرى اليوم`],
];
const cache = { fr: new Map(), ar: new Map() };
function tt(lang, s) {
  if (!s || !EXACT[lang]) return s;
  const hit = EXACT[lang][s]; if (hit !== undefined) return hit;
  const c = cache[lang]; if (c.has(s)) return c.get(s);
  const flat = s.replace(/\s{2,}/g, "  "); let out = s;
  for (const [re, fr, ar] of PATTERNS) { const m = re.exec(flat); if (m) { out = (lang === "fr" ? fr : ar)(...m); break; } }
  c.set(s, out); return out;
}
window.FA_I18N = { tt, EXACT, PATTERNS, CONF, CROP };
})();
