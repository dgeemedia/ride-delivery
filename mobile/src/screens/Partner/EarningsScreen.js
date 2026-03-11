// mobile/src/screens/Partner/EarningsScreen.js
import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView} from 'react-native';
import {partnerAPI} from '../../services/api';
import {colors, spacing, radius} from '../../theme';
import {formatCurrency} from '../../utils/formatters';

const EarningsScreen = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partnerAPI.getEarnings().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{flex: 1}} color={colors.primary} />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Earnings 💰</Text>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Earnings</Text>
          <Text style={styles.totalVal}>{formatCurrency(data?.total ?? 0)}</Text>
        </View>
        <View style={styles.row}>
          {[['Today', data?.today], ['This Week', data?.week], ['This Month', data?.month]].map(([l, v]) => (
            <View key={l} style={styles.box}>
              <Text style={styles.boxVal}>{formatCurrency(v ?? 0)}</Text>
              <Text style={styles.boxLabel}>{l}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  container: {padding: spacing.lg},
  title: {fontSize: 24, fontWeight: '700', marginBottom: spacing.lg},
  totalCard: {backgroundColor: colors.secondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg},
  totalLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 14},
  totalVal: {color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4},
  row: {flexDirection: 'row', gap: 10},
  box: {flex: 1, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, alignItems: 'center'},
  boxVal: {fontSize: 15, fontWeight: '700', color: colors.secondary},
  boxLabel: {fontSize: 11, color: colors.textSecondary, marginTop: 4},
});

export default EarningsScreen;