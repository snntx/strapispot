import type { Core } from '@strapi/strapi';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Adds "Strapispot → Change settings" to the role editor (Settings → Roles).
  await strapi.admin.services.permission.actionProvider.registerMany([
    {
      section: 'plugins',
      displayName: 'Change settings',
      uid: 'settings.update',
      pluginName: 'strapispot',
    },
  ]);
};

export default bootstrap;
