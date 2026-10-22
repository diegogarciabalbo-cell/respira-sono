import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/AppContext';
import { useT } from '../i18n/useT';
import { useTheme } from '../ui/theme';

function Gate() {
  const { ready, profile } = useApp();
  const t = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { t: tr } = useT();

  useEffect(() => {
    if (!ready) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile?.onboarding_completed_at && !inOnboarding) router.replace('/onboarding');
  }, [ready, profile, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.bg },
          headerBackTitle: tr('stack.back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="sessao/[id]" options={{ title: tr('stack.nightSummary') }} />
        <Stack.Screen name="exercicio/[id]" options={{ title: tr('stack.exercise') }} />
        <Stack.Screen name="diario" options={{ title: tr('stack.diary') }} />
        <Stack.Screen name="relatorio" options={{ title: tr('stack.report') }} />
        <Stack.Screen name="biblioteca" options={{ title: tr('stack.library') }} />
        <Stack.Screen name="conteudo" options={{ title: tr('stack.content') }} />
        <Stack.Screen name="teste-microfone" options={{ title: tr('stack.micTest') }} />
        <Stack.Screen name="sobre" options={{ title: tr('stack.about') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
