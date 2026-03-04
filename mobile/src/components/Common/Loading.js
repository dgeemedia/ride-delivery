import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';
import { colors, spacing } from '../../theme';

const Loading = ({
  visible = true,
  text = 'Loading...',
  overlay = false,
  size = 'large',
  color = colors.primary,
}) => {
  if (overlay) {
    return (
      <Modal transparent visible={visible} animationType="fade">
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <ActivityIndicator size={size} color={color} />
            {text && <Text style={styles.overlayText}>{text}</Text>}
          </View>
        </View>
      </Modal>
    );
  }

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

// Fullscreen loading component
export const FullScreenLoading = ({ text = 'Loading...' }) => {
  return (
    <View style={styles.fullScreenContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.fullScreenText}>{text}</Text>
    </View>
  );
};

// Inline loading component
export const InlineLoading = ({ text, size = 'small' }) => {
  return (
    <View style={styles.inlineContainer}>
      <ActivityIndicator size={size} color={colors.primary} />
      {text && <Text style={styles.inlineText}>{text}</Text>}
    </View>
  );
};

// Skeleton loader for content placeholders
export const SkeletonLoader = ({ width = '100%', height = 20, style }) => {
  return (
    <View
      style={[
        styles.skeleton,
        { width, height },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  text: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    backgroundColor: '#fff',
    padding: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 150,
  },
  overlayText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  fullScreenText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  inlineText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  skeleton: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
});

export default Loading;