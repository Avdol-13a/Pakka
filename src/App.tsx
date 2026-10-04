import { useEffect, useRef, useState } from "react";
import {
  analyze,
  approve,
  canApprove,
  catalog,
  compare,
  demos,
  featuresFor,
  itemName,
  receipt,
  receiptText,
  validOffering,
  type AppState,
  type Feature,
  type Interpretation,
  type Lang,
  type Model,
  type Offering,
  type Topic,
} from "./domain";
import { loadState, STORAGE_KEY } from "./storage";

const reasons = {
  unknown: [
    "This detail is outside the supported facts. Ask the guest or correct it.",
    "یہ تفصیل محفوظ معلومات میں شامل نہیں۔ مہمان سے پوچھیں یا درست کریں۔",
  ],
  ambiguous: [
    "The wording or value is uncertain. Confirm the interpretation.",
    "عبارت یا مقدار غیر واضح ہے۔ مطلب کی تصدیق کریں۔",
  ],
  excluded: [
    "The guest explicitly does not want this. It will be excluded.",
    "مہمان نے یہ سہولت نہیں مانگی۔ یہ شامل نہیں ہوگی۔",
  ],
  offered: [
    "Available in your saved offering.",
    "آپ کی محفوظ پیشکش میں دستیاب ہے۔",
  ],
  notOffered: [
    "Not available in your saved offering.",
    "آپ کی محفوظ پیشکش میں دستیاب نہیں ہے۔",
  ],
  capacity: [
    "Within your maximum group size.",
    "مہمانوں کی تعداد مقررہ حد کے اندر ہے۔",
  ],
  tooMany: [
    "The request exceeds your maximum group size.",
    "مہمانوں کی تعداد آپ کی مقررہ حد سے زیادہ ہے۔",
  ],
  hours: [
    "Arrival and the full visit fit within opening hours.",
    "آمد اور مکمل دورہ کھلنے کے اوقات کے اندر ہیں۔",
  ],
  outsideHours: [
    "Arrival plus the full visit does not fit your opening hours.",
    "آمد اور مکمل دورہ آپ کے اوقات کے اندر نہیں آتے۔",
  ],
  duration: [
    "Matches your offered visit duration.",
    "دورانیہ آپ کی پیشکش کے مطابق ہے۔",
  ],
  tooLong: [
    "Different from your offered visit duration.",
    "دورانیہ آپ کی پیشکش سے مختلف ہے۔",
  ],
  conflict: [
    "Another interpretation conflicts with this one. Resolve or dismiss the duplicate.",
    "ایک اور تشریح اس سے مختلف ہے۔ تضاد دور کریں یا اضافی اندراج خارج کریں۔",
  ],
} as const;
const topicNames: Record<Topic, [string, string]> = {
  meals: ["Meals", "کھانا"],
  transport: ["Transport", "آمد و رفت"],
  timing: ["Timing", "اوقات"],
  group: ["Group size", "مہمانوں کی تعداد"],
  activities: ["Activities", "سرگرمیاں"],
  other: ["Other / unclear", "دیگر / غیر واضح"],
};
const statusNames = {
  supported: ["Supported", "دستیاب"],
  unavailable: ["Unavailable", "دستیاب نہیں"],
  clarify: ["Needs clarification", "وضاحت درکار"],
} as const;

