import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '../src/config/firebase';

export default function ManageStore() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);

  const [name, setName] = useState('');
  // const [category, setCategory] = useState(''); // REPLACED by selectedCategories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

  const OPTIONS = ['Makanan', 'Minuman', 'Jajanan', 'Buah', 'Es Krim'];

  useEffect(() => {
    if (id) {
      const loadData = async () => {
        try {
          const docRef = doc(db, "vendors", id as string);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setName(data.name);
            // setCategory(data.category);
            if (data.category) {
              // Handle comma-separated string back to array
              setSelectedCategories(data.category.split(',').map((c: string) => c.trim()));
            }
            setMinPrice(data.minPrice.toString());
            setNotes(data.notes || '');
            setImage(data.photoUrl);
            setLocation({ lat: data.lat, lng: data.lng });
          }
        } catch (e) {
          Alert.alert("Error", "Gagal memuat data.");
        } finally {
          setFetching(false);
        }
      };
      loadData();
    }
  }, [id]);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const takePhoto = async () => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    const locationPerm = await Location.requestForegroundPermissionsAsync();

    if (cameraPerm.status !== 'granted' || locationPerm.status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Butuh kamera & lokasi.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
      const manipulated = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: SaveFormat.JPEG }
      );
      setImage(manipulated.uri);
      try {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (e) {
        Alert.alert('Lokasi Gagal', 'Gagal mengunci posisi GPS.');
      }
    }
  };

  const uploadToCloudinary = async (uri: string) => {
    // Cloudinary credentials from environment variables
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.error('Missing Cloudinary environment variables');
      return null;
    }

    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'upload.jpg' } as any);
    data.append('upload_preset', uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: data,
      });
      const resData = await res.json();
      return resData.secure_url;
    } catch (e) {
      return null;
    }
  };

  const handleSave = async () => {
    if (!name || selectedCategories.length === 0 || !minPrice || !image || !location) {
      Alert.alert('Data Kosong', 'Lengkapi data, kategori, dan foto di lokasi.');
      return;
    }

    setLoading(true);
    try {
      let finalUrl = image;
      if (image.startsWith('file://')) {
        const uploadedUrl = await uploadToCloudinary(image);
        if (uploadedUrl) finalUrl = uploadedUrl;
      }

      const payload = {
        name,
        category: selectedCategories.join(', '), // Save as "Makanan, Minuman"
        minPrice: Number(minPrice),
        notes: notes.trim(),
        lat: location.lat,
        lng: location.lng,
        photoUrl: finalUrl,
        updatedAt: serverTimestamp(),
      };

      if (id) {
        await updateDoc(doc(db, "vendors", id as string), payload);
      } else {
        await addDoc(collection(db, "vendors"), {
          ...payload,
          ownerId: auth.currentUser?.uid,
          rating: 5.0,
          createdAt: serverTimestamp(),
        });
      }
      Alert.alert('Sukses', 'Data disimpan!');
      router.replace('/(tabs)/profile');
    } catch (e) {
      Alert.alert('Gagal', 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Hapus', 'Yakin ingin menghapus?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, "vendors", id as string));
          router.replace('/(tabs)/profile');
        }
      },
    ]);
  };

  if (fetching) return <ActivityIndicator size="large" color="#f4511e" style={styles.centered} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{id ? 'Edit Dagangan' : 'Daftar Dagangan Baru'}</Text>
      </View>

      <Text style={styles.label}>Nama Gerobak / Warung</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Seblak Judes" maxLength={36} />

      <Text style={styles.label}>Kategori (Pilih minimal satu)</Text>
      {/* <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Jajanan" /> */}
      <View style={styles.categoryContainer}>
        {OPTIONS.map(opt => {
          const isSelected = selectedCategories.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => toggleCategory(opt)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{opt}</Text>
              {isSelected && <Ionicons name="checkmark-circle" size={16} color="white" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Harga Termurah (Rp)</Text>
      <TextInput style={styles.input} value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" placeholder="10000" maxLength={9} />

      <Text style={styles.label}>Catatan (Opsional)</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Contoh: Buka setiap sore, terima pesanan, dll."
        multiline
        maxLength={100}
      />

      <Text style={styles.label}>Foto & Lokasi</Text>
      <TouchableOpacity style={styles.cameraBox} onPress={takePhoto}>
        {image ? (
          <View style={styles.full}>
            <Image source={{ uri: image }} style={styles.full} />
            {location && (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={14} color="white" />
                <Text style={styles.badgeText}>Lokasi Terkunci</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera" size={50} color="#f4511e" />
            <Text style={styles.placeholderText}>Ambil Foto di Lokasi</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>SIMPAN PERUBAHAN</Text>}
      </TouchableOpacity>

      {id && (
        <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
          <Text style={styles.btnDeleteText}>Hapus Dagangan</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={{ alignItems: 'center', marginBottom: 300 }} >

      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  centered: { flex: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20, marginTop: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', marginTop: 15, color: '#666' },
  input: { borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 8, fontSize: 16 },
  cameraBox: { width: '100%', height: 250, backgroundColor: '#fafafa', borderRadius: 15, marginTop: 10, borderStyle: 'dashed', borderWidth: 2, borderColor: '#f4511e', overflow: 'hidden' },
  full: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  placeholderText: { color: '#f4511e', marginTop: 10, fontWeight: 'bold', fontSize: 14 },
  badge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#2ecc71', flexDirection: 'row', padding: 6, borderRadius: 20, alignItems: 'center', gap: 4 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  btn: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  btnSave: { backgroundColor: '#f4511e' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnDelete: { marginTop: 15, padding: 15, alignItems: 'center', marginBottom: 50 },
  btnDeleteText: { color: '#e74c3c', fontWeight: 'bold' },

  // Chip Styles
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9', flexDirection: 'row', alignItems: 'center' },
  chipActive: { borderColor: '#f4511e', backgroundColor: '#fff7ed' },
  chipText: { color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#f4511e' },
});