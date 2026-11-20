import type { Core } from '@strapi/strapi';

const settingsController = ({ strapi }: { strapi: Core.Strapi }) => {
  const service = () => strapi.plugin('strapispot').service('settings');

  return {
    async get(ctx: any) {
      ctx.body = { data: await service().get() };
    },
    async update(ctx: any) {
      ctx.body = { data: await service().set(ctx.request.body) };
    },
  };
};

export default settingsController;
