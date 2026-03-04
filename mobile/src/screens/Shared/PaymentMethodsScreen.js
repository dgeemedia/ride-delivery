import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { paymentAPI } from '../../services/api';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';

const PaymentMethodsScreen = ({ navigation }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const response = await paymentAPI.getCards();
      setCards(response.data.cards);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async (cardId) => {
    Alert.alert('Remove Card', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await paymentAPI.removeCard(cardId);
            loadCards();
          } catch (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const renderCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Icon name="credit-card" size={24} color={colors.primary} />
        <View style={styles.cardDetails}>
          <Text style={styles.cardBrand}>{item.brand.toUpperCase()}</Text>
          <Text style={styles.cardNumber}>•••• {item.last4}</Text>
          <Text style={styles.cardExpiry}>
            Expires {item.expMonth}/{item.expYear}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleRemoveCard(item.id)}>
        <Icon name="delete" size={24} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No payment methods added</Text>
        }
      />

      <Button
        title="Add Payment Method"
        onPress={() => navigation.navigate('AddCard')}
        fullWidth
        icon="add"
        style={styles.addButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardDetails: {
    gap: 2,
  },
  cardBrand: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardNumber: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardExpiry: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  addButton: {
    marginTop: spacing.md,
  },
});

export default PaymentMethodsScreen;