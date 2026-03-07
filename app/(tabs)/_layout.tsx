// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Image, Text, TouchableOpacity, View } from 'react-native';

const COLORS = {
  primary: "#f48c25",
  textDark: "#1c140d",
};

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#f4511e',
      headerShown: true,
      headerTitleStyle: { fontWeight: 'bold' },
      headerShadowVisible: false, // Clean look matching design
      headerStyle: { backgroundColor: '#fbf8f5' }, // Match home background
    }}>
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: "", // Hide default title
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16, gap: 8 }}>
              <View style={{ backgroundColor: COLORS.primary }}>
                <Image
                  source={require('../../assets/images/homeicon.png')}
                  style={{ width: 48, height: 48 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 }}>
                JajanKuy
              </Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={{
                marginRight: 16,
                backgroundColor: 'white',
                padding: 8,
                borderRadius: 50,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 5,
                elevation: 2
              }}
              onPress={() => router.push('/(tabs)/map')}
            >
              <Ionicons name="map-outline" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color }) => <Ionicons name="storefront" size={30} color={color} />,
          title: 'Beranda' // For Tab Label
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Peta',
          headerShown: false, // Map screen usually looks better without standard header as it has floating search bar
          tabBarIcon: ({ color }) => <Ionicons name="compass" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={30} color={color} />,
        }}
      />
    </Tabs>
  );
}