import adminAPIRoutes from './admin';

// Strapispot only has admin routes; it adds nothing to the public Content API.
const routes = {
  admin: adminAPIRoutes,
};

export default routes;
