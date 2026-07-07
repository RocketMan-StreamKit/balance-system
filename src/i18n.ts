export type UiLang = 'en' | 'ru' | 'uk';

type UiStrings = Record<string, Record<UiLang, string>>;

const strings: UiStrings = {
  title: {
    en: 'Viewer balance',
    ru: 'Баланс зрителей',
    uk: 'Баланс глядачів',
  },
  search: {
    en: 'Search by login or name…',
    ru: 'Поиск по логину или имени…',
    uk: 'Пошук за логіном або ім’ям…',
  },
  sortBalanceDesc: {
    en: 'Balance ↓',
    ru: 'Баланс ↓',
    uk: 'Баланс ↓',
  },
  sortBalanceAsc: {
    en: 'Balance ↑',
    ru: 'Баланс ↑',
    uk: 'Баланс ↑',
  },
  sortLoginAsc: {
    en: 'Login A–Z',
    ru: 'Логин А–Я',
    uk: 'Логін А–Я',
  },
  sortLoginDesc: {
    en: 'Login Z–A',
    ru: 'Логин Я–А',
    uk: 'Логін Я–А',
  },
  addViewer: {
    en: 'Add viewer',
    ru: 'Добавить зрителя',
    uk: 'Додати глядача',
  },
  login: {
    en: 'Twitch login',
    ru: 'Логин Twitch',
    uk: 'Логін Twitch',
  },
  columnLogin: {
    en: 'Login',
    ru: 'Логин',
    uk: 'Логін',
  },
  balance: {
    en: 'Balance',
    ru: 'Баланс',
    uk: 'Баланс',
  },
  name: {
    en: 'Name',
    ru: 'Имя',
    uk: "Ім'я",
  },
  save: {
    en: 'Save',
    ru: 'Сохранить',
    uk: 'Зберегти',
  },
  delete: {
    en: 'Delete',
    ru: 'Удалить',
    uk: 'Видалити',
  },
  viewerPage: {
    en: 'Viewer page',
    ru: 'Страница для зрителей',
    uk: 'Сторінка для глядачів',
  },
  copy: {
    en: 'Copy',
    ru: 'Копировать',
    uk: 'Копіювати',
  },
  copied: {
    en: 'Copied!',
    ru: 'Скопировано!',
    uk: 'Скопійовано!',
  },
  openInBrowser: {
    en: 'Open in browser',
    ru: 'Открыть в браузере',
    uk: 'Відкрити в браузері',
  },
  loading: {
    en: 'Loading…',
    ru: 'Загрузка…',
    uk: 'Завантаження…',
  },
  empty: {
    en: 'No viewers yet',
    ru: 'Зрителей пока нет',
    uk: 'Глядачів поки немає',
  },
  currency: {
    en: 'Currency',
    ru: 'Валюта',
    uk: 'Валюта',
  },
  actions: {
    en: 'Actions',
    ru: 'Действия',
    uk: 'Дії',
  },
  edit: {
    en: 'Edit',
    ru: 'Изменить',
    uk: 'Змінити',
  },
  cancel: {
    en: 'Cancel',
    ru: 'Отмена',
    uk: 'Скасувати',
  },
  error: {
    en: 'Error',
    ru: 'Ошибка',
    uk: 'Помилка',
  },
  viewerCount: {
    en: '{count} viewers',
    ru: '{count} зрителей',
    uk: '{count} глядачів',
  },
  importStreamKit: {
    en: 'Import from StreamKit',
    ru: 'Импорт из StreamKit',
    uk: 'Імпорт з StreamKit',
  },
  importTitle: {
    en: 'Import from StreamKit',
    ru: 'Импорт из StreamKit',
    uk: 'Імпорт з StreamKit',
  },
  importDescription: {
    en: 'Paste the contents of balanceUsers.json from the legacy StreamKit application (Windows only). File path: %APPDATA%\\rocketman-application\\storageData\\balanceUsers.json. Amounts will be converted from the selected currency into your current balance currency.',
    ru: 'Вставьте содержимое файла balanceUsers.json из старого приложения StreamKit (только Windows). Путь к файлу: %APPDATA%\\rocketman-application\\storageData\\balanceUsers.json. Суммы будут сконвертированы из выбранной валюты в текущую валюту баланса.',
    uk: 'Вставте вміст файлу balanceUsers.json зі старого застосунку StreamKit (лише Windows). Шлях до файлу: %APPDATA%\\rocketman-application\\storageData\\balanceUsers.json. Суми буде сконвертовано з обраної валюти в поточну валюту балансу.',
  },
  importCurrency: {
    en: 'Source currency',
    ru: 'Исходная валюта',
    uk: 'Вихідна валюта',
  },
  importJson: {
    en: 'JSON data',
    ru: 'JSON-данные',
    uk: 'JSON-дані',
  },
  importSubmit: {
    en: 'Import',
    ru: 'Импортировать',
    uk: 'Імпортувати',
  },
  importSuccess: {
    en: 'Imported {imported} viewers ({skipped} skipped)',
    ru: 'Импортировано {imported} зрителей ({skipped} пропущено)',
    uk: 'Імпортовано {imported} глядачів ({skipped} пропущено)',
  },
  bulkSelected: {
    en: 'Selected: {count}',
    ru: 'Выбрано: {count}',
    uk: 'Обрано: {count}',
  },
  bulkDelete: {
    en: 'Delete',
    ru: 'Удалить',
    uk: 'Видалити',
  },
  bulkReset: {
    en: 'Reset balance',
    ru: 'Обнулить баланс',
    uk: 'Обнулити баланс',
  },
  bulkAdd: {
    en: 'Add balance',
    ru: 'Добавить баланс',
    uk: 'Додати баланс',
  },
  bulkSubtract: {
    en: 'Subtract balance',
    ru: 'Отнять баланс',
    uk: 'Відняти баланс',
  },
  bulkMerge: {
    en: 'Merge',
    ru: 'Объединить',
    uk: "Об'єднати",
  },
  bulkDeleteConfirm: {
    en: 'Delete {count} selected viewers?',
    ru: 'Удалить {count} выбранных зрителей?',
    uk: 'Видалити {count} обраних глядачів?',
  },
  bulkResetConfirm: {
    en: 'Reset balance to 0 for {count} selected viewers?',
    ru: 'Обнулить баланс у {count} выбранных зрителей?',
    uk: 'Обнулити баланс у {count} обраних глядачів?',
  },
  bulkAmountTitleAdd: {
    en: 'Add balance',
    ru: 'Добавить баланс',
    uk: 'Додати баланс',
  },
  bulkAmountTitleSubtract: {
    en: 'Subtract balance',
    ru: 'Отнять баланс',
    uk: 'Відняти баланс',
  },
  bulkAmountLabel: {
    en: 'Amount',
    ru: 'Сумма',
    uk: 'Сума',
  },
  bulkAmountCurrency: {
    en: 'Currency',
    ru: 'Валюта',
    uk: 'Валюта',
  },
  bulkAmountApply: {
    en: 'Apply',
    ru: 'Применить',
    uk: 'Застосувати',
  },
  bulkMergeTitle: {
    en: 'Merge viewers',
    ru: 'Объединение зрителей',
    uk: "Об'єднання глядачів",
  },
  bulkMergeHint: {
    en: 'Pick a source for each field or edit values manually. Balance defaults to the sum of selected viewers.',
    ru: 'Выберите источник для каждого поля или отредактируйте значения вручную. Баланс по умолчанию — сумма выбранных зрителей.',
    uk: 'Оберіть джерело для кожного поля або відредагуйте значення вручну. Баланс за замовчуванням — сума обраних глядачів.',
  },
  bulkMergeManual: {
    en: 'Manual',
    ru: 'Вручную',
    uk: 'Вручну',
  },
  bulkMergeBalanceSum: {
    en: 'Sum',
    ru: 'Сумма',
    uk: 'Сума',
  },
  twitchId: {
    en: 'Twitch ID',
    ru: 'Twitch ID',
    uk: 'Twitch ID',
  },
  displayName: {
    en: 'Display name',
    ru: 'Отображаемое имя',
    uk: "Відображуване ім'я",
  },
  bulkMergeApply: {
    en: 'Merge',
    ru: 'Объединить',
    uk: "Об'єднати",
  },
};

/**
 * Returns UI string for the active language with English fallback.
 * @param key String key.
 * @param lang Active UI language.
 * @param vars Optional `{name}` placeholders.
 */
export const t = (
  key: keyof typeof strings,
  lang: UiLang,
  vars?: Record<string, string | number>
) => {
  let value = strings[key][lang] ?? strings[key].en;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(`{${name}}`, String(replacement));
    }
  }
  return value;
};
