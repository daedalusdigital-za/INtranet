// Type declarations for Google Maps JavaScript API
declare namespace google {
  namespace maps {
    class Map {
      constructor(element: Element, options?: MapOptions);
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
      getZoom(): number;
      getCenter(): LatLng;
    }

    class Marker {
      constructor(options?: MarkerOptions);
      setMap(map: Map | null): void;
      getPosition(): LatLng | null;
      getTitle(): string | null | undefined;
      setAnimation(animation: Animation | null): void;
      addListener(event: string, handler: Function): MapsEventListener;
    }

    class InfoWindow {
      constructor(options?: InfoWindowOptions);
      open(map?: Map | null, anchor?: Marker | null): void;
      close(): void;
      setContent(content: string | Node): void;
    }

    class LatLngBounds {
      constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
      getCenter(): LatLng;
      contains(latLng: LatLng | LatLngLiteral): boolean;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      mapTypeId?: string;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      styles?: MapTypeStyle[];
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map | null;
      title?: string;
      icon?: string | Icon | Symbol;
      animation?: Animation;
      zIndex?: number;
    }

    interface InfoWindowOptions {
      content?: string | Node;
      position?: LatLng | LatLngLiteral;
    }

    interface Icon {
      url: string;
      size?: Size;
      scaledSize?: Size;
      anchor?: Point;
    }

    interface Symbol {
      path: SymbolPath | string;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
      rotation?: number;
    }

    interface MapTypeStyle {
      featureType?: string;
      elementType?: string;
      stylers?: object[];
    }

    interface Padding {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }

    interface MapsEventListener {
      remove(): void;
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    class Polyline {
      constructor(options?: PolylineOptions);
      setMap(map: Map | null): void;
      getPath(): MVCArray<LatLng>;
      setPath(path: LatLng[] | LatLngLiteral[]): void;
      addListener(event: string, handler: Function): MapsEventListener;
    }

    interface PolylineOptions {
      path?: LatLng[] | LatLngLiteral[];
      geodesic?: boolean;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      map?: Map | null;
      clickable?: boolean;
      zIndex?: number;
    }

    class MVCArray<T> {
      getLength(): number;
      getAt(index: number): T;
      forEach(callback: (element: T, index: number) => void): void;
    }

    enum Animation {
      BOUNCE = 1,
      DROP = 2
    }

    enum SymbolPath {
      CIRCLE = 0,
      FORWARD_CLOSED_ARROW = 1,
      FORWARD_OPEN_ARROW = 2,
      BACKWARD_CLOSED_ARROW = 3,
      BACKWARD_OPEN_ARROW = 4
    }

    namespace places {
      class Autocomplete {
        constructor(input: HTMLInputElement, options?: AutocompleteOptions);
        addListener(event: string, handler: Function): MapsEventListener;
        getPlace(): PlaceResult;
        setBounds(bounds: LatLngBounds): void;
        setComponentRestrictions(restrictions: ComponentRestrictions): void;
        setFields(fields: string[]): void;
        setOptions(options: AutocompleteOptions): void;
        setTypes(types: string[]): void;
      }

      interface AutocompleteOptions {
        bounds?: LatLngBounds;
        componentRestrictions?: ComponentRestrictions;
        fields?: string[];
        strictBounds?: boolean;
        types?: string[];
      }

      interface ComponentRestrictions {
        country: string | string[];
      }

      interface PlaceResult {
        address_components?: AddressComponent[];
        formatted_address?: string;
        geometry?: PlaceGeometry;
        name?: string;
        place_id?: string;
        types?: string[];
      }

      interface AddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }

      interface PlaceGeometry {
        location?: LatLng;
        viewport?: LatLngBounds;
      }
    }
  }
}
