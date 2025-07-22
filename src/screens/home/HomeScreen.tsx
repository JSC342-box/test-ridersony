import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing, Image, ScrollView, Linking, Alert, Modal, Pressable, PanResponder, TextInput, Vibration, Platform } from 'react-native';
import MapView, { Marker, Polyline as MapPolyline, MapViewProps } from 'react-native-maps';
import { MaterialIcons, Ionicons, FontAwesome, Entypo, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import RideRequestScreen, { RideRequest } from '../../components/RideRequestScreen';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import Polyline from '@mapbox/polyline';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useAssignUserType } from '../../utils/helpers';

const { width, height } = Dimensions.get('window');

function SOSModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: 320, elevation: 12 }}>
          <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#222', textAlign: 'center', flex: 1 }}>Call</Text>
            <Pressable onPress={onClose} style={{ marginLeft: 10 }}>
              <Ionicons name="close-circle" size={32} color="#222" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 }}>
            <TouchableOpacity
              style={{ alignItems: 'center' }}
              onPress={() => Linking.openURL('tel:108')}
            >
              <View style={{ backgroundColor: '#3EC6FF', borderRadius: 50, width: 90, height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <FontAwesome5 name="ambulance" size={48} color="#fff" />
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>AMBULANCE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: 'center' }}
              onPress={() => Linking.openURL('tel:100')}
            >
              <View style={{ backgroundColor: '#FF3B30', borderRadius: 50, width: 90, height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                <FontAwesome5 name="user-shield" size={48} color="#fff" />
              </View>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>POLICE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Helper: Geocode address to lat/lng
async function geocodeAddress(address: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.results && data.results[0]) {
    return data.results[0].geometry.location;
  }
  throw new Error('Geocoding failed');
}

// Helper: Fetch directions and decode polyline
async function fetchRoute(from: {lat: number, lng: number}, to: {lat: number, lng: number}, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.routes && data.routes[0]) {
    const points = Polyline.decode(data.routes[0].overview_polyline.points);
    return points.map(([latitude, longitude]: [number, number]) => ({ latitude, longitude }));
  }
  throw new Error('Directions fetch failed');
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHN3SH_ODlqnHcU9Blvv2pLpnDNkg03lU';

function NavigationScreen({ ride, onNavigate, onArrived, onClose }: { ride: RideRequest, onNavigate: () => void, onArrived: () => void, onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [routeCoords, setRouteCoords] = useState<Array<{latitude: number, longitude: number}>>([]);
  const [pickupCoord, setPickupCoord] = useState<{lat: number, lng: number} | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<{lat: number, lng: number} | null>(null);
  const mapRef = useRef<MapView>(null);
  const pickupPulse = useRef(new Animated.Value(1)).current;
  const pickupBgOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    (async () => {
      try {
        const pickup = await geocodeAddress(ride.pickupAddress, GOOGLE_MAPS_API_KEY);
        const dropoff = await geocodeAddress(ride.dropoffAddress, GOOGLE_MAPS_API_KEY);
        setPickupCoord(pickup);
        setDropoffCoord(dropoff);
        const route = await fetchRoute(pickup, dropoff, GOOGLE_MAPS_API_KEY);
        setRouteCoords(route);
      } catch (e) {
        // handle error
      }
    })();
  }, [ride.pickupAddress, ride.dropoffAddress]);

  useEffect(() => {
    if (routeCoords.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(routeCoords, { edgePadding: { top: 100, right: 100, bottom: 100, left: 100 }, animated: true });
    }
  }, [routeCoords]);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pickupPulse, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(pickupPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pickupBgOpacity, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(pickupBgOpacity, { toValue: 0.5, duration: 600, useNativeDriver: false }),
        ]),
      ])
    ).start();
  }, []);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#fff',
      opacity: anim,
      zIndex: 9999,
    }}>
      {/* Full Screen Map */}
      <MapView
        ref={mapRef}
        provider="google"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
        }}
        initialRegion={{
          latitude: pickupCoord?.lat || 17.4375,
          longitude: pickupCoord?.lng || 78.4483,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        {pickupCoord && (
          <Marker coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }} title="Pickup" />
        )}
        {dropoffCoord && (
          <Marker coordinate={{ latitude: dropoffCoord.lat, longitude: dropoffCoord.lng }} title="Dropoff" />
        )}
        {routeCoords.length > 1 && (
          <MapPolyline coordinates={routeCoords} strokeWidth={5} strokeColor="#1877f2" />
        )}
      </MapView>
      
      {/* Top Routing Bar */}
      <View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        backgroundColor: 'linear-gradient(90deg, #e3f0ff 0%, #f6faff 100%)', // soft blue gradient
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      }}>
        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose} 
          style={{ 
            position: 'absolute', 
            top: 60, 
            right: 20, 
            zIndex: 10, 
            backgroundColor: 'rgba(0,0,0,0.1)', 
            borderRadius: 20, 
            padding: 8,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        
        {/* Route Header */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ backgroundColor: '#1877f2', borderRadius: 25, width: 50, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="navigate" size={28} color="#fff" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#222', textAlign: 'center' }}>Navigate to Pickup</Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 4 }}>ETA: {ride.pickup}</Text>
        </View>

        {/* Route Information */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16 }}>
          {/* Pickup (Animated) */}
          <Animated.View style={{ flex: 1, opacity: pickupBgOpacity }}>
            <Animated.View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#B9F6CA',
              borderRadius: 16,
              marginRight: 12,
              padding: 6,
              transform: [{ scale: pickupPulse }],
              shadowColor: '#00C853',
              shadowOpacity: 0.5,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 8,
            }}>
              <View style={{ backgroundColor: '#00C853', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 2 }}>Pickup</Text>
                <Text style={{ fontSize: 13, color: '#666', lineHeight: 16 }} numberOfLines={2}>{ride.pickupAddress}</Text>
              </View>
            </Animated.View>
          </Animated.View>
          
          {/* Arrow */}
          <View style={{ marginHorizontal: 12 }}>
            <Ionicons name="arrow-down" size={20} color="#999" />
          </View>
          
          {/* Dropoff (Static) */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#FF6B35', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="flag" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 2 }}>Dropoff</Text>
              <Text style={{ fontSize: 13, color: '#666', lineHeight: 16 }} numberOfLines={2}>{ride.dropoffAddress}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Action Buttons */}
      <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 32, zIndex: 10000 }} edges={['bottom']}>
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={{ 
              backgroundColor: '#1877f2', 
              borderRadius: 16, 
              paddingVertical: 18, 
              paddingHorizontal: 32, 
              width: '100%', 
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: '#1877f2',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
        onPress={onNavigate}
            activeOpacity={0.8}
      >
            <Ionicons name="navigate" size={24} color="#fff" style={{ marginRight: 12 }} />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Navigate to Dropoff</Text>
      </TouchableOpacity>
          
      <TouchableOpacity
            style={{ 
              backgroundColor: '#00C853', 
              borderRadius: 16, 
              paddingVertical: 18, 
              paddingHorizontal: 32, 
              width: '100%', 
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: '#00C853',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
        onPress={onArrived}
            activeOpacity={0.8}
      >
            <Ionicons name="checkmark-circle" size={24} color="#fff" style={{ marginRight: 12 }} />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Arrived at Pickup</Text>
      </TouchableOpacity>
    </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function OtpScreen({ onSubmit, onClose }: { onSubmit: (otp: string) => void, onClose: () => void }) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;
  const checkAnim = React.useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<Array<TextInput | null>>([]);

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleChange = (val: string, idx: number) => {
    if (!/^[0-9]?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 3) {
      inputRefs.current[idx + 1]?.focus();
      setFocusedIndex(idx + 1);
    }
    if (!val && idx > 0) {
      setFocusedIndex(idx - 1);
    }
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
      setFocusedIndex(idx - 1);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    Animated.sequence([
      Animated.timing(checkAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(600),
    ]).start(() => {
      onSubmit(otp.join(''));
      setSubmitted(false);
      checkAnim.setValue(0);
    });
  };

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)'] }),
      opacity: anim,
      zIndex: 9999,
    }}>
      <Animated.View style={{
        width: width - 32,
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderRadius: 28,
        padding: 36,
        elevation: 24,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 15 },
        alignItems: 'center',
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
      }}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 18, right: 18, zIndex: 10, backgroundColor: '#f6f6f6', borderRadius: 18, padding: 6 }}>
          <Ionicons name="close" size={26} color="#888" />
        </TouchableOpacity>
        <Text style={{ fontSize: 30, fontWeight: 'bold', marginBottom: 10, color: '#1877f2', letterSpacing: 1 }}>Enter OTP</Text>
        <Text style={{ fontSize: 17, marginBottom: 28, color: '#444', textAlign: 'center' }}>Enter the 4-digit code to start your ride</Text>
        <View style={{ flexDirection: 'row', marginBottom: 32, gap: 8 }}>
          {otp.map((digit, idx) => (
        <TextInput
              key={idx}
              ref={(ref) => { inputRefs.current[idx] = ref; }}
              style={{
                width: 44,
                height: 54,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: focusedIndex === idx ? '#1877f2' : '#e0e0e0',
                backgroundColor: '#f7faff',
                fontSize: 28,
                color: '#222',
                textAlign: 'center',
                marginHorizontal: 2,
                shadowColor: focusedIndex === idx ? '#1877f2' : 'transparent',
                shadowOpacity: focusedIndex === idx ? 0.15 : 0,
                shadowRadius: 6,
                elevation: focusedIndex === idx ? 4 : 0,
              }}
          keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onFocus={() => setFocusedIndex(idx)}
              onChangeText={val => handleChange(val, idx)}
              onKeyPress={e => handleKeyPress(e, idx)}
              returnKeyType="done"
              autoFocus={idx === 0}
        />
          ))}
      </View>
      <TouchableOpacity
          style={{ backgroundColor: otp.every(d => d) ? '#1877f2' : '#b0b0b0', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 8 }}
          onPress={handleSubmit}
          disabled={!otp.every(d => d)}
          activeOpacity={otp.every(d => d) ? 0.8 : 1}
      >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 1 }}>Submit OTP</Text>
      </TouchableOpacity>
        {submitted && (
          <Animated.View style={{ marginTop: 18, opacity: checkAnim, transform: [{ scale: checkAnim }] }}>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function EndRideScreen({ onEnd, onClose }: { onEnd: () => void, onClose: () => void }) {
  const SWIPE_WIDTH = width * 0.8;
  const SWIPE_THRESHOLD = SWIPE_WIDTH * 0.6;
  const swipeX = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5,
      onPanResponderGrant: () => {
        if (Platform.OS === 'android') {
          Vibration.vibrate([0, 2000], true);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        let newX = gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > SWIPE_WIDTH - 56) newX = SWIPE_WIDTH - 56;
        swipeX.setValue(newX);
        setSwiping(true);
      },
      onPanResponderRelease: (e, gestureState) => {
        if (Platform.OS === 'android') {
          Vibration.cancel();
        }
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(swipeX, {
            toValue: SWIPE_WIDTH - 56,
            duration: 120,
            useNativeDriver: false,
          }).start(() => {
            setSwiping(false);
            onEnd();
            Animated.spring(swipeX, {
              toValue: 0,
              useNativeDriver: false,
            }).start();
          });
        } else {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: false,
          }).start(() => setSwiping(false));
        }
      },
      onPanResponderTerminate: () => {
        if (Platform.OS === 'android') {
          Vibration.cancel();
        }
        Animated.spring(swipeX, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 9999, justifyContent: 'flex-start' }}>
      {/* Close Button */}
      <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 48, right: 28, zIndex: 10, backgroundColor: '#f6f6f6', borderRadius: 18, padding: 6 }}>
        <Ionicons name="close" size={26} color="#888" />
      </TouchableOpacity>
      {/* Title and Instructions */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#222', marginBottom: 18, textAlign: 'center' }}>End Ride</Text>
        <Text style={{ fontSize: 18, color: '#444', marginBottom: 32, textAlign: 'center' }}>Swipe below to confirm you want to end the ride.</Text>
      </View>
      {/* Swipe Bar at Bottom */}
      <View style={{ position: 'absolute', left: '10%', right: '10%', bottom: 48, width: '80%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2233', borderRadius: 32, paddingVertical: 16, paddingHorizontal: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 10 }} {...panResponder.panHandlers}>
          <Animated.View style={{ position: 'absolute', left: swipeX, top: 0, bottom: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: '#26304A', alignItems: 'center', justifyContent: 'center', shadowColor: '#26304A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 8, zIndex: 2 }}>
            <Ionicons name="arrow-forward" size={32} color="#fff" />
          </Animated.View>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20, marginLeft: 70, letterSpacing: 0.5, zIndex: 1 }}>Swipe to end ride</Text>
        </View>
      </View>
    </View>
  );
}

