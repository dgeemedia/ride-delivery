import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import Input from '../../components/Common/Input';
import PhoneInput from '../../components/Inputs/PhoneInput';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    profileImage: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profileImage: user.profileImage || '',
      });
    }
  }, [user]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await userAPI.updateProfile(formData);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {formData.profileImage ? (
          <Image source={{ uri: formData.profileImage }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {formData.firstName[0]}
              {formData.lastName[0]}
            </Text>
          </View>
        )}
        <Text style={styles.name}>
          {formData.firstName} {formData.lastName}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Input
          label="First Name"
          value={formData.firstName}
          onChangeText={(text) =>
            setFormData({ ...formData, firstName: text })
          }
        />

        <Input
          label="Last Name"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />

        <PhoneInput
          label="Phone Number"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
        />

        <Button
          title="Update Profile"
          onPress={handleUpdate}
          loading={loading}
          fullWidth
          style={styles.button}
        />

        <Button
          title="Change Password"
          variant="outline"
          onPress={() => navigation.navigate('ChangePassword')}
          fullWidth
          style={styles.button}
        />

        <Button
          title="Logout"
          variant="danger"
          onPress={handleLogout}
          fullWidth
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    padding: spacing.lg,
  },
  button: {
    marginTop: spacing.md,
  },
});

export default ProfileScreen;