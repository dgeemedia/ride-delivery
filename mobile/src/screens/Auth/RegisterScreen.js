import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Common/Input';
import PhoneInput from '../../components/Inputs/PhoneInput';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';
import { validateEmail } from '../../utils/helpers';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'CUSTOMER',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (formData.phone.length < 10) {
      newErrors.phone = 'Invalid phone number';
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
    } catch (error) {
      Alert.alert('Registration Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Sign up to get started</Text>

      <View style={styles.form}>
        <Input
          label="First Name"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
          placeholder="John"
          error={errors.firstName}
        />

        <Input
          label="Last Name"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
          placeholder="Doe"
          error={errors.lastName}
        />

        <Input
          label="Email"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />

        <PhoneInput
          label="Phone Number"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          error={errors.phone}
        />

        <Input
          label="Password"
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          placeholder="Minimum 8 characters"
          secureTextEntry
          error={errors.password}
        />

        <Input
          label="Confirm Password"
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          placeholder="Re-enter password"
          secureTextEntry
          error={errors.confirmPassword}
        />

        <Button
          title="Sign Up"
          onPress={handleRegister}
          loading={loading}
          fullWidth
          style={styles.button}
        />

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginTextBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  form: {
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.md,
  },
  loginLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  loginText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  loginTextBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default RegisterScreen;