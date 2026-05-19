'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

interface RetailerPin {
  name: string;
  latitude: number;
  longitude: number;
}

function FitBounds({ retailers }: { retailers: RetailerPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (retailers.length === 0) return;
    const bounds = L.latLngBounds(retailers.map((r) => [r.latitude, r.longitude]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, retailers]);
  return null;
}

export default function LeafletMap({ retailers }: { retailers: RetailerPin[] }) {
  useEffect(() => {
    // Fix Leaflet default marker icons broken by Next.js asset pipeline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);

  const center: [number, number] =
    retailers.length > 0
      ? [retailers[0]!.latitude, retailers[0]!.longitude]
      : [20.5937, 78.9629];

  const zoom = retailers.length > 0 ? 12 : 5;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      {retailers.length > 1 && <FitBounds retailers={retailers} />}
      {retailers.map((r, i) => (
        <Marker key={i} position={[r.latitude, r.longitude]}>
          <Popup>{r.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
