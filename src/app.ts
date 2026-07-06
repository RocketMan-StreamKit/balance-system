import { ADDON_ID } from './constants';
import { t, type UiLang } from './i18n';

type ViewerRow = {
  twitchId: string;
  login: string;
  displayName: string;
  balance: number;
};

type AppState = {
  currency: string;
  currencies: string[];
  viewerPageUrl: string;
  viewers: ViewerRow[];
};

type BulkAmountMode = 'add' | 'subtract';

const params = new URLSearchParams(window.location.search);
const token = params.get('token') ?? '';
const port = window.location.port;
const apiBase = `http://localhost:${port}/addon/${ADDON_ID}`;

let lang: UiLang = 'en';
const state: AppState = {
  currency: 'USD',
  currencies: [],
  viewerPageUrl: '',
  viewers: [],
};
const selectedIds = new Set<string>();
let editingViewer: ViewerRow | null = null;
let bulkAmountMode: BulkAmountMode = 'add';
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

const el = {
  title: document.getElementById('title'),
  currencyLabel: document.getElementById('currency-label'),
  viewerCount: document.getElementById('viewer-count'),
  viewerPageLabel: document.getElementById('viewer-page-label'),
  viewerPageUrl: document.getElementById('viewer-page-url') as HTMLInputElement,
  copyPageUrl: document.getElementById('copy-page-url'),
  openPageUrl: document.getElementById('open-page-url'),
  search: document.getElementById('search') as HTMLInputElement,
  sort: document.getElementById('sort') as HTMLSelectElement,
  addViewer: document.getElementById('add-viewer'),
  importStreamKit: document.getElementById('import-streamkit'),
  selectAll: document.getElementById('select-all') as HTMLInputElement,
  viewersBody: document.getElementById('viewers-body'),
  loadingCell: document.getElementById('loading-cell'),
  colLogin: document.getElementById('col-login'),
  colName: document.getElementById('col-name'),
  colBalance: document.getElementById('col-balance'),
  actionsHeader: document.getElementById('actions-header'),
  bulkBar: document.getElementById('bulk-bar'),
  bulkSelectedLabel: document.getElementById('bulk-selected-label'),
  bulkDelete: document.getElementById('bulk-delete'),
  bulkReset: document.getElementById('bulk-reset'),
  bulkAdd: document.getElementById('bulk-add'),
  bulkSubtract: document.getElementById('bulk-subtract'),
  bulkMerge: document.getElementById('bulk-merge'),
  editorDialog: document.getElementById('editor-dialog') as HTMLDialogElement,
  editorForm: document.getElementById('editor-form') as HTMLFormElement,
  editorTitle: document.getElementById('editor-title'),
  editorLogin: document.getElementById('editor-login') as HTMLInputElement,
  editorBalance: document.getElementById('editor-balance') as HTMLInputElement,
  editorAdjustSection: document.getElementById('editor-adjust-section'),
  editorCurrentBalance: document.getElementById('editor-current-balance'),
  editorAmountLabel: document.getElementById('editor-amount-label'),
  editorAmount: document.getElementById('editor-amount') as HTMLInputElement,
  editorAmountCurrencyLabel: document.getElementById(
    'editor-amount-currency-label'
  ),
  editorAmountCurrency: document.getElementById(
    'editor-amount-currency'
  ) as HTMLSelectElement,
  editorAdd: document.getElementById('editor-add'),
  editorSubtract: document.getElementById('editor-subtract'),
  editorCancel: document.getElementById('editor-cancel'),
  editorSave: document.getElementById('editor-save'),
  loginLabel: document.getElementById('login-label'),
  balanceLabel: document.getElementById('balance-label'),
  importDialog: document.getElementById('import-dialog') as HTMLDialogElement,
  importForm: document.getElementById('import-form') as HTMLFormElement,
  importTitle: document.getElementById('import-title'),
  importDescription: document.getElementById('import-description'),
  importCurrencyLabel: document.getElementById('import-currency-label'),
  importCurrency: document.getElementById(
    'import-currency'
  ) as HTMLSelectElement,
  importJsonLabel: document.getElementById('import-json-label'),
  importJson: document.getElementById('import-json') as HTMLTextAreaElement,
  importCancel: document.getElementById('import-cancel'),
  importSubmit: document.getElementById('import-submit'),
  bulkAmountDialog: document.getElementById(
    'bulk-amount-dialog'
  ) as HTMLDialogElement,
  bulkAmountForm: document.getElementById(
    'bulk-amount-form'
  ) as HTMLFormElement,
  bulkAmountTitle: document.getElementById('bulk-amount-title'),
  bulkAmountLabel: document.getElementById('bulk-amount-label'),
  bulkAmountCurrencyLabel: document.getElementById(
    'bulk-amount-currency-label'
  ),
  bulkAmountValue: document.getElementById(
    'bulk-amount-value'
  ) as HTMLInputElement,
  bulkAmountCurrency: document.getElementById(
    'bulk-amount-currency'
  ) as HTMLSelectElement,
  bulkAmountCancel: document.getElementById('bulk-amount-cancel'),
  bulkAmountSubmit: document.getElementById('bulk-amount-submit'),
  bulkMergeDialog: document.getElementById(
    'bulk-merge-dialog'
  ) as HTMLDialogElement,
  bulkMergeForm: document.getElementById('bulk-merge-form') as HTMLFormElement,
  bulkMergeTitle: document.getElementById('bulk-merge-title'),
  bulkMergeHint: document.getElementById('bulk-merge-hint'),
  bulkMergeIdLabel: document.getElementById('bulk-merge-id-label'),
  bulkMergeLoginLabel: document.getElementById('bulk-merge-login-label'),
  bulkMergeNameLabel: document.getElementById('bulk-merge-name-label'),
  bulkMergeBalanceLabel: document.getElementById('bulk-merge-balance-label'),
  bulkMergeId: document.getElementById('bulk-merge-id') as HTMLInputElement,
  bulkMergeLogin: document.getElementById(
    'bulk-merge-login'
  ) as HTMLInputElement,
  bulkMergeName: document.getElementById('bulk-merge-name') as HTMLInputElement,
  bulkMergeBalance: document.getElementById(
    'bulk-merge-balance'
  ) as HTMLInputElement,
  bulkMergeCancel: document.getElementById('bulk-merge-cancel'),
  bulkMergeSubmit: document.getElementById('bulk-merge-submit'),
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

/**
 * Opens a Twitch channel page in the system browser.
 * @param login Twitch login.
 */
const openTwitchProfile = async (login: string) => {
  const normalized = login.trim().toLowerCase();
  if (!normalized) {
    return;
  }

  const url = `https://www.twitch.tv/${normalized}`;
  const result = await apiFetch('open-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
  }
};

/** Opens the viewer page URL in the system browser. */
const openViewerPage = async () => {
  if (!state.viewerPageUrl) {
    return;
  }

  const result = await apiFetch('open-viewer-page', { method: 'POST' });
  if (!result.success) {
    alert(result.message ?? t('error', lang));
  }
};

/** Shows temporary feedback on the copy-link button. */
const showCopyFeedback = () => {
  if (!el.copyPageUrl) {
    return;
  }

  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
  }

  el.copyPageUrl.textContent = t('copied', lang);
  el.copyPageUrl.classList.add('secondary-action--copied');

  copyFeedbackTimer = setTimeout(() => {
    copyFeedbackTimer = null;
    if (el.copyPageUrl) {
      el.copyPageUrl.textContent = t('copy', lang);
      el.copyPageUrl.classList.remove('secondary-action--copied');
    }
  }, 2000);
};

