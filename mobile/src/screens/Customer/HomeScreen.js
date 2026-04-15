// mobile/src/screens/Customer/HomeScreen.js
// ── Premium Glass Edition ─────────────────────────────────────────────────────
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, Animated, ActivityIndicator, Image,
  Alert, Platform,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth }           from '../../context/AuthContext';
import { useTheme }          from '../../context/ThemeContext';
import { userAPI, rideAPI, deliveryAPI } from '../../services/api';
import ActiveRideBanner      from '../../components/ActiveRideBanner';
import ActiveDeliveryBanner  from '../../components/ActiveDeliveryBanner';
import MaintenanceBanner     from '../../components/MaintenanceBanner';
import { checkMaintenance }  from '../../utils/maintenanceCheck';

const { width, height } = Dimensions.get('window');
const H_PAD   = 20;
const CARD_W  = width - H_PAD * 2;

// ── Glass helpers ─────────────────────────────────────────────────────────────
const G = {
  card:    (mode) => mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)',
  cardMid: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.88)',
  border:  (mode) => mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
  borderHi:(mode) => mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
  icon:    (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  glow:    '#FFFFFF',
};

// ── Tips data ─────────────────────────────────────────────────────────────────
const RIDE_TIPS = [
  { id:'r1', icon:'location-outline',      title:'Pin your pickup precisely',  body:"Drag the map pin to your exact door — saves your driver hunting time." },
  { id:'r2', icon:'shield-checkmark-outline',title:'Share your trip link',     body:"Tap 'Share Trip' once matched and send the live link to family." },
  { id:'r3', icon:'star-outline',           title:'Rate every ride',           body:"Honest ratings help the best drivers rise to the top." },
  { id:'r4', icon:'cash-outline',           title:'Fund your wallet first',    body:"Pre-funded wallet rides are always faster to confirm than cash." },
  { id:'r5', icon:'time-outline',           title:'Book 10 mins early',        body:"Scheduling a little ahead guarantees a driver before you step outside." },
];
const DELIVERY_TIPS = [
  { id:'d1', icon:'cube-outline',           title:'Pack items securely',       body:"Use sealed bags or boxes for fragile goods." },
  { id:'d2', icon:'call-outline',           title:'Keep your recipient reachable', body:"Make sure the receiver's number is active — our courier will call ahead." },
  { id:'d3', icon:'camera-outline',         title:'Photograph high-value items', body:"Take a quick photo before handing over valuable packages." },
  { id:'d4', icon:'document-text-outline',  title:'Add clear labels',          body:"Write the recipient's name and address on the package itself." },
  { id:'d5', icon:'notifications-outline',  title:'Watch your delivery alerts', body:"You'll get push notifications at every status change." },
];

