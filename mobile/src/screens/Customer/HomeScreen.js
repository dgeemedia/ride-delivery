import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import {useAuth} from '../../context/AuthContext';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const HomeScreen = ({navigation}) => {
  const {user} = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.firstName}! 👋</Text>
        <Text style={styles.subtitle}>Where would you like to go?</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('RequestRide')}>
          <Text style={styles.cardEmoji}>🚗</Text>
          <Text style={styles.cardTitle}>Request Ride</Text>
          <Text style={styles.cardSubtitle}>Get a ride to your destination</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <Text style={styles.cardEmoji}>📦</Text>
          <Text style={styles.cardTitle}>Request Delivery</Text>
          <Text style={styles.cardSubtitle}>Send packages anywhere</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: 60,
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

export default HomeScreen;