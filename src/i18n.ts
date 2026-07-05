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
  balance: {
    en: 'Balance',
    ru: 'Баланс',
    uk: 'Баланс',
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
  tabViewers: {
    en: 'Viewers',
    ru: 'Зрители',
    uk: 'Глядачі',
  },
  tabShop: {
    en: 'Shop',
    ru: 'Магазин',
    uk: 'Магазин',
  },
  addShopItem: {
    en: 'Add shop item',
    ru: 'Добавить товар',
    uk: 'Додати товар',
  },
  shopEmpty: {
    en: 'No shop items yet. Add triggers from overlays, sounds, or timers.',
    ru: 'Товаров пока нет. Добавьте триггеры из оверлеев, звуков или таймеров.',
    uk: 'Товарів поки немає. Додайте тригери з оверлеїв, звуків або таймерів.',
  },
  shopTrigger: {
    en: 'Trigger source',
    ru: 'Источник триггера',
    uk: 'Джерело тригера',
  },
  shopPrice: {
    en: 'Price',
    ru: 'Цена',
    uk: 'Ціна',
  },
  shopTriggerValue: {
    en: 'Trigger code',
    ru: 'Код триггера',
    uk: 'Код тригера',
  },
  shopTriggerValueHint: {
    en: 'Use this number in overlay/sound/timer trigger settings.',
    ru: 'Укажите это число в настройках триггера оверлея/звука/таймера.',
    uk: 'Вкажіть це число в налаштуваннях тригера оверлею/звуку/таймера.',
  },
  shopName: {
    en: 'Name (EN)',
    ru: 'Название (EN)',
    uk: 'Назва (EN)',
  },
  shopNameRu: {
    en: 'Name (RU)',
    ru: 'Название (RU)',
    uk: 'Назва (RU)',
  },
  shopNameUk: {
    en: 'Name (UK)',
    ru: 'Название (UK)',
    uk: 'Назва (UK)',
  },
  shopDescription: {
    en: 'Description (EN)',
    ru: 'Описание (EN)',
    uk: 'Опис (EN)',
  },
  shopSystems: {
    en: 'Systems',
    ru: 'Системы',
    uk: 'Системи',
  },
  shopHint: {
    en: 'Pick a trigger already used in overlay, sounds, timer, hotkeys, or game rules.',
    ru: 'Выберите триггер, уже используемый в оверлее, звуках, таймере, хоткеях или игре.',
    uk: 'Оберіть тригер, який уже використовується в оверлеї, звуках, таймері, хоткеях або грі.',
  },
};

/**
 * Returns UI string for the active language with English fallback.
 * @param key String key.
 * @param lang Active UI language.
 */
export const t = (key: keyof typeof strings, lang: UiLang) =>
  strings[key][lang] ?? strings[key].en;