/**
 * Applies app theme from settings to the document root.
 * @param themeScheme Theme scheme from app config.
 */
const applyTheme = (themeScheme: string) => {
  const root = document.documentElement;
  const effective =
    themeScheme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : themeScheme === 'light'
        ? 'light'
        : 'dark';

  if (effective === 'light') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', 'dark');
  }
};

/** Fills a currency select with supported codes. */
const fillCurrencySelect = (
  select: HTMLSelectElement | null,
  currencies: string[],
  preferred?: string
) => {
  if (!select) {
    return;
  }

  const current = select.value;
  select.innerHTML = '';
  for (const code of currencies) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    select.appendChild(option);
  }

  const fallback = preferred ?? state.currency;
  if (current && currencies.includes(current)) {
    select.value = current;
  } else if (currencies.includes(fallback)) {
    select.value = fallback;
  }
};

/** Returns currently selected viewer rows in list order. */
const getSelectedViewers = () =>
  state.viewers.filter(viewer => selectedIds.has(viewer.twitchId));

/** Builds API payload references for selected viewers. */
const getSelectedTargets = () =>
  getSelectedViewers().map(viewer => ({
    twitchId: viewer.twitchId,
    login: viewer.login,
  }));

/** Clears row selection and refreshes bulk UI. */
const clearSelection = () => {
  selectedIds.clear();
  if (el.selectAll) {
    el.selectAll.checked = false;
    el.selectAll.indeterminate = false;
  }
  updateBulkBar();
};

