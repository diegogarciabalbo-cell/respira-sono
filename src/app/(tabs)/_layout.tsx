import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { useT } from '../../i18n/useT';
import { useTheme } from '../../ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useT();
  const icon = (name: IconName) => ({ color, size }: { color: any; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.text,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, minHeight: 60 },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarLabelStyle: { fontSize: t.fs(12), fontWeight: '600' },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('tabs.today'), tabBarIcon: icon('sunny-outline') }} />
      <Tabs.Screen name="gravar" options={{ title: tr('tabs.record'), tabBarIcon: icon('mic-outline') }} />
      <Tabs.Screen name="exercicios" options={{ title: tr('tabs.exercises'), tabBarIcon: icon('fitness-outline') }} />
      <Tabs.Screen name="historico" options={{ title: tr('tabs.history'), tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: tr('tabs.profile'), tabBarIcon: icon('shield-checkmark-outline') }} />
    </Tabs>
  );
}
