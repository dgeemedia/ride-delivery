import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const ServiceSelectionScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>What do you need?</Text>

      <TouchableOpacity
        style={[styles.serviceCard, { borderColor: colors.primary }]}
        onPress={() => navigation.navigate('RequestRide')}
      >
        <Icon name="directions-car" size={64} color={colors.primary} />
        <Text style={styles.serviceTitle}>Request a Ride</Text>
        <Text style={styles.serviceDescription}>
          Get picked up by a nearby driver
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.serviceCard, { borderColor: colors.warning }]}
        onPress={() => navigation.navigate('RequestDelivery')}
      >
        <Icon name="local-shipping" size={64} color={colors.warning} />
        <Text style={styles.serviceTitle}>Send a Package</Text>
        <Text style={styles.serviceDescription}>
          Fast and reliable delivery service
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default ServiceSelectionScreen;