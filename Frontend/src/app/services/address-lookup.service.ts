/// <reference types="google.maps" />
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { GoogleMapsLoaderService } from './google-maps-loader.service';

export interface AddressSuggestion { id: string; text: string; secondary?: string; }

/** The parts of an address the lookup can fill in (matches ShipmentAddress field names). */
export interface ResolvedAddress {
  line1: string; suburb: string; city: string; province: string; postalCode: string;
  latitude: number | null; longitude: number | null; googlePlaceId: string | null; formatted: string;
}

export interface RouteEstimate { distanceKm: number; durationMin: number; polyline?: google.maps.LatLng[]; }

export const SA_PROVINCES = ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'] as const;

/**
 * Google Places (New) address search for South Africa, ported from the Rocket Freight client
 * portal (core/address-lookup.ts). Uses the same Maps JS script as the rest of the intranet
 * (GoogleMapsLoaderService → key from /config/google-maps-key). When Places is unavailable the
 * server-side Geocoding endpoint (/logistics/googlemaps/geocode) is used as a fallback.
 */
@Injectable({ providedIn: 'root' })
export class AddressLookupService {
  private maps = inject(GoogleMapsLoaderService);
  private http = inject(HttpClient);
  private placesLib: Promise<google.maps.PlacesLibrary> | null = null;
  private session: google.maps.places.AutocompleteSessionToken | null = null;
  private predictions = new Map<string, google.maps.places.PlacePrediction>();

  private places(): Promise<google.maps.PlacesLibrary> {
    this.placesLib ??= this.maps.load()
      .then(g => g.maps.importLibrary('places') as Promise<google.maps.PlacesLibrary>)
      .catch(err => { this.placesLib = null; throw err; });
    return this.placesLib;
  }

  /** Autocomplete suggestions restricted to ZA. Empty when the query is too short or Maps is unavailable. */
  async suggest(query: string): Promise<AddressSuggestion[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    try {
      const lib = await this.places();
      this.session ??= new lib.AutocompleteSessionToken();
      const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q, includedRegionCodes: ['za'], sessionToken: this.session,
      });
      this.predictions.clear();
      return suggestions
        .map(s => s.placePrediction)
        .filter((p): p is google.maps.places.PlacePrediction => !!p)
        .slice(0, 6)
        .map(p => {
          this.predictions.set(p.placeId, p);
          return { id: p.placeId, text: p.mainText?.toString() ?? p.text.toString(), secondary: p.secondaryText?.toString() ?? '' };
        });
    } catch {
      return [];
    }
  }

  /** Resolves a suggestion into street / suburb / city / province / postal code / coordinates. */
  async details(id: string): Promise<ResolvedAddress | null> {
    const prediction = this.predictions.get(id);
    if (!prediction) return null;
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ['addressComponents', 'location', 'formattedAddress'] });
    this.session = null; // a billing session ends when details are fetched
    const part = (type: string, short = false) => {
      const c = place.addressComponents?.find(x => x.types.includes(type));
      return (short ? c?.shortText : c?.longText) ?? '';
    };
    return {
      line1: [part('street_number'), part('route')].filter(Boolean).join(' ') || part('premise') || part('establishment'),
      suburb: part('sublocality_level_1') || part('sublocality') || part('neighborhood'),
      city: part('locality') || part('administrative_area_level_2'),
      province: this.province(part('administrative_area_level_1')),
      postalCode: part('postal_code'),
      latitude: place.location?.lat() ?? null,
      longitude: place.location?.lng() ?? null,
      googlePlaceId: id,
      formatted: place.formattedAddress ?? '',
    };
  }

  /** Free-text geocode through the API (server key) — used when a user typed an address without picking a suggestion. */
  async geocode(address: string): Promise<ResolvedAddress | null> {
    const text = address.trim();
    if (!text) return null;
    try {
      const r: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/logistics/googlemaps/geocode`, { params: { address: `${text}, South Africa` } }));
      if (!r?.success) return null;
      const lat = Number(r.latitude), lng = Number(r.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return null;
      return {
        line1: [r.streetNumber, r.route].filter(Boolean).join(' '), suburb: r.suburb ?? '', city: r.city ?? '',
        province: this.province(r.province ?? ''), postalCode: r.postalCode ?? '',
        latitude: lat, longitude: lng, googlePlaceId: r.placeId ?? null, formatted: r.formattedAddress ?? text,
      };
    } catch { return null; }
  }

  /** Driving distance/time between two points via the Directions service (includes the path for drawing). */
  async route(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RouteEstimate | null> {
    try {
      const g = await this.maps.load();
      const svc = new g.maps.DirectionsService();
      const res = await svc.route({ origin: from, destination: to, travelMode: g.maps.TravelMode.DRIVING, region: 'za' });
      const leg = res.routes[0]?.legs[0];
      if (!leg) return null;
      return {
        distanceKm: Math.round(((leg.distance?.value ?? 0) / 1000) * 10) / 10,
        durationMin: Math.round((leg.duration?.value ?? 0) / 60),
        polyline: res.routes[0].overview_path,
      };
    } catch { return null; }
  }

  private province(name: string): string {
    const n = name.trim().toLowerCase();
    return SA_PROVINCES.find(p => p.toLowerCase() === n) ?? (n.includes('kwazulu') ? 'KwaZulu-Natal' : n.includes('north west') ? 'North West' : name);
  }
}
