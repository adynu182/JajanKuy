import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Camera, Map as MapLibre, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, endAt, getDocs, orderBy, query, startAt } from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../src/config/firebase';

const COLORS = {
  primary: "#f48c25",
  backgroundLight: "#f8f7f5",
  backgroundDark: "#221910",
  textDark: "#1c140d",
  textLight: "#ffffff",
  white: "#ffffff",
  gray: "#e5e7eb",
};

const CATEGORY_ICONS: Record<string, { icon: string; color: string }> = {
  makanan: { icon: 'utensils', color: '#fed7aa' },
  minuman: { icon: 'wine-glass-alt', color: '#bfdbfe' },
  jajanan: { icon: 'cookie-bite', color: '#fecaca' },
  buah: { icon: 'apple-alt', color: '#ade6c1ff' },
  'es krim': { icon: 'ice-cream', color: '#f3f7a9ff' },
  lainnya: { icon: 'question', color: '#e5e7eb' },
};

const getCategoryIcon = (category: string | undefined) => {
  const lowerCategory = category?.toLowerCase() ?? '';
  const match = Object.entries(CATEGORY_ICONS).find(([key]) => lowerCategory.includes(key));
  return match ? match[1] : CATEGORY_ICONS.lainnya;
};

export default function MapScreen() {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const cameraRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Fungsi Hitung Jarak (Haversine Formula)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius bumi dalam km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Jarak dalam km
  };

  useEffect(() => {
    setIsMapReady(false);
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [vendors]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let location = null;
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        location = loc;
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      if (location) {
        const center: [number, number] = [location.coords.latitude, location.coords.longitude];
        const radiusInM = 5000; // 5km fixed radius
        const bounds = geohashQueryBounds(center, radiusInM);
        const promises = [];
        for (const b of bounds) {
          const q = query(
            collection(db, 'vendors'),
            orderBy('geohash'),
            startAt(b[0]),
            endAt(b[1])
          );
          promises.push(getDocs(q));
        }

        const snapshots = await Promise.all(promises);
        let list: any[] = [];
        for (const snap of snapshots) {
          for (const doc of snap.docs) {
            const data = doc.data();
            const distance = getDistance(
              location.coords.latitude,
              location.coords.longitude,
              data.lat,
              data.lng
            );
            if (distance <= 5) {
              list.push({ id: doc.id, ...data, distanceKm: distance.toFixed(1) });
            }
          }
        }
        const uniqueVendors = Array.from(new Map(list.map(item => [item.id, item])).values());
        setVendors(uniqueVendors);
      }
      setLoading(false);
    })();
  }, []);

  const handleRecenter = () => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 14,
      });
    }
  };

  const onMarkerPress = (vendor: any, index: number) => {
    // Scroll carousel to item
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: index * 320 + index * 16, animated: true });
    }
  };

  if (loading && !userLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.textDark }}>Memuat Peta...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MAP BACKGROUND - maplibre via Carto Voyager style */}
      <MapLibre
        style={styles.map}
        mapStyle={'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'}
      >
        <Camera
          ref={cameraRef}
          initialViewState={
            userLocation
              ? {
                  center: [userLocation.longitude, userLocation.latitude],
                  zoom: 14,
                }
              : undefined
          }
        />

        <UserLocation animated={true} />

        {vendors.map((vendor, index) => (
          <Marker
            key={vendor.id}
            id={vendor.id}
            lngLat={[vendor.lng, vendor.lat]}
            onPress={() => onMarkerPress(vendor, index)}
          >
            {(() => {
              const categoryIcon = getCategoryIcon(vendor.category);
              return (
                <View style={styles.customMarker}>
                  <View style={[styles.markerInner, { backgroundColor: categoryIcon.color }]}> 
                    <FontAwesome5 name={categoryIcon.icon} size={18} color={COLORS.primary} />
                  </View>
                </View>
              );
            })()}
          </Marker>
        ))}
      </MapLibre>

      {/* FLOATING TOP BAR */}
      <View style={styles.topBarContainer}>
        <View style={styles.backButtonContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* MY LOCATION FAB */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={handleRecenter}>
          <MaterialIcons name="my-location" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* BOTTOM CAROUSEL */}
      <View style={styles.carouselContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          decelerationRate="fast"
          snapToInterval={336} // card width + margin
        >
          {vendors.map((vendor) => (
            <TouchableOpacity
              key={vendor.id}
              activeOpacity={0.9}
              style={styles.card}
              onPress={() => router.push(`/detail/${vendor.id}`)}
            >
              <View style={styles.cardContent}>
                <Image
                  source={{ uri: vendor.photoUrl }} // Placeholder image matching design style
                  style={styles.cardImage}
                />
                <View style={styles.cardInfo}>
                  <View>
                    <Text style={styles.cardTitle} numberOfLines={1}>{vendor.name}</Text>
                    <View style={styles.ratingRow}>
                      <MaterialIcons name="star" size={14} color={COLORS.primary} />
                      <Text style={styles.ratingText}>{vendor.rating}</Text>
                      <Text style={styles.reviewText}>{vendor.reviewCount ? vendor.reviewCount : 0} reviews</Text>
                    </View>
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={styles.distanceBadge}>
                      <MaterialIcons name="directions-walk" size={12} color={COLORS.primary} />
                      <Text style={styles.distanceText}>{vendor.distanceKm ? `${vendor.distanceKm} km` : 'Near'}</Text>
                    </View>
                  </View>
                </View>
              </View>

            </TouchableOpacity>
          ))}
          {vendors.length === 0 && (
            <View style={[styles.card, { justifyContent: 'center', alignItems: 'center', width: 320 }]}>
              <Text style={{ color: '#999' }}>No vendors found nearby</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { width: '100%', height: '100%' },

  // TOP BAR
  topBarContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 12,
    marginBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 20,
  },

  // MARKERS
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(244, 140, 37, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  // FAB
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 270, // Above carousel
    zIndex: 10,
  },
  fab: {
    width: 56,
    height: 56,
    backgroundColor: 'white',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },

  // CAROUSEL
  carouselContainer: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: 320,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  cardImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  reviewText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed', // primary/10
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  cardAction: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  viewMenuText: {
    backgroundColor: COLORS.backgroundLight,
    color: COLORS.textDark,
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
  },
});