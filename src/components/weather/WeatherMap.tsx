import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useWeatherStore } from '@/store/useWeatherStore';

const OTOPO_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'OpenTopoMap',
  sources: {
    otopo: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Kartendaten: © <a href="https://openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>-Mitwirkende, ' +
        'SRTM | Kartendarstellung: © <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> ' +
        '(<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)',
    },
  },
  layers: [
    {
      id: 'otopo-tiles',
      type: 'raster',
      source: 'otopo',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export function WeatherMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const { position, setPosition } = useWeatherStore();

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OTOPO_STYLE,
      center: [position.lng, position.lat],
      zoom: 10,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right',
    );

    // Marker at selected position
    const marker = new maplibregl.Marker({ color: 'hsl(215, 80%, 52%)' })
      .setLngLat([position.lng, position.lat])
      .addTo(map);
    markerRef.current = marker;

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setPosition({ lat, lng });
      marker.setLngLat([lng, lat]);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync marker when position changes externally
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([position.lng, position.lat]);
    }
  }, [position.lat, position.lng]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="absolute inset-0" />
      {/* Position overlay */}
      <div className="absolute bottom-6 left-2 bg-card/90 backdrop-blur-sm rounded px-2 py-1 text-[10px] text-muted-foreground border border-border shadow-sm pointer-events-none">
        {position.lat.toFixed(4)}°N, {position.lng.toFixed(4)}°E
      </div>
    </div>
  );
}
