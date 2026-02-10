import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../../src/config/firebase';

const COLORS = {
  primary: "#f48c25",
};

export default function DetailJajanan() {
  const { id } = useLocalSearchParams();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State untuk Rating
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

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
      }));
      setReviews(reviewData);
    });

    return () => unsubscribe();
  }, [id]);

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

  const submitReview = async () => {
    if (!auth.currentUser) return Alert.alert("Ups!", "Login dulu untuk kasih ulasan.");
    if (rating === 0) return Alert.alert("Bintang!", "Pilih jumlah bintang dulu.");

    setSubmitting(true);
    try {
      // 1. Tambah ke koleksi reviews
      await addDoc(collection(db, "reviews"), {
        vendorId: id,
        userId: auth.currentUser.uid,
        userName: auth.currentUser.email?.split('@')[0],
        rating,
        comment,
        createdAt: serverTimestamp(),
      });

      // 2. Hitung Rata-rata Rating baru
      const vendorRef = doc(db, "vendors", id as string);
      const currentRating = vendor?.rating || 0;
      const currentCount = vendor?.reviewCount || 0;
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + rating) / newCount;

      await updateDoc(vendorRef, {
        rating: Number(newRating.toFixed(1)),
        reviewCount: newCount
      });

      Alert.alert("Sukses", "Ulasan berhasil dikirim!");
      setRating(0);
      setComment('');
    } catch (e) {
      Alert.alert("Error", "Gagal mengirim ulasan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <ScrollView style={styles.container}>

      {vendor?.photoUrl ? (
        <Image source={{ uri: vendor.photoUrl }} style={styles.image} />
      ) : null}
      <View style={styles.infoBox}>
        <Text style={styles.title}>{vendor?.name}</Text>
        <Text style={styles.category}>{vendor?.category}</Text>
        <Text style={styles.price}>Mulai dari Rp {String(vendor?.minPrice || '-')}</Text>

        {vendor?.notes ? (
          <View style={styles.noteContainer}>
            <Ionicons name="information-circle-outline" size={16} color="#666" style={{ marginTop: 2 }} />
            <Text style={styles.noteText}>{vendor.notes}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnAction} onPress={openMap}>
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.btnActionText}>Petunjuk Arah</Text>
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
                <Text style={[styles.btnActionText, { color: isFavorite ? "#fff" : COLORS.primary }]}>
                  {isFavorite ? "Disimpan" : "Simpan"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.reviewSection}>
        <Text style={styles.sectionTitle}>Berikan Ulasan Anda</Text>


        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((num, idx) => (
            <TouchableOpacity
              key={num}
              onPress={() => setRating(num)}
              style={{ marginRight: idx < 4 ? 10 : 0 }}
            >
              <Ionicons
                name={num <= rating ? "star" : "star-outline"}
                size={35}
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

        <TouchableOpacity
          style={[styles.btnSubmit, submitting && { backgroundColor: '#ccc' }]}
          onPress={submitReview}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>KIRIM ULASAN</Text>
          )}
        </TouchableOpacity>
      </View>


      <View style={styles.listReviewSection}>
        <Text style={styles.sectionTitle}>Ulasan Pengguna ({reviews?.length ?? 0})</Text>
        {reviews.length > 0 ? (
          reviews.map((rev) => (
            <View key={rev.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{rev.userName || 'Anonim'}</Text>
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
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyReview}>Belum ada ulasan. Jadi yang pertama!</Text>
        )}
      </View>
      <View style={{ height: 130 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  image: { width: '100%', height: 250 },
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
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  listReviewSection: { padding: 20, backgroundColor: '#fff', marginTop: 10 },
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
    gap: 12,
    marginTop: 20
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 25,
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
  }
});

