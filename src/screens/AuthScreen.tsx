import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { COLORS } from '@/utils/constants';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'sign-up') await signUp(name.trim(), email.trim().toLowerCase(), password);
      else await signIn(email.trim().toLowerCase(), password);
    } catch { setError('Unable to continue. Check your details and connection.'); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.brand}><Text style={styles.eyebrow}>TODAY MEAL</Text><Text style={styles.title}>Your household, together.</Text><Text style={styles.copy}>Work offline as usual. Your records sync securely whenever a connection returns.</Text></View>
    <View style={styles.card}>
      <Text style={styles.heading}>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
      {mode === 'sign-up' && <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={COLORS.TEXT_MUTED} value={name} onChangeText={setName} autoComplete="name" />}
      <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={COLORS.TEXT_MUTED} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.TEXT_MUTED} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} onSubmitEditing={submit} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.buttonText}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>}</Pressable>
      <Pressable onPress={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); }}><Text style={styles.switch}>{mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: COLORS.BACKGROUND }, page: { flex: 1, justifyContent: 'center', padding: 24, gap: 28 }, brand: { gap: 10 }, eyebrow: { color: COLORS.PRIMARY_DARK, fontWeight: '800', letterSpacing: 2, fontSize: 12 }, title: { color: COLORS.TEXT, fontWeight: '800', fontSize: 36, lineHeight: 42 }, copy: { color: COLORS.TEXT_MUTED, fontSize: 16, lineHeight: 24 }, card: { backgroundColor: COLORS.CARD, borderRadius: 18, borderWidth: 1, borderColor: COLORS.BORDER, padding: 20, gap: 14 }, heading: { color: COLORS.TEXT, fontSize: 21, fontWeight: '700', marginBottom: 2 }, input: { minHeight: 52, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, color: COLORS.TEXT, fontSize: 16, backgroundColor: COLORS.BACKGROUND }, error: { color: COLORS.DANGER, fontSize: 14 }, button: { minHeight: 52, borderRadius: 10, backgroundColor: COLORS.PRIMARY_DARK, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' }, switch: { color: COLORS.PRIMARY_DARK, textAlign: 'center', fontSize: 14, fontWeight: '600', padding: 4 } });
