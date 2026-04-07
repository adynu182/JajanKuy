import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Linking, Modal, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '../../src/config/firebase';

const COLORS = {
  primary: "#f48c25",
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Zoomable Image Viewer Component with Pan support
function ZoomableImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const lastTap = useRef(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 5);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap — reset zoom and position
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
    lastTap.current = now;
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.modalOverlay}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Animated.Image
                source={{ uri }}
                style={[styles.modalImage, animatedStyle]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <TouchableOpacity
        style={styles.modalCloseBtn}
        onPress={onClose}
      >
        <Ionicons name="close-circle" size={36} color="#fff" />
      </TouchableOpacity>
    </GestureHandlerRootView>
  );
}

export default function DetailJajanan() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State untuk Rating
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [userReview, setUserReview] = useState<any>(null); // State untuk review user saat ini
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('');
  const [imageModalVisible, setImageModalVisible] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Mengambil ulasan yang vendorId-nya sesuai dengan ID jajanan ini
    const q = query(
      collection(db, "reviews"),
      where("vendorId", "==", id),
      orderBy("createdAt", "desc") // Komentar terbaru di atas
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setReviews(reviewData);

      // Cek apakah user sudah pernah review
      if (auth.currentUser) {
        const myReview = reviewData.find((r: any) => r.userId === auth.currentUser?.uid);

        setUserReview((prev: any) => {
          // Prevent unnecessary updates if data hasn't changed
          if (prev && myReview &&
            prev.id === myReview.id &&
            prev.rating === myReview.rating &&
            prev.comment === myReview.comment &&
            prev.updatedAt?.seconds === myReview.updatedAt?.seconds) {
            return prev;
          }
          return myReview || null;
        });
      }
    });

    return () => unsubscribe();
  }, [id]);

  // Sync form dengan userReview saat data dimuat
  useEffect(() => {
    if (userReview) {
      setRating(userReview.rating);
      setComment(userReview.comment);
    } else {
      setRating(0);
      setComment('');
    }
  }, [userReview]);

  useEffect(() => {
    const fetchVendor = async () => {
      const docRef = doc(db, "vendors", id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) setVendor(snap.data());
      setLoading(false);
    };

    const checkFavorite = async () => {
      if (auth.currentUser) {
        const favRef = doc(db, "users", auth.currentUser.uid, "favorites", id as string);
        const snap = await getDoc(favRef);
        setIsFavorite(snap.exists());
      }
    };

    fetchVendor();
    checkFavorite();
  }, [id]);

  // Fetch owner WhatsApp number
  useEffect(() => {
    if (!vendor?.ownerId) return;
    const fetchOwnerWa = async () => {
      try {
        const ownerDoc = await getDoc(doc(db, "users", vendor.ownerId));
        if (ownerDoc.exists()) {
          setOwnerWhatsapp(ownerDoc.data().whatsapp || '');
        }
      } catch (e) {
        console.error("Error fetching owner WA:", e);
      }
    };
    fetchOwnerWa();
  }, [vendor?.ownerId]);

  const toggleFavorite = async () => {
    if (!auth.currentUser) return Alert.alert("Ups!", "Login dulu untuk menyimpan favorit.");

    setFavLoading(true);
    const favRef = doc(db, "users", auth.currentUser.uid, "favorites", id as string);

    try {
      if (isFavorite) {
        await deleteDoc(favRef);
        setIsFavorite(false);
      } else {
        await setDoc(favRef, {
          vendorId: id,
          vendorName: vendor?.name || '',
          addedAt: serverTimestamp()
        });
        setIsFavorite(true);
      }
    } catch (e) {
      Alert.alert("Error", "Gagal mengupdate favorit.");
    } finally {
      setFavLoading(false);
    }
  };

  const openMap = () => {
    if (vendor?.lat && vendor?.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${vendor.lat},${vendor.lng}`;
      Linking.openURL(url);
    } else {
      Alert.alert("Info", "Lokasi tidak tersedia.");
    }
  };

  const openWhatsApp = () => {
    if (ownerWhatsapp) {
      Linking.openURL(`https://wa.me/${ownerWhatsapp}`);
    } else {
      Alert.alert("Info", "Nomor Tidak Tersedia");
    }
  };

  const submitReview = async () => {
    if (!auth.currentUser) return Alert.alert("Ups!", "Login dulu untuk kasih ulasan.");
    if (rating === 0) return Alert.alert("Bintang!", "Pilih jumlah bintang dulu.");

    setSubmitting(true);
    try {
      const vendorRef = doc(db, "vendors", id as string);

      // Ambil data vendor terbaru untuk perhitungan akurat
      const vendorSnap = await getDoc(vendorRef);
      if (!vendorSnap.exists()) throw new Error("Vendor not found");
      const vendorData = vendorSnap.data();

      // Ambil nama user terbaru dari Firestore
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userDocRef);
      const currentUserName = userSnap.exists() ? userSnap.data().name : (auth.currentUser.displayName || 'Anonim');

      const currentRating = vendorData.rating || 0;
      const currentCount = vendorData.reviewCount || 0;

      if (userReview) {
        // --- MODE EDIT ---
        const reviewRef = doc(db, "reviews", userReview.id);

        await updateDoc(reviewRef, {
          rating,
          comment,
          userName: currentUserName, // Update nama juga saat edit
          updatedAt: serverTimestamp(),
        });

        // Hitung ulang rating rata-rata
        // Rumus: (TotalRatingLama - RatingLamaUser + RatingBaruUser) / JumlahReview
        const oldTotal = currentRating * currentCount;
        const newTotal = oldTotal - userReview.rating + rating;
        const newRating = newTotal / currentCount;

        await updateDoc(vendorRef, {
          rating: Number(newRating.toFixed(1))
        });

        Alert.alert("Sukses", "Ulasan berhasil diperbarui!");

      } else {
        // --- MODE ADD ---
        await addDoc(collection(db, "reviews"), {
          vendorId: id,
          userId: auth.currentUser.uid,
          userName: currentUserName,
          rating,
          comment,
          createdAt: serverTimestamp(),
        });

        // Hitung Rata-rata Rating baru
        const newCount = currentCount + 1;
        const newRating = ((currentRating * currentCount) + rating) / newCount;

        await updateDoc(vendorRef, {
          rating: Number(newRating.toFixed(1)),
          reviewCount: newCount
        });

        Alert.alert("Sukses", "Ulasan berhasil dikirim!");
        // Reset form handled by userReview effect
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Gagal mengirim ulasan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = () => {
    Alert.alert("Hapus Ulasan", "Apakah Anda yakin ingin menghapus ulasan ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus", style: "destructive", onPress: async () => {
          setSubmitting(true);
          try {
            const vendorRef = doc(db, "vendors", id as string);

            // Ambil data vendor terbaru
            const vendorSnap = await getDoc(vendorRef);
            if (!vendorSnap.exists()) throw new Error("Vendor not found");
            const vendorData = vendorSnap.data();

            const currentRating = vendorData.rating || 0;
            const currentCount = vendorData.reviewCount || 0;

            // Hapus dokumen review
            await deleteDoc(doc(db, "reviews", userReview.id));

            // Update statistik vendor
            const newCount = currentCount - 1;
            let newRating = 0;

            if (newCount > 0) {
              const oldTotal = currentRating * currentCount;
              const newTotal = oldTotal - userReview.rating;
              newRating = newTotal / newCount;
            }

            await updateDoc(vendorRef, {
              rating: Number(newRating.toFixed(1)),
              reviewCount: newCount
            });

            Alert.alert("Dihapus", "Ulasan berhasil dihapus.");
            // State userReview akan null otomatis via onSnapshot
            setRating(0);
            setComment('');

          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Gagal menghapus ulasan.");
          } finally {
            setSubmitting(false);
          }
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container}>

      {vendor?.photoUrl ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setImageModalVisible(true)}>
          <Image source={{ uri: vendor.photoUrl }} style={styles.image} />
        </TouchableOpacity>
      ) : null}

      {/* Full Screen Image Modal with Pinch-to-Zoom */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <ZoomableImageViewer
          uri={vendor?.photoUrl}
          onClose={() => setImageModalVisible(false)}
        />
      </Modal>
      <View style={styles.infoBox}>
        <Text style={styles.title}>{vendor?.name}</Text>
        <Text style={styles.category}>{vendor?.category}</Text>
        <Text style={styles.price}>Mulai dari Rp {vendor?.minPrice?.toLocaleString() || '-'}</Text>

        {vendor?.notes ? (
          <View style={styles.noteContainer}>
            <Ionicons name="information-circle-outline" size={16} color="#666" style={{ marginTop: 2 }} />
            <Text style={styles.noteText}>{vendor.notes}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.btnAction, styles.btnWa]} onPress={openWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAction} onPress={openMap}>
            <Ionicons name="location-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnAction, styles.btnFav, isFavorite && styles.btnFavActive]}
            onPress={toggleFavorite}
            disabled={favLoading}
          >
            {favLoading ? (
              <ActivityIndicator color={isFavorite ? "#fff" : COLORS.primary} size="small" />
            ) : (
              <>
                <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={20} color={isFavorite ? "#fff" : COLORS.primary} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.reviewSection}>
        <Text style={styles.sectionTitle}>
          {userReview ? "Edit Ulasan Anda" : "Berikan Ulasan Anda"}
        </Text>


        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((num, idx) => (
            <TouchableOpacity
              key={num}
              onPress={() => setRating(num)}
              style={{ marginRight: idx < 4 ? 10 : 0 }}
            >
              <Ionicons
                name={num <= rating ? "star" : "star-outline"}
                size={30}
                color="#f1c40f"
              />
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.commentInput}
          placeholder="Tulis ulasan tentang jajanan ini..."
          value={comment}
          onChangeText={setComment}
          multiline
        />

        <View style={{ flexDirection: 'row', gap: 100 }}>
          {userReview && (
            <TouchableOpacity
              style={[styles.btnSubmit, { backgroundColor: '#d9534f', flex: 1, marginTop: 20 }]}
              onPress={handleDeleteReview}
              disabled={submitting}
            >
              <Text style={styles.btnText}>Hapus</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.btnSubmit,
              submitting && { backgroundColor: '#ccc' },
              userReview && { flex: 1 }
            ]}
            onPress={submitReview}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {userReview ? "Update Ulasan" : "Kirim Ulasan"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.listReviewSection}>
        <Text style={styles.sectionTitle}>Ulasan Pengguna ({reviews?.length ?? 0})</Text>
        {reviews.length > 0 ? (
          reviews.map((rev) => (
            <View key={rev.id} style={[styles.reviewCard, rev.id === userReview?.id && { backgroundColor: '#f0f8ff' }]}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>
                  {rev.userName || 'Anonim'}
                  {rev.id === userReview?.id ? " (Anda)" : ""}
                </Text>
                <View style={styles.starsSmall}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name="star"
                      size={12}
                      color={s <= rev.rating ? "#f1c40f" : "#ddd"}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewText}>{rev.comment}</Text>
              <Text style={styles.reviewDate}>
                {rev.createdAt && rev.createdAt.toDate
                  ? rev.createdAt.toDate().toLocaleDateString('id-ID')
                  : ''}
                {rev.updatedAt ? ' (diedit)' : ''}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyReview}>Belum ada ulasan. Jadi yang pertama!</Text>
        )}
      </View>
      <View style={{ height: 130 + insets.bottom }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  image: { width: '100%', height: 250 },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  infoBox: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold' },
  category: { fontSize: 16, color: '#666', marginTop: 5 },
  price: { fontSize: 18, color: '#f4511e', fontWeight: 'bold', marginTop: 10 },

  reviewSection: { padding: 20, backgroundColor: '#fff', marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center' // Bintang di tengah
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    backgroundColor: '#fafafa'
  },
  btnSubmit: {
    backgroundColor: '#f4511e',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  listReviewSection: { padding: 15, backgroundColor: '#fff', marginTop: 10 },
  reviewCard: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  reviewerName: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  starsSmall: { flexDirection: 'row' },
  reviewText: { fontSize: 14, color: '#555', lineHeight: 20 },
  reviewDate: { fontSize: 10, color: '#999', marginTop: 5 },
  emptyReview: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontStyle: 'italic'
  },

  // Note Section
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6
  },
  noteText: {
    fontSize: 14,
    color: '#c2410c',
    flex: 1,
    fontStyle: 'italic'
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 100,
    marginTop: 20,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: "#f4511e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4
  },
  btnActionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  btnFav: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: "#000",
    shadowOpacity: 0.05
  },
  btnFavActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: "#f4511e",
    shadowOpacity: 0.3
  },
  btnWa: {
    backgroundColor: '#25D366',
    shadowColor: '#25D366'
  }
});

