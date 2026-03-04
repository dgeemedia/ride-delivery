import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return colors.disabled;
    
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.secondary;
      case 'success':
        return colors.success;
      case 'danger':
        return colors.error;
      case 'outline':
        return 'transparent';
      case 'ghost':
        return 'transparent';
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textSecondary;
    if (variant === 'outline' || variant === 'ghost') return colors.primary;
    return '#fff';
  };

  const getBorderStyle = () => {
    if (variant === 'outline') {
      return {
        borderWidth: 2,
        borderColor: disabled ? colors.disabled : colors.primary,
      };
    }
    return {};
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: spacing.sm, paddingHorizontal: spacing.md };
      case 'medium':
        return { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };
      case 'large':
        return { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl };
      default:
        return { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          ...getPadding(),
          ...getBorderStyle(),
          width: fullWidth ? '100%' : 'auto',
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={getFontSize() + 4}
              color={getTextColor()}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 6,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  icon: {
    marginRight: 4,
  },
});

export default Button;