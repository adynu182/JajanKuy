import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
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

export default function MapScreen() {
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [radius, setRadius] = useState(5); // Default radius 5km
  const [loading, setLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
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
  }, [radius, vendors]);

  const filteredVendors = useMemo(() => {
    if (!userLocation) return vendors;
    return vendors.filter(v => {
      const distance = getDistance(
        userLocation.latitude,
        userLocation.longitude,
        v.lat,
        v.lng
      );
      // Attach calculated distance for display
      v.distanceKm = distance.toFixed(1);
      return distance <= radius;
    });
  }, [vendors, radius, userLocation]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      const unsubscribe = onSnapshot(collection(db, "vendors"), (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setVendors(list);
        setLoading(false);
      });

      return () => unsubscribe();
    })();
  }, []);

  const handleRecenter = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
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
      {/* MAP BACKGROUND */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={userLocation}
        showsUserLocation={true}
        showsMyLocationButton={false} // Custom button used below
      >
        <UrlTile
          urlTemplate="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maximumZ={19}
        />

        {filteredVendors.map((vendor, index) => (
          <Marker
            key={vendor.id}
            coordinate={{ latitude: vendor.lat, longitude: vendor.lng }}
            tracksViewChanges={!isMapReady}
            onPress={() => onMarkerPress(vendor, index)}
          >
            <View style={styles.customMarker}>
              <View style={styles.markerInner}>
                <MaterialIcons name="local-dining" size={20} color={COLORS.primary} />
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* FLOATING TOP RADIUS SLIDER */}
      <View style={styles.topBarContainer}>
        <View style={styles.radiusContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>

          <View style={styles.sliderWrapper}>
            <View style={styles.radiusLabelRow}>
              <Text style={styles.radiusLabel}>Radius Pencarian</Text>
              <Text style={styles.radiusValue}>{radius} km</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={radius}
              onValueChange={setRadius}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor="#d1d5db"
              thumbTintColor={COLORS.primary}
            />
          </View>
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
          {filteredVendors.map((vendor) => (
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
          {filteredVendors.length === 0 && (
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
  radiusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 20,
  },
  sliderWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  radiusLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -4,
    paddingHorizontal: 4,
  },
  radiusLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  radiusValue: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
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
    bottom: 40,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: 230,
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