import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Input from '../Common/Input';
import { colors, spacing } from '../../theme';

const AddressInput = ({ value, onSelectAddress, placeholder, label }) => {
  const [query, setQuery] = useState(value || '');
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);

  const handleTextChange = async (text) => {
    setQuery(text);
    
    if (text.length > 2) {
      // FUTURE: Implement Google Places Autocomplete API
      // For now, showing dummy data
      setPredictions([
        { id: '1', description: '123 Main Street, City' },
        { id: '2', description: '456 Park Avenue, City' },
      ]);
      setShowPredictions(true);
    } else {
      setPredictions([]);
      setShowPredictions(false);
    }
  };

  const handleSelectAddress = (address) => {
    setQuery(address.description);
    setShowPredictions(false);
    onSelectAddress(address);
  };

  return (
    <View style={styles.container}>
      <Input
        label={label}
        value={query}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        leftIcon="location-on"
        rightIcon={query ? 'clear' : null}
        onRightIconPress={() => {
          setQuery('');
          setPredictions([]);
          setShowPredictions(false);
        }}
      />

      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.predictionItem}
                onPress={() => handleSelectAddress(item)}
              >
                <Icon name="location-on" size={20} color={colors.textSecondary} />
                <Text style={styles.predictionText}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  predictionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: -spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  predictionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
});

export default AddressInput;