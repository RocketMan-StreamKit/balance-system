import { ADDON_ID, VIEWERS_PAGE_SIZE } from './constants';
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
  totalViewers: number;
  hasMoreViewers: boolean;
};

type BulkAmountMode = 'add' | 'subtract';

const MERGE_SOURCE_MANUAL = '__manual__';
const MERGE_SOURCE_SUM = '__sum__';

type MergeFieldKey = 'id' | 'login' | 'name' | 'balance';

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
  totalViewers: 0,
  hasMoreViewers: false,
};
const selectedIds = new Set<string>();
let editingViewer: ViewerRow | null = null;
let bulkAmountMode: BulkAmountMode = 'add';
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
let bulkMergeViewers: ViewerRow[] = [];
let mergeFieldUpdating = false;
let loadingMoreViewers = false;
let loadMoreObserver: IntersectionObserver | null = null;

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
  viewersTable: document.getElementById('viewers-table'),
  viewersBody: document.getElementById('viewers-body'),
  loadingCell: document.getElementById('loading-cell'),
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
  bulkMergeIdSource: document.getElementById(
    'bulk-merge-id-source'
  ) as HTMLSelectElement,
  bulkMergeLoginSource: document.getElementById(
    'bulk-merge-login-source'
  ) as HTMLSelectElement,
  bulkMergeNameSource: document.getElementById(
    'bulk-merge-name-source'
  ) as HTMLSelectElement,
  bulkMergeBalanceSource: document.getElementById(
    'bulk-merge-balance-source'
  ) as HTMLSelectElement,
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

type MergeFieldConfig = {
  key: MergeFieldKey;
  input: HTMLInputElement | null;
  source: HTMLSelectElement | null;
};

