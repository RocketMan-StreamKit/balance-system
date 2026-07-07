import {
  AUTH_SERVER_LOCAL_URL,
  AUTH_SERVER_RU_URL,
  buildAuthServerSelectOptions,
  DEFAULT_API_SERVER,
  SUPPORTED_CURRENCIES,
} from './constants';
import type { BalanceAddonParams } from './types';

const currencyOptions = () => [
  {
    value: 'app',
    label: {
      en: 'Same as app settings',
      ru: 'Как в настройках приложения',
      uk: 'Як у налаштуваннях програми',
    },
  },
  ...SUPPORTED_CURRENCIES.map(code => ({
    value: code,
    label: { en: code, ru: code, uk: code },
  })),
];

/**
 * Registers addon settings schema and default params.
 * @example registerBalanceConfig();
 */
export const registerBalanceConfig = () => {
  const fields: unknown[] = [
    {
      key: 'currency',
      type: 'select',
      default: 'app',
      options: currencyOptions(),
      editor: {
        label: {
          en: 'Balance currency',
          ru: 'Валюта баланса',
          uk: 'Валюта балансу',
        },
        description: {
          en: 'All balances are stored and displayed in this currency.',
          ru: 'Все балансы хранятся и отображаются в этой валюте.',
          uk: 'Усі баланси зберігаються та відображаються в цій валюті.',
        },
      },
    },
    {
      key: 'allow_external_credit',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Allow other addons to credit balance',
          ru: 'Разрешить другим аддонам зачислять баланс',
          uk: 'Дозволити іншим аддонам зараховувати баланс',
        },
        description: {
          en: 'Allows other addons to credit viewer balances through this addon (RPC `creditBalance`). Does not affect balance top-ups from donations registered in the app.',
          ru: 'Позволяет другим аддонам начислять баланс зрителям через этот аддон (RPC `creditBalance`). Не влияет на пополнение баланса от донатов, которые регистрируются в приложении.',
          uk: 'Дозволяє іншим аддонам нараховувати баланс глядачам через цей аддон (RPC `creditBalance`). Не впливає на поповнення балансу від донатів, які реєструються в застосунку.',
        },
      },
    },
    {
      key: 'allow_spend_message',
      type: 'boolean',
      default: false,
      editor: {
        label: {
          en: 'Add message to activation',
          ru: 'Добавить сообщение к вызову',
          uk: 'Додати повідомлення до виклику',
        },
        description: {
          en: 'When enabled, viewers can enter an optional message on the web page before activating an action.',
          ru: 'При включении зрители смогут указать текст сообщения на сайте перед активацией действия.',
          uk: 'Якщо увімкнено, глядачі зможуть вказати текст повідомлення на сайті перед активацією дії.',
        },
      },
    },
    {
      key: 'viewer_backup_enabled',
      type: 'boolean',
      default: true,
      editor: {
        label: {
          en: 'Backup viewer balances on server',
          ru: 'Бекапировать балансы зрителей на сервере',
          uk: 'Бекапити баланси глядачів на сервері',
        },
        description: {
          en: 'Uploads viewer balance data to the balance backend when it changes (at most once every 5 seconds).',
          ru: 'Отправляет данные балансов зрителей на сервер баланса при изменениях (не чаще одного раза в 5 секунд).',
          uk: 'Надсилає дані балансів глядачів на сервер балансу при змінах (не частіше одного разу на 5 секунд).',
        },
      },
    },
    {
      key: 'viewer_page_url',
      type: 'text',
      default: '',
      editor: {
        label: {
          en: 'Viewer page URL',
          ru: 'URL страницы для зрителей',
          uk: 'URL сторінки для глядачів',
        },
        description: {
          en: 'Filled automatically after backend registration.',
          ru: 'Заполняется автоматически после регистрации на сервере.',
          uk: 'Заповнюється автоматично після реєстрації на сервері.',
        },
      },
    },
    { key: 'stored_currency', type: 'hidden', default: '' },
    { key: 'viewers_json', type: 'text', default: '[]' },
    { key: 'categories_json', type: 'text', default: '[]' },
    { key: 'shop_items_json', type: 'text', default: '[]' },
    { key: 'session_token', type: 'hidden', default: '' },
    { key: 'license_id', type: 'hidden', default: '' },
  ];

  if (isDeveloperMode) {
    fields.splice(1, 0, {
      key: 'api_server_override',
      type: 'select',
      default: DEFAULT_API_SERVER,
      options: buildAuthServerSelectOptions(true),
      editor: {
        label: {
          en: 'API server (developer mode)',
          ru: 'API сервер (режим разработчика)',
          uk: 'API сервер (режим розробника)',
        },
      },
    });
  } else {
    fields.push({
      key: 'api_server_override',
      type: 'hidden',
      default: '',
    });
  }

  GenerateConfig(fields as Parameters<typeof GenerateConfig>[0]);

  return {
    currency: 'app' as BalanceAddonParams['currency'],
    stored_currency: '',
    api_server_override: DEFAULT_API_SERVER,
    allow_external_credit: false,
    allow_spend_message: false,
    viewer_backup_enabled: true,
    viewers_json: '[]',
    categories_json: '[]',
    shop_items_json: '[]',
    session_token: '',
    license_id: '',
    viewer_page_url: '',
  } satisfies Record<string, unknown>;
};
