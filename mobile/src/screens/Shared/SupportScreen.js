// mobile/src/screens/Shared/SupportScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Dimensions, Animated, Linking, Alert, Platform,
} from 'react-native';
import { Ionicons }              from '@expo/vector-icons';
import { useSafeAreaInsets }     from 'react-native-safe-area-context';
import { useTheme }              from '../../context/ThemeContext';
import { useAuth }               from '../../context/AuthContext';

const { width } = Dimensions.get('window');

const Section = ({ title, children, theme }) => (
  <View style={[sec.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    {title && <Text style={[sec.title, { color: theme.hint }]}>{title}</Text>}
    {children}
  </View>
);
const sec = StyleSheet.create({
  wrap:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 6 },
});

const MenuItem = ({ icon, label, onPress, danger, value, theme, last, badge }) => {
  const color = danger ? '#E05555' : theme.foreground;
  return (
    <TouchableOpacity
      style={[mi.item, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[mi.iconWrap, { backgroundColor: (danger ? '#E05555' : theme.accent) + '14' }]}>
        <Ionicons name={icon} size={17} color={danger ? '#E05555' : theme.accent} />
      </View>
      <Text style={[mi.label, { color }]}>{label}</Text>
      <View style={mi.right}>
        {value  && <Text style={[mi.value, { color: theme.hint }]}>{value}</Text>}
        {badge  && (
          <View style={[mi.badge, { backgroundColor: theme.accent }]}>
            <Text style={[mi.badgeTxt, { color: theme.accentFg ?? '#111' }]}>{badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={15} color={theme.hint} />
      </View>
    </TouchableOpacity>
  );
};
const mi = StyleSheet.create({
  item:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label:   { flex: 1, fontSize: 14, fontWeight: '500' },
  right:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value:   { fontSize: 13, fontWeight: '600' },
  badge:   { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt:{ fontSize: 10, fontWeight: '800' },
});

const openURL = async (url) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert('Cannot Open', `Unable to open: ${url}`);
  } catch { Alert.alert('Error', 'Could not open the link.'); }
};

export default function SupportScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();
  const insets          = useSafeAreaInsets();
  const fadeA           = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeA, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 14, backgroundColor: theme.backgroundAlt + 'EE', borderColor: theme.border }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeA }}>

          {/* Hero */}
          <View style={s.hero}>
            <View style={[s.heroIcon, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30' }]}>
              <Ionicons name="headset-outline" size={32} color={theme.accent} />
            </View>
            <Text style={[s.heroTitle, { color: theme.foreground }]}>Help & Support</Text>
            <Text style={[s.heroSub, { color: theme.hint }]}>
              We're here to help. Reach out anytime.
            </Text>
          </View>

          {/* ── SUPPORT TICKETS — new primary section ── */}
          <Section title="SUPPORT TICKETS" theme={theme}>
            <MenuItem
              icon="chatbubble-ellipses-outline"
              label="Submit a Ticket"
              theme={theme}
              onPress={() => navigation.navigate('SubmitTicket')}
            />
            <MenuItem
              icon="list-outline"
              label="My Tickets"
              theme={theme}
              last
              onPress={() => navigation.navigate('MyTickets')}
            />
          </Section>

          {/* Contact */}
          <Section title="CONTACT US" theme={theme}>
            <MenuItem
              icon="mail-outline"
              label="Email Support"
              value="support@diakite.app"
              theme={theme}
              onPress={() => openURL('mailto:support@diakite.app')}
            />
            <MenuItem
              icon="call-outline"
              label="Call Us"
              value="+234 800 000 0000"
              theme={theme}
              onPress={() => openURL('tel:+2348000000000')}
            />
            <MenuItem
              icon="logo-whatsapp"
              label="WhatsApp"
              theme={theme}
              last
              onPress={() => openURL('https://wa.me/2348000000000')}
            />
          </Section>

          {/* Self-service */}
          <Section title="SELF-SERVICE" theme={theme}>
            <MenuItem
              icon="help-buoy-outline"
              label="Help Center"
              theme={theme}
              onPress={() => openURL('https://diakite.app/help')}
            />
            <MenuItem
              icon="chatbubble-outline"
              label="Live Chat"
              theme={theme}
              onPress={() => Alert.alert('Coming Soon', 'Live chat will be available in the next update.')}
            />
            <MenuItem
              icon="warning-outline"
              label="Report an Issue"
              theme={theme}
              last
              onPress={() => navigation.navigate('SubmitTicket')}   // ← was Alert, now navigates
            />
          </Section>

          {/* Legal */}
          <Section title="LEGAL" theme={theme}>
            <MenuItem
              icon="document-text-outline"
              label="Terms of Service"
              theme={theme}
              onPress={() => openURL('https://diakite.app/terms')}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              theme={theme}
              last
              onPress={() => openURL('https://diakite.app/privacy')}
            />
          </Section>

          <Text style={[s.version,   { color: theme.hint }]}>Diakite v1.0.0</Text>
          <Text style={[s.copyright, { color: theme.hint }]}>
            © {new Date().getFullYear()} Diakite. All rights reserved.
          </Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: {
    position: 'absolute', width: width * 1.2, height: width * 1.2,
    borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center', opacity: 0.05,
  },
  backBtn: {
    position: 'absolute', left: 20, zIndex: 99,
    width: 42, height: 42, borderRadius: 13, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  scroll: { paddingHorizontal: 24 },
  hero:      { alignItems: 'center', paddingBottom: 28 },
  heroIcon:  { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  heroSub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  version:   { textAlign: 'center', fontSize: 11, fontWeight: '500', marginBottom: 4 },
  copyright: { textAlign: 'center', fontSize: 11, marginBottom: 12 },
});