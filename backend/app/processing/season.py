"""Season plan, task verifier, missing questions and daily briefing (Phase 4, ideas transposed from the AgriMind handoff).

Everything here is deterministic code. The language model never produces a number; these texts are templates with the
numbers inserted. Four languages: en, fr, ar, ary (Darija falls back to standard Arabic when a key is missing).

- needs_input(profile): what the farmer has not told us yet, with the question to ask. The system never guesses silently:
  what it assumes instead is listed in `assumptions`.
- build_season_plan(...): crop stages from the sowing date, an irrigation rhythm per stage from a reference ET0 climatology,
  nitrogen splits by stage, inspections every 10 days, the harvest window. Demo crop parameters (FAO-56 style Kc, typical
  cycle lengths); labelled "demo values, calibrate locally".
- verify_task(task, facts): recomputes what can be recomputed and returns verified / fixed / escalated. A task is never hidden:
  an escalated one is shown with the reason and no dose.
- briefing(...): one spoken paragraph for the day: stage, today's tasks, the weather, what is planned next.
"""
from datetime import date, timedelta

from . import engine

# ---- crop parameters (demo values; calibrate locally). Stages: (name key, share of the cycle, Kc, N share of the season total)
CROPS = {
    "Potato": {"cycle": 90, "n_total": 120, "stages": [("init", .22, .5, .4), ("dev", .28, .8, .4), ("mid", .33, 1.15, .2), ("late", .17, .75, 0)]},
    "Tomato": {"cycle": 120, "n_total": 150, "stages": [("init", .20, .6, .3), ("dev", .25, .85, .4), ("mid", .35, 1.15, .3), ("late", .20, .8, 0)]},
    "Onion": {"cycle": 130, "n_total": 110, "stages": [("init", .15, .7, .3), ("dev", .25, .85, .4), ("mid", .40, 1.05, .3), ("late", .20, .75, 0)]},
    "Wheat": {"cycle": 150, "n_total": 120, "stages": [("init", .20, .4, .3), ("dev", .25, .8, .5), ("mid", .35, 1.15, .2), ("late", .20, .4, 0)]},
    "Maize": {"cycle": 125, "n_total": 160, "stages": [("init", .20, .4, .3), ("dev", .28, .8, .5), ("mid", .32, 1.2, .2), ("late", .20, .6, 0)]},
    "Olive": {"cycle": 365, "n_total": 60, "stages": [("init", .25, .55, .5), ("dev", .25, .6, .5), ("mid", .25, .65, 0), ("late", .25, .55, 0)]},
    "Citrus": {"cycle": 365, "n_total": 150, "stages": [("init", .25, .65, .4), ("dev", .25, .7, .3), ("mid", .25, .7, .3), ("late", .25, .65, 0)]},
    "Melon": {"cycle": 100, "n_total": 100, "stages": [("init", .20, .5, .3), ("dev", .30, .8, .5), ("mid", .30, 1.05, .2), ("late", .20, .75, 0)]},
}
GENERIC = {"cycle": 90, "n_total": 100, "stages": [("init", .25, .5, .4), ("dev", .25, .8, .4), ("mid", .30, 1.1, .2), ("late", .20, .7, 0)]}
# reference ET0 by month for the Atlantic plain of Morocco (mm/day, climatology, demo values)
ET0_MONTH = [1.8, 2.3, 3.2, 4.2, 5.2, 6.0, 6.5, 6.1, 4.8, 3.4, 2.3, 1.8]
IRRIGATION_EFFICIENCY = {"drip": .9, "sprinkler": .75, "flood / furrow": .6, "rain-fed": None}
REQUIRED = ["crop", "planted_on", "area_ha", "irrigation", "location"]

