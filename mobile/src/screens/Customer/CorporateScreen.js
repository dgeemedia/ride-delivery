// mobile/src/screens/Customer/CorporateScreen.js
// ── Premium Glass Edition ─────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Animated, Platform,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { corporateAPI }      from '../../services/api';

const CORP_BLUE = '#2563EB';

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.82)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
  borderHi:(mode)=> mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
  icon:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
};

// ── Budget bar ────────────────────────────────────────────────────────────────
const BudgetBar = ({ spent, limit, theme, mode }) => {
  const pct   = limit > 0 ? Math.min(spent / limit, 1) : 0;
  const color = pct > 0.9 ? '#E05555' : pct > 0.7 ? '#FFB800' : CORP_BLUE;
  const widA  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(widA,{ toValue: pct, useNativeDriver:false, tension:60, friction:10 }).start();
  }, [pct]);
  return (
    <View style={bb.wrap}>
      <View style={[bb.track, { backgroundColor: G.border(mode) }]}>
        <Animated.View style={[bb.fill, { width: widA.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }), backgroundColor: color }]} />
      </View>
      <View style={bb.labels}>
        <Text style={[bb.txt, { color: theme.hint }]}>₦{spent.toLocaleString('en-NG')} spent</Text>
        <Text style={[bb.txt, { color: theme.hint }]}>₦{limit.toLocaleString('en-NG')} limit</Text>
      </View>
    </View>
  );
};
const bb = StyleSheet.create({
  wrap:   { marginBottom:12 },
  track:  { height:6, borderRadius:3, overflow:'hidden', marginBottom:6 },
  fill:   { height:'100%', borderRadius:3 },
  labels: { flexDirection:'row', justifyContent:'space-between' },
  txt:    { fontSize:10 },
});

