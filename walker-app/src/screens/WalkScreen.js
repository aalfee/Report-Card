import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { saveWalk } from '../api';

function formatDuration(start, end) {
  const diff = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}m ${seconds}s`;
}

function metersBetween(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function WalkScreen({ route, navigation }) {
  const { token, walkerName } = route?.params || {};
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [events, setEvents] = useState([]);
  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(isWalking);
  const [distance, setDistance] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Waiting for GPS...');
  const [saving, setSaving] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => {
    isWalkingRef.current = isWalking;
  }, [isWalking]);

  useEffect(() => {
    if (!token) {
      navigation.replace('Login');
      return;
    }

    const requestPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location permission required', 'Please allow location access to use walk tracking.');
          setPermissionGranted(false);
          return;
        }
        setPermissionGranted(true);
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const coords = current.coords;
        setCurrentLocation(coords);
        setMapRegion({ ...coords, latitudeDelta: 0.016, longitudeDelta: 0.016 });
        setStatus('Ready to start the walk');
      } catch (error) {
        console.warn('Unable to initialize location services:', error);
        setPermissionGranted(false);
        setStatus('Location unavailable');
      }
    };

    requestPermission();
  }, []);

  useEffect(() => {
    let subscription;

    if (isWalking && permissionGranted) {
      const startWatch = async () => {
        setStatus('Tracking your walk...');

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 3000,
            distanceInterval: 2,
          },
          (location) => {
            const coords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            setCurrentLocation(coords);
            setMapRegion({ ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 });

            setRoutePoints((prev) => {
              if (prev.length === 0) return [coords];
              const last = prev[prev.length - 1];
              const segment = metersBetween(last, coords);
              setDistance((prevDistance) => prevDistance + segment);
              return [...prev, coords];
            });
          }
        );
        watchRef.current = subscription;
      };

      startWatch();
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [isWalking, permissionGranted]);

const handleCamera = async () => {
    if (!permissionGranted) {
      Alert.alert('No location permission', 'Allow location access first.');
      return;
    }

    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera permission required', 'Please enable camera access to scan codes.');
        return;
      }
    }

    setCameraOpen(true);
    setScannedCode(null);
    setStatus('Camera ready');
  };

  const handleBarcodeScanned = ({ data }) => {
    if (!data) {
      return;
    }

    setScannedCode(data);
    setStatus(`Scanned: ${data}`);
    Alert.alert('Code scanned', data);
    setCameraOpen(false);
  };


  const handleStart = () => {
    if (!permissionGranted) {
      Alert.alert('No location permission', 'Allow location access first.');
      return;
    }
    if (!currentLocation) {
      Alert.alert('Waiting for location', 'Please wait until your current location is available.');
      return;
    }
    setRoutePoints([currentLocation]);
    setEvents([]);
    setDistance(0);
    const now = new Date();
    setStartTime(now);
    isWalkingRef.current = true;
    setIsWalking(true);
    setStatus('Walk started');
  };

  const clientEmail = route?.params?.clientEmail || null;

  const handleStop = async () => {
    if (!startTime) {
      Alert.alert('Invalid walk', 'No walk is currently in progress.');
      return;
    }

    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }

    isWalkingRef.current = false;
    setIsWalking(false);
    setStatus('Saving your walk...');
    const endTime = new Date();
    const durationMinutes = Math.max(0, Math.round((endTime - startTime) / 60000));
    const payload = {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      distance_meters: Math.round(distance),
      client_email: clientEmail,
      route: routePoints,
      events,
      poop_count: events.filter((event) => event.type === 'poop').length,
      pee_count: events.filter((event) => event.type === 'pee').length,
      notes,
    };

    try {
      console.log('Saving walk payload', payload);
      setSaving(true);
      const response = await saveWalk(token, payload);
      console.log('Walk saved response', response);
      setStatus('Walk saved successfully');
      navigation.navigate('Summary', { summary: response.walk || payload });
    } catch (error) {
      Alert.alert('Save failed', error.message || 'Unable to send walk data.');
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addEvent = (type) => {
    if (!currentLocation) {
      Alert.alert('No GPS fix', 'Wait until your location is available before recording an event.');
      return;
    }
    setEvents((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type,
        timestamp: new Date().toISOString(),
        coordinate: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
      },
    ]);
  };

  if (cameraOpen) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128'] }}
        >
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraOverlayText}>Point the camera at a QR or barcode</Text>
            <TouchableOpacity style={styles.cameraCloseButton} onPress={() => setCameraOpen(false)}>
              <Text style={styles.cameraCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
        {scannedCode ? (
          <View style={styles.scannedResultCard}>
            <Text style={styles.scannedResultLabel}>Scanned code</Text>
            <Text style={styles.scannedResultText}>{scannedCode}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScannedCode(null)}>
              <Text style={styles.secondaryText}>Scan again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.statsText}>Distance: {(distance / 1000).toFixed(2)} km</Text>
        <Text style={styles.statsText}>Events: {events.length}</Text>
        <Text style={styles.statsText}>Route points: {routePoints.length}</Text>
      </View>
      <View style={styles.mapContainer}>
        {mapRegion || currentLocation ? (
          <MapView
            style={styles.map}
            initialRegion={mapRegion || {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            region={mapRegion || {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            showsUserLocation={true}
          >
            {routePoints.length > 0 && <Polyline coordinates={routePoints} strokeWidth={5} strokeColor="#0077cc" />}
            {events.map((event) => (
              <Marker
                key={event.id}
                coordinate={event.coordinate}
                title={event.type.toUpperCase()}
                description={new Date(event.timestamp).toLocaleTimeString()}
                pinColor={event.type === 'poop' ? '#8b4513' : '#72bcd4'}
              />
            ))}
            <Marker coordinate={currentLocation} title="You" pinColor="#006400" />
          </MapView>
        ) : (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0077cc" />
            <Text style={styles.loadingText}>Waiting for GPS...</Text>
          </View>
        )}
      </View>
      <View style={styles.controls}>
        {!isWalking ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.controlText}>Start Walk</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop} disabled={saving}>
            <Text style={styles.controlText}>{saving ? 'Saving...' : 'Stop & Save Walk'}</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.notesInput}
          placeholder="Notes from the walk"
          value={notes}
          onChangeText={setNotes}
          editable={true}
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('History', { token })}>
          <Text style={styles.secondaryText}>View Walk History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Documents')}>
          <Text style={styles.secondaryText}>Browse Documents</Text>
        </TouchableOpacity>
        <View style={styles.eventRow}>
          <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('pee')} disabled={!isWalking}>
            <Text style={styles.controlText}>Pee</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.eventButton} onPress={() => addEvent('poop')} disabled={!isWalking}>
            <Text style={styles.controlText}>Poop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.eventButton} onPress={handleCamera} disabled={!isWalking}>
            <Text style={styles.controlText}>Camera</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.smallText}>Current walker: {walkerName}</Text>
          {startTime && <Text style={styles.smallText}>Elapsed: {formatDuration(startTime, new Date())}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef5ff',
  },
  statusCard: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#dfe6f0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#607d98',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#334e68',
  },
  mapContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: '#dfe6f0',
  },
  map: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#334e68',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  cameraOverlayText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 10,
    borderRadius: 10,
  },
  cameraCloseButton: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  cameraCloseButtonText: {
    color: '#102a43',
    fontWeight: '700',
  },
  scannedResultCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  scannedResultLabel: {
    fontSize: 12,
    color: '#607d98',
    marginBottom: 4,
  },
  scannedResultText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#102a43',
    marginBottom: 8,
  },
  controls: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#dfe6f0',
  },
  startButton: {
    backgroundColor: '#0077cc',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: '#cc3300',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  controlText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventButton: {
    flex: 1,
    backgroundColor: '#2d7a8a',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  infoRow: {
    marginTop: 12,
  },
  notesInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d0d9e8',
    borderRadius: 10,
    padding: 10,
    minHeight: 50,
    backgroundColor: '#ffffff',
    color: '#334e68',
  },
  secondaryButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#5a7cba',
    borderRadius: 10,
  },
  secondaryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  smallText: {
    color: '#334e68',
    fontSize: 13,
    marginTop: 4,
  },
});
