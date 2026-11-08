import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Address, PROVINCES, Province } from './models';

export interface AddressSuggestion { id: string; text: string; }

/** Address search for the booking form. Fills street, suburb, city, province, postal code, lat and lng. */
export abstract class AddressLookup {
  abstract readonly enabled: boolean;
  abstract suggest(query: string): Promise<AddressSuggestion[]>;
  abstract details(id: string): Promise<Partial<Address>>;
}

/**
 * Google Places API (New), restricted to South Africa.
 * Needs environment.googleMapsKey: a browser key restricted to the portal's domain,
 * with "Places API (New)" and "Maps JavaScript API" enabled.
 */
@Injectable()
export class GooglePlacesLookup extends AddressLookup {
  readonly enabled = true;
  private loading?: Promise<any>;
  private session?: any;
  private predictions = new Map<string, any>();

  private lib(): Promise<any> {
    this.loading ??= new Promise((resolve, reject) => {
      const w = window as any;
      const cb = '__portalPlacesReady';
      w[cb] = () => w.google.maps.importLibrary('places').then(resolve, reject);
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsKey)}&loading=async&callback=${cb}`;
      s.async = true;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return this.loading;
  }

  async suggest(query: string): Promise<AddressSuggestion[]> {
    if (query.trim().length < 3) return [];
    const places = await this.lib();
    this.session ??= new places.AutocompleteSessionToken();
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query, includedRegionCodes: ['za'], sessionToken: this.session,
    });
    this.predictions.clear();
    return suggestions
      .filter((s: any) => s.placePrediction)
      .slice(0, 5)
      .map((s: any) => {
        const p = s.placePrediction;
        this.predictions.set(p.placeId, p);
        return { id: p.placeId, text: p.text.toString() };
      });
  }

  async details(id: string): Promise<Partial<Address>> {
    const place = this.predictions.get(id).toPlace();
    await place.fetchFields({ fields: ['addressComponents', 'location'] });
    this.session = undefined; // a session ends when details are fetched
    const part = (type: string) => place.addressComponents?.find((c: any) => c.types.includes(type))?.longText ?? '';
    const province = PROVINCES.find(p => p.toLowerCase() === part('administrative_area_level_1').toLowerCase());
    return {
      street: [part('street_number'), part('route')].filter(Boolean).join(' '),
      suburb: part('sublocality_level_1') || part('sublocality') || part('neighborhood'),
      city: part('locality') || part('administrative_area_level_2'),
      province: province as Province,
      postalCode: part('postal_code'),
      lat: place.location?.lat(), lng: place.location?.lng(), placeId: id,
    };
  }
}

/** Demo lookup with a handful of real-looking South African addresses. */
@Injectable()
export class DemoAddressLookup extends AddressLookup {
  readonly enabled = true;
  private all: (Omit<Partial<Address>, 'id'> & { id: string; text: string })[] = [
    { id: 'd1', text: '101 Florida Rd, Morningside, Durban', street: '101 Florida Rd', suburb: 'Morningside', city: 'Durban', province: 'KwaZulu-Natal', postalCode: '4001', lat: -29.83, lng: 31.01 },
    { id: 'd2', text: '7 Electron Ave, Isando, Kempton Park', street: '7 Electron Ave', suburb: 'Isando', city: 'Kempton Park', province: 'Gauteng', postalCode: '1600', lat: -26.14, lng: 28.2 },
    { id: 'd3', text: '15 Montague Dr, Montague Gardens, Cape Town', street: '15 Montague Dr', suburb: 'Montague Gardens', city: 'Cape Town', province: 'Western Cape', postalCode: '7441', lat: -33.86, lng: 18.52 },
    { id: 'd4', text: '40 Nelson Mandela Dr, Bloemfontein Central, Bloemfontein', street: '40 Nelson Mandela Dr', suburb: 'Bloemfontein Central', city: 'Bloemfontein', province: 'Free State', postalCode: '9301', lat: -29.11, lng: 26.21 },
    { id: 'd5', text: '22 Samora Machel St, Mbombela Central, Mbombela', street: '22 Samora Machel St', suburb: 'Mbombela Central', city: 'Mbombela', province: 'Mpumalanga', postalCode: '1200', lat: -25.47, lng: 30.97 },
    { id: 'd6', text: '9 Old Main Rd, Hillcrest, Durban', street: '9 Old Main Rd', suburb: 'Hillcrest', city: 'Durban', province: 'KwaZulu-Natal', postalCode: '3610', lat: -29.78, lng: 30.76 },
  ];
  async suggest(q: string) {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return this.all.filter(a => a.text.toLowerCase().includes(t)).map(({ id, text }) => ({ id, text }));
  }
  async details(id: string) {
    const { id: _i, text: _t, ...rest } = this.all.find(a => a.id === id)!;
    return { ...rest, placeId: id };
  }
}

/** No key configured: the form falls back to typed addresses. */
@Injectable()
export class NoAddressLookup extends AddressLookup {
  readonly enabled = false;
  async suggest() { return []; }
  async details() { return {}; }
}
