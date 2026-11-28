import React, { useState, useEffect, useRef } from 'react';
import { IncidentCategory, IncidentSeverity } from '../types';
import { reportStore } from '../store/reportStore';
import { userStore } from '../store/userStore';
import { ASUNCION_BARRIOS } from '../data/mockReports';
import { 
  getEstimatedBarrio, 
  reverseGeocodeAsuncion, 
  isLocationInAsuncion,
  getBarrioAutoAddress,
  getBarrioCentroid
} from '../utils/geoUtils';
import L from 'leaflet';
import { compressImage } from '../utils/imageCompress';
import { 
  Camera, 
  MapPin, 
  AlertTriangle, 
  Navigation, 
  UploadCloud, 
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  CheckCircle2,
  Image as ImageIcon,
  RefreshCw,
  Edit3,
  Compass,
  CheckCircle
} from 'lucide-react';

interface Props {
  onReportCreated?: () => void;
  onOpenIdentityModal?: () => void;
}

const CATEGORIES: { label: IncidentCategory; desc: string; icon: string; alertColor: string }[] = [
  {
    label: 'Bache',
    desc: 'Hundimientos, pozos o roturas asfálticas peligrosas',
    icon: '🕳️',
    alertColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30'
  },
  {
    label: 'Badén en mal estado',
    desc: 'Desfondado, desnivel brusco o canaletas deterioradas',
    icon: '〰️',
    alertColor: 'text-orange-500 bg-orange-500/10 border-orange-500/30'
  },
  {
    label: 'Alcantarilla sin tapa',
    desc: 'Boca de tormenta abierta o rejilla rota (riesgo fatal)',
    icon: '⚠️',
    alertColor: 'text-rose-500 bg-rose-500/10 border-rose-500/30'
  },
  {
    label: 'Suciedad / Basura',
    desc: 'Vertederos clandestinos, podas acumuladas o taponamiento',
    icon: '🗑️',
    alertColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
  }
];


