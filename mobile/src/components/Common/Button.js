// mobile/src/components/Common/Button.js
import React from 'react';
import {TouchableOpacity, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {colors, radius} from '../../theme';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}) => {
  const bgMap = {
    primary: colors.primary,
    secondary: colors.secondary,
    danger: colors.error,
    outline: 'transparent',
    ghost: 'transparent',
  };

  const textMap = {
    primary: '#fff',
    secondary: '#fff',
    danger: '#fff',
    outline: colors.primary,
    ghost: colors.textSecondary,
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {backgroundColor: bgMap[variant]},
        variant === 'outline' && styles.outline,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator color={textMap[variant]} size="small" />
      ) : (
        <Text style={[styles.text, {color: textMap[variant]}]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Button;