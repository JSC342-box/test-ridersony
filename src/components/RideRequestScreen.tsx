import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export type RideRequest = {
  id: string;
  price: string;
  type: string;
  tag: string;
  rating: string;
  verified: boolean;
  pickup: string;
  pickupAddress: string;
  dropoff: string;
  dropoffAddress: string;
  // Optional detailed location information for socket data
  pickupDetails?: {
    latitude: number;
    longitude: number;
    address: string;
    name: string;
  };
  dropoffDetails?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    type: string;
  };
};

// Shared soundRef for both component and static function
const soundRef = { current: null as Audio.Sound | null };

// Static method to stop all notification sounds
export async function stopAllNotificationSounds() {
  if (soundRef.current) {
    try {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    } catch (e) {
      // Ignore errors
    }
    soundRef.current = null;
  }
}

const RideRequestScreen = ({ ride, onClose, onAccept, onReject, playSound = true }: { ride: RideRequest; onClose: () => void; onAccept: () => void; onReject?: () => void; playSound?: boolean }) => {
  const [isAccepting, setIsAccepting] = useState(false);
  
  const stopAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(100)).current;
  const acceptAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate overlay and card
    Animated.parallel([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 60,
      }),
    ]).start();
    // Animate Accept button (pulse)
    Animated.loop(
      Animated.sequence([
        Animated.timing(acceptAnim, {
          toValue: 1.08,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(acceptAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
    // Play sound and vibrate only if playSound is true
    if (playSound) {
      (async () => {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Load and play audio in loop
          const { sound } = await Audio.Sound.createAsync(
            require('../../assets/sounds/Ubersound.mp3'),
            { shouldPlay: true, isLooping: true }
          );
          soundRef.current = sound;
        } catch (e) {
          console.log('Error playing audio:', e);
        }
      })();
    }
    return () => {
      acceptAnim.stopAnimation();
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [playSound]);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}> 
      <Animated.View style={[styles.cardContainer, { transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 100], outputRange: [0, 500] }) }] }]}> 
        {/* Close Button */}
        <TouchableOpacity onPress={async () => {
          await stopAudio();
          onClose();
        }} style={{ position: 'absolute', top: 18, right: 18, zIndex: 10, backgroundColor: '#f6f6f6', borderRadius: 18, padding: 6 }}>
          <Ionicons name="close" size={26} color="#888" />
        </TouchableOpacity>
        {/* Top Pills */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 2 }}>
          <View style={styles.rideTypePill}><Text style={styles.rideTypeText}>{ride.type}</Text></View>
          <View style={styles.rideTypePillOutline}><Text style={styles.rideTypeTextOutline}>{ride.tag}</Text></View>
          <MaterialIcons name="bolt" size={22} color="#007AFF" style={{ marginLeft: 4 }} />
        </View>
        {/* Price */}
        <Text style={styles.priceText}>{ride.price}</Text>
        {/* Rating and Verified */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="star" size={20} color="#111" style={{ marginRight: 2 }} />
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginRight: 8 }}>{ride.rating}</Text>
          {ride.verified && <MaterialIcons name="verified" size={20} color="#007AFF" />}
          {ride.verified && <Text style={{ marginLeft: 4, color: '#007AFF', fontWeight: 'bold', fontSize: 18 }}>Verified</Text>}
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginVertical: 8, width: '100%' }} />
        {/* Details */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
          <Ionicons name="walk" size={22} color="#111" style={{ marginTop: 2, marginRight: 8 }} />
          <View>
            <Text style={styles.timeText}>{ride.pickup}</Text>
            <Text style={styles.addressText}>{ride.pickupAddress}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
          <Ionicons name="car" size={22} color="#111" style={{ marginTop: 2, marginRight: 8 }} />
          <View>
            <Text style={styles.timeText}>{ride.dropoff}</Text>
            <Text style={styles.addressText}>{ride.dropoffAddress}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          {onReject && (
            <TouchableOpacity style={styles.rejectButton} onPress={async () => {
              await stopAudio();
              onReject();
            }} activeOpacity={0.8}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          )}
          <Animated.View style={{ flex: 1, alignItems: 'center', transform: [{ scale: acceptAnim }] }}>
            <TouchableOpacity 
              style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]} 
              onPress={async () => {
                if (isAccepting) return; // Prevent multiple clicks
                setIsAccepting(true);
                await stopAudio();
                onAccept();
              }} 
              activeOpacity={0.8}
              disabled={isAccepting}
            >
              <Text style={styles.acceptButtonText}>
                {isAccepting ? 'Accepting...' : 'Accept'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  cardContainer: {
    width: width - 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 35,
    elevation: 25,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 15 },
    alignItems: 'flex-start',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#f6f6f6',
    borderRadius: 18,
    padding: 6,
    zIndex: 10,
  },
  rideTypePill: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginRight: 8,
  },
  rideTypeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rideTypePillOutline: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginRight: 8,
  },
  rideTypeTextOutline: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  priceText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
    marginTop: 8,
  },
  timeText: {
    fontSize: 18,
    color: '#111',
  },
  addressText: {
    fontSize: 15,
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#1877f2',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    marginBottom: 2,
    elevation: 2,
  },
  acceptButtonDisabled: {
    backgroundColor: '#ccc',
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 22,
    letterSpacing: 1,
  },
  rejectButton: {
    backgroundColor: '#fff',
    borderColor: '#FF3B30',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginRight: 8,
    elevation: 1,
  },
  rejectButtonText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
});

export default RideRequestScreen; 