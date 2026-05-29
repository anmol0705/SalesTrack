import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  useEffect(() => {
    const check = async () => {
      await useAuthStore.getState().hydrate();
      const { token } = useAuthStore.getState();
      if (token) {
        router.replace('/(tabs)/');
      } else {
        router.replace('/(auth)/login');
      }
    };
    check();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1D9E75" />
    </View>
  );
}