/** Updates bulk action bar visibility and labels. */
const updateBulkBar = () => {
  const count = selectedIds.size;
  const visible = count > 0;

  if (el.bulkBar) {
    el.bulkBar.hidden = !visible;
    el.bulkBar.classList.toggle('balance-bulk-bar--hidden', !visible);
  }

  if (el.bulkSelectedLabel) {
    el.bulkSelectedLabel.textContent = t('bulkSelected', lang, { count });
  }

  if (el.bulkMerge) {
    el.bulkMerge.disabled = count < 2;
  }

  if (el.selectAll && state.viewers.length > 0) {
    const visibleSelected = state.viewers.filter(viewer =>
      selectedIds.has(viewer.twitchId)
    ).length;
    el.selectAll.checked = visibleSelected === state.viewers.length;
    el.selectAll.indeterminate =
      visibleSelected > 0 && visibleSelected < state.viewers.length;
  }
};

/** Applies localized labels to static UI elements. */
const applyLocale = () => {
  document.documentElement.lang = lang;

  if (el.title) el.title.textContent = t('title', lang);
  if (el.search) el.search.placeholder = t('search', lang);
  if (el.addViewer) el.addViewer.textContent = t('addViewer', lang);
  if (el.importStreamKit)
    el.importStreamKit.textContent = t('importStreamKit', lang);
  if (el.copyPageUrl && !copyFeedbackTimer) {
    el.copyPageUrl.textContent = t('copy', lang);
  }
  if (el.openPageUrl) {
    const openLabel = t('openInBrowser', lang);
    el.openPageUrl.setAttribute('aria-label', openLabel);
    el.openPageUrl.setAttribute('title', openLabel);
  }
  if (el.viewerPageLabel)
    el.viewerPageLabel.textContent = t('viewerPage', lang);
  if (el.colLogin) el.colLogin.textContent = t('columnLogin', lang);
  if (el.colName) el.colName.textContent = t('name', lang);
  if (el.colBalance) el.colBalance.textContent = t('balance', lang);
  if (el.actionsHeader) el.actionsHeader.textContent = t('actions', lang);
  if (el.loginLabel) el.loginLabel.textContent = t('login', lang);
  if (el.balanceLabel) el.balanceLabel.textContent = t('balance', lang);
  if (el.editorCancel) el.editorCancel.textContent = t('cancel', lang);
  if (el.editorSave) el.editorSave.textContent = t('save', lang);
  if (el.editorAmountLabel) {
    el.editorAmountLabel.textContent = t('bulkAmountLabel', lang);
  }
  if (el.editorAmountCurrencyLabel) {
    el.editorAmountCurrencyLabel.textContent = t('bulkAmountCurrency', lang);
  }
  if (el.editorAdd) el.editorAdd.textContent = t('bulkAdd', lang);
  if (el.editorSubtract)
    el.editorSubtract.textContent = t('bulkSubtract', lang);
  if (el.importTitle) el.importTitle.textContent = t('importTitle', lang);
  if (el.importDescription) {
    el.importDescription.textContent = t('importDescription', lang);
  }
  if (el.importCurrencyLabel) {
    el.importCurrencyLabel.textContent = t('importCurrency', lang);
  }
  if (el.importJsonLabel)
    el.importJsonLabel.textContent = t('importJson', lang);
  if (el.importCancel) el.importCancel.textContent = t('cancel', lang);
  if (el.importSubmit) el.importSubmit.textContent = t('importSubmit', lang);
  if (el.bulkDelete) el.bulkDelete.textContent = t('bulkDelete', lang);
  if (el.bulkReset) el.bulkReset.textContent = t('bulkReset', lang);
  if (el.bulkAdd) el.bulkAdd.textContent = t('bulkAdd', lang);
  if (el.bulkSubtract) el.bulkSubtract.textContent = t('bulkSubtract', lang);
  if (el.bulkMerge) el.bulkMerge.textContent = t('bulkMerge', lang);
  if (el.bulkAmountLabel)
    el.bulkAmountLabel.textContent = t('bulkAmountLabel', lang);
  if (el.bulkAmountCurrencyLabel) {
    el.bulkAmountCurrencyLabel.textContent = t('bulkAmountCurrency', lang);
  }
  if (el.bulkAmountCancel) el.bulkAmountCancel.textContent = t('cancel', lang);
  if (el.bulkAmountSubmit) {
    el.bulkAmountSubmit.textContent = t('bulkAmountApply', lang);
  }
  if (el.bulkMergeTitle)
    el.bulkMergeTitle.textContent = t('bulkMergeTitle', lang);
  if (el.bulkMergeHint) el.bulkMergeHint.textContent = t('bulkMergeHint', lang);
  if (el.bulkMergeIdLabel)
    el.bulkMergeIdLabel.textContent = t('twitchId', lang);
  if (el.bulkMergeLoginLabel) {
    el.bulkMergeLoginLabel.textContent = t('columnLogin', lang);
  }
  if (el.bulkMergeNameLabel) {
    el.bulkMergeNameLabel.textContent = t('displayName', lang);
  }
  if (el.bulkMergeBalanceLabel) {
    el.bulkMergeBalanceLabel.textContent = t('balance', lang);
  }
  if (el.bulkMergeCancel) el.bulkMergeCancel.textContent = t('cancel', lang);
  if (el.bulkMergeSubmit) {
    el.bulkMergeSubmit.textContent = t('bulkMergeApply', lang);
  }

  if (el.bulkAmountTitle) {
    el.bulkAmountTitle.textContent =
      bulkAmountMode === 'add'
        ? t('bulkAmountTitleAdd', lang)
        : t('bulkAmountTitleSubtract', lang);
  }

  const sort = el.sort;
  if (sort?.options.length === 4) {
    sort.options[0].textContent = t('sortBalanceDesc', lang);
    sort.options[1].textContent = t('sortBalanceAsc', lang);
    sort.options[2].textContent = t('sortLoginAsc', lang);
    sort.options[3].textContent = t('sortLoginDesc', lang);
  }

  updateBulkBar();
};

