import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing } from '../../theme';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          !editable && styles.inputContainerDisabled,
        ]}
      >
        {leftIcon && (
          <Icon name={leftIcon} size={20} color={colors.textSecondary} style={styles.leftIcon} />
        )}

        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || isPassword) && styles.inputWithRightIcon,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={isPassword && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIconButton}
          >
            <Icon
              name={isPasswordVisible ? 'visibility' : 'visibility-off'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconButton}>
            <Icon name={rightIcon} size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  inputContainerFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  inputContainerDisabled: {
    backgroundColor: colors.backgroundLight,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    marginLeft: spacing.md,
  },
  rightIconButton: {
    padding: spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
});

export default Input;