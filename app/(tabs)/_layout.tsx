import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#FF6B35', headerTitleAlign: 'center' }}>
      <Tabs.Screen name="home" options={{ title: 'Feed' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="mine" options={{ title: 'My Reports' }} />
    </Tabs>
  );
}
