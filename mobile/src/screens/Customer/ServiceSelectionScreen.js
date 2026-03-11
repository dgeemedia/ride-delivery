// mobile/src/screens/Customer/ServiceSelectionScreen.js
import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, SafeAreaView} from 'react-native';
import {colors, spacing, radius} from '../../theme';

const SERVICES = [
  {emoji: '🚗', title: 'Ride', sub: 'Book a car to your destination', screen: 'RequestRide'},
  {emoji: '📦', title: 'Delivery', sub: 'Send a package across town', screen: 'RequestDelivery'},
];

const ServiceSelectionScreen = ({navigation}) => (
  <SafeAreaView style={styles.safe}>
    <View style={styles.container}>
      <Text style={styles.title}>Choose a Service</Text>
      {SERVICES.map(s => (
        <TouchableOpacity
          key={s.screen}
          style={styles.card}
          onPress={() => navigation.navigate(s.screen)}>
          <Text style={styles.emoji}>{s.emoji}</Text>
          <View>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardSub}>{s.sub}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  container: {flex: 1, padding: spacing.lg},
  title: {fontSize: 24, fontWeight: '700', marginBottom: spacing.xl},
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  emoji: {fontSize: 36, marginRight: spacing.md},
  cardTitle: {fontSize: 18, fontWeight: '600'},
  cardSub: {fontSize: 13, color: colors.textSecondary, marginTop: 4},
  arrow: {marginLeft: 'auto', fontSize: 24, color: colors.textMuted},
});

export default ServiceSelectionScreen;