export const routes = {
  root: '/',
  login: '/login',
};

export function slugifySegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function discussRoute(id) {
  return `/post/${id}`;
}

export function feedboxDetailRoute(slug) {
  return `/feedbox/${slugifySegment(slug)}`;
}

export function yourCityTabRoute(tab) {
  const cityRoutes = {
    'lgu-performance': routes.cityLguPerformance,
    'citizen-charter': routes.cityCitizenCharter,
  };
  return cityRoutes[tab] ?? routes.cityLguPerformance;
}
