import { ADDON_ID } from './constants';
import { t, type UiLang } from './i18n';

type ViewerRow = {
  twitchId: string;
  login: string;
  displayName: string;
  balance: number;
};

type ShopItemRow = {
  id: string;
  addonId: string;
  categoryId: string;
  price: number;
  name: { en: string; ru?: string; uk?: string };
  description: { en: string; ru?: string; uk?: string };
  trigger: {
    type: string;
    key?: string;
    value?: string | number | boolean;
  };
};

type TriggerSourceOption = {
  id: string;
  addonId: string;
  label: string;
  systems: string[];
  trigger: ShopItemRow['trigger'];
};

type AppState = {
  currency: string;
  viewerPageUrl: string;
  viewers: ViewerRow[];
  shopItems: ShopItemRow[];
  triggerSources: TriggerSourceOption[];
};

const params = new URLSearchParams(window.location.search);
const token = params.get('token') ?? '';
const port = window.location.port;
const apiBase = `http://localhost:${port}/addon/${ADDON_ID}`;

let lang: UiLang = 'en';
let state: AppState = {
  currency: 'USD',
  viewerPageUrl: '',
  viewers: [],
  shopItems: [],
  triggerSources: [],
};
let editingViewer: ViewerRow | null = null;
let editingShopItem: ShopItemRow | null = null;
let activeTab: 'viewers' | 'shop' = 'viewers';

const el = {
  title: document.getElementById('title'),
  currencyLabel: document.getElementById('currency-label'),
  viewerCount: document.getElementById('viewer-count'),
  viewerPageUrl: document.getElementById('viewer-page-url') as HTMLInputElement,
  copyPageUrl: document.getElementById('copy-page-url'),
  tabViewers: document.getElementById('tab-viewers'),
  tabShop: document.getElementById('tab-shop'),
  panelViewers: document.getElementById('panel-viewers'),
  panelShop: document.getElementById('panel-shop'),
  search: document.getElementById('search') as HTMLInputElement,
  sort: document.getElementById('sort') as HTMLSelectElement,
  addViewer: document.getElementById('add-viewer'),
  viewersBody: document.getElementById('viewers-body'),
  loadingCell: document.getElementById('loading-cell'),
  shopHint: document.getElementById('shop-hint'),
  addShopItem: document.getElementById('add-shop-item'),
  shopBody: document.getElementById('shop-body'),
  shopLoadingCell: document.getElementById('shop-loading-cell'),
  editorDialog: document.getElementById('editor-dialog') as HTMLDialogElement,
  editorForm: document.getElementById('editor-form') as HTMLFormElement,
  editorTitle: document.getElementById('editor-title'),
  editorLogin: document.getElementById('editor-login') as HTMLInputElement,
  editorBalance: document.getElementById('editor-balance') as HTMLInputElement,
  editorCancel: document.getElementById('editor-cancel'),
  shopDialog: document.getElementById('shop-dialog') as HTMLDialogElement,
  shopForm: document.getElementById('shop-form') as HTMLFormElement,
  shopEditorTitle: document.getElementById('shop-editor-title'),
  shopTrigger: document.getElementById('shop-trigger') as HTMLSelectElement,
  shopPrice: document.getElementById('shop-price') as HTMLInputElement,
  shopNameEn: document.getElementById('shop-name-en') as HTMLInputElement,
  shopNameRu: document.getElementById('shop-name-ru') as HTMLInputElement,
  shopNameUk: document.getElementById('shop-name-uk') as HTMLInputElement,
  shopDescriptionEn: document.getElementById('shop-description-en') as HTMLInputElement,
  shopCancel: document.getElementById('shop-cancel'),
};

/**
 * Performs authenticated fetch to addon HTTP endpoint.
 * @param path Endpoint path relative to addon base.
 * @param options Fetch options.
 */
