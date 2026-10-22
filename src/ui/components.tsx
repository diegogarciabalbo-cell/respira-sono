import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const inner = <View style={{ padding: 16, gap: 14, paddingBottom: 40 }}>{children}</View>;
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? <ScrollView contentInsetAdjustmentBehavior="automatic">{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={{ color: t.text, fontSize: t.fs(26), fontWeight: '700' }}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={{ color: t.text, fontSize: t.fs(18), fontWeight: '700' }}>{children}</Text>;
}

export function P({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: any }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.textMuted : t.text, fontSize: t.fs(16), lineHeight: t.fs(23) }, style]}>{children}</Text>;
}

export function Small({ children, color }: { children: React.ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={{ color: color ?? t.textMuted, fontSize: t.fs(13.5), lineHeight: t.fs(19) }}>{children}</Text>;
}

export function Card({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: 'default' | 'accent' | 'warn' | 'danger' | 'demo' }) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.accentSoft : tone === 'warn' ? t.warnSoft : tone === 'danger' ? t.dangerSoft : t.surface;
  const border = tone === 'demo' ? t.demo : t.border;
  return (
    <View style={[{ backgroundColor: bg, borderRadius: 16, padding: 16, gap: 8, borderWidth: tone === 'demo' ? 2 : StyleSheet.hairlineWidth, borderColor: border, borderStyle: tone === 'demo' ? 'dashed' : 'solid' }, style]}>
      {children}
    </View>
  );
}

export function Button({
  title, onPress, kind = 'primary', disabled, loading, accessibilityHint, big,
}: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean;
  accessibilityHint?: string; big?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? t.danger : kind === 'secondary' ? t.surfaceAlt : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? (t.dark ? t.bg : '#fff') : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        minHeight: big ? 64 : 52,
        borderRadius: 14,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: kind === 'ghost' ? 1 : 0,
        borderColor: t.border,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: t.fs(big ? 19 : 16.5), fontWeight: '700' }}>{title}</Text>}
    </Pressable>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: t.textMuted, fontSize: t.fs(15), flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: t.fs(15), fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function Badge({ text, tone = 'default' }: { text: string; tone?: 'default' | 'accent' | 'warn' | 'danger' | 'demo' }) {
  const t = useTheme();
  const map = {
    default: [t.surfaceAlt, t.textMuted],
    accent: [t.accentSoft, t.accent],
    warn: [t.warnSoft, t.warn],
    danger: [t.dangerSoft, t.danger],
    demo: [t.surfaceAlt, t.demo],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: t.fs(12.5), fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function DemoBanner({ text }: { text?: string }) {
  const t = useTheme();
  return (
    <Card tone="demo">
      <Text style={{ color: t.demo, fontWeight: '800', fontSize: t.fs(14) }}>DEMONSTRAÇÃO · CONTEÚDO NÃO REVISADO</Text>
      <Small>{text ?? 'Este conteúdo é um rascunho para demonstrar o funcionamento do app. Não é tratamento nem orientação aprovada por profissional.'}</Small>
    </Card>
  );
}

export function Choice<T extends string>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void; label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Text style={{ color: t.text, fontSize: t.fs(16), fontWeight: '600' }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => onChange(o.value)}
              style={{
                minHeight: 46, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12,
                backgroundColor: sel ? t.primary : t.surface, borderWidth: 1, borderColor: sel ? t.primary : t.border,
              }}
            >
              <Text style={{ color: sel ? t.primaryText : t.text, fontSize: t.fs(15), fontWeight: sel ? '700' : '500' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: t.fs(16) }}>{label}</Text>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.border }} />
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, multiline, maxLength }: {
  label: string; value: string; onChangeText: (s: string) => void; placeholder?: string; multiline?: boolean; maxLength?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.text, fontSize: t.fs(16), fontWeight: '600' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        style={{
          minHeight: multiline ? 90 : 48, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface,
          color: t.text, fontSize: t.fs(16), paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

export function Scale({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number) => void; low: string; high: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.text, fontSize: t.fs(16), fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} de 5`}
            accessibilityState={{ selected: value === n }}
            onPress={() => onChange(n)}
            style={{ flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: value === n ? t.primary : t.surface, borderWidth: 1, borderColor: t.border }}
          >
            <Text style={{ color: value === n ? t.primaryText : t.text, fontWeight: '700', fontSize: t.fs(16) }}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Small>{low}</Small>
        <Small>{high}</Small>
      </View>
    </View>
  );
}

/** Linha do tempo de níveis por minuto; lacunas aparecem como espaço vazio (sem preenchimento). */
export function Timeline({ points, height = 70 }: { points: { at: number; dbfs: number | null }[]; height?: number }) {
  const t = useTheme();
  if (!points.length) return null;
  const vals = points.map((p) => p.dbfs).filter((v): v is number => v != null);
  const min = Math.min(...vals, -80);
  const max = Math.max(...vals, -20);
  return (
    <View
      accessible
      accessibilityLabel="Linha do tempo do nível sonoro relativo por minuto. Espaços vazios indicam períodos sem gravação."
      style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 1, backgroundColor: t.surfaceAlt, borderRadius: 10, padding: 6 }}
    >
      {points.map((p, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: p.dbfs == null ? 0 : Math.max(2, ((p.dbfs - min) / (max - min || 1)) * (height - 12)),
            backgroundColor: p.dbfs == null ? 'transparent' : t.primary,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}
