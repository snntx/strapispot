export default () => ({
  type: 'admin',
  routes: [
    {
      // Every logged-in admin may read the settings: the palette needs them.
      method: 'GET',
      path: '/settings',
      handler: 'settings.get',
      config: { policies: [] },
    },
    {
      // Only admins whose role has this permission may change them.
      method: 'PUT',
      path: '/settings',
      handler: 'settings.update',
      config: {
        policies: [
          {
            name: 'admin::hasPermissions',
            config: { actions: ['plugin::strapispot.settings.update'] },
          },
        ],
      },
    },
  ],
});
