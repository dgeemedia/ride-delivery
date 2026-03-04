import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const SupportScreen = () => {
  const supportItems = [
    {
      id: '1',
      title: 'Help Center',
      icon: 'help-outline',
      onPress: () => Linking.openURL('https://duoride.com/help'),
    },
    {
      id: '2',
      title: 'Contact Support',
      icon: 'email',
      onPress: () => Linking.openURL('mailto:support@duoride.com'),
    },
    {
      id: '3',
      title: 'Call Us',
      icon: 'phone',
      onPress: () => Linking.openURL('tel:+1234567890'),
    },
    {
      id: '4',
      title: 'Report an Issue',
      icon: 'report-problem',
      onPress: () => {},
    },
    {
      id: '5',
      title: 'Terms of Service',
      icon: 'description',
      onPress: () => Linking.openURL('https://duoride.com/terms'),
    },
    {
      id: '6',
      title: 'Privacy Policy',
      icon: 'privacy-tip',
      onPress: () => Linking.openURL('https://duoride.com/privacy'),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Support & Help</Text>

      {supportItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.item}
          onPress={item.onPress}
        >
          <View style={styles.itemLeft}>
            <Icon name={item.icon} size={24} color={colors.primary} />
            <Text style={styles.itemText}>{item.title}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}

      <View style={styles.footer}>
        <Text style={styles.version}>Version 1.0.0</Text>
        <Text style={styles.copyright}>© 2024 DuoRide. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  version: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  copyright: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default SupportScreen;