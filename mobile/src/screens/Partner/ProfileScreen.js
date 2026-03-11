// mobile/src/screens/Shared/ProfileScreen.js
import React, {useState} from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import {useAuth} from '../../context/AuthContext';
import Input from '../../components/Common/Input';
import Button from '../../components/Common/Button';
import {userAPI} from '../../services/api';
import {colors, spacing, radius} from '../../theme';

const ProfileScreen = () => {
  const {user, logout, updateStoredUser} = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await userAPI.updateProfile({firstName, lastName, phone});
      await updateStoredUser(res.data?.user ?? {firstName, lastName, phone});
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = {
    CUSTOMER: '🚶 Customer',
    DRIVER: '🚗 Driver',
    DELIVERY_PARTNER: '📦 Delivery Partner',
  }[user?.role] ?? user?.role;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Text>
          </View>
          <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.role}>{roleLabel}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Text style={styles.section}>Edit Profile</Text>
        <Input label="First Name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <Input label="Last Name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Button title="Save Changes" onPress={handleSave} loading={saving} fullWidth style={{marginTop: spacing.sm}} />

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  container: {flexGrow: 1, padding: spacing.lg},
  avatarWrap: {alignItems: 'center', marginBottom: spacing.xl},
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarText: {color: '#fff', fontSize: 28, fontWeight: '700'},
  name: {fontSize: 22, fontWeight: '700'},
  role: {fontSize: 14, color: colors.textSecondary, marginTop: 4},
  email: {fontSize: 13, color: colors.textMuted, marginTop: 2},
  section: {fontSize: 16, fontWeight: '700', marginBottom: spacing.md, color: colors.textPrimary},
  logoutBtn: {marginTop: spacing.xl, padding: spacing.md, alignItems: 'center'},
  logoutText: {color: colors.error, fontSize: 16, fontWeight: '600'},
});

export default ProfileScreen;