import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatCurrency, formatTime } from '@salestrack/utils';
import { api, type PaymentWithRetailer } from '@/lib/api';
import type { Retailer } from '@salestrack/types';

type PaymentMethod = 'cash' | 'cheque' | 'upi';

const METHODS: PaymentMethod[] = ['cash', 'cheque', 'upi'];
const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function PaymentsScreen() {
  const queryClient = useQueryClient();

  // Form state
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retailerModalOpen, setRetailerModalOpen] = useState(false);
  const [retailerSearch, setRetailerSearch] = useState('');

  const { data: retailers = [] } = useQuery({
    queryKey: ['retailers'],
    queryFn: () => api.retailers.list(),
  });

  const { data: todayPayments = [] } = useQuery({
    queryKey: ['payments-today'],
    queryFn: () => api.payments.list({ date: TODAY }),
  });

  const filteredRetailers = retailers.filter((r: Retailer) =>
    r.name.toLowerCase().includes(retailerSearch.toLowerCase()),
  );

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!selectedRetailer) {
      Alert.alert('Validation', 'Please select a retailer');
      return;
    }
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount');
      return;
    }
    if ((method === 'cheque' || method === 'upi') && !reference.trim()) {
      Alert.alert('Validation', 'Please enter a reference number');
      return;
    }

    // Payments require a visit_id but for quick collection we need one.
    // For MVP, use the most recent pending visit for this retailer.
    // If none, show an error — agents must check in first.
    const visits = await api.visits.today().catch(() => []);
    const matchingVisit = visits.find(
      (v) => v.retailer_id === selectedRetailer.id && v.outcome === 'pending',
    );
    if (!matchingVisit) {
      Alert.alert(
        'Check in first',
        'You need an active visit for this retailer. Check in first.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.payments.create({
        visit_id: matchingVisit.id,
        retailer_id: selectedRetailer.id,
        amount: parsedAmount,
        method,
        ...(reference.trim() ? { reference_number: reference.trim() } : {}),
      });

      Alert.alert(
        'Payment Recorded',
        'Opening WhatsApp to send receipt...',
        [{ text: 'OK', onPress: () => Linking.openURL(result.whatsapp_link) }],
      );

      setSelectedRetailer(null);
      setAmount('');
      setMethod('cash');
      setReference('');
      await queryClient.invalidateQueries({ queryKey: ['payments-today'] });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Collect Payment</Text>

        {/* Log payment form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Payment</Text>

          {/* Retailer picker */}
          <Text style={styles.label}>Retailer</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setRetailerModalOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={selectedRetailer ? styles.pickerValue : styles.pickerPlaceholder}>
              {selectedRetailer ? selectedRetailer.name : 'Select retailer'}
            </Text>
          </TouchableOpacity>

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#B0AEA6"
            />
          </View>

          {/* Method pills */}
          <Text style={styles.label}>Method</Text>
          <View style={styles.pillRow}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.methodPill, method === m && styles.methodPillActive]}
                onPress={() => setMethod(m)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.methodPillText, method === m && styles.methodPillTextActive]}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reference (conditional) */}
          {(method === 'cheque' || method === 'upi') && (
            <>
              <Text style={styles.label}>
                {method === 'cheque' ? 'Cheque number' : 'UPI transaction ID'}
              </Text>
              <TextInput
                style={styles.input}
                value={reference}
                onChangeText={setReference}
                placeholder={method === 'cheque' ? 'CK123456' : 'UPI123456789'}
                placeholderTextColor="#B0AEA6"
                autoCapitalize="characters"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (!amount || isSubmitting) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={!amount || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Record Payment</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Today's collections */}
        {todayPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Collections</Text>
            {todayPayments.map((p: PaymentWithRetailer) => (
              <View key={p.id} style={styles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentRetailer}>{p.retailer.name}</Text>
                  <Text style={styles.paymentMeta}>
                    {p.method.toUpperCase()} · {formatTime(p.created_at)}
                  </Text>
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Retailer picker modal */}
      <Modal visible={retailerModalOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Retailer</Text>
            <TouchableOpacity onPress={() => setRetailerModalOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            value={retailerSearch}
            onChangeText={setRetailerSearch}
            placeholder="Search retailers…"
            placeholderTextColor="#B0AEA6"
          />
          <FlatList
            data={filteredRetailers}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.retailerRow}
                onPress={() => {
                  setSelectedRetailer(item);
                  setRetailerModalOpen(false);
                  setRetailerSearch('');
                }}
              >
                <Text style={styles.retailerRowName}>{item.name}</Text>
                <Text style={styles.retailerRowArea}>{item.area}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f6' },
  scroll: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 20, fontWeight: '600', color: '#2C2C2A', marginBottom: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#2C2C2A', marginBottom: 12 },
  label: { fontSize: 13, color: '#444441', fontWeight: '500', marginBottom: 6 },
  picker: {
    height: 44,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 14,
  },
  pickerValue: { fontSize: 14, color: '#2C2C2A' },
  pickerPlaceholder: { fontSize: 14, color: '#B0AEA6' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    height: 44,
  },
  rupee: { fontSize: 16, color: '#444441', marginRight: 4 },
  input: {
    height: 44,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2C2C2A',
    marginBottom: 14,
  },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  methodPill: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1EFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodPillActive: { backgroundColor: '#1D9E75' },
  methodPillText: { fontSize: 13, color: '#444441', fontWeight: '500' },
  methodPillTextActive: { color: '#fff' },
  submitBtn: {
    height: 48,
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E6DF',
  },
  paymentRetailer: { fontSize: 14, fontWeight: '500', color: '#2C2C2A' },
  paymentMeta: { fontSize: 12, color: '#888780', marginTop: 2 },
  paymentAmount: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#2C2C2A' },
  modalClose: { fontSize: 15, color: '#1D9E75', fontWeight: '500' },
  searchInput: {
    margin: 12,
    height: 40,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2C2C2A',
  },
  retailerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E6DF',
  },
  retailerRowName: { fontSize: 15, fontWeight: '500', color: '#2C2C2A' },
  retailerRowArea: { fontSize: 12, color: '#888780', marginTop: 2 },
});
