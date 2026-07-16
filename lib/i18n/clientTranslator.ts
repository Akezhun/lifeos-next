export type Lang = "ru" | "en";

const ru: Record<string, string> = {
  "Home": "Главная",
  "Main tools only. Everything else lives in context.": "Только главные инструменты. Всё остальное живёт внутри контекста.",
  "Notifications, import, media and Obsidian are no longer main rooms. They are mechanics inside Settings, Journal, Tracker and Analytics.": "Уведомления, импорт, медиа и Obsidian больше не отдельные комнаты. Это механики внутри настроек, журналов, трекеров и аналитики.",
  "Clean Product Mode": "Чистый режим продукта",
  "Trackers": "Трекеры",
  "Life Tracker": "Life Tracker",
  "Journals": "Журналы",
  "Schedule": "Расписание",
  "Analytics": "Аналитика",
  "Settings": "Настройки",
  "Sign out": "Выйти",
  "Logout": "Выйти",
  "Checking session...": "Проверка сессии...",
  "Not signed in": "Вход не выполнен",
  "Supabase DB": "База Supabase",
  "Loading LifeOS session...": "Загрузка сессии LifeOS...",
  "Sign in first": "Сначала войди",
  "Open auth": "Открыть вход",
  "Active": "Активные",
  "Archive": "Архив",
  "Archived": "В архиве",
  "All tags": "Все теги",
  "Filters": "Фильтры",
  "Selected": "Выбрано",
  "selected tracker": "выбранный трекер",
  "Details": "Детали",
  "Done": "Выполнено",
  "Fail": "Провал",
  "Partial": "Частично",
  "Edit": "Редактировать",
  "Delete": "Удалить",
  "Restore": "Вернуть",
  "Cancel": "Отмена",
  "Save": "Сохранить",
  "Create": "Создать",
  "+ Create": "+ Создать",
  "+ Add Token": "+ Добавить токен",
  "Save token": "Сохранить токен",
  "Save settings": "Сохранить настройки",
  "Save notes": "Сохранить заметки",
  "Save & Exit": "Сохранить и выйти",
  "Close": "Закрыть",
  "Title": "Название",
  "Name": "Название",
  "Type": "Тип",
  "Type:": "Тип:",
  "Priority": "Приоритет",
  "Priority:": "Приоритет:",
  "Status": "Статус",
  "Status:": "Статус:",
  "Deadline": "Дедлайн",
  "Deadline:": "Дедлайн:",
  "Cycle": "Цикл",
  "Countdown days": "Дней обратного отсчёта",
  "Confirmations": "Подтверждения",
  "Notification": "Уведомление",
  "Notify": "Уведомлять",
  "Notifications": "Уведомления",
  "Notify me": "Уведомлять меня",
  "Reminder minutes": "Минут до напоминания",
  "Notification on": "Уведомление включено",
  "Notification off": "Уведомление выключено",
  "Active days": "Активные дни",
  "Active weekdays": "Активные дни недели",
  "Active month days": "Активные дни месяца",
  "Only selected days require Done": "Done нужен только в выбранные дни",
  "No trackers here.": "Здесь пока нет трекеров.",
  "No trackers for this filter.": "Нет трекеров для этого фильтра.",
  "Select a tracker to open details, notes, edit and history.": "Выбери трекер, чтобы открыть детали, заметки, редактирование и историю.",
  "Private tracker notes...": "Личные заметки трекера...",
  "Focus Writer": "Focus Writer",
  "New entry": "Новая запись",
  "Edit entry": "Редактирование записи",
  "Journal": "Журнал",
  "Journal entries": "Записи журнала",
  "Journal containers": "Контейнеры журналов",
  "Mood": "Настроение",
  "Energy": "Энергия",
  "Words": "Слова",
  "Entries": "Записи",
  "No journal entries yet.": "Записей пока нет.",
  "No text yet": "Текста пока нет",
  "Attach": "Прикрепить",
  "Attach media to this entry": "Прикрепить медиа к этой записи",
  "Attached media": "Прикреплённое медиа",
  "Media found in text": "Медиа в тексте",
  "Schedule reminders": "Напоминания расписания",
  "Weekly Token Board": "Недельная доска токенов",
  "Token Library": "Библиотека токенов",
  "Click a token on the board.": "Нажми на токен на доске.",
  "Today": "Сегодня",
  "Tomorrow": "Завтра",
  "Next →": "Далее →",
  "← Previous": "← Назад",
  "Copy week +1": "Скопировать неделю +1",
  "Duplicate +1 week": "Дублировать +1 неделя",
  "Save this occurrence": "Сохранить это появление",
  "Apply this & future": "Применить это и будущие",
  "Apply entire series": "Применить всю серию",
  "Delete this": "Удалить это",
  "Delete this & future": "Удалить это и будущие",
  "Delete entire series": "Удалить всю серию",
  "Overlap warnings:": "Предупреждения пересечений:",
  "Hours": "Часы",
  "Risk": "Риск",
  "Success": "Успех",
  "Feature matrix": "Матрица признаков",
  "Progress maps": "Карты прогресса",
  "Settings Core": "Ядро настроек",
  "General": "Общие",
  "Modules": "Модули",
  "Integrations": "Интеграции",
  "Account": "Аккаунт",
  "Backup": "Бэкап",
  "Health": "Проверка данных",
  "System": "Система",
  "Language": "Язык",
  "Theme": "Тема",
  "Timezone": "Часовой пояс",
  "Week start": "Начало недели",
  "Time format": "Формат времени",
  "Start page": "Стартовая страница",
  "Compact mode": "Компактный режим",
  "Display name": "Отображаемое имя",
  "Onboarding done": "Онбординг завершён",
  "Tracker preferences": "Настройки трекеров",
  "Journal preferences": "Настройки журналов",
  "Schedule preferences": "Настройки расписания",
  "Analytics preferences": "Настройки аналитики",
  "Media rendering": "Отображение медиа",
  "Notification preferences": "Настройки уведомлений",
  "Obsidian Sync 2.0": "Obsidian Sync 2.0",
  "Auto export after changes": "Автоэкспорт после изменений",
  "Manual export to GitHub Vault": "Экспортировать в GitHub Vault",
  "Export backup": "Экспорт бэкапа",
  "Import backup": "Импорт бэкапа",
  "Download full backup": "Скачать полный бэкап",
  "Import pasted backup": "Импортировать вставленный бэкап",
  "Data Health Check": "Проверка данных",
  "Refresh": "Обновить",
  "System status": "Статус системы",
  "Send password reset": "Отправить сброс пароля",
  "Email enabled": "Email включён",
  "Telegram enabled": "Telegram включён",
  "Daily brief": "Утренний обзор",
  "Evening review": "Вечерний обзор",
  "Weekly review": "Еженедельный обзор",
  "Quiet start": "Начало тихих часов",
  "Quiet end": "Конец тихих часов",
  "Test email": "Тест email",
  "Test Telegram": "Тест Telegram",
  "Manual worker run": "Ручной запуск worker",
  "Last notifications": "Последние уведомления",
  "Worker status": "Статус worker",
  "Channel": "Канал",
  "Channels": "Каналы",
  "Rules": "Правила",
  "Source": "Источник",
  "Tag": "Тег",
  "Tags": "Теги",
  "Mon": "Пн",
  "Tue": "Вт",
  "Wed": "Ср",
  "Thu": "Чт",
  "Fri": "Пт",
  "Sat": "Сб",
  "Sun": "Вс",
  "Monday": "Понедельник",
  "Tuesday": "Вторник",
  "Wednesday": "Среда",
  "Thursday": "Четверг",
  "Friday": "Пятница",
  "Saturday": "Суббота",
  "Sunday": "Воскресенье",
  "daily": "ежедневно",
  "weekly": "еженедельно",
  "monthly": "ежемесячно",
  "deadline": "дедлайн",
  "cycle": "цикл",
  "countdown": "отсчёт",
  "gray": "серый",
  "low": "низкий",
  "mid": "средний",
  "high": "высокий",
  "draft": "черновик",
  "active": "активно",
  "final": "финал",
  "done": "выполнено",
  "fail": "провал",
  "partial": "частично",
  "success": "успех",
  "one_time": "один раз",
  "one-time": "один раз",
  "recurring": "повторяется",
  "permanent": "постоянный",
  "free": "свободный",
  "tracker": "трекер",
  "journal": "журнал",
  "hybrid": "гибрид",
  "Default tracker type": "Тип трекера по умолчанию",
  "Default priority": "Приоритет по умолчанию",
  "Progress map range, days": "Длина карты прогресса, дней",
  "Show progress maps": "Показывать карты прогресса",
  "Confirm before delete": "Подтверждать удаление",
  "Default entry type": "Тип записи по умолчанию",
  "Autosave": "Автосохранение",
  "Autosave interval, seconds": "Интервал автосохранения, секунд",
  "Focus writer width": "Ширина Focus Writer",
  "Show mood/energy": "Показывать настроение/энергию",
  "Visible start": "Начало видимого дня",
  "Visible end": "Конец видимого дня",
  "Default duration, minutes": "Длительность по умолчанию, минут",
  "Snap interval, minutes": "Шаг сетки, минут",
  "Show weekends": "Показывать выходные",
  "Overlap warnings": "Предупреждать о пересечениях",
  "Analytics default range": "Период аналитики по умолчанию",
  "Show Data Science mode": "Показывать Data Science режим",
  "Show Tag analytics": "Показывать аналитику тегов",
  "URL previews": "Превью ссылок",
  "Image previews": "Превью картинок",
  "YouTube cards": "Карточки YouTube",
  "Spotify/Apple Music cards": "Карточки Spotify/Apple Music",
  "Attachments": "Вложения",
  "Not configured": "Не настроено",
  "Configured": "Настроено",
  "Saved": "Сохранено",
  "Saving...": "Сохранение...",
  "Backup downloaded.": "Бэкап скачан.",
  "Paste backup JSON first.": "Сначала вставь JSON бэкапа.",
  "Invalid JSON.": "Неверный JSON.",
  "This does not look like a LifeOS backup.": "Это не похоже на бэкап LifeOS.",
  "Import finished. Reloading...": "Импорт завершён. Перезагрузка...",
  "Data health check refreshed.": "Проверка данных обновлена.",
  "Saved · Obsidian sync started": "Сохранено · синхронизация Obsidian запущена"
};

