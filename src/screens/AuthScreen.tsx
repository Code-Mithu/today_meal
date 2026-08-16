import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'sign-up' && !name.trim()) {
      setError('Enter your name.');
      return;
    }
    setBusy(true); setError('');
    try {
      if (mode === 'sign-up') await signUp(name.trim(), normalizedEmail, password);
      else await signIn(normalizedEmail, password);
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 401) setError('The email or password is incorrect.');
        else if (caught.status === 409) setError('An account with this email already exists.');
        else if (caught.kind === 'configuration') setError('This app build is not connected to its server. Please update the app.');
        else if (caught.kind === 'network') setError('Unable to reach the server. Check your connection and try again.');
        else if (caught.kind === 'timeout') setError('The server is taking too long to respond. Please try again.');
        else if (caught.kind === 'server') setError('The server is temporarily unavailable. Please try again shortly.');
        else setError(caught.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally { setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <View style={styles.brand}><Text style={styles.eyebrow}>TODAY MEAL</Text><Text style={styles.title}>Your household, together.</Text><Text style={styles.copy}>Work offline as usual. Your records sync securely whenever a connection returns.</Text></View>
      <View style={styles.card}>
        <Text style={styles.heading}>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
        {mode === 'sign-up' && <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={COLORS.TEXT_MUTED} value={name} onChangeText={setName} autoComplete="name" editable={!busy} returnKeyType="next" />}
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={COLORS.TEXT_MUTED} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} returnKeyType="next" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.TEXT_MUTED} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
        {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'sign-in' ? 'Sign in' : 'Create account'} style={({ pressed }) => [styles.button, (busy || pressed) && styles.buttonPressed]} onPress={submit} disabled={busy}>{busy ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.buttonText}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>}</Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); }}><Text style={styles.switch}>{mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: COLORS.BACKGROUND }, keyboard: { flex: 1 }, page: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 }, brand: { gap: 10 }, eyebrow: { color: COLORS.PRIMARY_DARK, fontWeight: '800', letterSpacing: 2, fontSize: 12 }, title: { color: COLORS.TEXT, fontWeight: '800', fontSize: 36, lineHeight: 42 }, copy: { color: COLORS.TEXT_MUTED, fontSize: 16, lineHeight: 24 }, card: { backgroundColor: COLORS.CARD, borderRadius: 18, borderWidth: 1, borderColor: COLORS.BORDER, padding: 20, gap: 14 }, heading: { color: COLORS.TEXT, fontSize: 21, fontWeight: '700', marginBottom: 2 }, input: { minHeight: 52, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, color: COLORS.TEXT, fontSize: 16, backgroundColor: COLORS.BACKGROUND }, error: { color: COLORS.DANGER, fontSize: 14, lineHeight: 20 }, button: { minHeight: 52, borderRadius: 10, backgroundColor: COLORS.PRIMARY_DARK, alignItems: 'center', justifyContent: 'center' }, buttonPressed: { opacity: 0.72 }, buttonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' }, switch: { color: COLORS.PRIMARY_DARK, textAlign: 'center', fontSize: 14, fontWeight: '600', padding: 4 } });
