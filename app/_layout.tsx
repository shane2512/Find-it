import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: 'center' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Login' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="report" options={{ title: 'Report Item' }} />
      <Stack.Screen name="item/[id]" options={{ title: 'Item Details' }} />
      <Stack.Screen name="chat/[threadId]" options={{ title: 'Recovery Chat' }} />
    </Stack>
  );
}