import { ADDON_ID, FALLBACK_LOGO_BASE64 } from '../constants';
import type { LocalizedText } from '../types';

const CATALOG_API_BASE = 'https://rocketman-streams.com/api/extensions';

type InstalledAddonRecord = {
  id: string;
  path?: string;
  catalogRepo?: string;
};

type AddonManifestJson = {
  id?: string;
  name?: LocalizedText | string;
  description?: LocalizedText | string;
  icon?: string;
};

export type ResolvedAddonCatalogMeta = {
  name: LocalizedText;
  description: LocalizedText;
  logoBase64: string;
};

const metaCache = new Map<string, ResolvedAddonCatalogMeta>();

/**
 * Encodes catalog repo id (`org/name`) for URL path segments.
 * @param repo Catalog repository id.
 */
export const encodeCatalogRepoPath = (repo: string) =>
  repo
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');

const parseManifestLocalized = (
  value: LocalizedText | string | undefined,
  fallback: string
): LocalizedText => {
  if (!value) {
    return { en: fallback };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? { en: trimmed, ru: trimmed, uk: trimmed } : { en: fallback };
  }

  const en = value.en?.trim() || fallback;
  return {
    en,
    ru: value.ru?.trim() || en,
    uk: value.uk?.trim() || en,
  };
};

const resolveCatalogRepo = (
  addonId: string,
  installed?: InstalledAddonRecord
) => {
  const catalogRepo = installed?.catalogRepo?.trim();
  if (catalogRepo) {
    return catalogRepo;
  }
  if (addonId.includes('/')) {
    return addonId;
  }
  return `RocketMan-StreamKit/${addonId}`;
};

const buildCatalogManifestUrl = (repo: string) =>
  `${CATALOG_API_BASE}/static/${encodeCatalogRepoPath(repo)}/manifest.json`;

const buildCatalogIconUrl = (repo: string) =>
  `${CATALOG_API_BASE}/icon/${encodeCatalogRepoPath(repo)}`;

const bytesToBase64 = (bytes: Uint8Array) => {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? alphabet[chunk & 63] : '=';
  }

  return output;
};

const binaryStringToBase64 = (binary: string) => {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytesToBase64(bytes);
};

const fetchCatalogIconBase64 = async (repo: string, iconFile?: string) => {
  const file = iconFile?.trim() || 'logo.png';

  if (file.toLowerCase().endsWith('.svg')) {
    const url = `${CATALOG_API_BASE}/static/${encodeCatalogRepoPath(repo)}/${encodeURIComponent(file)}`;
    const svg = await network.request.get(url);
    return binaryStringToBase64(svg);
  }

  const binary = await network.request.get(buildCatalogIconUrl(repo));
  return binary ? binaryStringToBase64(binary) : FALLBACK_LOGO_BASE64;
};

/**
 * Resolves localized addon metadata and logo for viewer page sync.
 * @param addonId Installed addon manifest id.
 */
export const resolveAddonCatalogMeta = async (
  addonId: string
): Promise<ResolvedAddonCatalogMeta> => {
  if (addonId === ADDON_ID) {
    return {
      name: { en: addonId },
      description: { en: '' },
      logoBase64: FALLBACK_LOGO_BASE64,
    };
  }

  const cached = metaCache.get(addonId);
  if (cached) {
    return cached;
  }

  const config = (await api.config.getConfig()) as {
    addonsInstalled?: InstalledAddonRecord[];
  } | null;
  const installed = config?.addonsInstalled?.find(entry => entry.id === addonId);
  const repo = resolveCatalogRepo(addonId, installed);

  let meta: ResolvedAddonCatalogMeta = {
    name: { en: addonId },
    description: { en: '' },
    logoBase64: FALLBACK_LOGO_BASE64,
  };

  try {
    const manifestRaw = await network.request.get(buildCatalogManifestUrl(repo));
    const manifest = JSON.parse(manifestRaw) as AddonManifestJson;
    meta = {
      name: parseManifestLocalized(manifest.name, addonId),
      description: parseManifestLocalized(manifest.description, ''),
      logoBase64: await fetchCatalogIconBase64(repo, manifest.icon),
    };
  } catch (error) {
    console.warn('[balance] addon catalog meta fallback:', addonId, error);
  }

  metaCache.set(addonId, meta);
  return meta;
};

/** Clears cached addon metadata (e.g. after settings save). */
export const clearAddonCatalogMetaCache = () => {
  metaCache.clear();
};
