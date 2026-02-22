import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore'; // Make sure existing imports are preserved/merged
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  { id: '1', name: 'Makanan', icon: 'utensils', type: 'FontAwesome5', color: '#fed7aa' },
  { id: '2', name: 'Minuman', icon: 'wine-glass-alt', type: 'FontAwesome5', color: '#bfdbfe' },
  { id: '3', name: 'Jajanan', icon: 'cookie-bite', type: 'FontAwesome5', color: '#fecaca' },
  { id: '4', name: 'Buah', icon: 'carrot', type: 'FontAwesome5', color: '#bbf7d0' },
  { id: '5', name: 'Es Krim', icon: 'ice-cream', type: 'FontAwesome5', color: '#f3f7a9ff' },
];

export default function HomeScreen() {
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [sortOption, setSortOption] = useState<'closest' | 'cheapest' | 'expensive'>('closest');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [searchSectionOffset, setSearchSectionOffset] = useState(200);
  const router = useRouter();

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

    const favRef = collection(db, "users", user.uid, "favorites");
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

      const querySnapshot = await getDocs(collection(db, "vendors"));
      let list = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let distance = 0;
        if (location) {
          distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            data.lat,
            data.lng
          );
        }
        // Ensure price exists for sorting, default to 0 if missing
        return { id: doc.id, ...data, distance, price: data.minPrice || data.price || 0 };
      });

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

  const handleScroll = (event: any) => {
    setScrollPosition(event.nativeEvent.contentOffset.y);
  };

  const renderSearchAndFilters = () => (
    <>
      {/* SEARCH BOX */}
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
      </View>

      {/* FILTERS */}
      <View style={styles.filterContainer}>
        {['closest', 'cheapest', 'expensive', 'favorite'].map((opt) => {
          const labels: Record<string, string> = { closest: 'Terdekat', cheapest: 'Termurah', expensive: 'Termahal' };
          const isFavorite = opt === 'favorite';
          const isActive = isFavorite ? showFavoritesOnly : sortOption === opt;

          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
                isFavorite && { borderColor: '#ef4444' }
              ]}
              onPress={() => handleFilterPress(opt)}
            >
              {isFavorite ? (
                <Ionicons name={isActive ? "heart" : "heart-outline"} size={20} color={isActive ? "white" : "#ef4444"} />
              ) : (
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {labels[opt]}
                </Text>
              )}
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
    <View style={{flex: 1}}>
      {/* STICKY SEARCH AND FILTERS - Shows when scrolled past */}
      {scrollPosition > searchSectionOffset && (
        <View style={styles.stickyHeader}>
          {renderSearchAndFilters()}
        </View>
      )}

      {/* SCROLLABLE CONTENT */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* HERO TITLE */}
        <View style={styles.heroTitleContainer}>
          <Text style={styles.heroTitleMain}>Cari jajanan</Text>
          <Text style={styles.heroTitleSub}>lezat disekelilingmu</Text>
        </View>

        {/* CATEGORIES */}
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

        {/* SEARCH BOX AND FILTERS - Regular position in scroll */}
        {renderSearchAndFilters()}

        {/* NEARBY LIST */}
        <View style={[styles.sectionHeader, { marginTop: 10 }]}>
          <Text style={styles.sectionTitle}>List Jajanan</Text>
          <TouchableOpacity>
            <Ionicons name="options-outline" size={20} color={COLORS.textGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.nearbyList}>
          {filteredVendors.map((item) => (
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
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Sticky Header
  stickyHeader: {
    backgroundColor: COLORS.background,
    paddingTop: 16,
    paddingBottom: 8,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  // header: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   paddingHorizontal: 20,
  //   paddingVertical: 10,
  // },
  // logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // logoIconBg: {
  //   backgroundColor: COLORS.primary,
  //   padding: 6,
  //   borderRadius: 12,
  // },
  // logoText: {
  //   fontSize: 20,
  //   fontWeight: '800', // Extra bold
  //   color: COLORS.primary,
  //   letterSpacing: 0.5,
  // },
  // mapBtn: {
  //   backgroundColor: COLORS.white,
  //   padding: 10,
  //   borderRadius: 50,
  //   shadowColor: '#000',
  //   shadowOpacity: 0.05,
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowRadius: 5,
  //   elevation: 2,
  // },

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
    paddingHorizontal: 20,
    marginBottom: 5,
    marginTop: 5,
  },
  searchWrapper: {
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
});