const placeholderRu: Record<string, string> = {
  "Search trackers...": "Поиск трекеров...",
  "Search entries...": "Поиск записей...",
  "Entry title": "Название записи",
  "Write here. This is the big text space, not a tiny form.": "Пиши здесь. Это большое рабочее поле, не маленькая форма.",
  "New journal, e.g. Diary / Essays / Projects": "Новый журнал, например Дневник / Эссе / Проекты",
  "Media title / optional": "Название медиа / необязательно",
  "https://image / youtube / spotify / article": "https://картинка / youtube / spotify / статья",
  "Paste LifeOS backup JSON here": "Вставь JSON-бэкап LifeOS сюда",
  "e.g. Read psychology book": "например Читать книгу по психологии",
  "study, psychology": "учёба, психология",
  "Title": "Название",
  "Tags": "Теги"
};

function replaceExact(value: string, lang: Lang) {
  if (lang === "en") return value;
  const trimmed = value.trim();
  if (ru[trimmed]) return value.replace(trimmed, ru[trimmed]);
  return value;
}

export function applyClientTranslations(lang: Lang) {
  if (typeof document === "undefined") return;
  const SKIP_TEXT = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);

  const translateTextNode = (node: Node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent || SKIP_TEXT.has(parent.tagName)) return;
    const current = node.textContent || "";
    if (!parent.dataset.i18nOriginalText) parent.dataset.i18nOriginalText = current;
    const original = parent.dataset.i18nOriginalText || current;
    const translated = replaceExact(original, lang);
    if (translated !== current) node.textContent = translated;
  };

  const translateAttrs = (el: Element) => {
    const html = el as HTMLElement & { placeholder?: string };
    if ("placeholder" in html && html.placeholder !== undefined) {
      if (!html.dataset.i18nOriginalPlaceholder) html.dataset.i18nOriginalPlaceholder = html.placeholder;
      const original = html.dataset.i18nOriginalPlaceholder || "";
      html.placeholder = lang === "ru" ? (placeholderRu[original] || ru[original] || original) : original;
    }
    if (html.title) {
      if (!html.dataset.i18nOriginalTitle) html.dataset.i18nOriginalTitle = html.title;
      const original = html.dataset.i18nOriginalTitle || "";
      html.title = lang === "ru" ? (ru[original] || original) : original;
    }
    if (el.tagName === "OPTION") {
      const text = el.textContent || "";
      if (!(el as HTMLElement).dataset.i18nOriginalText) (el as HTMLElement).dataset.i18nOriginalText = text;
      const original = (el as HTMLElement).dataset.i18nOriginalText || text;
      el.textContent = lang === "ru" ? (ru[original.trim()] || original) : original;
    }
  };

  const walk = (root: ParentNode) => {
    root.querySelectorAll("*").forEach(translateAttrs);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) translateTextNode(n);
  };

  (window as any).__lifeosTranslatorObserver?.disconnect?.();
  walk(document.body);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) walk(node as Element);
        else translateTextNode(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  (window as any).__lifeosTranslatorObserver = observer;
}