function RideInProgressScreen({ ride, onNavigate, onEnd, onClose }: { ride: RideRequest, onNavigate: () => void, onEnd: () => void, onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [routeCoords, setRouteCoords] = useState<Array<{latitude: number, longitude: number}>>([]);
  const [pickupCoord, setPickupCoord] = useState<{lat: number, lng: number} | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<{lat: number, lng: number} | null>(null);
  const mapRef = useRef<MapView>(null);
  const dropoffPulse = useRef(new Animated.Value(1)).current;
  const dropoffBgOpacity = useRef(new Animated.Value(0.5)).current;
  const [showEndRide, setShowEndRide] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pickup = await geocodeAddress(ride.pickupAddress, GOOGLE_MAPS_API_KEY);
        const dropoff = await geocodeAddress(ride.dropoffAddress, GOOGLE_MAPS_API_KEY);
        setPickupCoord(pickup);
        setDropoffCoord(dropoff);
        const route = await fetchRoute(pickup, dropoff, GOOGLE_MAPS_API_KEY);
        setRouteCoords(route);
      } catch (e) {
        // handle error
      }
    })();
  }, [ride.pickupAddress, ride.dropoffAddress]);

  useEffect(() => {
    if (routeCoords.length > 1 && mapRef.current) {
      mapRef.current.fitToCoordinates(routeCoords, { edgePadding: { top: 100, right: 100, bottom: 100, left: 100 }, animated: true });
    }
  }, [routeCoords]);

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(dropoffPulse, { toValue: 1.04, duration: 600, useNativeDriver: true }),
          Animated.timing(dropoffPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dropoffBgOpacity, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(dropoffBgOpacity, { toValue: 0.5, duration: 600, useNativeDriver: false }),
        ]),
      ])
    ).start();
  }, []);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#fff',
      opacity: anim,
      zIndex: 9999,
    }}>
      {/* Full Screen Map */}
      <MapView
        ref={mapRef}
        provider="google"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
        }}
        initialRegion={{
          latitude: pickupCoord?.lat || 17.4375,
          longitude: pickupCoord?.lng || 78.4483,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        {pickupCoord && (
          <Marker coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }} title="Pickup" />
        )}
        {dropoffCoord && (
          <Marker coordinate={{ latitude: dropoffCoord.lat, longitude: dropoffCoord.lng }} title="Dropoff" />
        )}
        {routeCoords.length > 1 && (
          <MapPolyline coordinates={routeCoords} strokeWidth={5} strokeColor="#1877f2" />
        )}
      </MapView>
      
      {/* Top Routing Bar */}
      <View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        backgroundColor: 'linear-gradient(90deg, #f7faff 0%, #e3f0ff 100%)', // soft blue gradient
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      }}>
        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose} 
          style={{ 
            position: 'absolute', 
            top: 60, 
            right: 20, 
            zIndex: 10, 
            backgroundColor: 'rgba(0,0,0,0.1)', 
            borderRadius: 20, 
            padding: 8,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        
        {/* Route Header */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ backgroundColor: '#00C853', borderRadius: 25, width: 50, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="car" size={28} color="#fff" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#222', textAlign: 'center' }}>Ride in Progress</Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 4 }}>Trip: {ride.dropoff}</Text>
        </View>

        {/* Route Information */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16 }}>
          {/* Pickup (Static) */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View style={{ backgroundColor: '#00C853', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 2 }}>Pickup Complete</Text>
              <Text style={{ fontSize: 13, color: '#666', lineHeight: 16 }} numberOfLines={2}>{ride.pickupAddress}</Text>
            </View>
          </View>
          
          {/* Arrow */}
          <View style={{ marginHorizontal: 12 }}>
            <Ionicons name="arrow-down" size={20} color="#999" />
          </View>
          
          {/* Dropoff (Animated) */}
          <Animated.View style={{ flex: 1, opacity: dropoffBgOpacity }}>
            <Animated.View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFD6B0',
              borderRadius: 16,
              padding: 6,
              transform: [{ scale: dropoffPulse }],
              shadowColor: '#FF6B35',
              shadowOpacity: 0.5,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 8,
            }}>
              <View style={{ backgroundColor: '#FF6B35', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="flag" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 2 }}>Dropoff</Text>
                <Text style={{ fontSize: 13, color: '#666', lineHeight: 16 }} numberOfLines={2}>{ride.dropoffAddress}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      {/* Bottom Action Buttons */}
      <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 32, zIndex: 10000 }} edges={['bottom']}>
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={{ 
              backgroundColor: '#1877f2', 
              borderRadius: 16, 
              paddingVertical: 18, 
              paddingHorizontal: 32, 
              width: '100%', 
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: '#1877f2',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
        onPress={onNavigate}
            activeOpacity={0.8}
      >
            <Ionicons name="navigate" size={24} color="#fff" style={{ marginRight: 12 }} />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Navigate to Dropoff</Text>
      </TouchableOpacity>
          
      <TouchableOpacity
            style={{ 
              backgroundColor: '#FF3B30', 
              borderRadius: 16, 
              paddingVertical: 18, 
              paddingHorizontal: 32, 
              width: '100%', 
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: '#FF3B30',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
        onPress={() => setShowEndRide(true)}
            activeOpacity={0.8}
      >
            <Ionicons name="stop-circle" size={24} color="#fff" style={{ marginRight: 12 }} />
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>End Ride</Text>
      </TouchableOpacity>
    </View>
      </SafeAreaView>
      {showEndRide && <EndRideScreen onEnd={() => { setShowEndRide(false); onEnd(); }} onClose={() => setShowEndRide(false)} />}
    </Animated.View>
  );
}

const MenuModal = ({ visible, onClose, onNavigate, halfScreen }: { visible: boolean; onClose: () => void; onNavigate: (screen: string) => void; halfScreen?: boolean }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Animated.View style={{
          backgroundColor: '#fff',
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          padding: 28,
          width: Math.round(width * 0.7),
          height: '100%',
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 15 },
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#222', marginBottom: 18, textAlign: 'center' }}>Menu</Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onNavigate('Home'); onClose(); }}>
            <Ionicons name="home" size={24} color="#1877f2" style={{ marginRight: 16 }} />
            <Text style={{ fontSize: 18, color: '#222' }}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onNavigate('RideHistory'); onClose(); }}>
            <Ionicons name="time" size={24} color="#1877f2" style={{ marginRight: 16 }} />
            <Text style={{ fontSize: 18, color: '#222' }}>Ride History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onNavigate('Wallet'); onClose(); }}>
            <Ionicons name="wallet" size={24} color="#1877f2" style={{ marginRight: 16 }} />
            <Text style={{ fontSize: 18, color: '#222' }}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onNavigate('Settings'); onClose(); }}>
            <Ionicons name="settings" size={24} color="#1877f2" style={{ marginRight: 16 }} />
            <Text style={{ fontSize: 18, color: '#222' }}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onNavigate('HelpSupport'); onClose(); }}>
            <Ionicons name="help-circle" size={24} color="#1877f2" style={{ marginRight: 16 }} />
            <Text style={{ fontSize: 18, color: '#222' }}>Support</Text>
          </TouchableOpacity>
          <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 16 }} />
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={onClose}>
            <Ionicons name="log-out" size={24} color="#FF3B30" style={{ marginRight: 16 }} />
            <Text style={{ fontSize: 18, color: '#FF3B30' }}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>
        {halfScreen && (
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} activeOpacity={1} />
        )}
      </View>
    </Modal>
  );
};