export const CitizenReportForm: React.FC<Props> = ({ onReportCreated, onOpenIdentityModal }) => {
  const [citizen, setCitizen] = useState(userStore.getCitizen());

  useEffect(() => {
    return userStore.subscribe(() => {
      setCitizen(userStore.getCitizen());
    });
  }, []);

  // Step state: 1 (Categoría & Foto), 2 (Ubicación GPS), 3 (Detalles & Confirmación)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string>('');

  const [category, setCategory] = useState<IncidentCategory>('Bache');
  const [severity, setSeverity] = useState<IncidentSeverity>('Alta');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoFileName, setPhotoFileName] = useState<string>('');

  // Location and Mandatory Barrio state (centered in Asunción)
  const [lat, setLat] = useState<number>(-25.2974);
  const [lng, setLng] = useState<number>(-57.5882);
  const [barrio, setBarrio] = useState<string>('');
  const [barrioError, setBarrioError] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [isAutoBarrio, setIsAutoBarrio] = useState<boolean>(true);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [detectedDistanceKm, setDetectedDistanceKm] = useState<number>(0);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const manualAddressOverrideRef = useRef<boolean>(false);

  // When a barrio is selected, reposition map pin to its centroid (and extract street from map)
  const handleBarrioSelect = (newBarrio: string) => {
    setBarrio(newBarrio);
    manualAddressOverrideRef.current = false;

    if (!newBarrio) {
      setBarrioError('Debes seleccionar obligatoriamente el barrio de Asunción.');
      setAddress('');
      return;
    }
    setBarrioError('');
    setIsAutoBarrio(false);

    // Pre-fill representative street immediately while map reverse-geocode resolves
    setAddress(getBarrioAutoAddress(newBarrio));

    // Reposition map and pin to centroid of chosen barrio
    const centroid = getBarrioCentroid(newBarrio);
    if (centroid) {
      setLat(centroid.lat);
      setLng(centroid.lng);
    }
  };

  // Synchronize street address (and auto-barrio) automatically from map coordinates
  useEffect(() => {
    const estimate = getEstimatedBarrio(lat, lng);
    setDetectedDistanceKm(estimate.distanceKm);

    if (isAutoBarrio || !barrio) {
      setBarrio(estimate.barrio);
      setBarrioError('');
    }

    if (!manualAddressOverrideRef.current) {
      setAddress((prev) => prev || getBarrioAutoAddress(isAutoBarrio ? estimate.barrio : (barrio || estimate.barrio)));
    }

    let isCancelled = false;
    setIsGeocoding(true);

    reverseGeocodeAsuncion(lat, lng).then((res) => {
      if (isCancelled) return;
      setIsGeocoding(false);

      if (!manualAddressOverrideRef.current && res.address) {
        setAddress(res.address);
      }
      if (res.source === 'nominatim' && isAutoBarrio && res.barrio) {
        setBarrio(res.barrio);
        setBarrioError('');
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [lat, lng, isAutoBarrio]);

  // Initialize mini-map when reaching step 2
  useEffect(() => {
    if (currentStep !== 2) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 14,
          zoomControl: true,
          attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        const customIcon = L.divIcon({
          className: 'custom-emerald-pin',
          html: `<div style="background-color: #059669; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4); display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; background: white; border-radius: 50%; transform: rotate(45deg);"></div></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });

        const marker = L.marker([lat, lng], { draggable: true, icon: customIcon }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', () => {
          const position = marker.getLatLng();
          manualAddressOverrideRef.current = false;
          setLat(Number(position.lat.toFixed(5)));
          setLng(Number(position.lng.toFixed(5)));
        });

        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          manualAddressOverrideRef.current = false;
          setLat(Number(e.latlng.lat.toFixed(5)));
          setLng(Number(e.latlng.lng.toFixed(5)));
        });

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentStep]);

  // Update marker position
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng]);
    }
  }, [lat, lng]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      return;
    }
    setIsLocating(true);
    manualAddressOverrideRef.current = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = Number(pos.coords.latitude.toFixed(5));
        const userLng = Number(pos.coords.longitude.toFixed(5));
        setLat(userLat);
        setLng(userLng);
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS fallback:', err);
        setLat(-25.2867);
        setLng(-57.6333);
        setIsLocating(false);
      },
      { timeout: 6000, enableHighAccuracy: true }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError('');
    try {
      // Se comprime en el navegador: la foto viaja y se guarda liviana.
      const compressed = await compressImage(file);
      setPhotoFileName(file.name);
      setPhotoUrl(compressed);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo procesar la fotografía.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const currentCitizen = userStore.getCitizen();
    if (!currentCitizen) {
      if (onOpenIdentityModal) onOpenIdentityModal();
      return;
    }

    if (!photoUrl) {
      setCurrentStep(1);
      setSubmitError('Por favor adjunta una fotografía de la irregularidad.');
      return;
    }

    if (!barrio || barrio.trim() === '') {
      setCurrentStep(2);
      setBarrioError('Debes seleccionar obligatoriamente el barrio de Asunción.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalAddress = address.trim() || `Intersección vial en ${barrio}`;
      const created = await reportStore.addReport({
        category,
        description: description.trim() || `Reporte ciudadano de ${category.toLowerCase()} en ${barrio}.`,
        photoUrl,
        location: {
          lat,
          lng,
          address: finalAddress,
          barrio
        },
        citizenId: currentCitizen.id,
        citizenName: currentCitizen.fullName,
        citizenPhone: currentCitizen.phone,
        severity
      });

      setSubmittedReportId(created.id);
      setIsSubmitting(false);

      if (onReportCreated) {
        onReportCreated();
      }
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar el reporte.');
      setIsSubmitting(false);
    }
  };

  const handleResetForNew = () => {
    setSubmittedReportId(null);
    setCurrentStep(1);
    setDescription('');
    manualAddressOverrideRef.current = false;
  };

  // Success view
  if (submittedReportId) {
    return (
      <div className="rounded-3xl bg-white dark:bg-zinc-900 p-6 sm:p-10 shadow-2xl border border-zinc-200/80 dark:border-zinc-800 text-center animate-in zoom-in-95 duration-200">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        
        <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
          ¡Reporte Registrado con Éxito!
        </span>
        
        <h3 className="mt-3 text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          Código: <span className="text-emerald-600 dark:text-emerald-400">{submittedReportId}</span>
        </h3>
        
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          Gracias <strong>{citizen?.fullName}</strong>. Tu reporte ya está indexado en el mapa público y en el centro de control vial de la Municipalidad de Asunción.
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-left text-xs space-y-2.5 max-w-md mx-auto">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Categoría & Gravedad:</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-100">{category} ({severity})</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Barrio asignado:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{barrio}</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Dirección / Cruce:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]" title={address}>
              {address}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Coordenadas GPS:</span>
            <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Estado inicial:</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">Pendiente</span>
          </div>
          <div className="flex justify-between items-center border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Visibilidad en Mapa:</span>
            {isLocationInAsuncion(lat, lng) ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Publicado en Mapa Asunción
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                No visible en mapa (Fuera de Asunción)
              </span>
            )}
          </div>
        </div>

        <div className="mt-7">
          <button
            onClick={handleResetForNew}
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 text-sm shadow-lg shadow-emerald-600/25 transition active:scale-98"
          >
            Hacer Otro Reporte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden transition-colors">
      {/* Wizard Header with Progress Stepper */}
      <div className="border-b border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 bg-zinc-50/50 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Asistente de Reporte Vial
            </span>
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              Reportar irregularidad en la calle
            </h2>
          </div>

          {citizen ? (
            <button
              type="button"
              onClick={onOpenIdentityModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition"
              title="Modificar identidad"
            >
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="max-w-[110px] truncate">{citizen.fullName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenIdentityModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            >
              Identificarme
            </button>
          )}
        </div>

        {/* 3-Step Indicator Bar */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { step: 1, title: '1. Tipo y Foto' },
            { step: 2, title: '2. Ubicación GPS' },
            { step: 3, title: '3. Confirmar' }
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setCurrentStep(item.step)}
                className={`py-2 px-2.5 rounded-xl text-left border transition-all ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold'
                    : isCompleted
                    ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    : 'border-transparent text-zinc-400 dark:text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs truncate">
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${
                      isCurrent ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {item.step}
                    </span>
                  )}
                  <span className="truncate">{item.title}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6">
        {/* STEP 1: CATEGORY & PHOTO */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-3">
                Selecciona la categoría del problema <span className="text-emerald-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.label;
                  return (
                    <button
                      type="button"
                      key={cat.label}
                      onClick={() => setCategory(cat.label)}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                          : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-2xl p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xs shrink-0">
                        {cat.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${
                            isSelected ? 'text-emerald-900 dark:text-emerald-100' : 'text-zinc-800 dark:text-zinc-200'
                          }`}>
                            {cat.label}
                          </span>
                          {isSelected && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {cat.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo Section */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Fotografía del estado de la calle
              </label>

              <div className="space-y-3">
                {photoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 aspect-16/9 max-h-56 shadow-inner group">
                    <img
                      src={photoUrl}
                      alt="Evidencia fotográfica"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-4">
                      <div className="text-white text-xs truncate max-w-[70%]">
                        <span className="font-semibold block truncate">{photoFileName}</span>
                        <span className="text-[11px] text-emerald-400 font-medium">✓ Fotografía lista</span>
                      </div>
                      <label className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-white/90 text-zinc-900 text-xs font-bold hover:bg-white transition flex items-center gap-1.5 shadow-md">
                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        Cambiar
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 hover:bg-emerald-50/20 transition text-center group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2 group-hover:scale-105 transition">
                      <Camera className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      Toma una foto con tu cámara o elige de la galería
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Esencial para la inspección de la cuadrilla municipal
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2"
              >
                <span>Continuar a Ubicación</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOCATION & MINI-MAP */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Ubicación exacta en Asunción
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Toca el mapa o arrastra el marcador para fijar el punto
                </p>
              </div>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 transition"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'Obteniendo GPS...' : 'Usar mi GPS'}
              </button>
            </div>

            {/* Interactive Leaflet Map */}
            <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-inner relative">
              <div ref={mapContainerRef} className="w-full h-64 z-0 bg-zinc-100 dark:bg-zinc-950" />
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-md flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 z-10">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate font-mono text-[11px]">
                    Lat: {lat.toFixed(4)}, Lng: {lng.toFixed(4)}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                  (Arrastra el pin para ajustar)
                </span>
              </div>
            </div>

            {/* Asunción Boundary Territorial Status Notice */}
            {!isLocationInAsuncion(lat, lng) ? (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Ubicación fuera del ejido de Asunción</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                    El sistema te permite cargar y registrar este reporte sin problemas, pero al estar fuera de Asunción <strong>no figurará en el mapa público oficial</strong>, ya que el mapa está reservado exclusivamente al municipio capitalino.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Ubicación dentro de Asunción — Aparecerá visible en el mapa público</span>
              </div>
            )}

            {/* Mandatory Barrio Selection & Automatic Streets Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      Selección Territorial
                    </span>
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>{barrio || 'Sin barrio seleccionado'}</span>
                      {barrio ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Barrio Validado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                          Requerido
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {!isAutoBarrio && (
                  <button
                    type="button"
                    onClick={() => {
                      manualAddressOverrideRef.current = false;
                      setIsAutoBarrio(true);
                      const est = getEstimatedBarrio(lat, lng);
                      setBarrio(est.barrio);
                      setBarrioError('');
                    }}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto-detectar por coordenadas GPS</span>
                  </button>
                )}
              </div>

              {/* Barrio Error Banner */}
              {barrioError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{barrioError}</span>
                </div>
              )}

              {/* Barrio Dropdown & Map-Extracted Street Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
                <div>
                  <label htmlFor="report-barrio-select" className="block text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                    Barrio de Asunción <span className="text-rose-500 font-bold">* (Obligatorio)</span>:
                  </label>
                  <select
                    id="report-barrio-select"
                    value={barrio}
                    onChange={(e) => handleBarrioSelect(e.target.value)}
                    required
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold transition focus:outline-hidden cursor-pointer ${
                      barrioError
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100 ring-2 ring-rose-400/30'
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:border-emerald-500'
                    }`}
                  >
                    <option value="">-- Selecciona obligatoriamente el barrio * --</option>
                    {ASUNCION_BARRIOS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    Selecciona obligatoriamente el barrio correspondiente al reporte.
                  </p>
                </div>

                <div>
                  <label htmlFor="report-street-input" className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Calle / Dirección (del mapa):</span>
                    {isGeocoding && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 animate-pulse font-normal lowercase">
                        obteniendo del mapa...
                      </span>
                    )}
                  </label>
                  <input
                    id="report-street-input"
                    type="text"
                    value={address}
                    onChange={(e) => {
                      manualAddressOverrideRef.current = true;
                      setAddress(e.target.value);
                    }}
                    placeholder="Se extrae automáticamente de la ubicación del mapa"
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Extraída automáticamente según la ubicación del mapa
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!barrio || barrio.trim() === '') {
                    setBarrioError('Debes seleccionar obligatoriamente el barrio de Asunción.');
                    return;
                  }
                  setBarrioError('');
                  setCurrentStep(3);
                }}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Siguiente: Detalles</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS & SUBMIT */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Severity Level */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                Nivel de gravedad estimada
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['Baja', 'Media', 'Alta', 'Crítica'] as IncidentSeverity[]).map((lvl) => {
                  const isSelected = severity === lvl;
                  return (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setSeverity(lvl)}
                      className={`py-2.5 rounded-xl text-xs font-bold text-center border transition ${
                        isSelected
                          ? lvl === 'Crítica'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : lvl === 'Alta'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
                Observaciones adicionales <span className="text-zinc-400 font-normal lowercase">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Indica si tapa el desagüe en días de lluvia, si genera accidentes, etc."
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 p-3.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Summary preview card */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Resumen de envío:
              </span>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Problema:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{category} ({severity})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Barrio:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{barrio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Dirección:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[220px]" title={address}>
                  {address}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Coordenadas GPS:</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Fecha de registro:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2">
                <span className="text-zinc-500 dark:text-zinc-400">Firmado por:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {citizen ? `${citizen.fullName} (C.I. ${citizen.id})` : 'Ciudadano sin registrar'}
                </span>
              </div>
              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold">
                  {submitError}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-xl shadow-emerald-600/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-5 h-5" />
                <span>{isSubmitting ? 'Registrando Reporte...' : 'Enviar Reporte a la Ciudad'}</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
