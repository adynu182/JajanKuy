import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
// Tambah import Firestore
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '../../src/config/firebase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'pengguna' | 'penjual'>('pengguna');
  const [myStores, setMyStores] = useState<any[]>([]);
  const router = useRouter();

  // New State for Name and Anti-Spam
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [spamAnswer, setSpamAnswer] = useState('');
  const [spamChallenge, setSpamChallenge] = useState({ q: '', a: 0 });

  // Generate Challenge
  const generateSpamChallenge = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setSpamChallenge({ q: `${num1} + ${num2}`, a: num1 + num2 });
    setSpamAnswer('');
  };

  // Mask WhatsApp Number - Show only last 3 digits
  const maskWhatsapp = (wa: string) => {
    if (!wa || wa.length <= 3) return wa;
    const lastThree = wa.slice(-3);
    const asterisks = '*'.repeat(wa.length - 3);
    return asterisks + lastThree;
  };

  // Mask Email - Show first letter, last letter before @, and domain
  const maskEmail = (email: string) => {
    if (!email) return email;
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;

    if (localPart.length <= 2) {
      return localPart + '@' + domain;
    }

    const firstChar = localPart[0];
    const lastChar = localPart[localPart.length - 1];
    const maskedLength = localPart.length - 2;
    const masked = firstChar + '*'.repeat(maskedLength) + lastChar;

    return masked + '@' + domain;
  };

  // Monitor Status Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUserData(null);
        setMyStores([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Ambil data dagangan jika user adalah penjual
  useEffect(() => {
    if (user && userData?.role === 'penjual') {
      const fetchMyStores = async () => {
        try {
          const q = query(collection(db, "vendors"), where("ownerId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setMyStores(list);
        } catch (error) {
          console.error("Error fetching stores:", error);
        }
      };
      fetchMyStores();
    }
  }, [user, userData]);

  // Generate challenge when register mode is active
  useEffect(() => {
    if (isRegister) {
      generateSpamChallenge();
    }
  }, [isRegister]);

  const handleAuth = async () => {
    try {
      if (isRegister) {
        // Validate Name
        if (!name.trim()) {
          alert("Nama lengkap harus diisi!");
          return;
        }
        // Validate Math Challenge
        if (parseInt(spamAnswer) !== spamChallenge.a) {
          alert("Jawaban keamanan salah! Coba lagi.");
          generateSpamChallenge();
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name: name,
          email: email,
          whatsapp: whatsapp.trim() ? `62${whatsapp.replace(/^0+/, '')}` : '',
          role: role,
          createdAt: new Date()
        });
        alert(`Berhasil daftar sebagai ${role}`);
        setName('');
        setWhatsapp('');
        setSpamAnswer('');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      // Handle login/registration errors
      let errorMessage = "Terjadi kesalahan. Silakan coba lagi.";

      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "Email atau password yang Anda masukkan salah.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Format email tidak valid.";
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = "Akun ini telah dinonaktifkan.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Terlalu banyak percobaan login. Coba lagi nanti.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Email ini sudah terdaftar.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password harus minimal 6 karakter.";
      }

      alert(errorMessage);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#f4511e" style={{ flex: 1 }} />;

  if (user) {
    return (
      <ScrollView contentContainerStyle={[styles.containerCenter, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.profileCard}>
          <Ionicons
            name={userData?.role === 'penjual' ? "storefront" : "person-circle"}
            size={100}
            color="#f4511e"
          />
          <Text style={styles.welcomeText}>
            Halo, {userData?.name || (userData?.role === 'penjual' ? 'Mitra Penjual' : 'Sobat Jajan')}
          </Text>
          <Text style={styles.emailText}>{maskEmail(user.email)}</Text>
          {userData?.whatsapp ? (
            <Text style={styles.emailText}>WA: +{maskWhatsapp(userData.whatsapp)}</Text>
          ) : null}

          <View style={styles.divider} />

          {userData?.role === 'penjual' && (
            <View style={{ width: '100%', marginBottom: 20 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 10, fontSize: 16 }}>Dagangan Saya:</Text>
              {myStores.length > 0 ? (
                myStores.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.storeListItem}
                    onPress={() => router.push(`/manage-store?id=${item.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                      <Text style={{ color: '#666' }}>{item.category}</Text>
                    </View>
                    <Ionicons name="create-outline" size={24} color="#f4511e" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: '#999', fontStyle: 'italic', marginBottom: 10 }}>Belum ada dagangan terdaftar.</Text>
              )}

              <TouchableOpacity style={styles.btnSpecial} onPress={() => router.push('/manage-store')}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.btnText}>Tambah Dagangan Baru</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.btnLogout} onPress={() => signOut(auth)}>
            <Text style={styles.btnText}>Keluar Akun</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#f8f8f8' }}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.title}>{isRegister ? 'Daftar Akun' : 'Masuk JajanKuy'}</Text>

        {isRegister && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nama / Username"
              value={name}
              onChangeText={setName}
            />
            <View style={styles.waContainer}>
              <Text style={styles.waPrefix}>+62</Text>
              <TextInput
                style={styles.waInput}
                placeholder="Nomor WhatsApp (opsional)"
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
              />
            </View>
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {isRegister && (
          <>
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>Daftar Sebagai:</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBox, role === 'pengguna' && styles.roleBoxActive]}
                  onPress={() => setRole('pengguna')}
                >
                  <Ionicons name="people" size={20} color={role === 'pengguna' ? '#fff' : '#666'} />
                  <Text style={[styles.roleText, role === 'pengguna' && styles.roleTextActive]}>Pengguna</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBox, role === 'penjual' && styles.roleBoxActive]}
                  onPress={() => setRole('penjual')}
                >
                  <Ionicons name="storefront" size={20} color={role === 'penjual' ? '#fff' : '#666'} />
                  <Text style={[styles.roleText, role === 'penjual' && styles.roleTextActive]}>Penjual</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={styles.roleLabel}>Keamanan: {spamChallenge.q} = ?</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="Jawaban Angka"
                value={spamAnswer}
                onChangeText={setSpamAnswer}
                keyboardType="numeric"
              />
            </View>
          </>
        )}

        <TouchableOpacity style={styles.btnLogin} onPress={handleAuth}>
          <Text style={styles.btnText}>{isRegister ? 'Daftar' : 'Masuk'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.switchText}>
            {isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center', backgroundColor: '#fff' },
  containerCenter: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f8f8', paddingVertical: 20 },
  profileCard: { backgroundColor: '#fff', padding: 25, borderRadius: 20, alignItems: 'center', elevation: 5, width: '90%' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#f4511e' },
  input: { borderBottomWidth: 1, borderBottomColor: '#ddd', marginBottom: 20, padding: 10, fontSize: 16 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ddd', marginBottom: 20 },
  passwordInput: { flex: 1, padding: 10, fontSize: 16 },
  eyeIcon: { padding: 10 },
  btnLogin: { backgroundColor: '#f4511e', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnLogout: { backgroundColor: '#333', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, width: '100%' },
  waContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ddd', marginBottom: 20 },
  waPrefix: { fontSize: 16, color: '#333', fontWeight: 'bold', paddingHorizontal: 10 },
  waInput: { flex: 1, padding: 10, fontSize: 16 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  emailText: { fontSize: 16, marginVertical: 5, color: '#555' },
  switchText: { textAlign: 'center', marginTop: 20, color: '#f4511e' },
  welcomeText: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  divider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 20 },
  roleContainer: { marginVertical: 15 },
  roleLabel: { fontSize: 14, color: '#666', marginBottom: 10 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', gap: 8 },
  roleBoxActive: { backgroundColor: '#f4511e', borderColor: '#f4511e' },
  roleText: { color: '#666', fontWeight: 'bold' },
  roleTextActive: { color: '#fff' },
  storeListItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  btnSpecial: { flexDirection: 'row', backgroundColor: '#2ecc71', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 8 },
  btnSecondary: { flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f4511e', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 8 },
  btnSecondaryText: { color: '#f4511e', fontWeight: 'bold' },
});