/** Loads application state from worker endpoints. */
const loadState = async () => {
  const meta = await apiFetch('state');
  if (!meta.success) {
    throw new Error(meta.message ?? 'Failed to load state');
  }

  if (meta.lang === 'ru' || meta.lang === 'uk' || meta.lang === 'en') {
    lang = meta.lang;
  }

  applyTheme(typeof meta.themeScheme === 'string' ? meta.themeScheme : 'dark');
  applyLocale();

  state.currency = meta.currency ?? 'USD';
  state.currencies = Array.isArray(meta.currencies) ? meta.currencies : [];
  state.viewerPageUrl = meta.viewerPageUrl ?? '';
  fillCurrencySelect(el.importCurrency, state.currencies);
  fillCurrencySelect(el.bulkAmountCurrency, state.currencies);

  if (el.viewerPageUrl) {
    el.viewerPageUrl.value = state.viewerPageUrl;
  }
  if (el.currencyLabel) {
    el.currencyLabel.textContent = `${t('currency', lang)}: ${state.currency}`;
  }

  await reloadViewers();
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

  for (const id of [...selectedIds]) {
    if (!state.viewers.some(viewer => viewer.twitchId === id)) {
      selectedIds.delete(id);
    }
  }

  renderViewers();
};

/** Renders viewer table rows. */
const renderViewers = () => {
  const body = el.viewersBody;
  if (!body) {
    return;
  }

  body.innerHTML = '';

  if (el.viewerCount) {
    el.viewerCount.textContent = t('viewerCount', lang, {
      count: state.viewers.length,
    });
  }

  if (state.viewers.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = t('empty', lang);
    row.appendChild(cell);
    body.appendChild(row);
    updateBulkBar();
    return;
  }

  for (const viewer of state.viewers) {
    const row = document.createElement('tr');
    row.className = 'balance-viewer-row';
    row.title = `https://www.twitch.tv/${viewer.login}`;
    row.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('input, button, .balance-row-actions')) {
        return;
      }
      void openTwitchProfile(viewer.login);
    });

    const selectCell = document.createElement('td');
    selectCell.className = 'balance-col-select';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIds.has(viewer.twitchId);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedIds.add(viewer.twitchId);
      } else {
        selectedIds.delete(viewer.twitchId);
      }
      updateBulkBar();
    });
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

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
    editBtn.className = 'secondary-action';
    editBtn.textContent = t('edit', lang);
    editBtn.addEventListener('click', () => openEditor(viewer));
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'secondary-action';
    deleteBtn.textContent = t('delete', lang);
    deleteBtn.addEventListener('click', () => void deleteViewer(viewer));
    actions.appendChild(deleteBtn);

    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    body.appendChild(row);
  }

  updateBulkBar();
};

