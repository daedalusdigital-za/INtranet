/// <reference types="google.maps" />
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const SCRIPT_ID = 'google-maps-js-api';
const CALLBACK_NAME = '__intranetGoogleMapsReady';
const LIBRARIES = 'places,geometry,marker';

/**
 * Loads the Google Maps JavaScript API on demand. The API key is fetched from the backend
 * (GET /config/google-maps-key, JWT-protected) instead of being hardcoded in the bundle.
 * Both the key and the script load are cached, so every caller shares one request/script.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private http = inject(HttpClient);
  private keyPromise: Promise<string> | null = null;
  private loadPromise: Promise<typeof google> | null = null;

  /** The Maps API key (for URL-based APIs such as Geocoding / Static Maps). */
  getKey(): Promise<string> {
    if (!this.keyPromise) {
      this.keyPromise = firstValueFrom(
        this.http.get<{ apiKey: string }>(`${environment.apiUrl}/config/google-maps-key`)
      ).then(res => {
        const key = res?.apiKey?.trim();
        if (!key) throw new Error('Google Maps API key is not configured');
        return key;
      }).catch(err => {
        this.keyPromise = null; // allow a retry later (e.g. after re-login)
        throw err;
      });
    }
    return this.keyPromise;
  }

  /** Resolves with the global `google` namespace once the Maps JS API is ready. */
  load(): Promise<typeof google> {
    const w = window as any;
    if (w.google?.maps?.Map) return Promise.resolve(w.google);
    if (!this.loadPromise) {
      this.loadPromise = this.getKey().then(key => new Promise<typeof google>((resolve, reject) => {
        w[CALLBACK_NAME] = () => resolve(w.google);
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.async = true;
        script.src = 'https://maps.googleapis.com/maps/api/js'
          + `?key=${encodeURIComponent(key)}`
          + `&libraries=${LIBRARIES}&loading=async&callback=${CALLBACK_NAME}`;
        script.onerror = () => {
          script.remove();
          reject(new Error('Failed to load the Google Maps JavaScript API'));
        };
        document.head.appendChild(script);
      })).catch(err => {
        this.loadPromise = null;
        throw err;
      });
    }
    return this.loadPromise;
  }
}
