import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatTime } from '@salestrack/utils';
import { api, type VisitWithRetailer } from '@/lib/api';
import type { VisitOutcome } from '@salestrack/types';

const outcomePill: Record<VisitOutcome, { bg: string; text: string; label: string }> = {
  visited: { bg: '#E1F5EE', text: '#0F6E56', label: 'Visited' },
  not_available: { bg: '#F1EFE8', text: '#5F5E5A', label: 'Not available' },
  refused: { bg: '#FCEBEB', text: '#A32D2D', label: 'Refused' },
  pending: { bg: '#FAEEDA', text: '#854F0B', label: 'Pending' },
};

function VisitCard({ visit }: { visit: VisitWithRetailer }) {
  const pill = outcomePill[visit.outcome];
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.retailerName}>{visit.retailer.name}</Text>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.pillText, { color: pill.text }]}>{pill.label}</Text>
        </View>
      </View>
      <Text style={styles.time}>{formatTime(visit.check_in_time)}</Text>
      {visit.notes ? <Text style={styles.notes}>{visit.notes}</Text> : null}
    </View>
  );
}

export default function VisitsScreen() {
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['visits-today'],
    queryFn: api.visits.today,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Visits</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1D9E75" />
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No visits today yet</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <VisitCard visit={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f6' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '600', color: '#2C2C2A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, color: '#888780' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  retailerName: { fontSize: 15, fontWeight: '600', color: '#2C2C2A', flex: 1 },
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  pillText: { fontSize: 12, fontWeight: '500' },
  time: { fontSize: 12, color: '#888780', marginTop: 4 },
  notes: { fontSize: 12, color: '#5F5E5A', marginTop: 4 },
});
