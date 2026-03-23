// mobile/src/screens/Customer/CorporateScreen.js
//
// Corporate account hub screen.
// Company admins: see wallet, manage employees, view trips, get invoice.
// Regular employees: see their monthly budget and usage.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StatusBar, Animated, Image,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { corporateAPI }      from '../../services/api';

const CORP_BLUE = '#2563EB';

// ── Budget bar ────────────────────────────────────────────────────────────────
const BudgetBar = ({ spent, limit, theme }) => {
  const pct   = limit > 0 ? Math.min(spent / limit, 1) : 0;
  const color = pct > 0.9 ? '#E05555' : pct > 0.7 ? '#FFB800' : CORP_BLUE;
  return (
    <View style={bb.wrap}>
      <View style={[bb.track, { backgroundColor: theme.border }]}>
        <View style={[bb.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <View style={bb.labels}>
        <Text style={[bb.txt, { color: theme.hint }]}>₦{spent.toLocaleString('en-NG')} spent</Text>
        <Text style={[bb.txt, { color: theme.hint }]}>₦{limit.toLocaleString('en-NG')} limit</Text>
      </View>
    </View>
  );
};
const bb = StyleSheet.create({
  wrap:   { marginBottom: 12 },
  track:  { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  fill:   { height: '100%', borderRadius: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  txt:    { fontSize: 11 },
});

// ── Employee card ─────────────────────────────────────────────────────────────
const EmployeeCard = ({ emp, theme, onEdit }) => {
  const statusColor = emp.inviteStatus === 'ACTIVE' ? '#4CAF50' : emp.inviteStatus === 'PENDING' ? '#FFB800' : '#E05555';
  return (
    <View style={[ec.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <View style={[ec.avatar, { backgroundColor: CORP_BLUE + '15' }]}>
        <Text style={[ec.initials, { color: CORP_BLUE }]}>
          {emp.user?.firstName?.[0]}{emp.user?.lastName?.[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ec.name, { color: theme.foreground }]}>
          {emp.user?.firstName} {emp.user?.lastName}
        </Text>
        <Text style={[ec.dept, { color: theme.hint }]}>{emp.department ?? emp.user?.phone}</Text>
        <BudgetBar spent={emp.currentMonthSpend} limit={emp.monthlyLimit} theme={theme} />
      </View>
      <View style={ec.right}>
        <View style={[ec.statusBadge, { backgroundColor: statusColor + '15' }]}>
          <Text style={[ec.statusTxt, { color: statusColor }]}>{emp.inviteStatus}</Text>
        </View>
        <TouchableOpacity onPress={() => onEdit(emp)} style={{ padding: 4, marginTop: 6 }}>
          <Ionicons name="create-outline" size={16} color={theme.hint} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
const ec = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  avatar:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  initials:   { fontSize: 15, fontWeight: '800' },
  name:       { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  dept:       { fontSize: 11, marginBottom: 8 },
  right:      { alignItems: 'flex-end', flexShrink: 0 },
  statusBadge:{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  statusTxt:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function CorporateScreen({ navigation }) {
  const { theme } = useTheme();
  const { user }  = useAuth();
  const insets    = useSafeAreaInsets();

  const [tab,       setTab]       = useState('overview'); // overview | employees | trips
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
          corporateAPI.listEmployees({ limit: 10 }),
          corporateAPI.getTrips({ limit: 10 }),
        ]);
        if (empRes.status  === 'fulfilled') setEmployees(empRes.value?.data?.employees ?? []);
        if (tripRes.status === 'fulfilled') setTrips(tripRes.value?.data?.trips ?? []);
      } else if (myRes.status === 'fulfilled') {
        setMyAccount(myRes.value?.data);
      }
    } catch {}
    finally {
      setLoading(false);
      Animated.timing(fadeA, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }
  };

  const handleInviteEmployee = () => navigation.navigate('InviteEmployee');
  const handleTopUp = () => navigation.navigate('CorporateTopUp');
  const accentFg = theme.accentFg ?? '#111';

  if (loading) return (
    <View style={[s.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={CORP_BLUE} size="large" />
    </View>
  );

  // ── Employee view (non-admin) ─────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <View style={[s.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" />
        <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={22} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[s.title, { color: theme.foreground }]}>Corporate</Text>
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
          {myAccount?.employed ? (
            <View style={[s.employeeCard, { backgroundColor: theme.backgroundAlt, borderColor: CORP_BLUE + '50' }]}>
              <View style={s.companyHeader}>
                <View style={[s.companyLogo, { backgroundColor: CORP_BLUE + '15' }]}>
                  <Ionicons name="business" size={22} color={CORP_BLUE} />
                </View>
                <View>
                  <Text style={[s.companyName, { color: theme.foreground }]}>{myAccount.companyName}</Text>
                  <Text style={[s.companyDept, { color: theme.hint }]}>{myAccount.department ?? 'Staff'}</Text>
                </View>
              </View>
              <BudgetBar spent={myAccount.currentMonthSpend} limit={myAccount.monthlyLimit} theme={theme} />
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
                <View style={[s.restrictNotice, { backgroundColor: '#FFB80010', borderColor: '#FFB800' }]}>
                  <Ionicons name="time-outline" size={14} color="#FFB800" />
                  <Text style={[s.restrictTxt, { color: '#FFB800' }]}>Corporate booking is only available on weekdays 7 AM – 8 PM</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[s.noCorpCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Ionicons name="business-outline" size={36} color={theme.hint} />
              <Text style={[s.noCorpTitle, { color: theme.foreground }]}>No Corporate Account</Text>
              <Text style={[s.noCorpSub, { color: theme.hint }]}>
                Ask your company admin to invite you, or register your own corporate account.
              </Text>
              <TouchableOpacity
                style={[s.registerBtn, { backgroundColor: CORP_BLUE }]}
                onPress={() => navigation.navigate('RegisterCompany')}
              >
                <Text style={[s.registerBtnTxt, { color: '#FFF' }]}>Register My Company</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Admin view ────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.foreground }]}>{company?.name ?? 'Corporate'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[s.statusDot, { backgroundColor: company?.status === 'ACTIVE' ? '#4CAF50' : '#FFB800' }]} />
            <Text style={[s.sub, { color: theme.hint }]}>{company?.status}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[s.topUpBtn, { backgroundColor: CORP_BLUE }]}
          onPress={handleTopUp}
        >
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={[s.topUpBtnTxt, { color: '#FFF' }]}>Top Up</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[s.tabs, { borderBottomColor: theme.border }]}>
        {[['overview', 'Overview'], ['employees', 'Employees'], ['trips', 'Trips']].map(([key, label]) => (
          <TouchableOpacity key={key} style={s.tab} onPress={() => setTab(key)}>
            <Text style={[s.tabTxt, { color: tab === key ? CORP_BLUE : theme.hint }]}>{label}</Text>
            {tab === key && <View style={[s.tabLine, { backgroundColor: CORP_BLUE }]} />}
          </TouchableOpacity>
        ))}
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeA }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Overview tab ── */}
        {tab === 'overview' && company && (
          <>
            {/* Wallet card */}
            <View style={[s.walletCard, { backgroundColor: CORP_BLUE + '10', borderColor: CORP_BLUE + '40' }]}>
              <Text style={[s.walletLabel, { color: CORP_BLUE }]}>WALLET BALANCE</Text>
              <Text style={[s.walletAmount, { color: CORP_BLUE }]}>
                ₦{(company.wallet?.balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </Text>
              <View style={s.walletRow}>
                <Text style={[s.walletSub, { color: theme.hint }]}>
                  {company._count?.employees ?? 0} employees · {company._count?.trips ?? 0} trips
                </Text>
                <Text style={[s.walletType, { color: CORP_BLUE }]}>{company.billingType}</Text>
              </View>
            </View>

            {/* Quick stats */}
            <View style={s.statsRow}>
              {[
                { label: 'Commission Rate', value: `${(company.commissionRate * 100).toFixed(0)}%` },
                { label: 'Billing', value: company.billingType },
                { label: 'Status', value: company.status },
              ].map((st, i) => (
                <View key={i} style={[s.statCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <Text style={[s.statCardLabel, { color: theme.hint }]}>{st.label}</Text>
                  <Text style={[s.statCardVal, { color: theme.foreground }]}>{st.value}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[s.invoiceBtn, { borderColor: CORP_BLUE + '50', backgroundColor: CORP_BLUE + '0D' }]}
              onPress={() => navigation.navigate('CorporateInvoice')}
            >
              <Ionicons name="document-text-outline" size={18} color={CORP_BLUE} />
              <Text style={[s.invoiceBtnTxt, { color: CORP_BLUE }]}>Download Monthly Invoice</Text>
              <Ionicons name="chevron-forward" size={14} color={CORP_BLUE} />
            </TouchableOpacity>
          </>
        )}

        {/* ── Employees tab ── */}
        {tab === 'employees' && (
          <>
            <TouchableOpacity
              style={[s.inviteBtn, { backgroundColor: CORP_BLUE }]}
              onPress={handleInviteEmployee}
            >
              <Ionicons name="person-add-outline" size={18} color="#FFF" />
              <Text style={[s.inviteBtnTxt, { color: '#FFF' }]}>Invite Employee</Text>
            </TouchableOpacity>
            {employees.length === 0 ? (
              <View style={[s.emptyState, { borderColor: theme.border }]}>
                <Ionicons name="people-outline" size={32} color={theme.hint} />
                <Text style={[s.emptyTxt, { color: theme.hint }]}>No employees yet. Invite your team.</Text>
              </View>
            ) : (
              employees.map(emp => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  theme={theme}
                  onEdit={(e) => navigation.navigate('EditEmployee', { employee: e })}
                />
              ))
            )}
          </>
        )}

        {/* ── Trips tab ── */}
        {tab === 'trips' && (
          <>
            {trips.length === 0 ? (
              <View style={[s.emptyState, { borderColor: theme.border }]}>
                <Ionicons name="car-outline" size={32} color={theme.hint} />
                <Text style={[s.emptyTxt, { color: theme.hint }]}>No corporate trips yet.</Text>
              </View>
            ) : (
              trips.map(trip => (
                <View key={trip.id} style={[s.tripCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                  <View style={s.tripHeader}>
                    <Text style={[s.tripEmployee, { color: theme.foreground }]}>
                      {trip.employee?.user?.firstName} {trip.employee?.user?.lastName}
                    </Text>
                    <Text style={[s.tripFare, { color: CORP_BLUE }]}>₦{trip.fare.toLocaleString('en-NG')}</Text>
                  </View>
                  {trip.purpose && (
                    <Text style={[s.tripPurpose, { color: theme.hint }]}>"{trip.purpose}"</Text>
                  )}
                  <Text style={[s.tripRoute, { color: theme.hint }]} numberOfLines={1}>
                    {trip.ride?.pickupAddress ?? trip.delivery?.pickupAddress}
                    {' → '}
                    {trip.ride?.dropoffAddress ?? trip.delivery?.dropoffAddress}
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
  root:     { flex: 1 },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title:    { fontSize: 17, fontWeight: '900' },
  sub:      { fontSize: 11 },
  statusDot:{ width: 7, height: 7, borderRadius: 4 },
  topUpBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  topUpBtnTxt: { fontSize: 13, fontWeight: '700' },
  tabs:     { flexDirection: 'row', borderBottomWidth: 1 },
  tab:      { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabTxt:   { fontSize: 13, fontWeight: '700' },
  tabLine:  { position: 'absolute', bottom: 0, left: 20, right: 20, height: 2, borderRadius: 1 },
  scroll:   { paddingHorizontal: 20, paddingTop: 20 },

  // Wallet
  walletCard:   { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 16 },
  walletLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 6 },
  walletAmount: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  walletRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletSub:    { fontSize: 12 },
  walletType:   { fontSize: 11, fontWeight: '700' },

  statsRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:      { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
  statCardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  statCardVal:   { fontSize: 14, fontWeight: '800' },

  invoiceBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 },
  invoiceBtnTxt: { flex: 1, fontSize: 14, fontWeight: '700' },

  inviteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 13, marginBottom: 16 },
  inviteBtnTxt: { fontSize: 14, fontWeight: '700' },

  emptyState: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', padding: 32, alignItems: 'center', gap: 10 },
  emptyTxt:   { fontSize: 13, textAlign: 'center' },

  tripCard:     { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  tripHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tripEmployee: { fontSize: 13, fontWeight: '700' },
  tripFare:     { fontSize: 13, fontWeight: '700' },
  tripPurpose:  { fontSize: 12, marginBottom: 4 },
  tripRoute:    { fontSize: 11 },

  // Employee view
  employeeCard:  { borderRadius: 16, borderWidth: 1.5, padding: 18, marginBottom: 20 },
  companyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  companyLogo:   { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  companyName:   { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  companyDept:   { fontSize: 12 },
  budgetStats:   { flexDirection: 'row', gap: 20 },
  statItem:      { flex: 1 },
  statLabel:     { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  statVal:       { fontSize: 16, fontWeight: '800' },
  restrictNotice:{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 12 },
  restrictTxt:   { fontSize: 12, flex: 1 },

  noCorpCard:   { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: 'center', gap: 12 },
  noCorpTitle:  { fontSize: 16, fontWeight: '800' },
  noCorpSub:    { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  registerBtn:  { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  registerBtnTxt: { fontSize: 14, fontWeight: '700' },
});