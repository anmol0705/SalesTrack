import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { formatCurrency } from '@salestrack/utils';
import { api, type BeatPlanStop, type VisitWithRetailer } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const TODAY = format(new Date(), 'yyyy-MM-dd');

type CheckoutOutcome = 'visited' | 'not_available' | 'refused';

// ─── Sequence circle ──────────────────────────────────────────────────────────

function SequenceCircle({
  index,
  status,
}: {
  index: number;
  status: 'visited' | 'current' | 'future';
}) {
  const bg =
    status === 'visited' ? '#1D9E75' : status === 'current' ? '#E1F5EE' : '#F1EFE8';
  const textColor =
    status === 'visited' ? '#fff' : status === 'current' ? '#1D9E75' : '#888780';
  const border = status === 'current' ? { borderWidth: 1.5, borderColor: '#1D9E75' } : {};
  return (
    <View style={[styles.seqCircle, { backgroundColor: bg }, border]}>
      <Text style={[styles.seqText, { color: textColor }]}>{index + 1}</Text>
    </View>
  );
}

// ─── Retailer card ────────────────────────────────────────────────────────────

function RetailerCard({
  stop,
  index,
  isCurrent,
  isCheckinLoading,
  onCheckin,
  pendingVisit,
  onOpenCheckout,
}: {
  stop: BeatPlanStop;
  index: number;
  isCurrent: boolean;
  isCheckinLoading: boolean;
  onCheckin: (stop: BeatPlanStop) => void;
  pendingVisit: VisitWithRetailer | undefined;
  onOpenCheckout: (stop: BeatPlanStop, visitId: string) => void;
}) {
  const status = stop.is_visited ? 'visited' : isCurrent ? 'current' : 'future';
  const { latitude, longitude } = stop.retailer;

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <SequenceCircle index={index} status={status} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{stop.retailer.name}</Text>
          <Text style={styles.cardArea}>{stop.retailer.area}</Text>
          {stop.retailer.outstanding_balance > 0 && (
            <View style={styles.duePill}>
              <Text style={styles.dueText}>
                {formatCurrency(stop.retailer.outstanding_balance)} due
              </Text>
            </View>
          )}
        </View>
        {stop.is_visited ? (
          <Text style={styles.checkIcon}>✓</Text>
        ) : isCurrent ? (
          <Text style={styles.chevron}>›</Text>
        ) : null}
      </View>

      {/* Check-in actions for current unvisited stop */}
      {isCurrent && !stop.is_visited && (
        <View style={styles.actions}>
          {latitude !== null && longitude !== null && (
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnOutlineText}>Navigate</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btnFill, isCheckinLoading && { opacity: 0.7 }]}
            onPress={() => onCheckin(stop)}
            disabled={isCheckinLoading}
            activeOpacity={0.8}
          >
            {isCheckinLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnFillText}>Check In</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Complete Visit button for visited stops with pending outcome */}
      {stop.is_visited && pendingVisit !== undefined && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => onOpenCheckout(stop, pendingVisit.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.btnOutlineText}>Complete Visit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Today screen ─────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [checkinLoadingId, setCheckinLoadingId] = useState<string | null>(null);

  // Checkout modal state
  const [checkoutStop, setCheckoutStop] = useState<BeatPlanStop | null>(null);
  const [checkoutVisitId, setCheckoutVisitId] = useState<string | null>(null);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutOutcome, setCheckoutOutcome] = useState<CheckoutOutcome>('visited');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['beat-plans-today', user?.id],
    queryFn: () => api.beatPlans.list({ agent_id: user!.id, date: TODAY }),
    enabled: !!user?.id,
  });

  const todayPlanId = plans[0]?.id ?? null;

  const { data: beatPlan, isLoading: detailLoading } = useQuery({
    queryKey: ['beat-plan-detail', todayPlanId],
    queryFn: () => api.beatPlans.get(todayPlanId!),
    enabled: !!todayPlanId,
  });

  const { data: todayVisits = [] } = useQuery({
    queryKey: ['visits-today'],
    queryFn: () => api.visits.today(),
    enabled: !!user?.id,
  });

  const stops = beatPlan?.beat_plan_retailers ?? [];
  const completedCount = stops.filter((s) => s.is_visited).length;
  const totalCount = stops.length;
  const firstUnvisitedId = stops.find((s) => !s.is_visited)?.id ?? null;

  const handleCheckin = async (stop: BeatPlanStop) => {
    setCheckinLoadingId(stop.id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to check in.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const createdVisit = await api.visits.checkin({
        beat_plan_retailer_id: stop.id,
        retailer_id: stop.retailer_id,
        check_in_lat: location.coords.latitude,
        check_in_lng: location.coords.longitude,
      });
      await queryClient.invalidateQueries({ queryKey: ['beat-plan-detail', todayPlanId] });
      await queryClient.invalidateQueries({ queryKey: ['visits-today'] });
      router.push({
        pathname: '/(tabs)/order',
        params: {
          visitId: createdVisit.id,
          retailerName: stop.retailer.name,
          retailerId: stop.retailer_id,
        },
      });
    } catch (e) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setCheckinLoadingId(null);
    }
  };

  const handleOpenCheckout = (stop: BeatPlanStop, visitId: string) => {
    setCheckoutStop(stop);
    setCheckoutVisitId(visitId);
    setCheckoutOutcome('visited');
    setCheckoutNotes('');
    setCheckoutModalVisible(true);
  };

  const handleCheckout = async () => {
    if (!checkoutVisitId) return;
    setIsCheckoutLoading(true);
    try {
      await api.visits.checkout(checkoutVisitId, {
        outcome: checkoutOutcome,
        ...(checkoutNotes.trim() ? { notes: checkoutNotes.trim() } : {}),
      });
      setCheckoutModalVisible(false);
      setCheckoutStop(null);
      setCheckoutVisitId(null);
      await queryClient.invalidateQueries({ queryKey: ['beat-plan-detail', todayPlanId] });
      await queryClient.invalidateQueries({ queryKey: ['visits-today'] });
      Alert.alert('Visit completed');
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const isLoading = plansLoading || detailLoading;

  const OUTCOME_OPTIONS: { value: CheckoutOutcome; label: string }[] = [
    { value: 'visited', label: 'Visited ✓' },
    { value: 'not_available', label: 'Not Available' },
    { value: 'refused', label: 'Refused' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning, {firstName} 👋</Text>
        <Text style={styles.dateText}>{format(new Date(), 'EEE, dd MMM yyyy')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : !beatPlan ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No route assigned today</Text>
          <Text style={styles.emptySubtitle}>
            Your manager hasn't assigned a beat plan yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{beatPlan.name}</Text>
              <Text style={styles.planProgress}>
                {completedCount} of {totalCount} visited
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: totalCount > 0
                        ? `${(completedCount / totalCount) * 100}%`
                        : '0%',
                    },
                  ]}
                />
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <RetailerCard
              stop={item}
              index={index}
              isCurrent={item.id === firstUnvisitedId}
              isCheckinLoading={checkinLoadingId === item.id}
              onCheckin={handleCheckin}
              pendingVisit={todayVisits.find(
                (v) => v.beat_plan_retailer_id === item.id && v.outcome === 'pending',
              )}
              onOpenCheckout={handleOpenCheckout}
            />
          )}
        />
      )}

      {/* Checkout modal */}
      <Modal
        visible={checkoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.checkoutSheet}>
            <Text style={styles.sheetTitle}>
              Complete visit at {checkoutStop?.retailer.name}
            </Text>

            {/* Outcome pills */}
            <View style={styles.pillRow}>
              {OUTCOME_OPTIONS.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.pill, checkoutOutcome === value && styles.pillActive]}
                  onPress={() => setCheckoutOutcome(value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.pillText,
                      checkoutOutcome === value && styles.pillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <TextInput
              style={styles.sheetNotesInput}
              placeholder="Any notes about this visit..."
              placeholderTextColor="#BDBCB7"
              value={checkoutNotes}
              onChangeText={setCheckoutNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Buttons */}
            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btnOutline, styles.sheetBtn]}
                onPress={() => setCheckoutModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnFill, styles.sheetBtn, isCheckoutLoading && { opacity: 0.7 }]}
                onPress={handleCheckout}
                disabled={isCheckoutLoading}
                activeOpacity={0.8}
              >
                {isCheckoutLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnFillText}>Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f6' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  greeting: { fontSize: 20, fontWeight: '600', color: '#2C2C2A' },
  dateText: { fontSize: 13, color: '#888780', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#2C2C2A', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#888780', textAlign: 'center', marginTop: 6 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  planHeader: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  planName: { fontSize: 16, fontWeight: '600', color: '#2C2C2A' },
  planProgress: { fontSize: 13, color: '#888780', marginTop: 4 },
  progressTrack: {
    height: 6,
    backgroundColor: '#E1F5EE',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#1D9E75', borderRadius: 3 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  seqCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seqText: { fontSize: 12, fontWeight: '600' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '500', color: '#2C2C2A' },
  cardArea: { fontSize: 12, color: '#888780', marginTop: 2 },
  duePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FCEBEB',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  dueText: { fontSize: 11, color: '#A32D2D', fontWeight: '500' },
  checkIcon: { fontSize: 18, color: '#1D9E75' },
  chevron: { fontSize: 22, color: '#1D9E75' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnOutline: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: { color: '#1D9E75', fontSize: 14, fontWeight: '500' },
  btnFill: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFillText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Checkout modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  checkoutSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: '#2C2C2A', marginBottom: 16 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#F1EFE8',
    borderWidth: 1,
    borderColor: '#D3D1C7',
  },
  pillActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  pillText: { fontSize: 12, fontWeight: '500', color: '#2C2C2A' },
  pillTextActive: { color: '#fff' },
  sheetNotesInput: {
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2C2C2A',
    marginBottom: 16,
    height: 80,
    textAlignVertical: 'top',
  },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  sheetBtn: { height: 48 },
});
