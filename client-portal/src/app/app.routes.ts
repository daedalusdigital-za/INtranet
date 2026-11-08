import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then(m => m.Login), title: 'Sign in' },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then(m => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'shipments' },
      { path: 'shipments', loadComponent: () => import('./features/shipments/shipments').then(m => m.Shipments), title: 'Shipments' },
      { path: 'shipments/:id', loadComponent: () => import('./features/shipment-detail/shipment-detail').then(m => m.ShipmentDetailPage), title: 'Shipment' },
      { path: 'book', loadComponent: () => import('./features/booking/booking-form').then(m => m.BookingForm), title: 'Book a shipment' },
      { path: 'book/done/:bookingNo', loadComponent: () => import('./features/booking/booking-done').then(m => m.BookingDone), title: 'Booking received' },
      { path: 'addresses', loadComponent: () => import('./features/address-book/address-book').then(m => m.AddressBook), title: 'Address book' },
      { path: 'settings', loadComponent: () => import('./features/settings/settings').then(m => m.Settings), title: 'Notifications' },
    ],
  },
  { path: '**', redirectTo: '' },
];
