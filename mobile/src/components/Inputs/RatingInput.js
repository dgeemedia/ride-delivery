import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const RatingInput = ({ rating, onRatingChange, size = 32 }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const handlePress = (value) => {
    onRatingChange(value);
  };

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handlePress(star)}
          activeOpacity={0.7}
        >
          <Icon
            name={star <= (hoverRating || rating) ? 'star' : 'star-border'}
            size={size}
            color={star <= (hoverRating || rating) ? colors.warning : colors.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
});

export default RatingInput;