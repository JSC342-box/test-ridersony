import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CancelRideModal from './CancelRideModal';
import socketManager from '../utils/socket';
import { useOnlineStatus } from '../store/OnlineStatusContext';
import { stopAllNotificationSounds } from './RideRequestScreen';

interface CancelRideButtonProps {
  rideId: string;
  driverId: string;
  rideDetails?: {
    pickupAddress: string;
    dropoffAddress: string;
    price: string;
  };
  onSuccess?: () => void;
  style?: any;
  disabled?: boolean;
  showIcon?: boolean;
}

export default function CancelRideButton({
  rideId,
  driverId,
  rideDetails,
  onSuccess,
  style,
  disabled = false,
  showIcon = true,
}: CancelRideButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { resetDriverStatus } = useOnlineStatus();

  const handleCancelRide = async (reason: string) => {
    try {
      console.log('🚫 Driver cancelling ride:', {
        rideId,
        driverId,
        reason,
      });

      // Stop notification sounds when cancelling ride
      await stopAllNotificationSounds();

      // Set driver offline to prevent receiving new ride requests immediately
      // Note: This will be handled by the parent component that uses this button
      console.log('🚫 Driver cancelling ride - should be set offline by parent');

      // Emit Socket.IO event to cancel ride
      socketManager.cancelRide({
        rideId,
        driverId,
        reason,
      });

      // Close modal
      setModalVisible(false);

      // Show success message
      Alert.alert(
        'Ride Cancelled',
        'Ride cancelled successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset driver status
              if (resetDriverStatus) {
                resetDriverStatus();
              }
              
              // Call success callback
              if (onSuccess) {
                onSuccess();
              }
            },
          },
        ]
      );

    } catch (error) {
      console.error('❌ Error cancelling ride:', error);
      Alert.alert(
        'Error',
        'Failed to cancel ride. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handlePress = () => {
    if (disabled) return;
    setModalVisible(true);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          disabled && styles.buttonDisabled,
          style,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {showIcon && (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color={disabled ? '#ccc' : '#fff'} 
            style={styles.icon}
          />
        )}
        {!showIcon && (
          <Text style={[
            styles.buttonText,
            disabled && styles.buttonTextDisabled,
          ]}>
            Cancel Ride
          </Text>
        )}
      </TouchableOpacity>

      <CancelRideModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={handleCancelRide}
        rideDetails={rideDetails}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#ff4757',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#f0f0f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonTextDisabled: {
    color: '#ccc',
  },
  icon: {
    marginRight: 8,
  },
});