/** Returns merge dialog field bindings. */
const getMergeFieldConfigs = (): MergeFieldConfig[] => [
  { key: 'id', input: el.bulkMergeId, source: el.bulkMergeIdSource },
  { key: 'login', input: el.bulkMergeLogin, source: el.bulkMergeLoginSource },
  { key: 'name', input: el.bulkMergeName, source: el.bulkMergeNameSource },
  {
    key: 'balance',
    input: el.bulkMergeBalance,
    source: el.bulkMergeBalanceSource,
  },
];

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

  if (el.bulkMerge && el.bulkMerge instanceof HTMLButtonElement) {
    el.bulkMerge.disabled = count < 2;
  }

  if (el.selectAll && state.viewers.length > 0) {
    const visibleSelected = state.viewers.filter(viewer =>
      selectedIds.has(viewer.twitchId)
    ).length;
    el.selectAll.checked = visibleSelected === state.viewers.length;
    el.selectAll.indeterminate =
      visibleSelected > 0 && visibleSelected < state.viewers.length;
  } else if (el.selectAll) {
    el.selectAll.checked = false;
    el.selectAll.indeterminate = false;
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
  if (bulkMergeViewers.length >= 2) {
    refreshBulkMergeSourceSelects();
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

/**
 * Builds the combined viewer label for the balance table.
 * Shows login in parentheses when it differs from the display name (case-insensitive).
 * @param viewer Viewer row.
 */
const formatViewerDisplayLabel = (viewer: ViewerRow) => {
  const login = viewer.login.trim();
  const name = (viewer.displayName?.trim() || login).trim();
  return name.toLowerCase() !== login.toLowerCase()
    ? `${name} (${login})`
    : name;
};

/** Builds a readable label for a viewer in merge source selectors. */
const formatMergeViewerLabel = (viewer: ViewerRow) => {
  const name = viewer.displayName?.trim();
  return name && name.toLowerCase() !== viewer.login.toLowerCase()
    ? `${viewer.login} (${name})`
    : viewer.login;
};

/**
 * Fills a merge source select with viewer options.
 * @param select Target select element.
 * @param viewers Selected viewers for the merge dialog.
 * @param options Optional sum preset for balance field.
 */
const fillMergeSourceSelect = (
  select: HTMLSelectElement | null,
  viewers: ViewerRow[],
  options: { includeSum?: boolean } = {}
) => {
  if (!select) {
    return;
  }

  const current = select.value;
  select.innerHTML = '';

  if (options.includeSum) {
    const sumOption = document.createElement('option');
    sumOption.value = MERGE_SOURCE_SUM;
    sumOption.textContent = t('bulkMergeBalanceSum', lang);
    select.appendChild(sumOption);
  }

  for (const viewer of viewers) {
    const option = document.createElement('option');
    option.value = viewer.twitchId;
    option.textContent = formatMergeViewerLabel(viewer);
    select.appendChild(option);
  }

  const manualOption = document.createElement('option');
  manualOption.value = MERGE_SOURCE_MANUAL;
  manualOption.textContent = t('bulkMergeManual', lang);
  select.appendChild(manualOption);

  if ([...select.options].some(option => option.value === current)) {
    select.value = current;
  }
};

/** Refreshes merge source selectors while preserving current values. */
const refreshBulkMergeSourceSelects = () => {
  for (const field of getMergeFieldConfigs()) {
    const savedSource = field.source?.value ?? '';
    fillMergeSourceSelect(field.source, bulkMergeViewers, {
      includeSum: field.key === 'balance',
    });
    if (field.source && savedSource) {
      field.source.value = savedSource;
    }
  }
};

/**
 * Resolves a merge field value from the selected source.
 * @param field Merge field key.
 * @param sourceValue Selected source option value.
 * @param viewers Selected viewers for the merge dialog.
 */
const getMergeFieldValue = (
  field: MergeFieldKey,
  sourceValue: string,
  viewers: ViewerRow[]
) => {
  if (sourceValue === MERGE_SOURCE_SUM) {
    return viewers.reduce((sum, viewer) => sum + viewer.balance, 0).toFixed(2);
  }

  const viewer = viewers.find(item => item.twitchId === sourceValue);
  if (!viewer) {
    return '';
  }

  switch (field) {
    case 'id':
      return viewer.twitchId;
    case 'login':
      return viewer.login;
    case 'name':
      return viewer.displayName || viewer.login;
    case 'balance':
      return viewer.balance.toFixed(2);
  }
};

/** Applies the selected source value to a merge dialog field. */
const applyMergeFieldFromSource = (field: MergeFieldConfig) => {
  const sourceValue = field.source?.value ?? '';
  if (!field.input || sourceValue === MERGE_SOURCE_MANUAL) {
    return;
  }

  const value = getMergeFieldValue(field.key, sourceValue, bulkMergeViewers);
  if (!value) {
    return;
  }

  mergeFieldUpdating = true;
  field.input.value = value;
  mergeFieldUpdating = false;
};

/** Switches a merge field source selector to manual mode. */
const setMergeFieldManual = (field: MergeFieldConfig) => {
  if (field.source) {
    field.source.value = MERGE_SOURCE_MANUAL;
  }
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

type ViewersPageResult = {
  viewers: ViewerRow[];
  total: number;
  hasMore: boolean;
};

/**
 * Fetches a viewer list page from the worker API.
 * Search and sort are applied on the server across the full viewer list.
 * @param offset Zero-based page offset.
 * @param limit Maximum rows to return.
 */
const fetchViewersPage = async (
  offset: number,
  limit: number
): Promise<ViewersPageResult> => {
  const search = el.search?.value.trim() ?? '';
  const sort = el.sort?.value ?? 'balance_desc';
  const query = new URLSearchParams({
    search,
    sort,
    limit: String(limit),
    offset: String(offset),
  });
  const result = await apiFetch(`viewers?${query.toString()}`);

  if (!result.success) {
    throw new Error(result.message ?? 'Failed to load viewers');
  }

  return {
    viewers: result.viewers ?? [],
    total:
      typeof result.total === 'number'
        ? result.total
        : (result.viewers?.length ?? 0),
    hasMore: Boolean(result.hasMore),
  };
};

/** Reloads viewer list using current search/sort controls (first page). */
const reloadViewers = async () => {
  const page = await fetchViewersPage(0, VIEWERS_PAGE_SIZE);
  state.viewers = page.viewers;
  state.totalViewers = page.total;
  state.hasMoreViewers = page.hasMore;

  for (const id of [...selectedIds]) {
    if (!state.viewers.some(viewer => viewer.twitchId === id)) {
      selectedIds.delete(id);
    }
  }

  renderViewers();
};

/** Appends the next viewer page when the table sentinel becomes visible. */
const loadMoreViewers = async () => {
  if (!state.hasMoreViewers || loadingMoreViewers) {
    return;
  }

  loadingMoreViewers = true;
  renderViewers();

  try {
    const page = await fetchViewersPage(
      state.viewers.length,
      VIEWERS_PAGE_SIZE
    );
    state.viewers = [...state.viewers, ...page.viewers];
    state.totalViewers = page.total;
    state.hasMoreViewers = page.hasMore;
  } finally {
    loadingMoreViewers = false;
    renderViewers();
  }
};

/** Observes the table sentinel row to trigger lazy loading. */
const setupLoadMoreObserver = (sentinel: HTMLElement) => {
  const root = el.viewersTable;
  if (!root) {
    return;
  }

  loadMoreObserver?.disconnect();
  loadMoreObserver = new IntersectionObserver(
    entries => {
      if (
        entries.some(entry => entry.isIntersecting) &&
        state.hasMoreViewers &&
        !loadingMoreViewers
      ) {
        void loadMoreViewers();
      }
    },
    { root, rootMargin: '120px' }
  );
  loadMoreObserver.observe(sentinel);
};

/** Disconnects lazy-load observer when the sentinel is removed. */
const teardownLoadMoreObserver = () => {
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
};

/** Renders viewer table rows. */
const renderViewers = () => {
  const body = el.viewersBody;
  if (!body) {
    return;
  }

  body.innerHTML = '';
  teardownLoadMoreObserver();

  if (el.viewerCount) {
    el.viewerCount.textContent = t('viewerCount', lang, {
      count: state.totalViewers,
    });
  }

  if (state.viewers.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = t('empty', lang);
    row.appendChild(cell);
    body.appendChild(row);
    updateBulkBar();
    return;
  }

  for (const viewer of state.viewers) {
    const row = document.createElement('tr');
    row.className = 'balance-viewer-row';

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

    const nameCell = document.createElement('td');
    const nameLink = document.createElement('span');
    nameLink.className = 'balance-viewer-link';
    nameLink.textContent = formatViewerDisplayLabel(viewer);
    nameLink.title = `https://www.twitch.tv/${viewer.login}`;
    nameLink.addEventListener('click', () => {
      void openTwitchProfile(viewer.login);
    });
    nameCell.appendChild(nameLink);
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

  if (state.hasMoreViewers) {
    const statusRow = document.createElement('tr');
    statusRow.className = 'balance-load-more-sentinel';
    const statusCell = document.createElement('td');
    statusCell.colSpan = 4;
    if (loadingMoreViewers) {
      statusCell.className = 'balance-load-more-cell';
      statusCell.textContent = t('loadingMore', lang);
    }
    statusRow.appendChild(statusCell);
    body.appendChild(statusRow);
    setupLoadMoreObserver(statusRow);
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

  bulkMergeViewers = selected;
  refreshBulkMergeSourceSelects();

  const first = selected[0];
  const summed = selected.reduce((sum, viewer) => sum + viewer.balance, 0);

  if (el.bulkMergeIdSource) {
    el.bulkMergeIdSource.value = first.twitchId;
  }
  if (el.bulkMergeLoginSource) {
    el.bulkMergeLoginSource.value = first.twitchId;
  }
  if (el.bulkMergeNameSource) {
    el.bulkMergeNameSource.value = first.twitchId;
  }
  if (el.bulkMergeBalanceSource) {
    el.bulkMergeBalanceSource.value = MERGE_SOURCE_SUM;
  }

  mergeFieldUpdating = true;
  if (el.bulkMergeId) {
    el.bulkMergeId.value = first.twitchId;
  }
  if (el.bulkMergeLogin) {
    el.bulkMergeLogin.value = first.login;
  }
  if (el.bulkMergeName) {
    el.bulkMergeName.value = first.displayName || first.login;
  }
  if (el.bulkMergeBalance) {
    el.bulkMergeBalance.value = summed.toFixed(2);
  }
  mergeFieldUpdating = false;

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

    const loadedCount = Math.max(state.viewers.length, VIEWERS_PAGE_SIZE);
    const page = await fetchViewersPage(0, loadedCount);
    const nextViewers = page.viewers;
    const viewersChanged =
      JSON.stringify(state.viewers) !== JSON.stringify(nextViewers);
    const totalChanged = state.totalViewers !== page.total;

    if (viewersChanged || totalChanged) {
      state.viewers = nextViewers;
      state.totalViewers = page.total;
      state.hasMoreViewers = page.hasMore;

      for (const id of [...selectedIds]) {
        if (!state.viewers.some(viewer => viewer.twitchId === id)) {
          selectedIds.delete(id);
        }
      }

      renderViewers();
    } else if (currencyChanged || langChanged) {
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
  for (const field of getMergeFieldConfigs()) {
    field.source?.addEventListener('change', () => {
      applyMergeFieldFromSource(field);
    });
    field.input?.addEventListener('input', () => {
      if (mergeFieldUpdating) {
        return;
      }
      setMergeFieldManual(field);
    });
  }
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
