import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, endAt, getDocs, limit, onSnapshot, orderBy, query, startAt } from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
// Make sure existing imports are preserved/merged
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { auth, db } from '../../src/config/firebase';

const COLORS = {
  primary: "#f48c25",
  background: "#fbf8f5", // Creamy background
  textDark: "#1c140d",
  textGray: "#9ca3af",
  white: "#ffffff",
  cardBg: "#ffffff",
  orangeLight: "#fff7ed",
};

const CATEGORIES = [
  { id: '1', name: 'Makanan', icon: 'utensils', color: '#fed7aa' },
  { id: '2', name: 'Minuman', icon: 'wine-glass-alt', color: '#bfdbfe' },
  { id: '3', name: 'Jajanan', icon: 'cookie-bite', color: '#fecaca' },
  { id: '4', name: 'Buah', icon: 'apple-alt', color: '#ade6c1ff' },
  { id: '5', name: 'Es Krim', icon: 'ice-cream', color: '#f3f7a9ff' },
  { id: '6', name: 'Lainnya', icon: 'question', color: '#e5e7eb' },
];


export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const activeSlideIndex = useRef(0);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [UserLocation, setUserLocation] = useState<any>(null);
  const [sortOption, setSortOption] = useState<'closest' | 'cheapest' | 'expensive'>('closest');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [promoImages, setPromoImages] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (promoImages.length === 0) return;
    const slideTimer = setInterval(() => {
      let nextIndex = activeSlideIndex.current + 1;
      if (nextIndex >= promoImages.length) {
        nextIndex = 0;
      }
      activeSlideIndex.current = nextIndex;
      scrollRef.current?.scrollTo({ x: nextIndex * 316, animated: true });
    }, 5000);
    return () => clearInterval(slideTimer);
  }, [promoImages.length]);

  // Fetch Promo Images from Firestore
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const q = query(collection(db, 'promos'));
        const qs = await getDocs(q);
        if (!qs.empty) {
          // Supports documents with 'imageUrl' or 'image' fields
          const images = qs.docs.map(doc => doc.data().imageUrl || doc.data().image).filter(Boolean);
          if (images.length > 0) {
            setPromoImages(images);
          }
        }
      } catch (e) {
        console.log("Error fetching promos:", e);
      }
    };
    fetchPromos();
  }, []);

  // Fungsi menghitung jarak (Hasil dalam KM)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2 +
      c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setFavorites([]);
        setShowFavoritesOnly(false);
      }
    });
    return unsubscribe;
  }, []);

  // Monitor Favorites
  useEffect(() => {
    if (!user) return;

    const favRef = collection(db, "favorites");
    const unsubscribe = onSnapshot(favRef, (snapshot) => {
      const favIds = snapshot.docs.map(doc => doc.id); // doc.id is usually vendorId based on detail page logic
      setFavorites(favIds);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let location = null;
      if (status === 'granted') {
        location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
      }

      let list: any[] = [];
      if (location) {
        const center: [number, number] = [location.coords.latitude, location.coords.longitude];
        const radiusInM = 5000;
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
        for (const snap of snapshots) {
          for (const doc of snap.docs) {
            const data = doc.data();
            // distance check
            const distance = calculateDistance(
              location.coords.latitude,
              location.coords.longitude,
              data.lat,
              data.lng
            );
            if (distance <= 5) {
              list.push({ id: doc.id, ...data, distance, price: data.minPrice || data.price || 0 });
            }
          }
        }
        // deduplicate bounds results
        list = Array.from(new Map(list.map(item => [item.id, item])).values());
      } else {
        const q = query(collection(db, "vendors"), orderBy('createdAt', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        list = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, distance: 999, price: data.minPrice || data.price || 0 };
        });
      }

      setAllVendors(list);
      setLoading(false);
    })();
  }, []);

  // Filter and Sort Effect
  useEffect(() => {
    let result = [...allVendors];

    // 1. Filter by Category
    if (selectedCategory) {
      result = result.filter(v =>
        v.category && v.category.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // 2. Filter by Search Query
    if (searchQuery) {
      result = result.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 3. Filter by Favorites (Independent)
    if (showFavoritesOnly) {
      result = result.filter(v => favorites.includes(v.id));
    }

    // 4. Sort (Always applied)
    if (sortOption === 'closest') {
      result.sort((a, b) => a.distance - b.distance);
    } else if (sortOption === 'cheapest') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'expensive') {
      result.sort((a, b) => b.price - a.price);
    }

    setFilteredVendors(result);
    setVisibleCount(10);
  }, [allVendors, sortOption, selectedCategory, searchQuery, favorites, showFavoritesOnly]);

  const handleCategoryPress = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null); // Deselect
    } else {
      setSelectedCategory(categoryName);
    }
  };

  const handleFilterPress = (opt: string) => {
    if (opt === 'favorite') {
      setShowFavoritesOnly(!showFavoritesOnly);
    } else {
      setSortOption(opt as any);
    }
  };

  const renderSearchAndFilters = () => (
    <>
      {/* SEARCH BOX + FAVORITE BUTTON */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color={COLORS.textGray} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari jajanan favoritmu..."
            placeholderTextColor={COLORS.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textGray} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.favButton,
            showFavoritesOnly && styles.favButtonActive,
          ]}
          onPress={() => handleFilterPress('favorite')}
        >
          <Ionicons
            name={showFavoritesOnly ? "heart" : "heart-outline"}
            size={22}
            color={showFavoritesOnly ? "#fff" : "#ef4444"}
          />
        </TouchableOpacity>
      </View>

      {/* PROMO SLIDES */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.promoContainer}
        snapToInterval={316}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const offsetX = e.nativeEvent.contentOffset.x;
          activeSlideIndex.current = Math.round(offsetX / 316);
        }}
      >
        {promoImages.map((img, idx) => (
          <TouchableOpacity key={idx} activeOpacity={0.9}>
            <Image source={{ uri: img }} style={styles.promoImage} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FILTERS */}
      <View style={styles.filterContainer}>
        {['closest', 'cheapest', 'expensive'].map((opt) => {
          const labels: Record<string, string> = { closest: 'Terdekat', cheapest: 'Termurah', expensive: 'Termahal' };
          const isActive = sortOption === opt;

          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
              ]}
              onPress={() => handleFilterPress(opt)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {labels[opt]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </>
  );

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );


  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={[{ title: 'List Jajanan', data: filteredVendors.slice(0, visibleCount) }]}
        keyExtractor={(item: any) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 0 }}
        ListHeaderComponent={
          <>
            {renderSearchAndFilters()}
            <View style={styles.sectionHeader}>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.name;
                return (
                  <TouchableOpacity key={cat.id} style={styles.categoryItem} onPress={() => handleCategoryPress(cat.name)}>
                    <View style={[
                      styles.categoryIcon,
                      {
                        backgroundColor: isActive ? COLORS.primary : cat.color,
                        borderWidth: isActive ? 2 : 0,
                        borderColor: 'red'
                      }
                    ]}>
                      <FontAwesome5 name={cat.icon as any} size={24} color={isActive ? 'white' : COLORS.primary} />
                    </View>
                    <Text style={[styles.categoryLabel, isActive && { color: COLORS.primary, fontWeight: 'bold' }]}>{cat.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </>
        }
        // disable sticky headers since search/filter is handled separately

        renderItem={({ item }) => (
          <TouchableOpacity key={item.id} style={styles.nearbyCard} onPress={() => router.push(`/detail/${item.id}`)}>
            <Image source={{ uri: item.photoUrl }} style={styles.nearbyImage} />
            <View style={styles.nearbyInfo}>
              <Text style={styles.nearbyName}>{item.name}</Text>
              <Text style={styles.nearbyDesc}>
                {item.price ? `Mulai Rp ${item.price.toLocaleString()}` : 'Harga belum tersedia'}
              </Text>

              <View style={styles.nearbyMetaRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.nearbyRating}>{item.rating || 4.5}</Text>
                <Ionicons name="location-sharp" size={14} color="#9ca3af" style={{ marginLeft: 8 }} />
                <Text style={styles.nearbyDistance}>{item.distance?.toFixed(1)} km</Text>
              </View>
            </View>
            <View style={styles.nearbyAction}>
              <View style={styles.arrowButton}>
                <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          filteredVendors.length > visibleCount ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => setVisibleCount(prev => prev + 5)}
              activeOpacity={0.7}
            >
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Hero Title
  heroTitleContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 6
  },
  heroTitleMain: {
    fontSize: 25,
    fontWeight: '700',
    color: '#0f172a', // Dark slate
    lineHeight: 30,
  },
  heroTitleSub: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.primary,
    lineHeight: 30,
  },

  // Search Box
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 5,
    marginTop: 5,
    gap: 10,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textDark,
  },
  favButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  favButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },

  // Promo Slides
  promoContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 5,
    gap: 16,
  },
  promoImage: {
    width: 300,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#eee',
  },

  // Categories
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  categoryList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 8,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    // colors handled inline
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },

  // Nearby List
  nearbyList: {
    paddingHorizontal: 20,
    gap: 7,
  },
  nearbyCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  nearbyImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  nearbyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nearbyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  nearbyDesc: {
    fontSize: 12,
    color: '#64748b', // Slate 500
    marginBottom: 8,
  },
  nearbyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearbyRating: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginLeft: 4,
  },
  nearbyDistance: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  nearbyAction: {
    justifyContent: 'center',
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filters
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: 'white',
  },
  loadMoreBtn: {
    backgroundColor: '#f8ddb9ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  loadMoreText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});