// ── Employee card ─────────────────────────────────────────────────────────────
const EmployeeCard = ({ emp, theme, mode, onEdit }) => {
  const statusColor = emp.inviteStatus === 'ACTIVE' ? '#4CAF50' : emp.inviteStatus === 'PENDING' ? '#FFB800' : '#E05555';
  return (
    <View style={[ec.card, { borderColor: G.border(mode), overflow:'hidden' }]}>
      <LinearGradient
        colors={mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.7)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[ec.avatar, { backgroundColor: CORP_BLUE + '18' }]}>
        <Text style={[ec.initials, { color: CORP_BLUE }]}>
          {emp.user?.firstName?.[0]}{emp.user?.lastName?.[0]}
        </Text>
      </View>
      <View style={{ flex:1 }}>
        <Text style={[ec.name, { color: theme.foreground }]}>{emp.user?.firstName} {emp.user?.lastName}</Text>
        <Text style={[ec.dept, { color: theme.hint }]}>{emp.department ?? emp.user?.phone}</Text>
        <BudgetBar spent={emp.currentMonthSpend} limit={emp.monthlyLimit} theme={theme} mode={mode} />
      </View>
      <View style={ec.right}>
        <View style={[ec.statusBadge, { backgroundColor: statusColor + '18', borderColor: statusColor + '30', borderWidth:1 }]}>
          <Text style={[ec.statusTxt, { color: statusColor }]}>{emp.inviteStatus}</Text>
        </View>
        <TouchableOpacity onPress={() => onEdit(emp)} style={{ padding:4, marginTop:6 }}>
          <Ionicons name="create-outline" size={16} color={theme.hint} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
const ec = StyleSheet.create({
  card:       { flexDirection:'row', alignItems:'flex-start', gap:12, borderRadius:16, borderWidth:1, padding:14, marginBottom:10, overflow:'hidden' },
  avatar:     { width:42, height:42, borderRadius:21, justifyContent:'center', alignItems:'center', flexShrink:0, marginTop:2 },
  initials:   { fontSize:15, fontWeight:'800' },
  name:       { fontSize:13, fontWeight:'700', marginBottom:2 },
  dept:       { fontSize:11, marginBottom:8 },
  right:      { alignItems:'flex-end', flexShrink:0 },
  statusBadge:{ borderRadius:8, paddingHorizontal:7, paddingVertical:3 },
  statusTxt:  { fontSize:9, fontWeight:'800', letterSpacing:0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function CorporateScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  const [tab,       setTab]       = useState('overview');
  const [company,   setCompany]   = useState(null);
  const [myAccount, setMyAccount] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [trips,     setTrips]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [isAdmin,   setIsAdmin]   = useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [profileRes, myRes] = await Promise.allSettled([
        corporateAPI.getProfile(),
        corporateAPI.getMyAccount(),
      ]);
      if (profileRes.status === 'fulfilled' && profileRes.value?.data?.company) {
        setCompany(profileRes.value.data.company);
        setIsAdmin(true);
        const [empRes, tripRes] = await Promise.allSettled([
          corporateAPI.listEmployees({ limit:10 }),
          corporateAPI.getTrips({ limit:10 }),
        ]);
        if (empRes.status  === 'fulfilled') setEmployees(empRes.value?.data?.employees ?? []);
        if (tripRes.status === 'fulfilled') setTrips(tripRes.value?.data?.trips ?? []);
      } else if (myRes.status === 'fulfilled') {
        setMyAccount(myRes.value?.data);
      }
    } catch {}
    finally {
      setLoading(false);
      Animated.timing(fadeA, { toValue:1, duration:450, useNativeDriver:true }).start();
    }
  };

  if (loading) return (
    <View style={[s.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={CORP_BLUE} size="large" />
    </View>
  );

  // ── Employee view ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <View style={[s.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: G.border(mode) }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[s.title, { color: theme.foreground }]}>Corporate</Text>
        </View>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + (Platform.OS==='ios' ? 110 : 90) }]}>
          {myAccount?.employed ? (
            <View style={[s.employeeCard, { borderColor: CORP_BLUE + '40', overflow:'hidden' }]}>
              <LinearGradient
                colors={darkMode ? ['rgba(37,99,235,0.12)','rgba(37,99,235,0.04)'] : ['rgba(37,99,235,0.08)','rgba(37,99,235,0.02)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.shimmer} />
              <View style={s.companyHeader}>
                <View style={[s.companyLogo, { backgroundColor: CORP_BLUE + '18' }]}>
                  <Ionicons name="business" size={22} color={CORP_BLUE} />
                </View>
                <View>
                  <Text style={[s.companyName, { color: theme.foreground }]}>{myAccount.companyName}</Text>
                  <Text style={[s.companyDept, { color: theme.hint }]}>{myAccount.department ?? 'Staff'}</Text>
                </View>
              </View>
              <BudgetBar spent={myAccount.currentMonthSpend} limit={myAccount.monthlyLimit} theme={theme} mode={mode} />
              <View style={s.budgetStats}>
                <View style={s.statItem}>
                  <Text style={[s.statLabel, { color: theme.hint }]}>MONTHLY BUDGET</Text>
                  <Text style={[s.statVal, { color: theme.foreground }]}>₦{myAccount.monthlyLimit.toLocaleString('en-NG')}</Text>
                </View>
                <View style={s.statItem}>
                  <Text style={[s.statLabel, { color: theme.hint }]}>REMAINING</Text>
                  <Text style={[s.statVal, { color: CORP_BLUE }]}>₦{myAccount.remaining.toLocaleString('en-NG')}</Text>
                </View>
              </View>
              {!myAccount.canBook && (
                <View style={[s.restrictNotice, { backgroundColor:'#FFB80012', borderColor:'#FFB800' }]}>
                  <Ionicons name="time-outline" size={14} color="#FFB800" />
                  <Text style={[s.restrictTxt, { color:'#FFB800' }]}>Corporate booking is only available weekdays 7 AM – 8 PM</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[s.noCorpCard, { borderColor: G.border(mode), overflow:'hidden' }]}>
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="business-outline" size={38} color={theme.hint} />
              <Text style={[s.noCorpTitle, { color: theme.foreground }]}>No Corporate Account</Text>
              <Text style={[s.noCorpSub, { color: theme.hint }]}>Ask your company admin to invite you, or register your own corporate account.</Text>
              <TouchableOpacity style={[s.registerBtn, { backgroundColor: CORP_BLUE }]} onPress={() => navigation.navigate('RegisterCompany')}>
                <Text style={s.registerBtnTxt}>Register My Company</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Admin view ───────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <View style={[s.orb, { backgroundColor: darkMode ? 'rgba(37,99,235,0.06)' : 'rgba(37,99,235,0.03)' }]} />

      <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: G.border(mode) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={[s.title, { color: theme.foreground }]}>{company?.name ?? 'Corporate'}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
            <View style={[s.statusDot, { backgroundColor: company?.status === 'ACTIVE' ? '#4CAF50' : '#FFB800' }]} />
            <Text style={[s.sub, { color: theme.hint }]}>{company?.status}</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.topUpBtn, { backgroundColor: CORP_BLUE }]} onPress={() => navigation.navigate('CorporateTopUp')}>
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={s.topUpBtnTxt}>Top Up</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[s.tabs, { borderBottomColor: G.border(mode) }]}>
        {[['overview','Overview'],['employees','Employees'],['trips','Trips']].map(([key, label]) => (
          <TouchableOpacity key={key} style={s.tab} onPress={() => setTab(key)}>
            <Text style={[s.tabTxt, { color: tab === key ? CORP_BLUE : theme.hint }]}>{label}</Text>
            {tab === key && <View style={[s.tabLine, { backgroundColor: CORP_BLUE }]} />}
          </TouchableOpacity>
        ))}
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeA }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + (Platform.OS==='ios' ? 110 : 90) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Overview ── */}
        {tab === 'overview' && company && (
          <>
            <View style={[s.walletCard, { borderColor: CORP_BLUE + '40', overflow:'hidden' }]}>
              <LinearGradient
                colors={darkMode ? ['rgba(37,99,235,0.14)','rgba(37,99,235,0.05)'] : ['rgba(37,99,235,0.10)','rgba(37,99,235,0.03)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.walletShimmer, { backgroundColor: CORP_BLUE + '40' }]} />
              <Text style={[s.walletLabel, { color: CORP_BLUE }]}>WALLET BALANCE</Text>
              <Text style={[s.walletAmount, { color: CORP_BLUE }]}>
                ₦{(company.wallet?.balance ?? 0).toLocaleString('en-NG',{ minimumFractionDigits:2 })}
              </Text>
              <View style={s.walletRow}>
                <Text style={[s.walletSub, { color: theme.hint }]}>{company._count?.employees ?? 0} employees · {company._count?.trips ?? 0} trips</Text>
                <Text style={[s.walletType, { color: CORP_BLUE }]}>{company.billingType}</Text>
              </View>
            </View>

            <View style={s.statsRow}>
              {[
                { label:'Commission Rate', value:`${(company.commissionRate*100).toFixed(0)}%` },
                { label:'Billing',         value: company.billingType },
                { label:'Status',          value: company.status },
              ].map((st, i) => (
                <View key={i} style={[s.statCard, { borderColor: G.border(mode), overflow:'hidden' }]}>
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.75)']}
                    start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[s.statCardLabel, { color: theme.hint }]}>{st.label}</Text>
                  <Text style={[s.statCardVal, { color: theme.foreground }]}>{st.value}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.invoiceBtn, { borderColor: CORP_BLUE + '40', overflow:'hidden' }]}
              onPress={() => navigation.navigate('CorporateInvoice')}
            >
              <LinearGradient
                colors={darkMode ? ['rgba(37,99,235,0.10)','rgba(37,99,235,0.04)'] : ['rgba(37,99,235,0.07)','rgba(37,99,235,0.02)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="document-text-outline" size={18} color={CORP_BLUE} />
              <Text style={[s.invoiceBtnTxt, { color: CORP_BLUE }]}>Download Monthly Invoice</Text>
              <Ionicons name="chevron-forward" size={14} color={CORP_BLUE} />
            </TouchableOpacity>
          </>
        )}

        {/* ── Employees ── */}
        {tab === 'employees' && (
          <>
            <TouchableOpacity style={[s.inviteBtn, { backgroundColor: CORP_BLUE }]} onPress={() => navigation.navigate('InviteEmployee')}>
              <Ionicons name="person-add-outline" size={18} color="#FFF" />
              <Text style={s.inviteBtnTxt}>Invite Employee</Text>
            </TouchableOpacity>
            {employees.length === 0 ? (
              <View style={[s.emptyState, { borderColor: G.border(mode) }]}>
                <Ionicons name="people-outline" size={32} color={theme.hint} />
                <Text style={[s.emptyTxt, { color: theme.hint }]}>No employees yet. Invite your team.</Text>
              </View>
            ) : (
              employees.map(emp => (
                <EmployeeCard
                  key={emp.id} emp={emp} theme={theme} mode={mode}
                  onEdit={(e) => navigation.navigate('EditEmployee',{ employee:e })}
                />
              ))
            )}
          </>
        )}

        {/* ── Trips ── */}
        {tab === 'trips' && (
          <>
            {trips.length === 0 ? (
              <View style={[s.emptyState, { borderColor: G.border(mode) }]}>
                <Ionicons name="car-outline" size={32} color={theme.hint} />
                <Text style={[s.emptyTxt, { color: theme.hint }]}>No corporate trips yet.</Text>
              </View>
            ) : (
              trips.map(trip => (
                <View key={trip.id} style={[s.tripCard, { borderColor: G.border(mode), overflow:'hidden' }]}>
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                    start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.tripHeader}>
                    <Text style={[s.tripEmployee, { color: theme.foreground }]}>{trip.employee?.user?.firstName} {trip.employee?.user?.lastName}</Text>
                    <Text style={[s.tripFare, { color: CORP_BLUE }]}>₦{trip.fare.toLocaleString('en-NG')}</Text>
                  </View>
                  {trip.purpose && <Text style={[s.tripPurpose, { color: theme.hint }]}>"{trip.purpose}"</Text>}
                  <Text style={[s.tripRoute, { color: theme.hint }]} numberOfLines={1}>
                    {trip.ride?.pickupAddress ?? trip.delivery?.pickupAddress} → {trip.ride?.dropoffAddress ?? trip.delivery?.dropoffAddress}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex:1 },
  center:   { flex:1, justifyContent:'center', alignItems:'center' },
  orb:      { position:'absolute', width:400, height:400, borderRadius:200, top:-150, right:-100 },
  header:   { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingBottom:14, borderBottomWidth:1 },
  backBtn:  { padding:4 },
  title:    { fontSize:18, fontWeight:'900' },
  sub:      { fontSize:11 },
  statusDot:{ width:7, height:7, borderRadius:4 },
  topUpBtn: { flexDirection:'row', alignItems:'center', gap:5, borderRadius:11, paddingHorizontal:12, paddingVertical:9 },
  topUpBtnTxt:{ fontSize:13, fontWeight:'700', color:'#FFF' },
  tabs:     { flexDirection:'row', borderBottomWidth:1 },
  tab:      { flex:1, alignItems:'center', paddingVertical:12, position:'relative' },
  tabTxt:   { fontSize:13, fontWeight:'700' },
  tabLine:  { position:'absolute', bottom:0, left:20, right:20, height:2, borderRadius:1 },
  scroll:   { paddingHorizontal:20, paddingTop:20 },
  shimmer:  { position:'absolute', top:0, left:0, right:0, height:1, opacity:0.6 },

  walletCard:    { borderRadius:18, borderWidth:1, padding:20, marginBottom:16, overflow:'hidden' },
  walletShimmer: { position:'absolute', top:0, left:0, right:0, height:1, opacity:0.5 },
  walletLabel:   { fontSize:9, fontWeight:'800', letterSpacing:2.5, marginBottom:8 },
  walletAmount:  { fontSize:30, fontWeight:'900', letterSpacing:-1, marginBottom:10 },
  walletRow:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  walletSub:     { fontSize:12 },
  walletType:    { fontSize:11, fontWeight:'700' },
  statsRow:      { flexDirection:'row', gap:10, marginBottom:16 },
  statCard:      { flex:1, borderRadius:14, borderWidth:1, padding:12, alignItems:'center', overflow:'hidden' },
  statCardLabel: { fontSize:9, fontWeight:'700', letterSpacing:1, marginBottom:5 },
  statCardVal:   { fontSize:14, fontWeight:'900' },
  invoiceBtn:    { flexDirection:'row', alignItems:'center', gap:10, borderRadius:16, borderWidth:1, paddingHorizontal:16, paddingVertical:15, marginBottom:20, overflow:'hidden' },
  invoiceBtnTxt: { flex:1, fontSize:14, fontWeight:'700' },
  inviteBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:14, paddingVertical:14, marginBottom:16 },
  inviteBtnTxt:  { fontSize:14, fontWeight:'700', color:'#FFF' },
  emptyState:    { borderRadius:14, borderWidth:1, borderStyle:'dashed', padding:32, alignItems:'center', gap:10 },
  emptyTxt:      { fontSize:13, textAlign:'center' },
  tripCard:      { borderRadius:14, borderWidth:1, padding:14, marginBottom:10, overflow:'hidden' },
  tripHeader:    { flexDirection:'row', justifyContent:'space-between', marginBottom:4 },
  tripEmployee:  { fontSize:13, fontWeight:'700' },
  tripFare:      { fontSize:13, fontWeight:'700' },
  tripPurpose:   { fontSize:12, marginBottom:4 },
  tripRoute:     { fontSize:11 },
  employeeCard:  { borderRadius:18, borderWidth:1, padding:18, marginBottom:20, overflow:'hidden' },
  companyHeader: { flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 },
  companyLogo:   { width:44, height:44, borderRadius:12, justifyContent:'center', alignItems:'center' },
  companyName:   { fontSize:16, fontWeight:'800', marginBottom:2 },
  companyDept:   { fontSize:12 },
  budgetStats:   { flexDirection:'row', gap:20 },
  statItem:      { flex:1 },
  statLabel:     { fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:4 },
  statVal:       { fontSize:17, fontWeight:'900' },
  restrictNotice:{ flexDirection:'row', alignItems:'flex-start', gap:8, borderRadius:10, borderWidth:1, padding:10, marginTop:12 },
  restrictTxt:   { fontSize:12, flex:1 },
  noCorpCard:    { borderRadius:18, borderWidth:1, padding:28, alignItems:'center', gap:12, overflow:'hidden' },
  noCorpTitle:   { fontSize:16, fontWeight:'800' },
  noCorpSub:     { fontSize:13, textAlign:'center', lineHeight:18 },
  registerBtn:   { borderRadius:12, paddingHorizontal:20, paddingVertical:12 },
  registerBtnTxt:{ fontSize:14, fontWeight:'700', color:'#FFF' },
});