import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { mountPalette } from './mount';

import type { StrapiApp } from '@strapi/strapi/admin';

const plugin: StrapiApp['appPlugins'][string] = {
  register(app) {
    app.registerPlugin({
      id: PLUGIN_ID,
      name: PLUGIN_ID,
    });
  },

  bootstrap(app) {
    mountPalette();

    // Settings → Strapispot (only for roles that have the "Change settings" permission).
    app.addSettingsLink('global', {
      id: PLUGIN_ID,
      to: PLUGIN_ID,
      intlLabel: { id: `${PLUGIN_ID}.settings.link`, defaultMessage: 'Strapispot' },
      permissions: [{ action: `plugin::${PLUGIN_ID}.settings.update`, subject: null }],
      Component: () => import('./pages/Settings'),
    });
  },

  registerTrads({ locales }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(`./translations/${locale}.json`)) as {
            default: Record<string, string>;
          };

          const newData: Record<string, string> = {};
          const keys = Object.keys(data);

          for (const key of keys) {
            newData[getTranslation(key)] = data[key];
          }

          return { data: newData, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

export default plugin;
