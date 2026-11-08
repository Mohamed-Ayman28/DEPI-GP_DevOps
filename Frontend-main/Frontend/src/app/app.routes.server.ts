import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'dashboard',
    renderMode: RenderMode.Server
  },
  {
    path: 'services/:id',
    renderMode: RenderMode.Server
  },
  {
    path: 'services',
    renderMode: RenderMode.Server
  },
  {
    path: 'vendor/services',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
