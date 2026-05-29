import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/lib/api';

const UNIT_OPTIONS = ['piece', 'box', 'kg', 'litre', 'dozen', 'metre'] as const;

interface ItemRow {
  id: string;
  item_description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

function newItem(): ItemRow {
  return {
    id: Math.random().toString(36).slice(2),
    item_description: '',
    quantity: '',
    unit: 'piece',
    unit_price: '',
  };
}

export default function OrderScreen() {
  const { visitId, retailerName, retailerId } = useLocalSearchParams<{
    visitId: string;
    retailerName: string;
    retailerId: string;
  }>();

  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unitPickerItemId, setUnitPickerItemId] = useState<string | null>(null);

  const lineItems = useMemo(
    () =>
      items.map((item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        return { qty, price, total: qty * price };
      }),
    [items],
  );

  const grandTotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.total, 0),
    [lineItems],
  );

  const isValid = useMemo(
    () =>
      items.some(
        (item) =>
          item.item_description.trim() &&
          parseFloat(item.quantity) > 0 &&
          parseFloat(item.unit_price) > 0,
      ),
    [items],
  );

  const updateItem = (id: string, field: keyof Omit<ItemRow, 'id'>, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, newItem()]);

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const handleSubmit = async () => {
    const validItems = items.filter(
      (item) =>
        item.item_description.trim() &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.unit_price) > 0,
    );

    if (validItems.length === 0) {
      Alert.alert(
        'No valid items',
        'Please add at least one item with description, quantity and price.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await api.orders.create({
        visit_id: visitId ?? '',
        retailer_id: retailerId ?? '',
        items: validItems.map((item) => ({
          item_description: item.item_description.trim(),
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          unit_price: parseFloat(item.unit_price),
        })),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      Alert.alert(
        'Order Submitted ✓',
        `Order of ₹${grandTotal.toFixed(2)} recorded.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert('Failed to submit', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>New Order</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{retailerName}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Items section */}
          <Text style={styles.sectionLabel}>ITEMS</Text>

          {items.map((item, idx) => {
            const li = lineItems[idx];
            const qty = li?.qty ?? 0;
            const price = li?.price ?? 0;
            const total = li?.total ?? 0;
            return (
              <View key={item.id} style={styles.itemCard}>
                {/* Row 1: description + delete */}
                <View style={styles.row}>
                  <TextInput
                    style={styles.descInput}
                    placeholder="Item description"
                    placeholderTextColor="#BDBCB7"
                    value={item.item_description}
                    onChangeText={(v) => updateItem(item.id, 'item_description', v)}
                  />
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8}>
                      <Text style={styles.deleteBtn}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Row 2: qty + unit + price */}
                <View style={[styles.row, styles.rowGap]}>
                  <TextInput
                    style={styles.qtyInput}
                    placeholder="Qty"
                    placeholderTextColor="#BDBCB7"
                    value={item.quantity}
                    onChangeText={(v) => updateItem(item.id, 'quantity', v)}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.unitBtn}
                    onPress={() => setUnitPickerItemId(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.unitBtnText}>{item.unit}</Text>
                  </TouchableOpacity>
                  <View style={[styles.row, styles.priceRow]}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Unit price"
                      placeholderTextColor="#BDBCB7"
                      value={item.unit_price}
                      onChangeText={(v) => updateItem(item.id, 'unit_price', v)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Row 3: line total */}
                {qty > 0 && price > 0 && (
                  <Text style={styles.lineTotal}>₹{total.toFixed(2)}</Text>
                )}
              </View>
            );
          })}

          {/* Add item */}
          <TouchableOpacity style={styles.addItemBtn} onPress={addItem} activeOpacity={0.7}>
            <Text style={styles.addItemText}>+ Add item</Text>
          </TouchableOpacity>

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Any notes for this order..."
              placeholderTextColor="#BDBCB7"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Grand total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₹{grandTotal.toFixed(2)}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.skipText}>Skip Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!isValid || isSubmitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unit picker modal */}
      <Modal
        visible={unitPickerItemId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerItemId(null)}
      >
        <TouchableOpacity
          style={styles.unitModalOverlay}
          onPress={() => setUnitPickerItemId(null)}
          activeOpacity={1}
        >
          <View style={styles.unitPickerCard}>
            <Text style={styles.unitPickerTitle}>Select unit</Text>
            <FlatList
              data={UNIT_OPTIONS}
              keyExtractor={(u) => u}
              renderItem={({ item: unit }) => (
                <TouchableOpacity
                  style={styles.unitOption}
                  onPress={() => {
                    if (unitPickerItemId) {
                      updateItem(unitPickerItemId, 'unit', unit);
                    }
                    setUnitPickerItemId(null);
                  }}
                >
                  <Text style={styles.unitOptionText}>{unit}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f6' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D3D1C7',
    backgroundColor: '#fff',
    gap: 12,
  },
  backBtn: { padding: 4 },
  back: { fontSize: 20, color: '#1D9E75' },
  headerInfo: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#2C2C2A' },
  subtitle: { fontSize: 12, color: '#888780', marginTop: 1 },
  scroll: { paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    color: '#888780',
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  itemCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowGap: { gap: 8, marginTop: 8 },
  descInput: { flex: 1, fontSize: 14, color: '#2C2C2A', paddingVertical: 4 },
  deleteBtn: { fontSize: 16, color: '#E24B4A', paddingLeft: 8 },
  qtyInput: {
    width: 64,
    height: 36,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 6,
    fontSize: 14,
    color: '#2C2C2A',
    paddingHorizontal: 8,
  },
  unitBtn: {
    width: 80,
    height: 36,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBtnText: { fontSize: 13, color: '#2C2C2A' },
  priceRow: { flex: 1, borderWidth: 0.5, borderColor: '#D3D1C7', borderRadius: 6, height: 36, paddingHorizontal: 8 },
  rupee: { fontSize: 14, color: '#888780', marginRight: 2 },
  priceInput: { flex: 1, fontSize: 14, color: '#2C2C2A' },
  lineTotal: {
    textAlign: 'right',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#1D9E75',
  },
  addItemBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#9FE1CB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addItemText: { fontSize: 14, color: '#1D9E75', fontWeight: '500' },
  notesSection: { marginHorizontal: 16, marginTop: 20 },
  notesLabel: { fontSize: 13, color: '#2C2C2A', fontWeight: '500', marginBottom: 6 },
  notesInput: {
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#2C2C2A',
    height: 80,
    textAlignVertical: 'top',
  },
  totalCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#E1F5EE',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  totalAmount: { fontSize: 20, fontWeight: '700', color: '#1D9E75' },
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { color: '#888780', fontSize: 15 },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: '#9FE1CB' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // unit picker modal
  unitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitPickerCard: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  unitPickerTitle: {
    fontSize: 12,
    color: '#888780',
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 6,
    textTransform: 'uppercase',
  },
  unitOption: { paddingVertical: 12, paddingHorizontal: 16 },
  unitOptionText: { fontSize: 15, color: '#2C2C2A' },
});
