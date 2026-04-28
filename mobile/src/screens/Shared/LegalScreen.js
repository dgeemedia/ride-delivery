// mobile/src/screens/Shared/LegalScreen.js
//
// Universal in-app reader for Terms of Service, Privacy Policy, and Help Center.
// Receives `contentKey` ('terms_content' | 'privacy_content' | 'help_content')
// and `title` via navigation params.
//
// Usage from SupportScreen:
//   navigation.navigate('Legal', { contentKey: 'terms_content',   title: 'Terms of Service' })
//   navigation.navigate('Legal', { contentKey: 'privacy_content', title: 'Privacy Policy'   })
//   navigation.navigate('Legal', { contentKey: 'help_content',    title: 'Help Center'      })

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { settingsAPI }       from '../../services/api';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN PARSER
// Converts the markdown stored in the DB into a tree of styled React Native nodes.
// Supports: # ## ### headings, **bold**, *italic*, - bullet lists, blank lines.
// ─────────────────────────────────────────────────────────────────────────────
function parseMarkdown(raw) {
  const lines   = (raw || '').split('\n');
  const nodes   = [];
  let   listBuf = [];
  let   key     = 0;

  const flushList = () => {
    if (listBuf.length === 0) return;
    nodes.push({ type: 'list', items: [...listBuf], key: key++ });
    listBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^### /.test(line))      { flushList(); nodes.push({ type: 'h3',   text: line.slice(4), key: key++ }); continue; }
    if (/^## /.test(line))       { flushList(); nodes.push({ type: 'h2',   text: line.slice(3), key: key++ }); continue; }
    if (/^# /.test(line))        { flushList(); nodes.push({ type: 'h1',   text: line.slice(2), key: key++ }); continue; }
    if (/^[-*] /.test(line))     {              listBuf.push(line.slice(2));                                    continue; }
    if (line.trim() === '')      { flushList(); nodes.push({ type: 'gap',                        key: key++ }); continue; }
    /* paragraph */                flushList(); nodes.push({ type: 'p',    text: line,           key: key++ });
  }

  flushList();
  return nodes;
}

// Render inline **bold** and *italic* within a <Text> node.
function InlineText({ text, style, theme }) {
  // Split on ** and * markers, preserving the delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          return <Text key={i} style={[style, { fontWeight: '700' }]}>{part.slice(2, -2)}</Text>;
        }
        if (/^\*[^*]+\*$/.test(part)) {
          return <Text key={i} style={[style, { fontStyle: 'italic' }]}>{part.slice(1, -1)}</Text>;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function LegalScreen({ navigation, route }) {
  const { contentKey = 'terms_content', title = 'Document' } = route.params ?? {};
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const fadeA           = useRef(new Animated.Value(0)).current;

  const [nodes,   setNodes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    setLoading(true); setError(false);
    settingsAPI.getLegalContent()
      .then(res => {
        const raw = res?.data?.[contentKey] ?? '';
        if (!raw.trim()) {
          // No content saved yet — show a friendly placeholder
          setNodes([{ type: 'h1', text: title, key: 0 }, { type: 'p', text: 'This page has not been set up yet. Please check back later.', key: 1 }]);
        } else {
          setNodes(parseMarkdown(raw));
        }
        Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      })
      .catch(() => {
        setError(true);
        Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      })
      .finally(() => setLoading(false));
  }, [contentKey]);

  const renderNode = (node) => {
    switch (node.type) {
      case 'h1':
        return <Text key={node.key} style={[st.h1, { color: theme.foreground }]}>{node.text}</Text>;
      case 'h2':
        return <Text key={node.key} style={[st.h2, { color: theme.foreground }]}>{node.text}</Text>;
      case 'h3':
        return <Text key={node.key} style={[st.h3, { color: theme.foreground }]}>{node.text}</Text>;
      case 'p':
        return <InlineText key={node.key} text={node.text} theme={theme} style={[st.p, { color: theme.foreground }]} />;
      case 'list':
        return (
          <View key={node.key} style={st.list}>
            {node.items.map((item, i) => (
              <View key={i} style={st.listRow}>
                <View style={[st.bullet, { backgroundColor: theme.accent }]} />
                <InlineText text={item} theme={theme} style={[st.listText, { color: theme.foreground }]} />
              </View>
            ))}
          </View>
        );
      case 'gap':
        return <View key={node.key} style={st.gap} />;
      default:
        return null;
    }
  };

  return (
    <View style={[st.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Ambient glow */}
      <View style={[st.glow, { backgroundColor: theme.accent }]} />

      {/* Back button */}
      <TouchableOpacity
        style={[st.back, {
          top:             insets.top + 14,
          backgroundColor: theme.backgroundAlt + 'EE',
          borderColor:     theme.border,
        }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={20} color={theme.foreground} />
      </TouchableOpacity>

      {/* Page title bar */}
      <View style={[st.titleBar, { marginTop: insets.top + 14 }]}>
        <Text style={[st.titleBarText, { color: theme.foreground }]}>{title}</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={st.centre}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[st.loadingTxt, { color: theme.hint }]}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={st.centre}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.hint} />
          <Text style={[st.errorTxt, { color: theme.hint }]}>
            Could not load this page. Please check your connection and try again.
          </Text>
          <TouchableOpacity
            style={[st.retryBtn, { borderColor: theme.accent }]}
            onPress={() => {
              setLoading(true);
              settingsAPI.getLegalContent()
                .then(res => {
                  setNodes(parseMarkdown(res?.data?.[contentKey] ?? ''));
                  setError(false);
                  Animated.timing(fadeA, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                })
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            }}
            activeOpacity={0.75}
          >
            <Text style={[st.retryTxt, { color: theme.accent }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          style={{ opacity: fadeA }}
          contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {nodes.map(renderNode)}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1 },
  glow:        {
    position: 'absolute', width: width * 1.2, height: width * 1.2,
    borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center', opacity: 0.04,
  },
  back:        {
    position: 'absolute', left: 20, zIndex: 99,
    width: 42, height: 42, borderRadius: 13, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  titleBar:    { alignItems: 'center', paddingBottom: 8 },
  titleBarText:{ fontSize: 17, fontWeight: '700' },
  scroll:      { paddingHorizontal: 24, paddingTop: 70 },
  centre:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingTxt:  { marginTop: 12, fontSize: 13 },
  errorTxt:    { marginTop: 16, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:    { marginTop: 20, borderWidth: 1, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt:    { fontSize: 14, fontWeight: '600' },

  // Markdown nodes
  h1:          { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6,  marginTop: 8  },
  h2:          { fontSize: 18, fontWeight: '700', letterSpacing: -0.2, marginBottom: 4,  marginTop: 22 },
  h3:          { fontSize: 15, fontWeight: '700',                      marginBottom: 4,  marginTop: 16 },
  p:           { fontSize: 14, lineHeight: 24, marginBottom: 4 },
  gap:         { height: 10 },
  list:        { marginVertical: 6, paddingLeft: 4 },
  listRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bullet:      { width: 6, height: 6, borderRadius: 3, marginTop: 9, flexShrink: 0 },
  listText:    { flex: 1, fontSize: 14, lineHeight: 22 },
});