// mobile/src/components/ErrorBoundary.js
//
// Catches any render-time crash in the tree below it and shows a readable
// error screen instead of a white blank.  Wrap the entire app with this.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error?.message);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
    this.setState({ info });
  }

  reset = () => this.setState({ hasError: false, error: null, info: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.root}>
        <Text style={s.emoji}>💥</Text>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.msg}>{this.state.error?.message ?? 'Unknown error'}</Text>

        <ScrollView style={s.stackWrap} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={s.stack}>{this.state.info?.componentStack ?? ''}</Text>
        </ScrollView>

        <TouchableOpacity style={s.btn} onPress={this.reset} activeOpacity={0.8}>
          <Text style={s.btnTxt}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#080C18', justifyContent: 'center', alignItems: 'center', padding: 28 },
  emoji:    { fontSize: 48, marginBottom: 16 },
  title:    { fontSize: 20, fontWeight: '900', color: '#FFB800', marginBottom: 10, textAlign: 'center' },
  msg:      { fontSize: 13, color: '#fff', textAlign: 'center', marginBottom: 14, lineHeight: 20 },
  stackWrap:{ maxHeight: 220, width: '100%', backgroundColor: '#111', borderRadius: 10, padding: 12, marginBottom: 24 },
  stack:    { fontSize: 10, color: '#aaa', fontFamily: 'monospace', lineHeight: 16 },
  btn:      { backgroundColor: '#FFB800', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  btnTxt:   { fontSize: 15, fontWeight: '900', color: '#080C18' },
});