// ── Service cards ─────────────────────────────────────────────────────────────
const buildServiceCards = (nav, maint, showAlert) => [
  {
    id:'ride', icon:'car-sport-outline', label:'RIDE', title:'Book a Ride',
    subtitle:'Fast · Safe · Reliable', cta:'Book Now', filled:true,
    onPress:() => { if(maint.isOn){showAlert();return;} nav.navigate('RequestRide'); },
  },
  {
    id:'delivery', icon:'cube-outline', label:'DELIVERY', title:'Send a Package',
    subtitle:'Door‑to‑door delivery', cta:'Book Now', filled:false,
    onPress:() => { if(maint.isOn){showAlert();return;} nav.navigate('RequestDelivery'); },
  },
  {
    id:'support', icon:'headset-outline', label:'SUPPORT', title:'Get Help 24/7',
    subtitle:'Always here for you', cta:'Chat Now', filled:true,
    onPress:() => nav.navigate('Support'),
  },
  {
    id:'wallet', icon:'wallet-outline', label:'WALLET', title:'Fund Your Wallet',
    subtitle:'Quick & secure top‑up', cta:'Top Up', filled:false,
    onPress:() => nav.getParent()?.navigate('WalletTab'),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GLASS CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────
const ServiceCarousel = ({ cards, theme, mode }) => {
  const scrollRef  = useRef(null);
  const currentIdx = useRef(0);
  const ctaScale   = useRef(new Animated.Value(1)).current;
  const [activeIdx, setActiveIdx] = useState(0);

  const advance = useCallback(() => {
    Animated.sequence([
      Animated.spring(ctaScale,{ toValue:0.88, useNativeDriver:true, speed:80 }),
      Animated.spring(ctaScale,{ toValue:1.04, useNativeDriver:true, speed:80 }),
      Animated.spring(ctaScale,{ toValue:1,    useNativeDriver:true, speed:60 }),
    ]).start(() => {
      const next = (currentIdx.current + 1) % cards.length;
      currentIdx.current = next;
      setActiveIdx(next);
      scrollRef.current?.scrollTo({ x: next * (CARD_W + 14), animated: true });
    });
  }, [cards.length]);

  useEffect(() => {
    const t = setInterval(advance, 3400);
    return () => clearInterval(t);
  }, [advance]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_W + 14}
        snapToAlignment="start"
        contentContainerStyle={{ paddingRight: H_PAD }}
        style={{ marginHorizontal: -H_PAD, paddingLeft: H_PAD }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + 14));
          currentIdx.current = idx;
          setActiveIdx(idx);
        }}
      >
        {cards.map((item, idx) => {
          const isFilled  = item.filled;
          const isActive  = idx === activeIdx;
          const darkMode  = mode === 'dark';

          // Filled cards: accent-tinted glass; outlined: pure glass
          const bgColors  = isFilled
            ? (darkMode ? ['rgba(255,255,255,0.10)','rgba(255,255,255,0.04)'] : ['rgba(0,0,0,0.08)','rgba(0,0,0,0.02)'])
            : (darkMode ? ['rgba(255,255,255,0.06)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.95)','rgba(255,255,255,0.80)']);
          const borderC   = isFilled ? G.borderHi(mode) : G.border(mode);
          const fg        = theme.foreground;
          const labelC    = darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
          const subtitleC = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
          const ctaBg     = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';

          return (
            <TouchableOpacity key={item.id} onPress={item.onPress} activeOpacity={0.9}>
              <View style={[sc.card, { width: CARD_W, marginRight: idx === cards.length-1 ? 0 : 14, borderColor: borderC }]}>
                <LinearGradient
                  colors={bgColors}
                  start={{ x:0, y:0 }}
                  end={{ x:1, y:1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Shimmer top edge */}
                <View style={[sc.shimmer, { backgroundColor: isFilled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)' }]} />

                <View style={sc.topRow}>
                  <View style={[sc.iconWrap, { backgroundColor: G.icon(mode) }]}>
                    <Ionicons name={item.icon} size={22} color={fg} />
                  </View>
                  <Text style={[sc.label, { color: labelC }]}>{item.label}</Text>
                </View>

                <Text style={[sc.title, { color: fg }]}>{item.title}</Text>
                <Text style={[sc.subtitle, { color: subtitleC }]}>{item.subtitle}</Text>

                <Animated.View style={[sc.ctaWrap, { backgroundColor: ctaBg, transform: isActive ? [{ scale: ctaScale }] : [] }]}>
                  <Text style={[sc.ctaTxt, { color: fg }]}>{item.cta}</Text>
                  <View style={[sc.ctaArrow, { backgroundColor: G.icon(mode) }]}>
                    <Ionicons name="arrow-forward" size={13} color={fg} />
                  </View>
                </Animated.View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dot indicators */}
      <View style={sc.dots}>
        {cards.map((_, i) => (
          <View
            key={i}
            style={[sc.dot, {
              backgroundColor: i === activeIdx ? theme.foreground : G.border(mode),
              width: i === activeIdx ? 20 : 6,
              opacity: i === activeIdx ? 1 : 0.4,
            }]}
          />
        ))}
      </View>
    </View>
  );
};

const sc = StyleSheet.create({
  card:     { borderRadius: 26, padding: 24, marginBottom: 4, overflow: 'hidden', borderWidth: 1 },
  shimmer:  { position:'absolute', top:0, left:0, right:0, height:1 },
  topRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 20 },
  iconWrap: { width:50, height:50, borderRadius:16, justifyContent:'center', alignItems:'center' },
  label:    { fontSize:9, fontWeight:'800', letterSpacing:3.5 },
  title:    { fontSize:27, fontWeight:'900', letterSpacing:-0.8, marginBottom:6 },
  subtitle: { fontSize:13, fontWeight:'500', marginBottom:24, letterSpacing:0.2 },
  ctaWrap:  { flexDirection:'row', alignItems:'center', gap:10, alignSelf:'flex-start', borderRadius:14, paddingVertical:11, paddingHorizontal:16 },
  ctaTxt:   { fontSize:13, fontWeight:'800', letterSpacing:0.3 },
  ctaArrow: { width:26, height:26, borderRadius:9, justifyContent:'center', alignItems:'center' },
  dots:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, marginTop:16 },
  dot:      { height:6, borderRadius:3 },
});

// ─────────────────────────────────────────────────────────────────────────────
// HAMBURGER DRAWER  (unchanged logic, glass visual)
// ─────────────────────────────────────────────────────────────────────────────
import { Modal, SafeAreaView } from 'react-native';

const DrawerMenu = ({ visible, onClose, navigation, user, theme, mode }) => {
  const slideA = useRef(new Animated.Value(-320)).current;
  const bgA    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideA,{ toValue:0,    useNativeDriver:true, tension:80, friction:12 }),
        Animated.timing(bgA,   { toValue:1,    duration:250, useNativeDriver:true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideA,{ toValue:-320, useNativeDriver:true, tension:100, friction:14 }),
        Animated.timing(bgA,   { toValue:0,    duration:200, useNativeDriver:true }),
      ]).start();
    }
  }, [visible]);

  const go = (dest, params) => {
    onClose();
    setTimeout(() => {
      if(['WalletTab','ProfileTab','HistoryTab'].includes(dest)) navigation.getParent()?.navigate(dest);
      else navigation.navigate(dest, params);
    }, 250);
  };

  const MENU_ITEMS = [
    { icon:'home-outline',             label:'Home',           dest:null },
    { icon:'car-outline',              label:'Book a Ride',    dest:'RequestRide' },
    { icon:'cube-outline',             label:'Send a Package', dest:'RequestDelivery' },
    { icon:'people-outline',           label:'Nearby Drivers', dest:'NearbyDrivers', params:{ pickupAddress:'', pickupLat:6.5244, pickupLng:3.3792, dropoffAddress:'', dropoffLat:6.4281, dropoffLng:3.4219, vehicleType:'CAR' } },
    { icon:'time-outline',             label:'My History',     dest:'HistoryTab' },
    { icon:'wallet-outline',           label:'Wallet',         dest:'WalletTab' },
    { icon:'shield-checkmark-outline', label:'Shield',         dest:'Shield' },
    { icon:'business-outline',         label:'Corporate',      dest:'Corporate' },
    { icon:'notifications-outline',    label:'Notifications',  dest:'Notifications' },
    { icon:'headset-outline',          label:'Support',        dest:'Support' },
    { icon:'person-outline',           label:'Profile',        dest:'ProfileTab' },
  ];

  if (!visible) return null;

  const panelBg = mode === 'dark' ? 'rgba(8,8,8,0.96)' : 'rgba(255,255,255,0.96)';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[dm.scrim, { opacity: bgA }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[dm.panel, { backgroundColor: panelBg, borderRightColor: G.border(mode), transform:[{ translateX: slideA }] }]}>
        <SafeAreaView style={{ flex:1 }}>
          <View style={[dm.userHeader, { borderBottomColor: G.border(mode) }]}>
            <View style={[dm.avatar, { backgroundColor: G.cardMid(mode) }]}>
              {user?.profileImage
                ? <Image source={{ uri: user.profileImage }} style={dm.avatarImg} />
                : <Text style={[dm.avatarTxt, { color: theme.foreground }]}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
              }
            </View>
            <View style={{ flex:1, minWidth:0 }}>
              <Text style={[dm.userName, { color: theme.foreground }]} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
              <Text style={[dm.userEmail, { color: theme.hint }]} numberOfLines={1}>{user?.email}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[dm.closeBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
              <Ionicons name="close" size={18} color={theme.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingVertical:8 }}>
              {MENU_ITEMS.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[dm.menuItem, { borderBottomColor: G.border(mode) }]}
                  onPress={() => item.dest ? go(item.dest, item.params) : onClose()}
                  activeOpacity={0.7}
                >
                  <View style={[dm.menuIcon, { backgroundColor: G.icon(mode) }]}>
                    <Ionicons name={item.icon} size={18} color={theme.foreground} />
                  </View>
                  <Text style={[dm.menuLabel, { color: theme.foreground }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.hint} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={[dm.footer, { borderTopColor: G.border(mode) }]}>
            <Text style={[dm.footerTxt, { color: theme.hint }]}>DrivAfrica · v1.0.0</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const dm = StyleSheet.create({
  scrim:      { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.60)' },
  panel:      { position:'absolute', top:0, left:0, bottom:0, width:300, borderRightWidth:1 },
  userHeader: { flexDirection:'row', alignItems:'center', gap:12, padding:20, paddingTop:24, borderBottomWidth:1 },
  avatar:     { width:48, height:48, borderRadius:24, justifyContent:'center', alignItems:'center', overflow:'hidden', flexShrink:0 },
  avatarImg:  { width:48, height:48 },
  avatarTxt:  { fontSize:16, fontWeight:'800' },
  userName:   { fontSize:15, fontWeight:'800', marginBottom:2 },
  userEmail:  { fontSize:12 },
  closeBtn:   { width:34, height:34, borderRadius:10, borderWidth:1, justifyContent:'center', alignItems:'center', flexShrink:0 },
  menuItem:   { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:20, paddingVertical:14, borderBottomWidth:StyleSheet.hairlineWidth },
  menuIcon:   { width:38, height:38, borderRadius:12, justifyContent:'center', alignItems:'center', flexShrink:0 },
  menuLabel:  { flex:1, fontSize:14, fontWeight:'600' },
  footer:     { padding:20, borderTopWidth:1 },
  footerTxt:  { fontSize:11, textAlign:'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// GLASS WALLET STRIP
// ─────────────────────────────────────────────────────────────────────────────
const WalletStrip = ({ balance, onTopUp, theme, mode }) => (
  <View style={[wl.wrap, { borderColor: G.borderHi(mode), overflow:'hidden' }]}>
    <LinearGradient
      colors={mode==='dark' ? ['rgba(255,255,255,0.07)','rgba(255,255,255,0.03)'] : ['rgba(255,255,255,0.95)','rgba(255,255,255,0.80)']}
      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
      style={StyleSheet.absoluteFill}
    />
    {/* Top shimmer */}
    <View style={[wl.shimmer, { backgroundColor: mode==='dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)' }]} />
    <View style={[wl.iconWrap, { backgroundColor: G.icon(mode) }]}>
      <Ionicons name="wallet-outline" size={20} color={theme.foreground} />
    </View>
    <View style={{ flex:1, minWidth:0 }}>
      <Text style={[wl.label, { color: theme.hint }]}>WALLET BALANCE</Text>
      <Text style={[wl.amount, { color: theme.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {'\u20A6'}{Number(balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits:2 })}
      </Text>
    </View>
    <TouchableOpacity style={[wl.btn, { backgroundColor: G.cardMid(mode), borderColor: G.border(mode) }]} onPress={onTopUp} activeOpacity={0.85}>
      <Ionicons name="add" size={14} color={theme.foreground} />
      <Text style={[wl.btnTxt, { color: theme.foreground }]}>Top Up</Text>
    </TouchableOpacity>
  </View>
);
const wl = StyleSheet.create({
  wrap:    { borderRadius:22, borderWidth:1, padding:18, flexDirection:'row', alignItems:'center', gap:14, marginBottom:14 },
  shimmer: { position:'absolute', top:0, left:0, right:0, height:1 },
  iconWrap:{ width:46, height:46, borderRadius:14, justifyContent:'center', alignItems:'center', flexShrink:0 },
  label:   { fontSize:9, fontWeight:'700', letterSpacing:2.5, marginBottom:4 },
  amount:  { fontSize:22, fontWeight:'900', letterSpacing:-0.8 },
  btn:     { flexDirection:'row', alignItems:'center', gap:5, borderRadius:13, paddingHorizontal:14, paddingVertical:10, borderWidth:1, flexShrink:0 },
  btnTxt:  { fontSize:12, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS ROW
// ─────────────────────────────────────────────────────────────────────────────
const StatsRow = ({ stats, theme, mode }) => (
  <View style={[sr.wrap, { borderColor: G.border(mode), overflow:'hidden' }]}>
    <LinearGradient
      colors={mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.7)']}
      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
      style={StyleSheet.absoluteFill}
    />
    {[
      { icon:'car-outline',  value: stats?.totalRides ?? 0,     label:'Rides'    },
      { icon:'cube-outline', value: stats?.totalDeliveries ?? 0, label:'Packages' },
      { icon:'cash-outline', value: `₦${((stats?.totalSpent ?? 0)/1000).toFixed(1)}k`, label:'Spent' },
    ].map((item, i) => (
      <React.Fragment key={item.label}>
        {i > 0 && <View style={[sr.divider, { backgroundColor: G.border(mode) }]} />}
        <View style={sr.item}>
          <Ionicons name={item.icon} size={13} color={theme.hint} style={{ marginBottom:4 }} />
          <Text style={[sr.val, { color: theme.foreground }]}>{item.value}</Text>
          <Text style={[sr.lbl, { color: theme.hint }]}>{item.label}</Text>
        </View>
      </React.Fragment>
    ))}
  </View>
);
const sr = StyleSheet.create({
  wrap:    { flexDirection:'row', borderRadius:18, borderWidth:1, padding:14, alignItems:'center', marginBottom:24, overflow:'hidden' },
  item:    { flex:1, alignItems:'center' },
  val:     { fontSize:19, fontWeight:'900', marginBottom:2, letterSpacing:-0.5 },
  lbl:     { fontSize:9, fontWeight:'600', letterSpacing:0.5 },
  divider: { width:1, height:32 },
});

// ─────────────────────────────────────────────────────────────────────────────
// TIPS
// ─────────────────────────────────────────────────────────────────────────────
const TipCard = ({ item, theme, mode }) => (
  <View style={tp.card}>
    <View style={[tp.iconWrap, { backgroundColor: G.icon(mode) }]}>
      <Ionicons name={item.icon} size={17} color={theme.foreground} />
    </View>
    <View style={{ flex:1, minWidth:0 }}>
      <Text style={[tp.title, { color: theme.foreground }]}>{item.title}</Text>
      <Text style={[tp.body,  { color: theme.hint }]}>{item.body}</Text>
    </View>
  </View>
);

const TipsSection = ({ title, tips, icon, theme, mode }) => {
  const [expanded, setExpanded] = useState(false);
  const rotA = useRef(new Animated.Value(0)).current;
  const toggle = () => {
    Animated.spring(rotA,{ toValue: expanded ? 0 : 1, useNativeDriver:true, tension:80, friction:10 }).start();
    setExpanded(v => !v);
  };
  const rotate = rotA.interpolate({ inputRange:[0,1], outputRange:['0deg','180deg'] });
  const shown  = expanded ? tips : tips.slice(0,2);
  return (
    <View style={[tp.section, { borderColor: G.border(mode), overflow:'hidden' }]}>
      <LinearGradient
        colors={mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.7)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      <TouchableOpacity style={tp.header} onPress={toggle} activeOpacity={0.8}>
        <View style={[tp.headerIcon, { backgroundColor: G.icon(mode) }]}>
          <Ionicons name={icon} size={15} color={theme.foreground} />
        </View>
        <Text style={[tp.sectionTitle, { color: theme.foreground }]}>{title}</Text>
        <Animated.View style={{ transform:[{ rotate }] }}>
          <Ionicons name="chevron-down" size={15} color={theme.hint} />
        </Animated.View>
      </TouchableOpacity>
      <View style={[tp.divider, { backgroundColor: G.border(mode) }]} />
      {shown.map((tip, i) => (
        <View key={tip.id}>
          <TipCard item={tip} theme={theme} mode={mode} />
          {i < shown.length-1 && <View style={[tp.itemDivider, { backgroundColor: G.border(mode) }]} />}
        </View>
      ))}
      {!expanded && tips.length > 2 && (
        <TouchableOpacity style={tp.showMore} onPress={toggle} activeOpacity={0.7}>
          <Text style={[tp.showMoreTxt, { color: theme.hint }]}>Show {tips.length-2} more</Text>
          <Ionicons name="chevron-down" size={13} color={theme.hint} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const tp = StyleSheet.create({
  section:      { borderRadius:20, borderWidth:1, overflow:'hidden', marginBottom:14 },
  header:       { flexDirection:'row', alignItems:'center', gap:10, padding:16 },
  headerIcon:   { width:34, height:34, borderRadius:10, justifyContent:'center', alignItems:'center', flexShrink:0 },
  sectionTitle: { flex:1, fontSize:13, fontWeight:'800' },
  divider:      { height:StyleSheet.hairlineWidth, marginHorizontal:16 },
  itemDivider:  { height:StyleSheet.hairlineWidth, marginHorizontal:16 },
  card:         { flexDirection:'row', alignItems:'flex-start', gap:12, paddingHorizontal:16, paddingVertical:14 },
  iconWrap:     { width:34, height:34, borderRadius:10, justifyContent:'center', alignItems:'center', flexShrink:0, marginTop:1 },
  title:        { fontSize:13, fontWeight:'700', marginBottom:4 },
  body:         { fontSize:12, lineHeight:17 },
  showMore:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, padding:14 },
  showMoreTxt:  { fontSize:12, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY ITEM
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_META = {
  COMPLETED:   { label:'Done',      dot:'#5DAA72' },
  CANCELLED:   { label:'Cancelled', dot:'#E05555' },
  IN_PROGRESS: { label:'Active',    dot:'#AAAAAA' },
  PENDING:     { label:'Pending',   dot:'#AAAAAA' },
};

const HistoryItem = ({ icon, title, subtitle, amount, status, theme, mode, last }) => {
  const meta = STATUS_META[status] ?? { label:status, dot: theme.hint };
  return (
    <View style={[hi.row, !last && { borderBottomWidth:1, borderBottomColor: G.border(mode) }]}>
      <View style={[hi.iconWrap, { backgroundColor: G.icon(mode), borderColor: G.border(mode) }]}>
        <Ionicons name={icon} size={15} color={theme.foreground} />
      </View>
      <View style={{ flex:1, minWidth:0 }}>
        <Text style={[hi.title, { color: theme.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[hi.sub,   { color: theme.hint }]}       numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={{ alignItems:'flex-end', flexShrink:0 }}>
        <Text style={[hi.amount, { color: theme.foreground }]}>{amount}</Text>
        <View style={hi.statusRow}>
          <View style={[hi.dot, { backgroundColor: meta.dot }]} />
          <Text style={[hi.statusTxt, { color: theme.hint }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
};
const hi = StyleSheet.create({
  row:       { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:14 },
  iconWrap:  { width:38, height:38, borderRadius:12, borderWidth:1, justifyContent:'center', alignItems:'center', flexShrink:0 },
  title:     { fontSize:13, fontWeight:'600', marginBottom:3 },
  sub:       { fontSize:11 },
  amount:    { fontSize:13, fontWeight:'800', marginBottom:3 },
  statusRow: { flexDirection:'row', alignItems:'center', gap:4 },
  dot:       { width:5, height:5, borderRadius:3 },
  statusTxt: { fontSize:10, fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY + CHOOSE DRIVER
// ─────────────────────────────────────────────────────────────────────────────
const EmptyHistory = ({ theme, mode, onBook }) => (
  <View style={eh.wrap}>
    <View style={[eh.iconWrap, { backgroundColor: G.icon(mode), borderColor: G.border(mode) }]}>
      <Ionicons name="map-outline" size={26} color={theme.foreground} />
    </View>
    <Text style={[eh.title, { color: theme.foreground }]}>No trips yet</Text>
    <Text style={[eh.sub, { color: theme.hint }]}>Book your first ride or send a package to get started.</Text>
    <TouchableOpacity style={[eh.btn, { borderColor: G.border(mode), backgroundColor: G.icon(mode) }]} onPress={onBook} activeOpacity={0.8}>
      <Ionicons name="car-outline" size={14} color={theme.foreground} />
      <Text style={[eh.btnTxt, { color: theme.foreground }]}>Book a Ride</Text>
    </TouchableOpacity>
  </View>
);
const eh = StyleSheet.create({
  wrap:    { alignItems:'center', paddingVertical:32, paddingHorizontal:16 },
  iconWrap:{ width:56, height:56, borderRadius:16, borderWidth:1, justifyContent:'center', alignItems:'center', marginBottom:14 },
  title:   { fontSize:15, fontWeight:'800', marginBottom:6 },
  sub:     { fontSize:12, textAlign:'center', lineHeight:18, marginBottom:18 },
  btn:     { flexDirection:'row', alignItems:'center', gap:7, borderRadius:12, borderWidth:1, paddingHorizontal:18, paddingVertical:11 },
  btnTxt:  { fontSize:13, fontWeight:'800' },
});

const ChooseDriverBar = ({ theme, mode, onPress }) => (
  <TouchableOpacity
    style={[cd.bar, { borderColor: G.border(mode), overflow:'hidden' }]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <LinearGradient
      colors={mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.75)']}
      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={[cd.iconWrap, { backgroundColor: G.icon(mode) }]}>
      <Ionicons name="people-outline" size={18} color={theme.foreground} />
    </View>
    <View style={{ flex:1 }}>
      <Text style={[cd.title, { color: theme.foreground }]}>Choose Your Driver</Text>
      <Text style={[cd.sub, { color: theme.hint }]}>Browse nearby · See ratings & fares</Text>
    </View>
    <Ionicons name="chevron-forward" size={15} color={theme.hint} />
  </TouchableOpacity>
);
const cd = StyleSheet.create({
  bar:     { flexDirection:'row', alignItems:'center', gap:12, borderRadius:18, borderWidth:1, paddingHorizontal:16, paddingVertical:16, marginBottom:24, overflow:'hidden' },
  iconWrap:{ width:40, height:40, borderRadius:12, justifyContent:'center', alignItems:'center', flexShrink:0 },
  title:   { fontSize:14, fontWeight:'800', marginBottom:2 },
  sub:     { fontSize:11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user }        = useAuth();
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [stats,           setStats]           = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [historyLoading,  setHistoryLoading]  = useState(true);
  const [rideHistory,     setRideHistory]     = useState([]);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [activeRide,      setActiveRide]      = useState(null);
  const [activeDelivery,  setActiveDelivery]  = useState(null);
  const [maintenance,     setMaintenance]     = useState({ isOn:false, isScheduled:false, message:'', endsAt:null });

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(22)).current;

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchAll);
    return unsub;
  }, [navigation]);

  const fetchAll = async () => {
    try {
      const [statsRes, rideRes, deliveryRes, rideHistRes, delHistRes] = await Promise.allSettled([
        userAPI.getStats(),
        rideAPI.getActiveRide(),
        deliveryAPI.getActiveDelivery(),
        rideAPI.getRideHistory?.({ limit:5 }),
        deliveryAPI.getDeliveryHistory?.({ limit:5 }),
      ]);
      if (statsRes.status === 'fulfilled')    setStats(statsRes.value?.data ?? statsRes.value);
      if (rideRes.status === 'fulfilled') {
        const ride = rideRes.value?.data?.ride ?? rideRes.value?.ride ?? null;
        setActiveRide(ride && ['REQUESTED','ACCEPTED','ARRIVED','IN_PROGRESS'].includes(ride.status) ? ride : null);
      }
      if (deliveryRes.status === 'fulfilled') {
        const del = deliveryRes.value?.data?.delivery ?? null;
        setActiveDelivery(del && ['PENDING','ASSIGNED','PICKED_UP','IN_TRANSIT'].includes(del.status) ? del : null);
      }
      if (rideHistRes.status === 'fulfilled') setRideHistory(rideHistRes.value?.data?.rides ?? rideHistRes.value?.rides ?? []);
      if (delHistRes.status  === 'fulfilled') setDeliveryHistory(delHistRes.value?.data?.deliveries ?? delHistRes.value?.deliveries ?? []);
      const maint = await checkMaintenance();
      setMaintenance(maint);
    } catch {}
    finally {
      setLoading(false); setHistoryLoading(false);
      Animated.parallel([
        Animated.timing(fadeA,  { toValue:1, duration:550, useNativeDriver:true }),
        Animated.timing(slideA, { toValue:0, duration:550, useNativeDriver:true }),
      ]).start();
    }
  };

  const showMaintenanceAlert = () => {
    const endsMsg = maintenance.endsAt ? `\n\nExpected back: ${new Date(maintenance.endsAt).toLocaleString('en-NG')}` : '';
    Alert.alert('Platform Under Maintenance', maintenance.message + endsMsg);
  };

  const goToRide      = () => { if(maintenance.isOn){showMaintenanceAlert();return;} navigation.navigate('RequestRide'); };
  const goToNearby    = () => { if(maintenance.isOn){showMaintenanceAlert();return;} navigation.navigate('NearbyDrivers',{ pickupAddress:'', pickupLat:6.5244, pickupLng:3.3792, dropoffAddress:'', dropoffLat:6.4281, dropoffLng:3.4219, vehicleType:'CAR' }); };

  const handleCancelRide = () => {
    Alert.alert('Cancel Ride?','Your ride request will be cancelled.',[
      { text:'Keep', style:'cancel' },
      { text:'Cancel Ride', style:'destructive', onPress: async () => {
        try {
          await rideAPI.cancelRide(activeRide.id,{ reason:'Customer cancelled from home screen' });
          setActiveRide(null);
        } catch(err) {
          Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel the ride.');
        }
      }},
    ]);
  };

  const handleCancelDelivery = async () => {
    try {
      await deliveryAPI.cancelDelivery(activeDelivery.id,{ reason:'Customer cancelled from home screen' });
      setActiveDelivery(null);
    } catch(err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel delivery.');
    }
  };

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const hasMaintBanner  = maintenance.isOn || maintenance.isScheduled;
  const paddingTop      = hasMaintBanner ? 16 : insets.top + 16;
  const paddingBottom   = insets.bottom + (Platform.OS === 'ios' ? 110 : 90);

  const combinedHistory = [
    ...rideHistory.map(r => ({
      id:`ride-${r.id}`, icon:'car-outline',
      title: r.dropoffAddress ?? 'Ride',
      subtitle: r.createdAt ? new Date(r.createdAt).toLocaleString('en-NG',{ dateStyle:'short', timeStyle:'short' }) : '',
      amount: r.fare ? `₦${Number(r.fare).toLocaleString('en-NG')}` : '—',
      status: r.status ?? 'COMPLETED',
    })),
    ...deliveryHistory.map(d => ({
      id:`del-${d.id}`, icon:'cube-outline',
      title: d.dropoffAddress ?? 'Delivery',
      subtitle: d.createdAt ? new Date(d.createdAt).toLocaleString('en-NG',{ dateStyle:'short', timeStyle:'short' }) : '',
      amount: d.fare ? `₦${Number(d.fare).toLocaleString('en-NG')}` : '—',
      status: d.status ?? 'COMPLETED',
    })),
  ].sort((a,b) => new Date(b.subtitle) - new Date(a.subtitle)).slice(0,6);

  const serviceCards = buildServiceCards(navigation, maintenance, showMaintenanceAlert);
  const darkMode     = mode === 'dark';

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient glow orbs */}
      <View style={[s.orb1, { backgroundColor: darkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)' }]} />
      <View style={[s.orb2, { backgroundColor: darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        user={user}
        theme={theme}
        mode={mode}
      />

      {hasMaintBanner && (
        <View style={{ paddingTop: insets.top }}>
          <MaintenanceBanner message={maintenance.message} endsAt={maintenance.endsAt} scheduled={maintenance.isScheduled} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        <Animated.View style={{ opacity: fadeA, transform:[{ translateY: slideA }] }}>

          {/* ── HEADER ── */}
          <View style={s.header}>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
              onPress={() => setDrawerOpen(true)}
              activeOpacity={0.85}
            >
              <View style={s.hamburger}>
                <View style={[s.hLine, { backgroundColor: theme.foreground }]} />
                <View style={[s.hLine, s.hLineMid, { backgroundColor: theme.foreground }]} />
                <View style={[s.hLine, { backgroundColor: theme.foreground }]} />
              </View>
            </TouchableOpacity>

            <View style={{ flex:1, alignItems:'center' }}>
              <Text style={[s.greet, { color: theme.hint }]}>{greet}</Text>
              <Text style={[s.name, { color: theme.foreground }]} numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
            </View>

            <View style={s.headerRight}>
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color={theme.foreground} />
                <View style={[s.notifDot, { borderColor: theme.background }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.getParent()?.navigate('ProfileTab')} activeOpacity={0.85}>
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={[s.avatar, { borderColor: G.borderHi(mode) }]} />
                ) : (
                  <View style={[s.avatarFallback, { backgroundColor: G.cardMid(mode), borderColor: G.borderHi(mode) }]}>
                    <Text style={[s.avatarInitials, { color: theme.foreground }]}>
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── ACTIVE BANNERS ── */}
          {activeRide && (
            <ActiveRideBanner
              ride={activeRide} role="CUSTOMER" theme={theme}
              onPress={() => navigation.navigate('RideTracking',{ rideId: activeRide.id })}
              onCancel={activeRide.status === 'REQUESTED' ? handleCancelRide : undefined}
            />
          )}
          {activeDelivery && (
            <ActiveDeliveryBanner
              delivery={activeDelivery} role="CUSTOMER" theme={theme}
              onPress={() => navigation.navigate('DeliveryTracking',{ deliveryId: activeDelivery.id })}
              onCancel={activeDelivery.status === 'PENDING' ? handleCancelDelivery : undefined}
            />
          )}

          {/* ── WALLET ── */}
          <WalletStrip
            balance={stats?.walletBalance}
            onTopUp={() => navigation.getParent()?.navigate('WalletTab')}
            theme={theme}
            mode={mode}
          />

          {/* ── STATS ── */}
          {loading
            ? <ActivityIndicator color={theme.foreground} style={{ marginVertical:16 }} />
            : <StatsRow stats={stats} theme={theme} mode={mode} />
          }

          {/* ── SERVICE CAROUSEL ── */}
          <Text style={[s.sectionLabel, { color: theme.hint }]}>SERVICES</Text>
          <ServiceCarousel cards={serviceCards} theme={theme} mode={mode} />

          <View style={{ height:24 }} />

          {/* ── CHOOSE DRIVER ── */}
          <ChooseDriverBar theme={theme} mode={mode} onPress={goToNearby} />

          {/* ── TIPS ── */}
          <Text style={[s.sectionLabel, { color: theme.hint }]}>TIPS & GUIDES</Text>
          <TipsSection title="Ride Tips"     icon="car-outline"  tips={RIDE_TIPS}     theme={theme} mode={mode} />
          <TipsSection title="Delivery Tips" icon="cube-outline" tips={DELIVERY_TIPS} theme={theme} mode={mode} />

          <View style={{ height:8 }} />

          {/* ── RECENT TRIPS ── */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionLabel, { color: theme.hint, marginBottom:0, marginTop:0 }]}>RECENT TRIPS</Text>
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('HistoryTab')} activeOpacity={0.7}>
              <Text style={[s.seeAll, { color: theme.hint }]}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.historyCard, { borderColor: G.border(mode), overflow:'hidden' }]}>
            <LinearGradient
              colors={darkMode ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
              start={{ x:0, y:0 }} end={{ x:1, y:1 }}
              style={StyleSheet.absoluteFill}
            />
            {historyLoading ? (
              <ActivityIndicator color={theme.foreground} style={{ marginVertical:24 }} />
            ) : combinedHistory.length > 0 ? (
              combinedHistory.map((item, i) => (
                <HistoryItem
                  key={item.id}
                  icon={item.icon} title={item.title} subtitle={item.subtitle}
                  amount={item.amount} status={item.status}
                  theme={theme} mode={mode}
                  last={i === combinedHistory.length - 1}
                />
              ))
            ) : (
              <EmptyHistory theme={theme} mode={mode} onBook={goToRide} />
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex:1 },
  orb1:   { position:'absolute', width:width*1.2, height:width*1.2, borderRadius:width*0.6, top:-width*0.5, right:-width*0.3 },
  orb2:   { position:'absolute', width:width*0.8, height:width*0.8, borderRadius:width*0.4, bottom:-width*0.1, left:-width*0.2 },
  scroll: { paddingHorizontal: H_PAD },

  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:22 },
  greet:       { fontSize:11, fontWeight:'600', marginBottom:2, letterSpacing:0.3 },
  name:        { fontSize:17, fontWeight:'900', letterSpacing:-0.5 },
  headerRight: { flexDirection:'row', alignItems:'center', gap:10, flexShrink:0 },
  iconBtn:     { width:42, height:42, borderRadius:13, borderWidth:1, justifyContent:'center', alignItems:'center' },
  notifDot:    { position:'absolute', top:10, right:10, width:7, height:7, borderRadius:4, backgroundColor:'#E05555', borderWidth:1.5 },
  avatar:      { width:42, height:42, borderRadius:21, borderWidth:1.5 },
  avatarFallback:{ width:42, height:42, borderRadius:21, borderWidth:1.5, justifyContent:'center', alignItems:'center' },
  avatarInitials:{ fontSize:14, fontWeight:'800' },

  hamburger: { gap:4.5, alignItems:'center', justifyContent:'center' },
  hLine:     { width:16, height:1.8, borderRadius:1 },
  hLineMid:  { width:11 },

  sectionLabel:  { fontSize:9, fontWeight:'800', letterSpacing:3.5, marginTop:8, marginBottom:14 },
  sectionHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:22, marginBottom:14 },
  seeAll:        { fontSize:12, fontWeight:'700' },

  historyCard: { borderRadius:18, borderWidth:1, paddingHorizontal:16, paddingVertical:4, marginBottom:8 },
});