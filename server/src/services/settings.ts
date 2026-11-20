import type { Core } from '@strapi/strapi';

import { sanitizeSettings, type StrapispotSettings } from '../settings';

const settingsService = ({ strapi }: { strapi: Core.Strapi }) => {
  const store = () => strapi.store({ type: 'plugin', name: 'strapispot', key: 'settings' });

  return {
    async get(): Promise<StrapispotSettings> {
      return sanitizeSettings(await store().get({}));
    },
    async set(input: unknown): Promise<StrapispotSettings> {
      const clean = sanitizeSettings(input);
      await store().set({ value: clean });
      return clean;
    },
  };
};

export default settingsService;
