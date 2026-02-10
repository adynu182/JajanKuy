// app/_layout.tsx
import { Stack } from 'expo-router';
import { View } from 'react-native';
import OfflineWarning from '../components/OfflineWarning';

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <OfflineWarning />
      <Stack>
        {/* (tabs) akan merender Bottom Tab Bar */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Detail tidak memakai Tab Bar, jadi kita letakkan di Stack luar */}
        <Stack.Screen
          name="detail/[id]"
          options={{
            title: 'Detail Jajanan',
            headerBackTitle: 'Kembali'
          }}
        />
        <Stack.Screen name="manage-store" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}