T = {
    "en": {
        "q_crop": "What do you grow?", "q_planted_on": "When did you plant?", "q_area_ha": "How big is your field?", "q_irrigation": "How do you water?", "q_location": "Where is your farm?",
        "a_crop": "Crop not given: a generic crop (90-day cycle) is assumed.", "a_planted_on": "Planting date not given: the demo sowing date is used.",
        "a_area_ha": "Surface not given: the demo field of {ha} ha is used.", "a_irrigation": "Watering method not given: furrow efficiency (60 %) is assumed.",
        "a_location": "Position not given: the weather and the satellite data are those of the demo parcel.",
        "a_crop_unknown": "\"{crop}\" has no parameters here: a generic crop is used.", "a_et0": "Water needs use a reference climatology for the Atlantic plain, not a measurement.",
        "a_demo": "Stage lengths, crop coefficients and nitrogen totals are demo values to calibrate locally.",
        "st_init": "Establishment", "st_dev": "Growth", "st_mid": "Full cover", "st_late": "Ripening", "st_done": "After harvest", "st_before": "Before sowing",
        "p_irrigate": "Irrigate about {mm} mm, every {days} days ({method})", "p_rainfed": "Rain-fed: watch the soil moisture, no irrigation planned",
        "p_fertilize": "Nitrogen split {k} of {n}: about {dose} kg N/ha", "p_inspect": "Walk the field and look at 10 plants", "p_harvest": "Harvest window", "p_sow": "Sowing",
        "v_ok": "Recomputed: consistent with the data.", "v_cap_mm": "Depth capped at {cap} mm (was {mm}).", "v_cap_dose": "Dose capped at {cap} kg N/ha (was {dose}).",
        "v_low": "Confidence is Low and no soil sample: the dose is not given, a soil test is recommended first.",
        "v_sensor": "The sensor behind this task is flagged: see your advisor or take a soil sample before acting.",
        "v_rain": "Heavy rain is forecast within 2 days: fertilizer would wash away. Wait.",
        "b_stage": "Week {w} since sowing, {stage}.", "b_tasks": "Today: {lines}.", "b_none": "Nothing to do today.", "b_weather": "Weather: {tmax} degrees, {rain}.",
        "b_rain": "{mm} mm of rain expected", "b_dry": "no rain in the next 5 days", "b_next": "Next in the plan: {what} ({when}).", "b_escalated": "{n} task(s) need your advisor before acting.",
        "w_today": "today", "w_tomorrow": "tomorrow", "w_in": "in {d} days",
    },
    "fr": {
        "q_crop": "Que cultivez-vous ?", "q_planted_on": "Quand avez-vous planté ?", "q_area_ha": "Quelle est la taille de votre champ ?", "q_irrigation": "Comment arrosez-vous ?", "q_location": "Où est votre ferme ?",
        "a_crop": "Culture non renseignée : une culture générique (cycle de 90 jours) est supposée.", "a_planted_on": "Date de plantation non renseignée : la date de semis de démonstration est utilisée.",
        "a_area_ha": "Surface non renseignée : le champ de démonstration de {ha} ha est utilisé.", "a_irrigation": "Méthode d'arrosage non renseignée : efficacité gravitaire (60 %) supposée.",
        "a_location": "Position non renseignée : la météo et le satellite sont ceux de la parcelle de démonstration.",
        "a_crop_unknown": "« {crop} » n'a pas de paramètres ici : une culture générique est utilisée.", "a_et0": "Les besoins en eau utilisent une climatologie de référence de la plaine atlantique, pas une mesure.",
        "a_demo": "Durées des stades, coefficients culturaux et totaux d'azote sont des valeurs de démonstration à calibrer localement.",
        "st_init": "Installation", "st_dev": "Croissance", "st_mid": "Pleine couverture", "st_late": "Maturation", "st_done": "Après récolte", "st_before": "Avant semis",
        "p_irrigate": "Irriguer environ {mm} mm, tous les {days} jours ({method})", "p_rainfed": "Pluvial : surveiller l'humidité du sol, pas d'irrigation prévue",
        "p_fertilize": "Apport d'azote {k} sur {n} : environ {dose} kg N/ha", "p_inspect": "Parcourir le champ et observer 10 plants", "p_harvest": "Fenêtre de récolte", "p_sow": "Semis",
        "v_ok": "Recalculé : cohérent avec les données.", "v_cap_mm": "Dose d'eau plafonnée à {cap} mm (était {mm}).", "v_cap_dose": "Dose plafonnée à {cap} kg N/ha (était {dose}).",
        "v_low": "Confiance faible et pas d'échantillon de sol : la dose n'est pas donnée, une analyse de sol est recommandée d'abord.",
        "v_sensor": "Le capteur derrière cette tâche est signalé : voyez votre conseiller ou prenez un échantillon avant d'agir.",
        "v_rain": "Forte pluie prévue sous 2 jours : l'engrais serait lessivé. Attendez.",
        "b_stage": "Semaine {w} depuis le semis, {stage}.", "b_tasks": "Aujourd'hui : {lines}.", "b_none": "Rien à faire aujourd'hui.", "b_weather": "Météo : {tmax} degrés, {rain}.",
        "b_rain": "{mm} mm de pluie attendus", "b_dry": "pas de pluie dans les 5 prochains jours", "b_next": "Prochaine étape du plan : {what} ({when}).", "b_escalated": "{n} tâche(s) demandent votre conseiller avant d'agir.",
        "w_today": "aujourd'hui", "w_tomorrow": "demain", "w_in": "dans {d} jours",
    },
    "ar": {
        "q_crop": "ماذا تزرع؟", "q_planted_on": "متى زرعت؟", "q_area_ha": "ما مساحة حقلك؟", "q_irrigation": "كيف تسقي؟", "q_location": "أين مزرعتك؟",
        "a_crop": "المحصول غير محدد: يُفترض محصول عام (دورة 90 يومًا).", "a_planted_on": "تاريخ الزراعة غير محدد: يُستخدم تاريخ البذر التجريبي.",
        "a_area_ha": "المساحة غير محددة: يُستخدم الحقل التجريبي بمساحة {ha} هكتار.", "a_irrigation": "طريقة السقي غير محددة: تُفترض كفاءة الغمر (60%).",
        "a_location": "الموقع غير محدد: الطقس وبيانات القمر الصناعي تخص القطعة التجريبية.",
        "a_crop_unknown": "«{crop}» بلا معايير هنا: يُستخدم محصول عام.", "a_et0": "احتياجات الماء تعتمد على مناخ مرجعي للسهل الأطلسي، لا على قياس.",
        "a_demo": "مدد المراحل ومعاملات المحصول ومجاميع الأزوت قيم تجريبية تحتاج معايرة محلية.",
        "st_init": "التأسيس", "st_dev": "النمو", "st_mid": "التغطية الكاملة", "st_late": "النضج", "st_done": "بعد الحصاد", "st_before": "قبل البذر",
        "p_irrigate": "سقي حوالي {mm} مم كل {days} أيام ({method})", "p_rainfed": "بعلي: راقب رطوبة التربة، لا سقي مخطط",
        "p_fertilize": "دفعة الأزوت {k} من {n}: حوالي {dose} كغ N/هكتار", "p_inspect": "امشِ في الحقل وافحص 10 نباتات", "p_harvest": "فترة الحصاد", "p_sow": "البذر",
        "v_ok": "أُعيد الحساب: متوافق مع البيانات.", "v_cap_mm": "حُدّد عمق الماء بـ {cap} مم (كان {mm}).", "v_cap_dose": "حُدّدت الجرعة بـ {cap} كغ N/هكتار (كانت {dose}).",
        "v_low": "الثقة ضعيفة ولا عيّنة تربة: لا تُعطى الجرعة، يُنصح بتحليل التربة أولًا.",
        "v_sensor": "المستشعر وراء هذه المهمة موسوم: راجع مستشارك أو خذ عيّنة تربة قبل التنفيذ.",
        "v_rain": "مطر غزير متوقع خلال يومين: سيُجرف السماد. انتظر.",
        "b_stage": "الأسبوع {w} منذ البذر، {stage}.", "b_tasks": "اليوم: {lines}.", "b_none": "لا شيء لتفعله اليوم.", "b_weather": "الطقس: {tmax} درجة، {rain}.",
        "b_rain": "{mm} مم من المطر متوقعة", "b_dry": "لا مطر في الأيام الخمسة القادمة", "b_next": "التالي في الخطة: {what} ({when}).", "b_escalated": "{n} مهام تحتاج مستشارك قبل التنفيذ.",
        "w_today": "اليوم", "w_tomorrow": "غدًا", "w_in": "بعد {d} أيام",
    },
    "ary": {   # Darija in Arabic script; AI-written, needs a native review (docs/DARIJA.md)
        "q_crop": "شنو كتزرع؟", "q_planted_on": "فوقاش زرعتي؟", "q_area_ha": "شحال كبيرة الأرض ديالك؟", "q_irrigation": "كيفاش كتسقي؟", "q_location": "فين كاينة الفلاحة ديالك؟",
        "a_crop": "الزرع ماعطيتيهش: كنفترضو زرع عام (دورة 90 يوم).", "a_planted_on": "تاريخ الزراعة ماعطيتيهش: كنستعملو تاريخ الزريعة التجريبي.",
        "a_area_ha": "المساحة ماعطيتيهاش: كنستعملو الأرض التجريبية ديال {ha} هكتار.", "a_irrigation": "طريقة السقي ماعطيتيهاش: كنفترضو السقي بالغمر (60%).",
        "a_location": "الموقع ماعطيتيهش: الجو والقمر الصناعي ديال الأرض التجريبية.",
        "st_init": "البداية", "st_dev": "النمو", "st_mid": "التغطية الكاملة", "st_late": "النضج", "st_done": "من بعد الصابة", "st_before": "قبل الزريعة",
        "p_irrigate": "سقي تقريبا {mm} مم كل {days} أيام ({method})", "p_rainfed": "بوري: راقب رطوبة التربة، ماكاينش سقي مبرمج",
        "p_fertilize": "دفعة الأزوت {k} من {n}: تقريبا {dose} كغ N/هكتار", "p_inspect": "دور فالأرض وشوف 10 نباتات", "p_harvest": "وقت الصابة", "p_sow": "الزريعة",
        "v_ok": "عاودنا الحساب: متوافق مع المعطيات.", "v_low": "الثقة ضعيفة وماكاينش عينة ديال التربة: ما كنعطيوش الجرعة، دير تحليل التربة قبل.",
        "v_sensor": "المستشعر ديال هاد المهمة موسوم: شوف المستشار ديالك ولا خود عينة قبل ما دير شي حاجة.", "v_rain": "شتا قوية متوقعة فيومين: السماد غادي يمشي مع الما. تسنى.",
        "b_stage": "الأسبوع {w} من الزريعة، {stage}.", "b_tasks": "اليوم: {lines}.", "b_none": "ماكاين والو تدير اليوم.", "b_weather": "الجو: {tmax} درجة، {rain}.",
        "b_rain": "{mm} مم ديال الشتا متوقعة", "b_dry": "ماكاينش شتا ف5 أيام الجاية", "b_next": "الجاي فالبرنامج: {what} ({when}).", "b_escalated": "{n} مهام خاصها المستشار ديالك قبل ما تدار.",
        "w_today": "اليوم", "w_tomorrow": "غدا", "w_in": "من بعد {d} أيام",
    },
}
METHOD = {"en": {"drip": "drip", "sprinkler": "sprinkler", "flood / furrow": "furrow", "rain-fed": "rain"}, "fr": {"drip": "goutte à goutte", "sprinkler": "aspersion", "flood / furrow": "gravitaire", "rain-fed": "pluie"},
          "ar": {"drip": "بالتنقيط", "sprinkler": "بالرش", "flood / furrow": "بالغمر", "rain-fed": "المطر"}, "ary": {"drip": "بالطقطيق", "sprinkler": "بالرشاش", "flood / furrow": "بالغمر", "rain-fed": "الشتا"}}


