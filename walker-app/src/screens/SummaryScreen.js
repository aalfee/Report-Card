import { View, Text, StyleSheet, ScrollView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const eventColors = {
  pee: '#72bcd4',
  poop: '#8b4513',
};

export default function SummaryScreen({ route }) {
  const summary = route.params?.summary || {};
  const routePoints = summary.route || [];
  const events = summary.events || [];
  const startTime = summary.start_time ? new Date(summary.start_time) : summary.startTime ? new Date(summary.startTime) : null;
  const endTime = summary.end_time ? new Date(summary.end_time) : summary.endTime ? new Date(summary.endTime) : null;
  const distanceMeters = summary.distance_meters ?? summary.distanceMeters ?? 0;
  const poopCount = summary.poop_count ?? (events ? events.filter((e) => e.type === 'poop').length : 0);
  const peeCount = summary.pee_count ?? (events ? events.filter((e) => e.type === 'pee').length : 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.card}>
        <Text style={styles.title}>Walk Summary</Text>
        <Text style={styles.row}>Walker: {summary.walkerName || 'Unknown'}</Text>
        <Text style={styles.row}>Start: {startTime?.toLocaleString() || 'N/A'}</Text>
        <Text style={styles.row}>End: {endTime?.toLocaleString() || 'N/A'}</Text>
        <Text style={styles.row}>Duration: {summary.duration_minutes ? `${summary.duration_minutes} min` : 'N/A'}</Text>
        <Text style={styles.row}>Distance: {(distanceMeters / 1000).toFixed(2)} km</Text>
        <Text style={styles.row}>Pee: {peeCount}, Poop: {poopCount}</Text>
        <Text style={styles.row}>Events: {events.length}</Text>
      </View>
      <View style={styles.mapWrapper}>
        {routePoints.length > 0 ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Polyline coordinates={routePoints} strokeWidth={4} strokeColor="#0077cc" />
            {events.map((event) => (
              <Marker
                key={event.id}
                coordinate={event.coordinate}
                title={event.type.toUpperCase()}
                description={new Date(event.timestamp).toLocaleTimeString()}
                pinColor={eventColors[event.type] || '#444444'}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.emptyMap}>
            <Text style={styles.emptyText}>No route data available.</Text>
          </View>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.subtitle}>Event details</Text>
        {events.length === 0 ? (
          <Text style={styles.row}>No pee/poop events recorded.</Text>
        ) : (
          events.map((event) => (
            <View style={styles.eventCard} key={event.id}>
              <Text style={styles.eventLabel}>{event.type.toUpperCase()}</Text>
              <Text style={styles.row}>Time: {new Date(event.timestamp).toLocaleTimeString()}</Text>
              <Text style={styles.row}>Lat: {event.coordinate.latitude.toFixed(5)}</Text>
              <Text style={styles.row}>Lng: {event.coordinate.longitude.toFixed(5)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {     /* Restricts the size so content can overflow */
    flex: 1,
    backgroundColor: '#eef5ff',

  },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#102a43',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 12,
    color: '#102a43',
  },
  row: {
    fontSize: 15,
    color: '#334e68',
    marginBottom: 6,
  },
  mapWrapper: {
    height: 320,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'auto',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  map: {
    flex: 1,
  },
  emptyMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dfe6f0',
  },
  emptyText: {
    color: '#334e68',
  },
  eventCard: {
    backgroundColor: '#f6faff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  eventLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d3b66',
    marginBottom: 4,
  },
});