export default function App() {
  const [loaded] = useState(loadState);
  const [state, setState] = useState<AppState>(loaded.state);
  const [screen, setScreen] = useState(0);
  const [draft, setDraft] = useState<Offering>(state.offering);
  const [storageError, setStorageError] = useState(loaded.error);
  const [saved, setSaved] = useState(false);
  const [model, setModel] = useState<Model | null>(null);
  const [modelError, setModelError] = useState(false);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState("");
  const [copyFallback, setCopyFallback] = useState(false);
  const [customEn, setCustomEn] = useState("");
  const [customUr, setCustomUr] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const [otherTab, setOtherTab] = useState(false);
  const lang = state.lang;
  const t = (en: string, ur: string) => (lang === "en" ? en : ur);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.offering);
  function update(next: AppState) {
    setState(next);
    setNotice("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError(false);
      setSaved(true);
    } catch {
      setStorageError(true);
      setSaved(false);
    }
  }
  function go(n: number) {
    setScreen(n);
    setNotice("");
    setTimeout(() => heading.current?.focus(), 0);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    let active = true;
    fetch("./model.json")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((m) => {
        if (active) {
          if (
            m.version !== 1 ||
            m.labels?.length !== 5 ||
            !m.vocabulary?.length
          )
            throw Error();
          setModel(m);
        }
      })
      .catch(() => active && setModelError(true));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    const changed = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setOtherTab(true);
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    window.addEventListener("storage", changed);
    let checkReady: (() => void) | undefined;
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      // Registration update may fail offline even when the installed worker is healthy.
      // Check the active worker independently so offline reload still reports readiness.
      void navigator.serviceWorker.register("./sw.js").catch(() => {});
      void navigator.serviceWorker.ready.then((reg) => {
        checkReady = () => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => {
            setReady(e.data.ready === true);
            channel.port1.close();
          };
          (navigator.serviceWorker.controller || reg.active)?.postMessage(
            "CHECK_READY",
            [channel.port2],
          );
        };
        checkReady();
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          checkReady,
        );
      });
    }
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
      window.removeEventListener("storage", changed);
      if (checkReady)
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          checkReady,
        );
    };
  }, []);
  function saveOffering(e: React.FormEvent) {
    e.preventDefault();
    if (!validOffering(draft)) return;
    const offering = {
      ...draft,
      name: draft.name.trim(),
      revision: state.offering.revision + 1,
    };
    setDraft(offering);
    update({
      ...state,
      offering,
      items: state.items.map((i) => ({ ...i, reviewed: false })),
      approval: null,
    });
    setNotice(
      t(
        "Offering saved. Existing interpretations need a fresh review.",
        "پیشکش محفوظ ہوگئی۔ سابقہ تشریحات دوبارہ چیک کریں۔",
      ),
    );
  }
  function changeRequest(request: string) {
    update({
      ...state,
      request,
      analyzedRequest: "",
      items: [],
      approval: null,
    });
  }
  function editItem(id: string, patch: Partial<Interpretation>) {
    update({
      ...state,
      approval: null,
      items: state.items.map((i) => ({
        ...i,
        ...(i.id === id ? { ...patch, corrected: true } : {}),
        reviewed: false,
      })),
    });
  }
  function review(id: string) {
    update({
      ...state,
      approval: null,
      items: state.items.map((i) =>
        i.id === id ? { ...i, reviewed: !i.reviewed } : i,
      ),
    });
  }
  const counts = { supported: 0, unavailable: 0, clarify: 0 };
  state.items
    .filter((i) => !i.dismissed)
    .forEach((i) => counts[compare(i, state.offering, state.items).status]++);
  const reviewed = state.items.filter((i) => i.reviewed).length;
  const names = [
    t("My Offering", "میری پیشکش"),
    t("Check Request", "درخواست چیک کریں"),
    t("Promise Receipt", "وعدے کی رسید"),
  ];
  const facts = (i: Interpretation) =>
    i.kind === "feature"
      ? state.offering.available.includes(i.feature)
        ? t("Offered", "دستیاب")
        : t("Not offered", "دستیاب نہیں")
      : i.kind === "count"
        ? t(
            `Maximum ${state.offering.capacity} guests`,
            `زیادہ سے زیادہ ${state.offering.capacity} مہمان`,
          )
        : i.kind === "duration"
          ? t(
              `${state.offering.duration} minutes`,
              `${state.offering.duration} منٹ`,
            )
          : i.kind === "arrival"
            ? `${state.offering.opens}–${state.offering.closes} · ${state.offering.duration} ${t("min", "منٹ")}`
            : t("No matching saved fact", "کوئی متعلقہ معلومات محفوظ نہیں");
  return (
    <div className="app">
      <a className="skip" href="#main">
        {t("Skip to content", "اصل مواد پر جائیں")}
      </a>
      <header className="topbar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            if (!dirty) go(0);
          }}
          aria-label="Pakka"
        >
          <img src="./icon.svg" alt="" />
          <span>
            pakka<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="top-right">
          <span
            className={"connection " + (ready ? "is-ready" : "")}
            role="status"
          >
            <span className="dot" />
            {ready
              ? t(
                  online ? "Offline ready" : "Working offline",
                  online ? "آف لائن تیار" : "آف لائن کام جاری",
                )
              : t("Preparing offline access", "آف لائن رسائی کی تیاری")}
          </span>
          <button
            className="language"
            onClick={() =>
              update({ ...state, lang: lang === "en" ? "ur" : "en" })
            }
            aria-label={t("Switch to Urdu", "انگریزی منتخب کریں")}
          >
            {lang === "en" ? "اردو" : "English"}{" "}
            <span aria-hidden="true">⇄</span>
          </button>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <div className="side-intro">
            <span className="eyebrow">
              {t("A CLEAR PROMISE", "ایک واضح وعدہ")}
            </span>
            <p>
              {t(
                "Good visits begin with shared expectations.",
                "اچھے دورے کی بنیاد واضح توقعات ہیں۔",
              )}
            </p>
          </div>
          <nav aria-label={t("Main navigation", "مرکزی رہنمائی")}>
            {names.map((name, n) => (
              <button
                key={name}
                className={"nav-item " + (screen === n ? "active" : "")}
                onClick={() => go(n)}
                disabled={dirty && n !== 0}
                aria-current={screen === n ? "page" : undefined}
              >
                <span className="step">0{n + 1}</span>
                <span>{name}</span>
                {screen === n && (
                  <span className="nav-arrow" aria-hidden="true">
                    ↗
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <span className="small-leaf" aria-hidden="true">
              ❧
            </span>
            <b>{t("Made for small hosts.", "چھوٹے میزبانوں کے لیے۔")}</b>
            <p>
              {t(
                "Your facts. Your approval.\nOn this device.",
                "آپ کی معلومات۔ آپ کی منظوری۔\nاسی ڈیوائس پر۔",
              )}
            </p>
            <span className="mini-label">
              {t("PAKISTAN · FIELD EDITION 01", "پاکستان · پہلا ایڈیشن")}
            </span>
          </div>
        </aside>
        <main id="main">
          {storageError && (
            <div role="alert" className="alert">
              {t(
                "Local storage is unavailable or saved data could not be read. Changes may not survive reload. Your current work remains on screen.",
                "محفوظ معلومات پڑھی نہیں جاسکیں یا مقامی ذخیرہ دستیاب نہیں۔ تبدیلیاں دوبارہ کھولنے پر ضائع ہو سکتی ہیں۔ موجودہ کام اسکرین پر ہے۔",
              )}
            </div>
          )}
          {otherTab && (
            <div role="alert" className="alert">
              {t(
                "This project changed in another tab. Reload before continuing to avoid overwriting it.",
                "دوسرے ٹیب میں تبدیلی ہوئی ہے۔ آگے بڑھنے سے پہلے دوبارہ کھولیں۔",
              )}
              <button onClick={() => location.reload()}>
                {t("Reload", "دوبارہ کھولیں")}
              </button>
            </div>
          )}
          <div className="page-top">
            <span className="eyebrow">
              {t("YOUR HOST WORKSPACE", "آپ کے فارم کا انتظام")} / 0{screen + 1}
            </span>
            <span className="save-state">
              {storageError
                ? t("Not saved", "محفوظ نہیں")
                : saved
                  ? t("Saved on this device", "اسی ڈیوائس پر محفوظ")
                  : t("Local to this device", "اسی ڈیوائس تک محدود")}
            </span>
          </div>
          <h1 tabIndex={-1} ref={heading}>
            {names[screen]}
            <span className="heading-dot">.</span>
          </h1>
          <p className="lede">
            {screen === 0
              ? t(
                  "Set out what you can offer. We’ll check guest requests against these facts.",
                  "اپنی سہولیات درج کریں۔ مہمانوں کی درخواستیں انہی معلومات سے چیک ہوں گی۔",
                )
              : screen === 1
                ? t(
                    "A little clarity before you say yes. Review every interpretation before making a promise.",
                    "وعدہ کرنے سے پہلے ہر تشریح چیک کریں اور توقعات واضح کریں۔",
                  )
                : t(
                    "A shared understanding, in two languages. Ready for the guest to review.",
                    "دو زبانوں میں واضح بات۔ مہمان کے جائزے کے لیے تیار۔",
                  )}
          </p>
          <fieldset className="workspace" disabled={otherTab}>
            {screen === 0 && (
              <form onSubmit={saveOffering}>
                <div className="farm-banner">
                  <div>
                    <span className="eyebrow">
                      {t("YOUR FARM PROFILE", "آپ کے فارم کی معلومات")}
                    </span>
                    <h2>{draft.name || t("Your farm", "آپ کا فارم")}</h2>
                    <span className="fictional">
                      {t(
                        "Fictional demo profile · edit to make it yours",
                        "فرضی نمونہ · اپنی معلومات درج کریں",
                      )}
                    </span>
                  </div>
                  <FarmArt />
                </div>
                <section className="card">
                  <div className="section-heading">
                    <span className="section-icon" aria-hidden="true">
                      ⌂
                    </span>
                    <div>
                      <h2>{t("The essentials", "بنیادی معلومات")}</h2>
                      <p>
                        {t(
                          "One daily window. One clear capacity.",
                          "روزانہ کے اوقات اور مہمانوں کی حد۔",
                        )}
                      </p>
                    </div>
                  </div>
                  <label>
                    {t("Farm name", "فارم کا نام")}
                    <input
                      value={draft.name}
                      maxLength={100}
                      required
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      {t("Opening time", "کھلنے کا وقت")}
                      <input
                        type="time"
                        required
                        value={draft.opens}
                        onChange={(e) =>
                          setDraft({ ...draft, opens: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("Closing time", "بند ہونے کا وقت")}
                      <input
                        type="time"
                        required
                        value={draft.closes}
                        onChange={(e) =>
                          setDraft({ ...draft, closes: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("Maximum guests", "زیادہ سے زیادہ مہمان")}
                      <input
                        type="number"
                        min={1}
                        max={500}
                        required
                        value={draft.capacity || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            capacity: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      {t("Visit duration (minutes)", "دورانیہ (منٹ)")}
                      <input
                        type="number"
                        min={15}
                        max={1440}
                        required
                        value={draft.duration || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            duration: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
                <section className="card">
                  <div className="section-heading">
                    <span className="section-icon" aria-hidden="true">
                      ✧
                    </span>
                    <div>
                      <h2>
                        {t(
                          "What’s part of the experience?",
                          "آپ کون سی سہولیات دیتے ہیں؟",
                        )}
                      </h2>
                      <p>
                        {t(
                          "Select what you offer. Unselected items are unavailable.",
                          "دستیاب سہولیات منتخب کریں۔ باقی دستیاب نہیں سمجھی جائیں گی۔",
                        )}
                      </p>
                    </div>
                  </div>
                  {(["meals", "transport", "activities"] as const).map(
                    (topic) => (
                      <fieldset className="feature-group" key={topic}>
                        <legend>
                          {topicNames[topic][lang === "en" ? 0 : 1]}
                        </legend>
                        <div className="feature-grid">
                          {featuresFor(draft)
                            .filter((f) => f.topic === topic)
                            .map((f) => (
                              <label
                                className={
                                  "feature " +
                                  (draft.available.includes(f.id)
                                    ? "selected"
                                    : "")
                                }
                                key={f.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.available.includes(f.id)}
                                  onChange={(e) =>
                                    setDraft({
                                      ...draft,
                                      available: e.target.checked
                                        ? [...draft.available, f.id]
                                        : draft.available.filter(
                                            (id) => id !== f.id,
                                          ),
                                    })
                                  }
                                />
                                <span>{f[lang]}</span>
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    ),
                  )}
                  <details>
                    <summary>
                      {t("Add a custom activity", "اپنی سرگرمی شامل کریں")}
                    </summary>
                    <p className="muted">
                      {t(
                        "Supply both names yourself; Pakka does not translate free text.",
                        "دونوں زبانوں میں نام خود درج کریں؛ پکّا آزاد متن کا ترجمہ نہیں کرتا۔",
                      )}
                    </p>
                    <div className="form-grid">
                      <label>
                        {t("Activity in English", "سرگرمی کا انگریزی نام")}
                        <input
                          dir="ltr"
                          value={customEn}
                          maxLength={80}
                          onChange={(e) => setCustomEn(e.target.value)}
                        />
                      </label>
                      <label>
                        {t("Activity in Urdu", "سرگرمی کا اردو نام")}
                        <input
                          dir="rtl"
                          lang="ur"
                          value={customUr}
                          maxLength={80}
                          onChange={(e) => setCustomUr(e.target.value)}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="secondary"
                      disabled={!customEn.trim() || !customUr.trim()}
                      onClick={() => {
                        const f: Feature = {
                          id: "custom-" + crypto.randomUUID(),
                          en: customEn.trim(),
                          ur: customUr.trim(),
                          topic: "activities",
                        };
                        setDraft({
                          ...draft,
                          custom: [...draft.custom, f],
                          available: [...draft.available, f.id],
                        });
                        setCustomEn("");
                        setCustomUr("");
                      }}
                    >
                      {t("Add activity", "سرگرمی شامل کریں")}
                    </button>
                  </details>
                </section>
                {!validOffering(draft) && (
                  <p role="alert" className="alert">
                    {t(
                      "Enter a farm name, valid same-day hours, 1–500 guests, and a visit of at least 15 minutes that fits those hours.",
                      "فارم کا نام، ایک دن کے درست اوقات، ۱ تا ۵۰۰ مہمان، اور کم از کم ۱۵ منٹ کا دورانیہ درج کریں جو ان اوقات میں پورا ہو۔",
                    )}
                  </p>
                )}
                <div className="action-row">
                  <span className="muted">
                    {dirty
                      ? t(
                          "Unsaved changes · save to continue",
                          "غیر محفوظ تبدیلیاں · آگے بڑھنے کے لیے محفوظ کریں",
                        )
                      : t(
                          "These facts guide every promise.",
                          "ہر وعدہ انہی معلومات پر مبنی ہے۔",
                        )}
                  </span>
                  <button
                    className="primary"
                    type="submit"
                    disabled={!validOffering(draft)}
                  >
                    {t("Save offering", "پیشکش محفوظ کریں")}{" "}
                    <span aria-hidden="true">✓</span>
                  </button>
                  {!dirty && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => go(1)}
                    >
                      {t("Check a request →", "درخواست چیک کریں ←")}
                    </button>
                  )}
                </div>
              </form>
            )}
            {screen === 1 && (
              <>
                <div className="language-note">
                  <span aria-hidden="true">ⓘ</span>
                  <span>
                    {t(
                      "English guest text only. Urdu controls and receipts use fixed wording, not general translation.",
                      "مہمان کا متن صرف انگریزی میں۔ اردو بٹن اور رسیدیں مقررہ عبارت استعمال کرتے ہیں، عمومی ترجمہ نہیں۔",
                    )}
                  </span>
                </div>
                <section className="card">
                  <label htmlFor="request">
                    {t(
                      "What did your guest ask for?",
                      "مہمان نے کیا درخواست کی؟",
                    )}
                  </label>
                  <textarea
                    id="request"
                    dir="ltr"
                    lang="en"
                    maxLength={4000}
                    placeholder="We are 6 guests. We will arrive at 10 am…"
                    value={state.request}
                    onChange={(e) => changeRequest(e.target.value)}
                    rows={5}
                  />
                  <div className="request-meta">
                    <span>
                      {t("Stays on this device", "اسی ڈیوائس پر رہتا ہے")}
                    </span>
                    <span>{state.request.length}/4000</span>
                  </div>
                  <div className="demo-row">
                    <span className="muted">
                      {t("Try an example:", "نمونہ آزمائیں:")}
                    </span>
                    {demos.map((d, k) => (
                      <button
                        key={k}
                        className="demo"
                        onClick={() => changeRequest(d)}
                      >
                        {
                          [
                            t("A good fit", "مناسب درخواست"),
                            t("A few mismatches", "کچھ اختلافات"),
                            t("Not so clear", "غیر واضح"),
                          ][k]
                        }
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary"
                    disabled={
                      !state.request.trim() ||
                      !model ||
                      !validOffering(state.offering)
                    }
                    onClick={() => {
                      if (model)
                        update({
                          ...state,
                          analyzedRequest: state.request,
                          items: analyze(state.request, state.offering, model),
                          approval: null,
                        });
                    }}
                  >
                    {t(
                      "Check against my offering",
                      "میری پیشکش سے موازنہ کریں",
                    )}{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                  {modelError && (
                    <p className="alert" role="alert">
                      {t(
                        "The local model could not load. Reload online once to complete setup.",
                        "مقامی ماڈل لوڈ نہیں ہوسکا۔ تنصیب مکمل کرنے کے لیے ایک بار آن لائن دوبارہ کھولیں۔",
                      )}
                    </p>
                  )}
                </section>
                {state.items.length > 0 && (
                  <>
                    <div className="results-header">
                      <h2>
                        {t("Let’s check the details", "تفصیلات چیک کریں")}
                      </h2>
                      <span>
                        {reviewed}/{state.items.length}{" "}
                        {t("reviewed", "چیک شدہ")}
                      </span>
                    </div>
                    <div className="summary-grid">
                      {(["supported", "unavailable", "clarify"] as const).map(
                        (status) => (
                          <div className={"summary " + status} key={status}>
                            <b>{counts[status]}</b>
                            <span>
                              {statusNames[status][lang === "en" ? 0 : 1]}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                    {state.items.map((i, k) => {
                      const c = compare(i, state.offering, state.items);
                      return (
                        <article
                          key={i.id}
                          className={
                            "card interpretation " +
                            (i.reviewed ? "reviewed" : "")
                          }
                          data-testid="interpretation"
                        >
                          <div className="item-head">
                            <div>
                              <span className="eyebrow">
                                {String(k + 1).padStart(2, "0")} /{" "}
                                {topicNames[i.topic][lang === "en" ? 0 : 1]}
                              </span>
                              <h3>{itemName(i, state.offering, lang)}</h3>
                            </div>
                            <span
                              className={
                                "badge " +
                                (i.dismissed ? "dismissed" : c.status)
                              }
                            >
                              {i.dismissed
                                ? t("Dismissed", "خارج شدہ")
                                : statusNames[c.status][lang === "en" ? 0 : 1]}
                            </span>
                          </div>
                          <blockquote dir="ltr" lang="en">
                            {i.source}
                          </blockquote>
                          <p className="fact">
                            <b>{t("Your offering:", "آپ کی پیشکش:")}</b>{" "}
                            <bdi>{facts(i)}</bdi>
                          </p>
                          <p className="reason">
                            {reasons[c.reason][lang === "en" ? 0 : 1]}
                          </p>
                          <details>
                            <summary>
                              {t(
                                "Correct this interpretation",
                                "اس تشریح کو درست کریں",
                              )}
                            </summary>
                            <div className="form-grid">
                              <label>
                                {t("Category", "زمرہ")}
                                <select
                                  value={i.topic}
                                  onChange={(e) => {
                                    const topic = e.target.value as Topic;
                                    editItem(i.id, {
                                      topic,
                                      kind:
                                        topic === "group"
                                          ? "count"
                                          : topic === "timing"
                                            ? "arrival"
                                            : topic === "other"
                                              ? "unknown"
                                              : "feature",
                                      feature: "",
                                      value: "",
                                      ambiguous: true,
                                    });
                                  }}
                                >
                                  {Object.entries(topicNames).map(([v, n]) => (
                                    <option key={v} value={v}>
                                      {n[lang === "en" ? 0 : 1]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {["meals", "transport", "activities"].includes(
                                i.topic,
                              ) && (
                                <label>
                                  {t("Requested feature", "مطلوبہ سہولت")}
                                  <select
                                    value={i.feature}
                                    onChange={(e) =>
                                      editItem(i.id, {
                                        feature: e.target.value,
                                        kind: "feature",
                                      })
                                    }
                                  >
                                    <option value="">
                                      {t(
                                        "Select a feature",
                                        "سہولت منتخب کریں",
                                      )}
                                    </option>
                                    {featuresFor(state.offering)
                                      .filter((f) => f.topic === i.topic)
                                      .map((f) => (
                                        <option key={f.id} value={f.id}>
                                          {f[lang]}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                              )}
                              {i.topic === "timing" && (
                                <label>
                                  {t("Time detail", "وقت کی تفصیل")}
                                  <select
                                    value={
                                      i.kind === "duration"
                                        ? "duration"
                                        : "arrival"
                                    }
                                    onChange={(e) =>
                                      editItem(i.id, {
                                        kind: e.target.value as
                                          | "arrival"
                                          | "duration",
                                        value: "",
                                      })
                                    }
                                  >
                                    <option value="arrival">
                                      {t("Arrival", "آمد")}
                                    </option>
                                    <option value="duration">
                                      {t(
                                        "Duration in minutes",
                                        "دورانیہ منٹوں میں",
                                      )}
                                    </option>
                                  </select>
                                </label>
                              )}
                              {(i.topic === "timing" ||
                                i.topic === "group") && (
                                <label>
                                  {i.topic === "group"
                                    ? t("Number of guests", "مہمانوں کی تعداد")
                                    : i.kind === "duration"
                                      ? t("Minutes", "منٹ")
                                      : t("Arrival time", "آمد کا وقت")}
                                  <input
                                    type={
                                      i.kind === "arrival" ? "time" : "number"
                                    }
                                    min="1"
                                    value={i.value}
                                    onChange={(e) =>
                                      editItem(i.id, {
                                        value: e.target.value,
                                        kind:
                                          i.topic === "group"
                                            ? "count"
                                            : i.kind === "duration"
                                              ? "duration"
                                              : "arrival",
                                      })
                                    }
                                  />
                                </label>
                              )}
                              <label>
                                {t("Guest intent", "مہمان کا ارادہ")}
                                <select
                                  value={i.polarity}
                                  onChange={(e) =>
                                    editItem(i.id, {
                                      polarity: e.target
                                        .value as Interpretation["polarity"],
                                    })
                                  }
                                >
                                  <option value="wanted">
                                    {t("Wants this", "یہ چاہیے")}
                                  </option>
                                  <option value="notWanted">
                                    {t("Does not want this", "یہ نہیں چاہیے")}
                                  </option>
                                  <option value="uncertain">
                                    {t("Uncertain", "غیر واضح")}
                                  </option>
                                </select>
                              </label>
                            </div>
                            <label className="check-line">
                              <input
                                type="checkbox"
                                checked={i.ambiguous}
                                onChange={(e) =>
                                  editItem(i.id, {
                                    ambiguous: e.target.checked,
                                  })
                                }
                              />
                              {t(
                                "Still ambiguous — keep as a question",
                                "ابھی غیر واضح ہے — سوال برقرار رکھیں",
                              )}
                            </label>
                            <label className="check-line">
                              <input
                                type="checkbox"
                                checked={i.dismissed}
                                onChange={(e) =>
                                  editItem(i.id, {
                                    dismissed: e.target.checked,
                                  })
                                }
                              />
                              {t(
                                "Dismiss as irrelevant or duplicate (not promised)",
                                "غیر متعلقہ یا اضافی ہونے کی وجہ سے خارج کریں (وعدہ نہیں)",
                              )}
                            </label>
                          </details>
                          <button
                            className={
                              "review-button " + (i.reviewed ? "done" : "")
                            }
                            onClick={() => review(i.id)}
                            aria-pressed={i.reviewed}
                          >
                            {i.reviewed
                              ? t(
                                  "✓ Reviewed — change",
                                  "✓ چیک ہوگیا — تبدیل کریں",
                                )
                              : c.status === "clarify"
                                ? t(
                                    "Keep question · mark reviewed",
                                    "سوال برقرار رکھیں · چیک ہوگیا",
                                  )
                                : t(
                                    "Confirm interpretation",
                                    "تشریح کی تصدیق کریں",
                                  )}
                          </button>
                        </article>
                      );
                    })}
                    <button
                      className="secondary"
                      onClick={() =>
                        update({
                          ...state,
                          approval: null,
                          items: [
                            ...state.items.map((i) => ({
                              ...i,
                              reviewed: false,
                            })),
                            {
                              id: crypto.randomUUID(),
                              source: state.request,
                              topic: "other",
                              kind: "unknown",
                              feature: "",
                              value: "",
                              polarity: "uncertain",
                              ambiguous: true,
                              reviewed: false,
                              dismissed: false,
                              corrected: true,
                            },
                          ],
                        })
                      }
                    >
                      {t(
                        "+ Add a missed detail",
                        "+ رہ جانے والی تفصیل شامل کریں",
                      )}
                    </button>
                    <div className="approval-bar">
                      <div>
                        <b>
                          {t(
                            "Your review makes the promise.",
                            "آپ کے جائزے سے وعدہ بنتا ہے۔",
                          )}
                        </b>
                        <p>
                          {t(
                            "Unresolved questions stay visible on the receipt.",
                            "غیر حل شدہ سوالات رسید پر نظر آئیں گے۔",
                          )}
                        </p>
                      </div>
                      <button
                        className="primary"
                        disabled={!canApprove(state)}
                        onClick={() => {
                          update({ ...state, approval: approve(state) });
                          go(2);
                        }}
                      >
                        {t(
                          "Approve & create receipt",
                          "منظور کریں اور رسید بنائیں",
                        )}{" "}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
            {screen === 2 &&
              (state.approval ? (
                <>
                  <div className="receipt-toolbar">
                    <span className="badge supported">
                      {t("✓ Operator approved", "✓ میزبان کی منظوری")}
                    </span>
                    <div>
                      <button
                        className="secondary"
                        onClick={async () => {
                          const text =
                            receiptText(state.approval!, "en") +
                            "\n\n──────────\n\n" +
                            receiptText(state.approval!, "ur");
                          try {
                            await navigator.clipboard.writeText(text);
                            setNotice(
                              t(
                                "Bilingual receipt copied.",
                                "دو زبانوں والی رسید کاپی ہوگئی۔",
                              ),
                            );
                          } catch {
                            setCopyFallback(true);
                            setNotice(
                              t(
                                "Copy is unavailable. Select the text below and copy it manually.",
                                "کاپی دستیاب نہیں۔ نیچے متن منتخب کرکے خود کاپی کریں۔",
                              ),
                            );
                          }
                        }}
                      >
                        {t("Copy receipt", "رسید کاپی کریں")}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => window.print()}
                      >
                        {t("Print", "پرنٹ کریں")}
                      </button>
                    </div>
                  </div>
                  <div className="receipts">
                    {(["en", "ur"] as Lang[]).map((l) => {
                      const a = state.approval!,
                        r = receipt(a, l);
                      return (
                        <article
                          className="receipt"
                          key={l}
                          lang={l}
                          dir={l === "ur" ? "rtl" : "ltr"}
                        >
                          <div className="receipt-top">
                            <span className="receipt-brand">pakka.</span>
                            <span>
                              {l === "en" ? "PROMISE RECEIPT" : "وعدے کی رسید"}
                            </span>
                          </div>
                          <h2>
                            <bdi>{a.offering.name}</bdi>
                          </h2>
                          <p className="receipt-facts">
                            {l === "en" ? "Daily offering" : "روزانہ کی پیشکش"}{" "}
                            ·{" "}
                            <bdi>
                              {a.offering.opens}–{a.offering.closes}
                            </bdi>
                            <br />
                            {a.offering.duration}{" "}
                            {l === "en"
                              ? "minutes · Maximum"
                              : "منٹ · زیادہ سے زیادہ"}{" "}
                            {a.offering.capacity}{" "}
                            {l === "en" ? "guests" : "مہمان"}
                          </p>
                          {[r.inclusions, r.exclusions, r.questions].map(
                            (items, k) => (
                              <section className="receipt-section" key={k}>
                                <h3>
                                  {
                                    (l === "en"
                                      ? [
                                          "Inclusions",
                                          "Exclusions",
                                          "Unresolved questions",
                                        ]
                                      : [
                                          "شامل سہولیات",
                                          "شامل نہیں",
                                          "غیر حل شدہ سوالات",
                                        ])[k]
                                  }
                                </h3>
                                {items.length ? (
                                  <ul>
                                    {items.map((x, n) => (
                                      <li key={n}>{x}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>
                                    {l === "en"
                                      ? "None recorded."
                                      : "کوئی درج نہیں۔"}
                                  </p>
                                )}
                              </section>
                            ),
                          )}
                          <div className="pending">
                            {l === "en"
                              ? "Guest agreement pending."
                              : "مہمان کی رضامندی کا انتظار ہے۔"}
                          </div>
                          <p className="receipt-foot">
                            {l === "en"
                              ? "Operator approved. This is not a booking confirmation."
                              : "میزبان نے منظور کیا۔ یہ بکنگ کی تصدیق نہیں ہے۔"}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                  {copyFallback && (
                    <label className="copy-fallback">
                      {t("Select and copy", "منتخب کریں اور کاپی کریں")}
                      <textarea
                        readOnly
                        rows={14}
                        dir="auto"
                        value={
                          receiptText(state.approval, "en") +
                          "\n\n" +
                          receiptText(state.approval, "ur")
                        }
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                  )}
                </>
              ) : (
                <div className="card empty">
                  <span aria-hidden="true">◇</span>
                  <h2>
                    {t(
                      "A promise starts with a review.",
                      "وعدہ جائزے سے شروع ہوتا ہے۔",
                    )}
                  </h2>
                  <p>
                    {t(
                      "Check a request and approve every interpretation to create your receipt.",
                      "رسید بنانے کے لیے درخواست اور ہر تشریح چیک کرکے منظور کریں۔",
                    )}
                  </p>
                  <button className="primary" onClick={() => go(1)}>
                    {t("Check a request", "درخواست چیک کریں")}
                  </button>
                </div>
              ))}
          </fieldset>
          <p className="notice" role="status">
            {notice}
          </p>
          <footer>
            {t(
              "Made for clarity, not automatic commitments.",
              "وضاحت کے لیے، خودکار وعدوں کے لیے نہیں۔",
            )}
            <span>{t("Pakka · Offline MVP", "پکّا · آف لائن نمونہ")}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function FarmArt() {
  return (
    <svg
      className="farm-art"
      viewBox="0 0 220 130"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="174" cy="29" r="15" fill="#dca857" />
      <path d="M0 98Q60 55 119 94T240 84V130H0Z" fill="#d9dfc6" />
      <path d="M0 112Q72 74 160 102T240 92V130H0Z" fill="#aec3a4" />
      <path d="m75 66 32-27 32 27v41H75Z" fill="#fbf5e6" />
      <path
        d="m66 69 41-35 41 35"
        stroke="#476c4c"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M98 107V82h18v25" fill="#476c4c" />
      <path
        d="M38 103V54m0 25C13 83 16 59 38 68m0-7c17 4 25-14 0-12m142 60V68m0 20c-21 4-22-17 0-11m0-1c22 4 23-18 0-12"
        stroke="#476c4c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M20 126q71-21 134-2m-50 6 25-17m-73 17 26-15m63 15 19-15"
        stroke="#78976d"
        strokeWidth="2"
      />
    </svg>
  );
}