const apiFetch = async (path: string, options?: RequestInit) => {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${apiBase}/${path}${separator}token=${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  return response.json();
};

const pickLocalized = (text: { en: string; ru?: string; uk?: string }) =>
  (lang === 'ru' && text.ru) || (lang === 'uk' && text.uk) || text.en;

/** Applies localized labels to static UI elements. */
const applyLocale = () => {
  if (el.title) el.title.textContent = t('title', lang);
  if (el.search) el.search.placeholder = t('search', lang);
  if (el.addViewer) el.addViewer.textContent = t('addViewer', lang);
  if (el.copyPageUrl) el.copyPageUrl.textContent = t('copy', lang);
  if (el.tabViewers) el.tabViewers.textContent = t('tabViewers', lang);
  if (el.tabShop) el.tabShop.textContent = t('tabShop', lang);
  if (el.addShopItem) el.addShopItem.textContent = t('addShopItem', lang);
  if (el.shopHint) el.shopHint.textContent = t('shopHint', lang);

  const sort = el.sort;
  if (sort?.options.length === 4) {
    sort.options[0].textContent = t('sortBalanceDesc', lang);
    sort.options[1].textContent = t('sortBalanceAsc', lang);
    sort.options[2].textContent = t('sortLoginAsc', lang);
    sort.options[3].textContent = t('sortLoginDesc', lang);
  }
};

/** Switches between viewers and shop panels. */
const setActiveTab = (tab: 'viewers' | 'shop') => {
  activeTab = tab;
  el.panelViewers?.classList.toggle('balance-panel--hidden', tab !== 'viewers');
  el.panelShop?.classList.toggle('balance-panel--hidden', tab !== 'shop');
  el.tabViewers?.classList.toggle('balance-tab--active', tab === 'viewers');
  el.tabShop?.classList.toggle('balance-tab--active', tab === 'shop');

  if (tab === 'shop' && state.shopItems.length === 0) {
    void reloadShop();
  }
};

/** Loads application state from worker endpoints. */
const loadState = async () => {
  const meta = await apiFetch('state');
  if (!meta.success) {
    throw new Error(meta.message ?? 'Failed to load state');
  }

  state.currency = meta.currency ?? 'USD';
  state.viewerPageUrl = meta.viewerPageUrl ?? '';
  if (el.viewerPageUrl) {
    el.viewerPageUrl.value = state.viewerPageUrl;
  }
  if (el.currencyLabel) {
    el.currencyLabel.textContent = `${t('currency', lang)}: ${state.currency}`;
  }

  await Promise.all([reloadViewers(), reloadShop()]);
};

/** Reloads viewer list using current search/sort controls. */
const reloadViewers = async () => {
  const search = el.search?.value.trim() ?? '';
  const sort = el.sort?.value ?? 'balance_desc';
  const query = new URLSearchParams({ search, sort });
  const result = await apiFetch(`viewers?${query.toString()}`);

  if (!result.success) {
    throw new Error(result.message ?? 'Failed to load viewers');
  }

  state.viewers = result.viewers ?? [];
  renderViewers();
};

/** Reloads shop items and trigger source options. */
const reloadShop = async () => {
  const [shopResult, sourcesResult] = await Promise.all([
    apiFetch('shop'),
    apiFetch('trigger-sources'),
  ]);

  if (!shopResult.success) {
    throw new Error(shopResult.message ?? 'Failed to load shop');
  }

  state.shopItems = shopResult.items ?? [];
  state.triggerSources = sourcesResult.success ? sourcesResult.options ?? [] : [];
  renderShop();
};

/** Renders viewer table rows. */
const renderViewers = () => {
  const body = el.viewersBody;
  if (!body) {
    return;
  }

  body.innerHTML = '';

  if (el.viewerCount) {
    el.viewerCount.textContent = `${state.viewers.length} viewers`;
  }

  if (state.viewers.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = t('empty', lang);
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  for (const viewer of state.viewers) {
    const row = document.createElement('tr');

    const loginCell = document.createElement('td');
    loginCell.textContent = viewer.login;
    row.appendChild(loginCell);

    const nameCell = document.createElement('td');
    nameCell.textContent = viewer.displayName || viewer.login;
    row.appendChild(nameCell);

    const balanceCell = document.createElement('td');
    balanceCell.textContent = `${viewer.balance.toFixed(2)} ${state.currency}`;
    row.appendChild(balanceCell);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'balance-row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = t('edit', lang);
    editBtn.addEventListener('click', () => openEditor(viewer));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-secondary';
    deleteBtn.textContent = t('delete', lang);
    deleteBtn.addEventListener('click', () => void deleteViewer(viewer));
    actions.appendChild(deleteBtn);

    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    body.appendChild(row);
  }
};

/** Renders shop table rows. */
const renderShop = () => {
  const body = el.shopBody;
  if (!body) {
    return;
  }

  body.innerHTML = '';

  if (state.shopItems.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = t('shopEmpty', lang);
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  for (const item of state.shopItems) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = pickLocalized(item.name);
    row.appendChild(nameCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = `${item.price.toFixed(2)} ${state.currency}`;
    row.appendChild(priceCell);

    const triggerCell = document.createElement('td');
    const triggerLabel =
      state.triggerSources.find(source => source.id === `${item.addonId}:${item.trigger.type}:${item.trigger.key ?? ''}:${String(item.trigger.value ?? '')}`)?.label ??
      `${item.addonId} · ${item.trigger.type}`;
    triggerCell.textContent = triggerLabel;
    row.appendChild(triggerCell);

    const systemsCell = document.createElement('td');
    const source = state.triggerSources.find(
      source =>
        source.addonId === item.addonId &&
        source.trigger.type === item.trigger.type &&
        source.trigger.key === item.trigger.key &&
        String(source.trigger.value ?? '') === String(item.trigger.value ?? '')
    );
    systemsCell.textContent = source?.systems.join(', ') ?? '—';
    row.appendChild(systemsCell);

    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'balance-row-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = t('edit', lang);
    editBtn.addEventListener('click', () => openShopEditor(item));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-secondary';
    deleteBtn.textContent = t('delete', lang);
    deleteBtn.addEventListener('click', () => void deleteShopItem(item));
    actions.appendChild(deleteBtn);

    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    body.appendChild(row);
  }
};

/**
 * Opens add/edit dialog for a viewer.
 * @param viewer Existing viewer or null for new entry.
 */
const openEditor = (viewer: ViewerRow | null) => {
  editingViewer = viewer;
  if (el.editorTitle) {
    el.editorTitle.textContent = viewer ? t('edit', lang) : t('addViewer', lang);
  }
  if (el.editorLogin) {
    el.editorLogin.value = viewer?.login ?? '';
    el.editorLogin.disabled = Boolean(viewer);
  }
  if (el.editorBalance) {
    el.editorBalance.value = String(viewer?.balance ?? 0);
  }
  el.editorDialog?.showModal();
};

/** Populates trigger source select options. */
const fillTriggerSourceSelect = (selectedId?: string) => {
  const select = el.shopTrigger;
  if (!select) {
    return;
  }

  select.innerHTML = '';

  if (state.triggerSources.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = t('shopEmpty', lang);
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  for (const source of state.triggerSources) {
    const option = document.createElement('option');
    option.value = source.id;
    option.textContent = `${source.label} [${source.systems.join(', ')}]`;
    if (source.id === selectedId) {
      option.selected = true;
    }
    select.appendChild(option);
  }
};

/**
 * Opens add/edit dialog for a shop item.
 * @param item Existing item or null for new entry.
 */
const openShopEditor = async (item: ShopItemRow | null) => {
  if (state.triggerSources.length === 0) {
    await reloadShop();
  }

  editingShopItem = item;
  if (el.shopEditorTitle) {
    el.shopEditorTitle.textContent = item ? t('edit', lang) : t('addShopItem', lang);
  }

  const sourceId = item
    ? `${item.addonId}:${item.trigger.type}:${item.trigger.key ?? ''}:${String(item.trigger.value ?? '')}`
    : undefined;
  fillTriggerSourceSelect(sourceId);

  if (el.shopPrice) el.shopPrice.value = String(item?.price ?? 0);
  if (el.shopNameEn) el.shopNameEn.value = item?.name.en ?? '';
  if (el.shopNameRu) el.shopNameRu.value = item?.name.ru ?? '';
  if (el.shopNameUk) el.shopNameUk.value = item?.name.uk ?? '';
  if (el.shopDescriptionEn) el.shopDescriptionEn.value = item?.description.en ?? '';

  el.shopDialog?.showModal();
};

/** Saves viewer from dialog form. */
const saveViewer = async () => {
  const login = el.editorLogin?.value.trim() ?? '';
  const balance = Number(el.editorBalance?.value);
  if (!login || !Number.isFinite(balance)) {
    return;
  }

  const result = await apiFetch('viewers', {
    method: 'POST',
    body: JSON.stringify({
      login,
      twitchId: editingViewer?.twitchId,
      balance,
      mode: 'set',
    }),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return;
  }

  el.editorDialog?.close();
  await reloadViewers();
};

/** Saves shop item from dialog form. */
const saveShopItem = async () => {
  const sourceId = el.shopTrigger?.value ?? '';
  const source = state.triggerSources.find(entry => entry.id === sourceId);
  const price = Number(el.shopPrice?.value);
  const nameEn = el.shopNameEn?.value.trim() ?? '';

  if (!source || !Number.isFinite(price) || price <= 0 || !nameEn) {
    return;
  }

  const payload = {
    id: editingShopItem?.id,
    addonId: source.addonId,
    catalogGroup:
      source.systems.includes('sounds') && !source.systems.includes('overlay')
        ? 'sounds'
        : 'addon',
    categoryId: editingShopItem?.categoryId ?? 'default',
    price,
    name: {
      en: nameEn,
      ru: el.shopNameRu?.value.trim() || undefined,
      uk: el.shopNameUk?.value.trim() || undefined,
    },
    description: {
      en: el.shopDescriptionEn?.value.trim() || nameEn,
      ru: editingShopItem?.description.ru,
      uk: editingShopItem?.description.uk,
    },
    trigger: source.trigger,
  };

  const result = await apiFetch('shop', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return;
  }

  el.shopDialog?.close();
  await reloadShop();
};

/** Deletes a viewer after confirmation. */
const deleteViewer = async (viewer: ViewerRow) => {
  if (!confirm(`${t('delete', lang)} ${viewer.login}?`)) {
    return;
  }

  const result = await apiFetch('viewers/delete', {
    method: 'POST',
    body: JSON.stringify({
      login: viewer.login,
      twitchId: viewer.twitchId,
    }),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return;
  }

  await reloadViewers();
};

/** Deletes a shop item after confirmation. */
const deleteShopItem = async (item: ShopItemRow) => {
  if (!confirm(`${t('delete', lang)} ${pickLocalized(item.name)}?`)) {
    return;
  }

  const result = await apiFetch('shop/delete', {
    method: 'POST',
    body: JSON.stringify({ id: item.id }),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return;
  }

  await reloadShop();
};

const bindEvents = () => {
  el.tabViewers?.addEventListener('click', () => setActiveTab('viewers'));
  el.tabShop?.addEventListener('click', () => setActiveTab('shop'));
  el.search?.addEventListener('input', () => {
    void reloadViewers();
  });
  el.sort?.addEventListener('change', () => {
    void reloadViewers();
  });
  el.addViewer?.addEventListener('click', () => openEditor(null));
  el.addShopItem?.addEventListener('click', () => void openShopEditor(null));
  el.editorCancel?.addEventListener('click', () => el.editorDialog?.close());
  el.shopCancel?.addEventListener('click', () => el.shopDialog?.close());
  el.editorForm?.addEventListener('submit', event => {
    event.preventDefault();
    void saveViewer();
  });
  el.shopForm?.addEventListener('submit', event => {
    event.preventDefault();
    void saveShopItem();
  });
  el.copyPageUrl?.addEventListener('click', async () => {
    if (!state.viewerPageUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(state.viewerPageUrl);
    } catch {
      el.viewerPageUrl?.select();
      document.execCommand('copy');
    }
  });
};

void (async () => {
  applyLocale();
  bindEvents();
  try {
    await loadState();
  } catch (error) {
    console.error(error);
    if (el.loadingCell) {
      el.loadingCell.textContent = t('error', lang);
    }
    if (el.shopLoadingCell) {
      el.shopLoadingCell.textContent = t('error', lang);
    }
  }
})();
