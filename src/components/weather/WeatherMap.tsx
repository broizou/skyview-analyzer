import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useWeatherStore } from '@/store/useWeatherStore';

export function WeatherMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const { position, setPosition } = useWeatherStore();

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [position.lng, position.lat],
      zoom: 9,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'top-right');

    // Initial marker
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

    return () => { map.remove(); mapRef.current = null; };
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
      {/* Position tooltip */}
      <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-sm rounded px-2 py-1 text-[10px] text-muted-foreground border border-border shadow-sm">
        {position.lat.toFixed(4)}°N, {position.lng.toFixed(4)}°E
      </div>
    </div>
  );
}