/**
 * Sends a bulk action to the worker API.
 * @param payload Bulk action body.
 */
const runBulkAction = async (payload: Record<string, unknown>) => {
  const result = await apiFetch('viewers/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return false;
  }

  clearSelection();
  await reloadViewers();
  return true;
};

/** Opens add/subtract balance dialog for selected viewers. */
const openBulkAmountDialog = (mode: BulkAmountMode) => {
  bulkAmountMode = mode;
  if (el.bulkAmountTitle) {
    el.bulkAmountTitle.textContent =
      mode === 'add'
        ? t('bulkAmountTitleAdd', lang)
        : t('bulkAmountTitleSubtract', lang);
  }
  if (el.bulkAmountValue) {
    el.bulkAmountValue.value = '';
  }
  fillCurrencySelect(el.bulkAmountCurrency, state.currencies, state.currency);
  el.bulkAmountDialog?.showModal();
};

/** Opens merge dialog prefilled from the first selected viewer. */
const openBulkMergeDialog = () => {
  const selected = getSelectedViewers();
  if (selected.length < 2) {
    return;
  }

  const first = selected[0];
  const summed = selected.reduce((sum, viewer) => sum + viewer.balance, 0);

  if (el.bulkMergeId) el.bulkMergeId.value = first.twitchId;
  if (el.bulkMergeLogin) el.bulkMergeLogin.value = first.login;
  if (el.bulkMergeName) {
    el.bulkMergeName.value = first.displayName || first.login;
  }
  if (el.bulkMergeBalance) {
    el.bulkMergeBalance.value = summed.toFixed(2);
  }

  el.bulkMergeDialog?.showModal();
};

const setEditorAdjustVisible = (visible: boolean) => {
  el.editorAdjustSection?.classList.toggle('balance-panel--hidden', !visible);
  if (el.editorAdjustSection) {
    el.editorAdjustSection.hidden = !visible;
  }
  if (el.editorAdd) {
    el.editorAdd.hidden = !visible;
  }
  if (el.editorSubtract) {
    el.editorSubtract.hidden = !visible;
  }
};

/**
 * Opens add/edit dialog for a viewer.
 * @param viewer Existing viewer or null for new entry.
 */
const openEditor = (viewer: ViewerRow | null) => {
  editingViewer = viewer;
  const isEdit = Boolean(viewer);

  if (el.editorTitle) {
    el.editorTitle.textContent = viewer
      ? t('edit', lang)
      : t('addViewer', lang);
  }
  if (el.editorLogin) {
    el.editorLogin.value = viewer?.login ?? '';
    el.editorLogin.disabled = isEdit;
  }
  if (el.editorBalance) {
    el.editorBalance.value = String(viewer?.balance ?? 0);
  }
  if (el.editorCurrentBalance && viewer) {
    el.editorCurrentBalance.textContent = `${t('balance', lang)}: ${viewer.balance.toFixed(2)} ${state.currency}`;
  }
  if (el.editorAmount) {
    el.editorAmount.value = '';
  }
  fillCurrencySelect(el.editorAmountCurrency, state.currencies, state.currency);
  setEditorAdjustVisible(isEdit);
  el.editorDialog?.showModal();
};

/** Opens StreamKit legacy import dialog. */
const openImportDialog = () => {
  if (el.importJson) {
    el.importJson.value = '';
  }
  fillCurrencySelect(el.importCurrency, state.currencies);
  el.importDialog?.showModal();
};

