// mobile/src/components/AnimatedTabBar.js
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useScrollY } from '../context/ScrollContext';  // adjust if folder is 'context'

const AnimatedTabBar = (props) => {
  const scrollY = useScrollY();
  const insets = useSafeAreaInsets();

  const TAB_CONTENT_H = 54;
  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const TAB_HEIGHT = TAB_CONTENT_H + insets.bottom + EXTRA_BOTTOM;

  const lastScrollY = useSharedValue(0);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const current = scrollY.value;
    const last = lastScrollY.value;
    const delta = current - last;

    if (Math.abs(delta) > 5) {
      lastScrollY.value = current;
      if (delta > 0) {
        translateY.value = withTiming(TAB_HEIGHT, { duration: 250 });
      } else {
        translateY.value = withTiming(0, { duration: 250 });
      }
    }

    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <BottomTabBar {...props} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
});

export default AnimatedTabBar;