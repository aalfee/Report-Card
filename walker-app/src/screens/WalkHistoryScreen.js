import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getWalks } from '../api';

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

export default function WalkHistoryScreen({ route, navigation }) {
  const { token } = route.params || {};
  const [walks, setWalks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      Alert.alert('Not authenticated', 'Please log in again.');
      navigation.replace('Login');
      return;
    }

    const loadWalks = async () => {
      setLoading(true);
      try {
        const data = await getWalks(token);
        setWalks(data.walks || []);
      } catch (error) {
        console.error('fetch walks error:', error);
        Alert.alert('Error', 'Unable to fetch walk history');
      } finally {
        setLoading(false);
      }
    };

    loadWalks();
  }, [token]);

  const renderItem = ({ item }) => {
    const pee = item.pee_count ?? (item.events?.filter((e) => e.type === 'pee').length || 0);
    const poop = item.poop_count ?? (item.events?.filter((e) => e.type === 'poop').length || 0);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Summary', { summary: item })}
      >
        <Text style={styles.date}>Started: {formatDate(item.start_time)}</Text>
        <Text style={styles.row}>Duration: {item.duration_minutes ? `${item.duration_minutes} min` : 'N/A'}</Text>
        <Text style={styles.row}>Dist: {item.distance_meters ? `${(item.distance_meters / 1000).toFixed(2)} km` : 'N/A'}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.event}>Pee: {pee}</Text>
          <Text style={styles.event}>Poop: {poop}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#0077cc" style={styles.loader} />
      ) : walks.length === 0 ? (
        <Text style={styles.empty}>No walks yet. Start a walk first.</Text>
      ) : (
        <FlatList
          data={walks}
          keyExtractor={(item) => item.id?.toString() || item.start_time}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef5ff',
    padding: 12,
  },
  loader: {
    marginTop: 20,
  },
  empty: {
    marginTop: 20,
    textAlign: 'center',
    color: '#334e68',
    fontSize: 16,
  },
  list: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  date: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0d3b66',
    marginBottom: 4,
  },
  row: {
    fontSize: 14,
    color: '#334e68',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  event: {
    fontSize: 14,
    color: '#1d2d50',
    fontWeight: '600',
  },
});