/** Saves viewer from dialog form. */
const saveViewer = async () => {
  const login = el.editorLogin?.value.trim() ?? '';
  const balance = Math.round(Number(el.editorBalance?.value) * 100) / 100;
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

/**
 * Adds or subtracts balance for the viewer being edited.
 * @param mode Adjustment direction.
 */
const adjustViewerBalance = async (mode: 'add' | 'subtract') => {
  if (!editingViewer) {
    return;
  }

  const amount = Number(el.editorAmount?.value);
  const sourceCurrency = el.editorAmountCurrency?.value ?? '';
  if (!Number.isFinite(amount) || amount <= 0 || !sourceCurrency) {
    return;
  }

  const result = await apiFetch('viewers', {
    method: 'POST',
    body: JSON.stringify({
      login: editingViewer.login,
      twitchId: editingViewer.twitchId,
      balance: amount,
      mode,
      sourceCurrency,
    }),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return;
  }

  el.editorDialog?.close();
  await reloadViewers();
};

/** Imports viewers from legacy StreamKit JSON. */
const importLegacyViewers = async () => {
  const rawJson = el.importJson?.value.trim() ?? '';
  const sourceCurrency = el.importCurrency?.value ?? '';
  if (!rawJson || !sourceCurrency) {
    return;
  }

  const result = await apiFetch('viewers/import', {
    method: 'POST',
    body: JSON.stringify({ json: rawJson, sourceCurrency }),
  });

  if (!result.success) {
    alert(result.message ?? t('error', lang));
    return;
  }

  el.importDialog?.close();
  alert(
    t('importSuccess', lang, {
      imported: result.imported ?? 0,
      skipped: result.skipped ?? 0,
    })
  );
  await reloadViewers();
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

  selectedIds.delete(viewer.twitchId);
  await reloadViewers();
};

/** Applies add/subtract bulk amount from dialog. */
const submitBulkAmount = async () => {
  const amount = Number(el.bulkAmountValue?.value);
  const sourceCurrency = el.bulkAmountCurrency?.value ?? '';
  if (!Number.isFinite(amount) || amount <= 0 || !sourceCurrency) {
    return;
  }

  const ok = await runBulkAction({
    action: bulkAmountMode,
    targets: getSelectedTargets(),
    amount,
    sourceCurrency,
  });

  if (ok) {
    el.bulkAmountDialog?.close();
  }
};

/** Applies merge bulk action from dialog. */
const submitBulkMerge = async () => {
  const twitchId = el.bulkMergeId?.value.trim() ?? '';
  const login = el.bulkMergeLogin?.value.trim() ?? '';
  const displayName = el.bulkMergeName?.value.trim() ?? '';
  const balance = Number(el.bulkMergeBalance?.value);

  if (!twitchId || !login || !displayName || !Number.isFinite(balance)) {
    return;
  }

  const ok = await runBulkAction({
    action: 'merge',
    targets: getSelectedTargets(),
    merge: { twitchId, login, displayName, balance },
  });

  if (ok) {
    el.bulkMergeDialog?.close();
  }
};

/** Returns true when a modal dialog is open and polling should pause. */
const isDialogOpen = () =>
  Boolean(
    el.editorDialog?.open ||
      el.importDialog?.open ||
      el.bulkAmountDialog?.open ||
      el.bulkMergeDialog?.open
  );

/** Polls worker state and viewer list, refreshing UI when data changes. */
const refreshAppData = async () => {
  if (isDialogOpen()) {
    return;
  }

  try {
    const meta = await apiFetch('state');
    if (!meta.success) {
      return;
    }

    const nextLang =
      meta.lang === 'ru' || meta.lang === 'uk' || meta.lang === 'en'
        ? meta.lang
        : lang;
    const themeScheme =
      typeof meta.themeScheme === 'string' ? meta.themeScheme : 'dark';
    const nextCurrency =
      typeof meta.currency === 'string' ? meta.currency : state.currency;
    const nextViewerPageUrl =
      typeof meta.viewerPageUrl === 'string'
        ? meta.viewerPageUrl
        : state.viewerPageUrl;

    const langChanged = nextLang !== lang;
    const currencyChanged = nextCurrency !== state.currency;
    const viewerPageChanged = nextViewerPageUrl !== state.viewerPageUrl;

    lang = nextLang;
    applyTheme(themeScheme);

    if (langChanged) {
      applyLocale();
    }

    if (currencyChanged) {
      state.currency = nextCurrency;
      if (el.currencyLabel) {
        el.currencyLabel.textContent = `${t('currency', lang)}: ${state.currency}`;
      }
      fillCurrencySelect(el.importCurrency, state.currencies);
      fillCurrencySelect(el.bulkAmountCurrency, state.currencies);
      fillCurrencySelect(el.editorAmountCurrency, state.currencies);
    }

    if (viewerPageChanged) {
      state.viewerPageUrl = nextViewerPageUrl;
      if (el.viewerPageUrl) {
        el.viewerPageUrl.value = state.viewerPageUrl;
      }
    }

    const search = el.search?.value.trim() ?? '';
    const sort = el.sort?.value ?? 'balance_desc';
    const query = new URLSearchParams({ search, sort });
    const viewersResult = await apiFetch(`viewers?${query.toString()}`);

    if (viewersResult.success) {
      const nextViewers = viewersResult.viewers ?? [];
      const viewersChanged =
        JSON.stringify(state.viewers) !== JSON.stringify(nextViewers);

      if (viewersChanged) {
        state.viewers = nextViewers;

        for (const id of [...selectedIds]) {
          if (!state.viewers.some(viewer => viewer.twitchId === id)) {
            selectedIds.delete(id);
          }
        }

        renderViewers();
      } else if (currencyChanged) {
        renderViewers();
      }
    } else if (langChanged || currencyChanged) {
      renderViewers();
    }
  } catch {
    // ignore polling errors
  }
};

const bindEvents = () => {
  el.search?.addEventListener('input', () => {
    void reloadViewers();
  });
  el.sort?.addEventListener('change', () => {
    void reloadViewers();
  });
  el.selectAll?.addEventListener('change', () => {
    const checked = el.selectAll?.checked ?? false;
    if (checked) {
      for (const viewer of state.viewers) {
        selectedIds.add(viewer.twitchId);
      }
    } else {
      for (const viewer of state.viewers) {
        selectedIds.delete(viewer.twitchId);
      }
    }
    renderViewers();
  });
  el.addViewer?.addEventListener('click', () => openEditor(null));
  el.importStreamKit?.addEventListener('click', openImportDialog);
  el.editorCancel?.addEventListener('click', () => el.editorDialog?.close());
  el.editorAdd?.addEventListener(
    'click',
    () => void adjustViewerBalance('add')
  );
  el.editorSubtract?.addEventListener(
    'click',
    () => void adjustViewerBalance('subtract')
  );
  el.importCancel?.addEventListener('click', () => el.importDialog?.close());
  el.bulkAmountCancel?.addEventListener('click', () =>
    el.bulkAmountDialog?.close()
  );
  el.bulkMergeCancel?.addEventListener('click', () =>
    el.bulkMergeDialog?.close()
  );
  el.editorForm?.addEventListener('submit', event => {
    event.preventDefault();
    void saveViewer();
  });
  el.importForm?.addEventListener('submit', event => {
    event.preventDefault();
    void importLegacyViewers();
  });
  el.bulkAmountForm?.addEventListener('submit', event => {
    event.preventDefault();
    void submitBulkAmount();
  });
  el.bulkMergeForm?.addEventListener('submit', event => {
    event.preventDefault();
    void submitBulkMerge();
  });
  el.bulkDelete?.addEventListener('click', () => {
    const count = selectedIds.size;
    if (!count || !confirm(t('bulkDeleteConfirm', lang, { count }))) {
      return;
    }
    void runBulkAction({ action: 'delete', targets: getSelectedTargets() });
  });
  el.bulkReset?.addEventListener('click', () => {
    const count = selectedIds.size;
    if (!count || !confirm(t('bulkResetConfirm', lang, { count }))) {
      return;
    }
    void runBulkAction({ action: 'reset', targets: getSelectedTargets() });
  });
  el.bulkAdd?.addEventListener('click', () => openBulkAmountDialog('add'));
  el.bulkSubtract?.addEventListener('click', () =>
    openBulkAmountDialog('subtract')
  );
  el.bulkMerge?.addEventListener('click', openBulkMergeDialog);
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
    showCopyFeedback();
  });
  el.openPageUrl?.addEventListener('click', () => {
    void openViewerPage();
  });
  window.addEventListener('focus', () => {
    void refreshAppData();
  });
  window.setInterval(() => {
    void refreshAppData();
  }, 3000);
};

void (async () => {
  bindEvents();
  try {
    await loadState();
  } catch (error) {
    console.error(error);
    if (el.loadingCell) {
      el.loadingCell.textContent = t('error', lang);
    }
  }
})();