def tr(lang, key, **kw):
    """Darija falls back to standard Arabic, everything falls back to English."""
    table = T.get(lang) or T["en"]
    text = table.get(key) or (T["ar"].get(key) if lang == "ary" else None) or T["en"][key]
    return text.format(**kw)


def crop_params(crop):
    return CROPS.get(crop or "", None)


# ---------------------------------------------------------------- missing questions

def needs_input(profile, field, lang="en"):
    """Returns (questions, assumptions). A question for every required answer not given; an assumption for what is used instead."""
    profile = profile or {}
    questions, assumptions = [], []
    for k in REQUIRED:
        v = profile.get(k)
        if v in (None, "", 0):
            questions.append({"field": k, "question": tr(lang, "q_" + k)})
            assumptions.append(tr(lang, "a_" + k, ha=field.get("area_ha", "")))
    crop = profile.get("crop") or field.get("crop")
    if crop and not crop_params(field.get("crop")):
        assumptions.append(tr(lang, "a_crop_unknown", crop=crop))
    assumptions.append(tr(lang, "a_et0"))
    assumptions.append(tr(lang, "a_demo"))
    return questions, assumptions


# ---------------------------------------------------------------- season plan

def stage_at(day_index, params):
    """(stage key, stage index, days into stage, stage length) for a day since sowing, or None outside the cycle."""
    if day_index < 0:
        return None
    start = 0
    for i, (name, share, _kc, _n) in enumerate(params["stages"]):
        length = round(params["cycle"] * share)
        if day_index < start + length:
            return name, i, day_index - start, length
        start += length
    return None


