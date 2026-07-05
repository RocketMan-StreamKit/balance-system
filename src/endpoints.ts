import { ADDON_ID } from './constants';
import { resolveBalanceCurrency } from './balance/currency';
import {
  deleteViewerBalance,
  setViewerBalance,
} from './twitch/api';
import { loadParams } from './balance/store';
import { resyncBackend } from './backend/sync';
import { creditViewerBalance } from './twitch/api';
import { collectTriggerSourceOptions } from './triggers/sources';
import { deleteShopItem, upsertShopItem } from './triggers/shop-store';
import type { BalanceShopItem } from './types';

const unauthorized = () => ({ success: false, message: 'Unauthorized' });

const assertToken = (token: unknown) =>
  typeof token === 'string' && token === data.token;

/**
 * Registers HTTP endpoints for the application window.
 */
export const registerHttpEndpoints = async () => {
  await network.endpoints.create('state', 'GET', 'onGetState');
  await network.endpoints.create('viewers', 'GET', 'onListViewers');
  await network.endpoints.create('viewers', 'POST', 'onSaveViewer');
  await network.endpoints.create('viewers/delete', 'POST', 'onDeleteViewer');
  await network.endpoints.create('shop', 'GET', 'onListShop');
  await network.endpoints.create('shop', 'POST', 'onSaveShopItem');
  await network.endpoints.create('shop/delete', 'POST', 'onDeleteShopItem');
  await network.endpoints.create('trigger-sources', 'GET', 'onListTriggerSources');

  events.On('onGetState', async ({ query }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const params = await loadParams();
    const currencyCode = await resolveBalanceCurrency();

    return {
      success: true,
      addonId: ADDON_ID,
      currency: currencyCode,
      viewerPageUrl: params.viewer_page_url,
      licenseId: params.license_id,
      viewerCount: params.viewers.length,
    };
  });

  events.On('onListViewers', async ({ query }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const params = await loadParams();
    const search =
      typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const sort =
      typeof query.sort === 'string' ? query.sort : 'balance_desc';

    let viewers = [...params.viewers];
    if (search) {
      viewers = viewers.filter(
        entry =>
          entry.login.toLowerCase().includes(search) ||
          entry.displayName.toLowerCase().includes(search) ||
          entry.twitchId.includes(search)
      );
    }

    viewers.sort((a, b) => compareViewers(a, b, sort));

    return { success: true, viewers };
  });

  events.On('onSaveViewer', async ({ query, body }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const login =
      typeof body?.login === 'string' && body.login.trim()
        ? body.login.trim()
        : undefined;
    const twitchId =
      typeof body?.twitchId === 'string' && body.twitchId.trim()
        ? body.twitchId.trim()
        : undefined;
    const balance = Number(body?.balance);
    const mode = typeof body?.mode === 'string' ? body.mode : 'set';

    if (!login && !twitchId) {
      return { success: false, message: 'login or twitchId required' };
    }
    if (!Number.isFinite(balance)) {
      return { success: false, message: 'balance must be a number' };
    }

    let result;
    if (mode === 'add') {
      result = await creditViewerBalance({ login, twitchId, amount: balance });
    } else {
      result = await setViewerBalance({ login, twitchId, balance });
    }

    if (result.success) {
      await resyncBackend();
    }

    return result;
  });

  events.On('onDeleteViewer', async ({ query, body }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const result = await deleteViewerBalance({
      login: typeof body?.login === 'string' ? body.login : undefined,
      twitchId: typeof body?.twitchId === 'string' ? body.twitchId : undefined,
    });

    if (result.success) {
      await resyncBackend();
    }

    return result;
  });

  events.On('onListShop', async ({ query }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const params = await loadParams();
    return {
      success: true,
      items: params.shop_items,
      categories: params.categories,
    };
  });

  events.On('onListTriggerSources', async ({ query }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const options = await collectTriggerSourceOptions();
    return { success: true, options };
  });

  events.On('onSaveShopItem', async ({ query, body }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const item = parseShopItemBody(body);
    if (!item) {
      return { success: false, message: 'Invalid shop item payload' };
    }

    await upsertShopItem(item);
    return { success: true, item };
  });

  events.On('onDeleteShopItem', async ({ query, body }) => {
    if (!assertToken(query.token)) {
      return unauthorized();
    }

    const itemId = typeof body?.id === 'string' ? body.id : '';
    if (!itemId) {
      return { success: false, message: 'id is required' };
    }

    return deleteShopItem(itemId);
  });
};

type ViewerRow = {
  login: string;
  displayName: string;
  twitchId: string;
  balance: number;
};

const compareViewers = (a: ViewerRow, b: ViewerRow, sort: string) => {
  switch (sort) {
    case 'balance_asc':
      return a.balance - b.balance;
    case 'login_asc':
      return a.login.localeCompare(b.login);
    case 'login_desc':
      return b.login.localeCompare(a.login);
    case 'balance_desc':
    default:
      return b.balance - a.balance;
  }
};

const parseShopItemBody = (body: unknown): BalanceShopItem | null => {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  const price = Number(record.price);
  const addonId = typeof record.addonId === 'string' ? record.addonId.trim() : '';
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : random.id();
  const categoryId =
    typeof record.categoryId === 'string' && record.categoryId.trim()
      ? record.categoryId.trim()
      : 'default';
  const trigger = record.trigger;

  if (!addonId || !Number.isFinite(price) || price < 0 || !trigger || typeof trigger !== 'object') {
    return null;
  }

  const triggerRecord = trigger as Record<string, unknown>;
  const type = triggerRecord.type;
  if (
    type !== 'donation' &&
    type !== 'subscribe' &&
    type !== 'subgift' &&
    type !== 'follow' &&
    type !== 'custom'
  ) {
    return null;
  }

  const name = parseLocalized(record.name) ?? { en: id };
  const description = parseLocalized(record.description) ?? { en: '' };
  const catalogGroup = record.catalogGroup === 'sounds' ? 'sounds' : 'addon';

  return {
    id,
    addonId,
    categoryId,
    price,
    catalogGroup,
    name,
    description,
    trigger: {
      type,
      key: typeof triggerRecord.key === 'string' ? triggerRecord.key : undefined,
      value:
        typeof triggerRecord.value === 'string' ||
        typeof triggerRecord.value === 'number' ||
        typeof triggerRecord.value === 'boolean'
          ? triggerRecord.value
          : undefined,
    },
  };
};

const parseLocalized = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.en !== 'string' || !record.en.trim()) {
    return null;
  }

  return {
    en: record.en,
    ru: typeof record.ru === 'string' ? record.ru : undefined,
    uk: typeof record.uk === 'string' ? record.uk : undefined,
  };
};
