// app/_layout.tsx
import { Stack } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import OfflineWarning from '../components/OfflineWarning';

// Disable font scaling globally — works reliably in Expo Go
// Override render to force allowFontScaling=false on every Text/TextInput
const originalTextRender = (Text as any).render;
if (originalTextRender) {
  (Text as any).render = function (props: any, ref: any) {
    return originalTextRender.call(this, { ...props, allowFontScaling: false, maxFontSizeMultiplier: 1 }, ref);
  };
}

const originalTextInputRender = (TextInput as any).render;
if (originalTextInputRender) {
  (TextInput as any).render = function (props: any, ref: any) {
    return originalTextInputRender.call(this, { ...props, allowFontScaling: false, maxFontSizeMultiplier: 1 }, ref);
  };
}

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