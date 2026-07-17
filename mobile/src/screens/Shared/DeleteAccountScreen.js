// mobile/src/screens/Shared/DeleteAccountScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';

export default function DeleteAccountScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = password.length > 0 && confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canSubmit) return;

    Alert.alert(
      'Delete Account',
      'This is permanent. Your account and personal data will be removed and this cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await userAPI.deleteAccount({ password });
              Alert.alert('Account Deleted', 'Your account has been deleted.', [
                { text: 'OK', onPress: () => logout() },
              ]);
            } catch (err) {
              Alert.alert('Error', err?.message ?? 'Could not delete account. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>Delete Account</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={s.content}>
        <View style={[s.warnIcon, { backgroundColor: '#E0555518' }]}>
          <Ionicons name="warning-outline" size={28} color="#E05555" />
        </View>
        <Text style={[s.title, { color: theme.foreground }]}>This can't be undone</Text>
        <Text style={[s.body, { color: theme.hint }]}>
          Deleting your account permanently removes your profile, ride/delivery history,
          and personal information from Diakite. If you have a wallet balance, withdraw it
          first — accounts with a positive balance can't be deleted.
        </Text>

        <Text style={[s.label, { color: theme.hint }]}>PASSWORD</Text>
        <TextInput
          style={[s.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.backgroundAlt }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor={theme.hint}
          secureTextEntry
        />

        <Text style={[s.label, { color: theme.hint, marginTop: 16 }]}>TYPE "DELETE" TO CONFIRM</Text>
        <TextInput
          style={[s.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.backgroundAlt }]}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="DELETE"
          placeholderTextColor={theme.hint}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[s.deleteBtn, { opacity: canSubmit ? 1 : 0.4 }]}
          onPress={handleDelete}
          disabled={!canSubmit || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.deleteBtnTxt}>Delete My Account</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  content: { paddingHorizontal: 24, paddingTop: 12 },
  warnIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  body:    { fontSize: 14, lineHeight: 21, marginBottom: 24 },
  label:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input:   { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10, fontSize: 15 },
  deleteBtn: { backgroundColor: '#E05555', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  deleteBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});