export default function HomeScreen() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigation = useNavigation<NavigationProp<any>>();
  const [isSOSVisible, setSOSVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [showOfflineScreen, setShowOfflineScreen] = useState(false);
  const swipeX = useRef(new Animated.Value(0)).current;
  const offlineSwipeX = useRef(new Animated.Value(0)).current;
  const SWIPE_WIDTH = width - 48;
  const SWIPE_THRESHOLD = SWIPE_WIDTH * 0.6;
  const lastHaptic = useRef(Date.now());
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [navigationRide, setNavigationRide] = useState<RideRequest | null>(null);
  const [showOtp, setShowOtp] = useState(false);
  const [rideInProgress, setRideInProgress] = useState<RideRequest | null>(null);
  const sosAnim = useRef(new Animated.Value(1)).current;
  const [menuVisible, setMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoaded) return;
    // Check for required documents
    const meta = user?.unsafeMetadata || {};
    if (!meta.bikeFrontPhoto || !meta.bikeBackPhoto || !meta.licensePhoto || !meta.rcPhoto || !meta.aadharPhoto || !meta.panPhoto) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'DocumentUpload' }],
      });
    }
  }, [isLoaded, user]);

  useAssignUserType('driver');

  // PanResponder for swipe to go online gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isOnline,
      onMoveShouldSetPanResponder: (_, gesture) => !isOnline && Math.abs(gesture.dx) > 5,
      onPanResponderGrant: () => {
        if (Platform.OS === 'android') {
          Vibration.vibrate([0, 2000], true);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        if (isOnline) return;
        let newX = gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > SWIPE_WIDTH - 56) newX = SWIPE_WIDTH - 56;
        swipeX.setValue(newX);
        // Throttle haptic feedback
        const now = Date.now();
        if (now - lastHaptic.current > 60) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          lastHaptic.current = now;
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (Platform.OS === 'android') {
          Vibration.cancel();
        }
        if (isOnline) return;
        if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(swipeX, {
            toValue: SWIPE_WIDTH - 56,
            duration: 120,
            useNativeDriver: false,
          }).start(async () => {
            setIsOnline(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Fetch JWT token when going online
            if (user?.unsafeMetadata?.type === 'driver') {
              try {
                const token = await getToken({ template: 'driver-app-token' });
                console.log('Custom Clerk JWT (online):', token);
                // Optionally: store or use the token as needed
              } catch (err) {
                console.error('Failed to fetch custom JWT on go online:', err);
              }
            }
          });
        } else {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (Platform.OS === 'android') {
          Vibration.cancel();
        }
        Animated.spring(swipeX, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // PanResponder for swipe to go offline gesture
  const offlineSwipeWidth = width * 0.9; // 90% width to match modal
  const offlineSwipeThreshold = offlineSwipeWidth * 0.6;
  
  // Create PanResponder function that always uses current state values
  const createOfflinePanResponder = () => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return isOnline && showOfflineScreen;
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        return isOnline && showOfflineScreen && Math.abs(gesture.dx) > 5;
      },
      onPanResponderGrant: () => {
        if (Platform.OS === 'android') {
          Vibration.vibrate([0, 2000], true);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        if (!isOnline || !showOfflineScreen) return;
        let newX = gestureState.dx;
        if (newX < 0) newX = 0;
        if (newX > offlineSwipeWidth - 56) newX = offlineSwipeWidth - 56;
        offlineSwipeX.setValue(newX);
        // Throttle haptic feedback
        const now = Date.now();
        if (now - lastHaptic.current > 60) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          lastHaptic.current = now;
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (Platform.OS === 'android') {
          Vibration.cancel();
        }
        if (!isOnline || !showOfflineScreen) return;
        if (gestureState.dx > offlineSwipeThreshold) {
          Animated.timing(offlineSwipeX, {
            toValue: offlineSwipeWidth - 56,
            duration: 120,
            useNativeDriver: false,
          }).start(() => {
            setIsOnline(false);
            setShowOfflineScreen(false);
            // Reset the main swipe bar to its default position
            Animated.spring(swipeX, {
              toValue: 0,
              useNativeDriver: false,
            }).start();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.navigate('Home');
          });
        } else {
          Animated.spring(offlineSwipeX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (Platform.OS === 'android') {
          Vibration.cancel();
        }
        Animated.spring(offlineSwipeX, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
    });
  };
  
  // Create PanResponder instance
  const offlinePanResponder = createOfflinePanResponder();

  const resetOnline = () => {
    setIsOnline(false);
    Animated.spring(swipeX, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const goOffline = () => {
    setShowOfflineScreen(true);
    Animated.spring(offlineSwipeX, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const cancelOffline = () => {
    setShowOfflineScreen(false);
    Animated.spring(offlineSwipeX, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const handleTestRideRequest = () => {
    setRideRequest({
      id: '1',
      price: '₹120.00',
      type: 'Mini',
      tag: 'Hyderabad',
      rating: '4.95',
      verified: true,
      pickup: '5 min (2.1 km) away',
      pickupAddress: 'Hitech City, Hyderabad, Telangana',
      dropoff: '25 min (12.3 km) trip',
      dropoffAddress: 'Charminar, Hyderabad, Telangana',
    });
  };

  const handleAcceptRide = () => {
    if (rideRequest) {
      setNavigationRide(rideRequest);
      setRideRequest(null);
    }
  };

  const handleRejectRide = () => {
    setRideRequest(null);
  };

  const handleNavigate = () => {
    if (navigationRide) {
      const address = encodeURIComponent(navigationRide.pickupAddress);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
      Linking.openURL(url);
    }
  };

  const handleArrived = () => {
    setShowOtp(true);
  };

  const handleOtpSubmit = (otp: string) => {
    setShowOtp(false);
    setRideInProgress(navigationRide);
    setNavigationRide(null);
    Alert.alert('OTP Verified', 'You can now start the ride!');
  };

  const handleNavigateToDropoff = () => {
    if (rideInProgress) {
      const address = encodeURIComponent(rideInProgress.dropoffAddress);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
      Linking.openURL(url);
    }
  };

  const handleEndRide = () => {
    setRideInProgress(null);
  };

  const isRideActive = !!(rideRequest || navigationRide || showOtp || rideInProgress);

  // Play haptic feedback on ride request
  useEffect(() => {
    if (rideRequest) {
      // Play haptic feedback immediately
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [rideRequest]);

  // Fetch custom Clerk JWT after login
  useEffect(() => {
    if (user?.unsafeMetadata?.type !== 'driver') return;
    const fetchCustomJWT = async () => {
      try {
        const token = await getToken({ template: 'driver-app-token' });
        console.log('Custom Clerk JWT:', token);
        // Optionally: send to backend or store in state
      } catch (err) {
        console.error('Failed to fetch custom JWT:', err);
      }
    };
    fetchCustomJWT();
  }, [getToken, user]);

  // Button handler to fetch and log the custom JWT manually
  const handleFetchCustomJWT = async () => {
    if (user?.unsafeMetadata?.type !== 'driver') {
      Alert.alert('Error', 'User type is not set to driver.');
      return;
    }
    try {
      const token = await getToken({ template: 'driver-app-token' });
      console.log('Custom Clerk JWT:', token);
      Alert.alert('Custom Clerk JWT', token ? 'Token fetched and logged to console.' : 'No token received.');
    } catch (err) {
      console.error('Failed to fetch custom JWT:', err);
      Alert.alert('Error', 'Failed to fetch custom JWT.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom', 'left', 'right']}>
      {/* StatusBar background fix for edge-to-edge */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: '#fff', zIndex: 10000 }} />
      <StatusBar barStyle="dark-content" translucent />
      {/* Map */}
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 17.4375, // Example: Hyderabad
          longitude: 78.4483,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        scrollEnabled={isOnline}
        zoomEnabled={isOnline}
        rotateEnabled={isOnline}
        pitchEnabled={isOnline}
      />
      {/* Overall Offline Overlay */}
      {!isOnline && !isRideActive && !showOfflineScreen && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Offline Icon */}
          <View
            style={{
              backgroundColor: '#B0B3B8',
              borderRadius: 50,
              width: 80,
              height: 80,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              shadowColor: '#B0B3B8',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Ionicons name="wifi-outline" size={40} color="#222" />
            {/* Diagonal slash overlay */}
            <View
              style={{
                position: 'absolute',
                width: 60,
                height: 6,
                backgroundColor: '#333333',
                borderRadius: 3,
                top: 37,
                left: 10,
                transform: [{ rotate: '-25deg' }],
                opacity: 0.95,
              }}
            />
          </View>
          
          {/* Offline Text */}
          <Text
            style={{
              fontSize: 34,
              fontWeight: '900',
              color: '#222',
              textAlign: 'center',
              textShadowColor: 'rgba(255,255,255,0.7)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 6,
              letterSpacing: 0.5,
              marginTop: 4,
            }}
          >
            You're Offline
          </Text>
        </View>
      )}

      {/* Go Offline Confirmation Modal */}
      <Modal
        visible={showOfflineScreen && isOnline}
        animationType="slide"
        transparent={false}
        onRequestClose={cancelOffline}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#fff',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            paddingTop: insets.top + 24,
            paddingHorizontal: 0,
          }}
          pointerEvents="box-none"
        >
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginLeft: 24, marginBottom: 24, color: '#111' }}>Recommended for you</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 24, marginBottom: 16 }}>
            <Ionicons name="compass-outline" size={22} color="#111" style={{ marginRight: 8 }} />
            <TouchableOpacity onPress={() => Alert.alert('Driving Time', 'Driving time feature coming soon!')}>
              <Text style={{ fontSize: 16, color: '#111' }}>See driving time</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ marginLeft: 24, marginBottom: 32 }} onPress={() => Alert.alert('Waybill', 'Waybill feature coming soon!')}>
            <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '500' }}>Waybill</Text>
          </TouchableOpacity>

          {/* Swipe to Go Offline Bar (modal, 90% width, bottom, working like online swipe) */}
          <View
            style={{
              position: 'absolute',
              left: '5%',
              right: '5%',
              bottom: insets.bottom > 0 ? insets.bottom + 16 : 32,
              width: '90%',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
            pointerEvents="box-none"
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'green',
                borderRadius: 36,
                paddingVertical: 20,
                paddingHorizontal: 28,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 12,
                elevation: 10,
              }}
              {...offlinePanResponder.panHandlers}
            >
              <Animated.View
                style={{
                position: 'absolute',
                left: offlineSwipeX,
                top: 0,
                bottom: 0,
                  width: 66,
                  height: 66,
                  borderRadius: 32,
                  backgroundColor: '#26304A',
                alignItems: 'center',
                justifyContent: 'center',
                  shadowColor: '#26304A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
                elevation: 8,
                zIndex: 2,
                }}
              >
                <Ionicons name="arrow-forward" size={36} color="#fff" />
              </Animated.View>
              <Text
                style={{
                color: '#fff',
                fontWeight: 'bold',
                  fontSize: 22,
                  marginLeft: 80,
                letterSpacing: 0.5,
                zIndex: 1,
                }}
              >
                Swipe to go offline
              </Text>
            </View>
          </View>
        </View>
      </Modal>
      {/* Test Ride Request Button (show only when online and no ride in progress) */}
      {isOnline && !isRideActive && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: 170,
            right: 24,
            backgroundColor: '#1877f2',
            borderRadius: 32,
            paddingVertical: 16,
            paddingHorizontal: 28,
            elevation: 8,
            zIndex: 100,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
          onPress={handleTestRideRequest}
          activeOpacity={0.7}
        >
          <Animated.Text
            style={{
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 18,
            }}
          >
            Test Ride Request
          </Animated.Text>
        </TouchableOpacity>
      )}
      {/* Top Bar Overlay */}
      <Animated.View
        style={[
          styles.topBar,
          {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 10,
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderRadius: 18,
            margin: 16,
            paddingHorizontal: 16,
            paddingVertical: 8,
            alignSelf: 'center',
            width: '92%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        ]}
      >
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Entypo name="menu" size={28} color="#222" />
            <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
          </TouchableOpacity>
        <View style={styles.speedPill}>
          <Text style={styles.speedZero}>0</Text>
          <Text style={styles.speedZero}> | </Text>
          <Text style={styles.speedLimit}>80</Text>
        </View>
        <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-circle" size={32} color="#222" />
          </TouchableOpacity>
      </Animated.View>
      {/* Center Marker */}
      <Animated.View
        style={{
          position: 'absolute',
          top: '48%',
          left: '50%',
          transform: [{ translateX: -20 }, { translateY: -32 }],
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <MaterialIcons name="navigation" size={32} color="#222" style={{ transform: [{ rotate: '0deg' }] }} />
      </Animated.View>
      {/* Bottom Online/Offline Bar */}
      <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', paddingBottom: insets.bottom > 0 ? insets.bottom : 16, zIndex: 10000 }} edges={['bottom']}>
        {isOnline && !isRideActive && !navigationRide && !rideRequest && !showOtp && !rideInProgress && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
            <View style={{
              width: '94%',
              marginBottom: -30,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
              borderRadius: 32,
              paddingVertical: 16,
              paddingHorizontal: 18,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.10,
              shadowRadius: 8,
              elevation: 8,
              alignSelf: 'center',
              
            }}>
              {/* Center Text */}
              <Text style={{
                color: '#00C853',
                fontWeight: 'bold',
                fontSize: 30,
                letterSpacing: 0.5,
                textAlign: 'center',
                flex: 1,
              }}>
                You're online
              </Text>
              {/* Hamburger Icon (right) */}
              <TouchableOpacity 
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  elevation: 2,
                }}
                onPress={goOffline}
                activeOpacity={0.8}
              >
                <Entypo name="menu" size={28} color="#222" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
      {/* Swipe to Go Online Bar (show only if offline and not in ride) */}
      {!isOnline && !isRideActive && (
        <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom > 0 ? insets.bottom + 16 : 32, zIndex: 10000 }} edges={['bottom']}>
          <View style={{
            width: '90%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '5%',
          }}>
            {/* Safety Toolkit Icon - left of swipe bar */}

            {/* Swipe Bar */}
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1A2233',
              borderRadius: 32,
              paddingVertical: 20,
              paddingHorizontal: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 10,
              overflow: 'hidden',
            }}
              {...panResponder.panHandlers}
            >
              {/* Gradient Progress Bar Background */}
              <Animated.View style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: swipeX.interpolate({
                  inputRange: [0, SWIPE_WIDTH - 56],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
                zIndex: 1,
              }}>
                <LinearGradient
                  colors={['#B9F6CA', '#00C853', '#009624']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, borderRadius: 32 }}
                />
                {/* Ripple shimmer effect */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: rippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (SWIPE_WIDTH - 56) * 0.7],
                    }),
                    top: 0,
                    bottom: 0,
                    width: 60,
                    opacity: 0.35,
                    zIndex: 2,
                  }}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1, borderRadius: 32 }}
                  />
                </Animated.View>
              </Animated.View>
              <Animated.View style={{
                position: 'absolute',
                left: swipeX,
                top: 0,
                bottom: 0,
                width: 66,
                height: 66,
                borderRadius: 28,
                backgroundColor: 'green',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#26304A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 8,
                elevation: 8,
                zIndex: 3,
              }}>
                <Ionicons name="arrow-forward" size={32} color="#fff" />
            </Animated.View>
              <Text style={{
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 20,
                marginLeft: 70,
                letterSpacing: 0.5,
                zIndex: 4,
              }}>
                Swipe to go online
              </Text>
          </View>
      </View>
        </SafeAreaView>
      )}
      {/* SOS Button (show only when online) */}
      {isOnline && (
        <Animated.View style={{
          position: 'absolute',
          top: '35%',
          right: 7,
          zIndex: 1000,
          shadowColor: '#FF3B30',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 12,
        }}>
        <TouchableOpacity
            style={{
              backgroundColor: '#FF3B30',
              borderRadius: 32,
              width: 64,
              height: 64,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#FF3B30',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 12,
            }}
        onPress={() => setSOSVisible(true)}
            activeOpacity={0.85}
        >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 1 }}>SOS</Text>
        </TouchableOpacity>
        </Animated.View>
      )}
      {/* SOS Modal */}
      <SOSModal visible={isSOSVisible} onClose={() => setSOSVisible(false)} />
      {/* Ride Request Modal */}
      {rideRequest && (
        <RideRequestScreen
          ride={rideRequest}
          onClose={handleRejectRide}
          onAccept={handleAcceptRide}
          onReject={handleRejectRide}
        />
      )}
      {/* Navigation Screen */}
      {navigationRide && !showOtp && (
        <NavigationScreen
          ride={navigationRide}
          onNavigate={handleNavigate}
          onArrived={handleArrived}
          onClose={() => setNavigationRide(null)}
        />
      )}
      {/* OTP Screen */}
      {navigationRide && showOtp && (
        <OtpScreen onSubmit={handleOtpSubmit} onClose={() => setShowOtp(false)} />
      )}
      {/* Ride In Progress Screen */}
      {rideInProgress && (
        <RideInProgressScreen
          ride={rideInProgress}
          onNavigate={handleNavigateToDropoff}
          onEnd={handleEndRide}
          onClose={() => setRideInProgress(null)}
        />
      )}
      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onNavigate={(screen) => {
          try {
            navigation.navigate(screen as never);
          } catch (error) {
            console.log(`Navigation error to ${screen}:`, error);
            // Fallback navigation or show error message
          }
        }}
        halfScreen
      />
      {/* Safety Toolkit Modal */}
      <Modal
        visible={safetyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSafetyModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' }}>
          <View style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 16,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 32,
            paddingHorizontal: 0,
            minHeight: 420,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 20,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#222' }}>Safety Toolkit</Text>
              <TouchableOpacity onPress={() => setSafetyModalVisible(false)}>
                <Ionicons name="close" size={28} color="#222" />
              </TouchableOpacity>
    </View>
            {/* List */}
            <ScrollView style={{ paddingHorizontal: 8 }} showsVerticalScrollIndicator={false}>
              {/* Emergency Contacts */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
                <Ionicons name="alert-circle" size={28} color="#FF3B30" style={{ marginRight: 18 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>Emergency Contacts</Text>
                  <Text style={{ color: '#666', fontSize: 14 }}>Contact emergency services.</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#bbb" />
              </TouchableOpacity>
              {/* Record Audio */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
                <Ionicons name="mic" size={26} color="#222" style={{ marginRight: 18 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>Record audio</Text>
                  <Text style={{ color: '#666', fontSize: 14 }}>Record audio during your trips.</Text>
                </View>
                <TouchableOpacity style={{ backgroundColor: '#eee', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 }}>
                  <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 14 }}>Set up</Text>
                </TouchableOpacity>
              </View>
              {/* Follow my ride */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
                <Ionicons name="radio-outline" size={26} color="#222" style={{ marginRight: 18 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>Follow my ride</Text>
                  <Text style={{ color: '#666', fontSize: 14 }}>Share your location and trip status.</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#bbb" />
              </TouchableOpacity>
              {/* Proof of trip status */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
                <Ionicons name="image-outline" size={26} color="#222" style={{ marginRight: 18 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>Proof of trip status</Text>
                  <Text style={{ color: '#666', fontSize: 14 }}>Show law enforcement your current status.</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#bbb" />
              </TouchableOpacity>
              {/* Safety Hub */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16 }}>
                <Ionicons name="shield-outline" size={26} color="#222" style={{ marginRight: 18 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#222' }}>Safety Hub</Text>
                  <Text style={{ color: '#666', fontSize: 14 }}>View your safety settings and resources.</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#bbb" />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 10,
  },
  menuButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  speedPill: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 60,
    justifyContent: 'center',
  },
  speedZero: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 4,
  },
  speedLimit: {
    color: '#00C853',
    fontSize: 20,
    fontWeight: 'bold',
  },
  iconCircle: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
});
