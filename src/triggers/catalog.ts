import { ADDON_ID, SOUNDS_SECTION_META } from '../constants';
import type {
  BalanceAddonParams,
  BalanceSyncAddonEntry,
  BalanceSyncSoundsEntry,
  BalanceSyncTriggerEntry,
} from '../types';
import { resolveAddonCatalogMeta } from '../addons/catalog-meta';

/**
 * Builds addon/category catalog for the viewer web page.
 * @param params Current addon params with shop items and categories.
 */
export const buildSyncCatalog = async (params: BalanceAddonParams) => {
  const categories =
    params.categories.length > 0
      ? params.categories
      : [
          {
            id: 'default',
            name: {
              en: 'Actions',
              ru: 'Действия',
              uk: 'Дії',
            },
          },
        ];

  const grouped = new Map<string, BalanceSyncAddonEntry>();
  const soundTriggers: BalanceSyncTriggerEntry[] = [];

  for (const item of params.shop_items) {
    if (item.catalogGroup === 'sounds') {
      const trigger: BalanceSyncTriggerEntry = {
        id: item.id,
        price: item.price,
      };
      if (item.name.en.trim()) {
        trigger.label = item.name;
      }
      soundTriggers.push(trigger);
      continue;
    }

    if (item.addonId === ADDON_ID) {
      continue;
    }

    const meta = await resolveAddonCatalogMeta(item.addonId);

    const entry =
      grouped.get(item.addonId) ??
      ({
        addonId: item.addonId,
        name: meta.name,
        description: meta.description,
        categoryId: item.categoryId,
        logoBase64: meta.logoBase64,
        triggers: [],
      } satisfies BalanceSyncAddonEntry);

    entry.triggers.push({
      id: item.id,
      price: item.price,
    });

    grouped.set(item.addonId, entry);
  }

  const sounds: BalanceSyncSoundsEntry | undefined =
    soundTriggers.length > 0
      ? {
          name: SOUNDS_SECTION_META.name,
          description: SOUNDS_SECTION_META.description,
          logoBase64: SOUNDS_SECTION_META.logoBase64,
          triggers: soundTriggers,
        }
      : undefined;

  return {
    categories,
    addons: [...grouped.values()],
    sounds,
  };
};