def build_season_plan(field, profile, today=None, lang="en", soil=None):
    """The season as weeks of planned tasks, computed from crop parameters, the sowing date and a reference climatology.
    Numbers: irrigation depth = Kc x ET0 x interval / efficiency (capped at the engine's maximum); nitrogen splits by stage share."""
    today = today or date.today()
    profile = profile or {}
    crop = field.get("crop") or "Not identified"
    params = crop_params(crop) or GENERIC
    sowing = date.fromisoformat(field["sowing_date"])
    method = profile.get("irrigation") or "flood / furrow"
    eff = IRRIGATION_EFFICIENCY.get(method, .6)
    om = (soil or {}).get("om_pct")
    n_total = params["n_total"] - (10 if om is not None and om >= 3 else -10 if om is not None and om < 1.5 else 0)
    weeks = []
    n_splits = sum(1 for s in params["stages"] if s[3] > 0)
    split_k = 0
    n_given = 0
    start = 0
    for i, (name, share, kc, n_share) in enumerate(params["stages"]):
        length = round(params["cycle"] * share)
        s_start, s_end = sowing + timedelta(days=start), sowing + timedelta(days=start + length - 1)
        et0 = ET0_MONTH[(s_start + timedelta(days=length // 2)).month - 1]
        interval = 2 if method == "drip" else 5 if method == "sprinkler" else 7
        if eff is None:
            irr = tr(lang, "p_rainfed")
            mm = None
        else:
            mm = int(min(engine.MAX_IRRIGATION_MM, max(5, round(kc * et0 * interval / eff / 5) * 5)))
            irr = tr(lang, "p_irrigate", mm=mm, days=interval, method=METHOD.get(lang, METHOD["en"]).get(method, method))
        tasks = [{"type": "irrigate", "text": irr, "mm": mm, "every_days": None if eff is None else interval}]
        if n_share > 0:
            split_k += 1
            dose = int(round(n_total * n_share / 5) * 5) if split_k < n_splits else n_total - n_given   # the last split takes the rest: the splits sum to the total
            n_given += dose
            tasks.append({"type": "fertilize", "text": tr(lang, "p_fertilize", k=split_k, n=n_splits, dose=dose), "dose_kg_n_ha": dose, "on": (s_start + timedelta(days=min(3, length - 1))).isoformat()})
        tasks.append({"type": "inspect", "text": tr(lang, "p_inspect"), "every_days": 10})
        weeks.append({"stage": name, "stage_label": tr(lang, "st_" + name), "start": s_start.isoformat(), "end": s_end.isoformat(), "days": length, "kc": kc, "et0_ref": et0,
                      "current": s_start <= today <= s_end, "tasks": tasks})
        start += length
    harvest = sowing + timedelta(days=params["cycle"])
    weeks.append({"stage": "harvest", "stage_label": tr(lang, "p_harvest"), "start": (harvest - timedelta(days=3)).isoformat(), "end": (harvest + timedelta(days=3)).isoformat(), "days": 7, "kc": None, "et0_ref": None,
                  "current": harvest - timedelta(days=3) <= today <= harvest + timedelta(days=3), "tasks": [{"type": "harvest", "text": tr(lang, "p_harvest")}]})
    day_index = (today - sowing).days
    st = stage_at(day_index, params)
    questions, assumptions = needs_input(profile, field, lang)
    return {
        "crop": crop, "crop_known": crop_params(crop) is not None, "sowing_date": sowing.isoformat(), "cycle_days": params["cycle"], "harvest_date": harvest.isoformat(),
        "day_index": day_index, "week": max(0, day_index // 7 + 1), "irrigation_method": method, "n_total_kg_ha": n_total,
        "stage": {"key": st[0], "label": tr(lang, "st_" + st[0]), "day_in_stage": st[2], "length": st[3]} if st else {"key": "done" if day_index >= 0 else "before", "label": tr(lang, "st_done" if day_index >= 0 else "st_before"), "day_in_stage": 0, "length": 0},
        "stages": weeks, "needs_input": questions, "assumptions": assumptions, "confidence": "Low", "source": "deterministic plan, demo parameters",
    }


# ---------------------------------------------------------------- task verifier

def verify_task(task, est, weather, soil, bad_sensors, lang="en"):
    """Independent re-check of one engine task. Returns {status, detail}. status: verified | fixed | escalated.
    `est` is the zone estimate used by the engine, `bad_sensors` {zone: flags}. Nothing here changes the task; the service stores the verdict."""
    z = task["zone"]
    rain2 = sum(d["rain"] for d in weather["days"][:2])
    if task["type"] == "irrigate":
        m = est.get(z, {}).get("moisture")
        if z in bad_sensors and not (soil.get(z) or {}).get("moisture"):
            return {"status": "escalated", "detail": tr(lang, "v_sensor")}
        if m is None or est[z]["confidence"] == "Low" and not soil.get(z):
            return {"status": "escalated", "detail": tr(lang, "v_low")}
        mm = int(task["title"].split(",")[1].split()[0]) if "," in task["title"] else None
        want = int(min(engine.MAX_IRRIGATION_MM, max(5, round((engine.TARGET_MOISTURE - m) * engine.ROOT_DEPTH_MM / 5) * 5)))
        if mm is not None and mm > engine.MAX_IRRIGATION_MM:
            return {"status": "fixed", "detail": tr(lang, "v_cap_mm", cap=engine.MAX_IRRIGATION_MM, mm=mm)}
        return {"status": "verified", "detail": tr(lang, "v_ok")} if mm is None or mm == want else {"status": "fixed", "detail": tr(lang, "v_cap_mm", cap=want, mm=mm)}
    if task["type"] == "fertilize":
        if rain2 >= 10:
            return {"status": "escalated", "detail": tr(lang, "v_rain")}
        try:
            dose = int([p for p in task["title"].replace(",", " ").split() if p.isdigit()][-1])
        except IndexError:
            dose = None
        if dose is not None and dose > 60:
            return {"status": "fixed", "detail": tr(lang, "v_cap_dose", cap=60, dose=dose)}
        return {"status": "verified", "detail": tr(lang, "v_ok")}
    return {"status": "verified", "detail": tr(lang, "v_ok")}


# ---------------------------------------------------------------- daily briefing

def briefing(plan, tasks, weather, lang="en", today=None):
    """One paragraph to read aloud: stage, today's open tasks, the weather, the next planned step, escalations."""
    today = today or date.today()
    parts = []
    if plan["stage"]["key"] not in ("before", "done"):
        parts.append(tr(lang, "b_stage", w=plan["week"], stage=plan["stage"]["label"]))
    open_tasks = [t for t in tasks if t.get("status", "open") == "open" and t.get("verify_status") != "escalated"]
    parts.append(tr(lang, "b_tasks", lines="; ".join(f"{t['title']} ({t['when_text']})" for t in open_tasks)) if open_tasks else tr(lang, "b_none"))
    esc = sum(1 for t in tasks if t.get("status", "open") == "open" and t.get("verify_status") == "escalated")
    if esc:
        parts.append(tr(lang, "b_escalated", n=esc))
    d0 = weather["days"][0]
    nr = engine.next_rain(weather["days"])
    parts.append(tr(lang, "b_weather", tmax=round(d0["tmax"]), rain=tr(lang, "b_rain", mm=f"{nr['rain']:.0f}") if nr else tr(lang, "b_dry")))
    nxt = next((s for s in plan["stages"] if date.fromisoformat(s["start"]) > today), None)
    if nxt:
        d = (date.fromisoformat(nxt["start"]) - today).days
        when = tr(lang, "w_today") if d == 0 else tr(lang, "w_tomorrow") if d == 1 else tr(lang, "w_in", d=d)
        parts.append(tr(lang, "b_next", what=nxt["stage_label"], when=when))
    return " ".join(parts)
