import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Animated, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import socketManager from '../../utils/socket';
import rideService from '../../services/rideService';
import CancelRideButton from '../../components/CancelRideButton';

interface OtpScreenProps {
  route: any;
  navigation: any;
}

export default function OtpScreen({ route, navigation }: OtpScreenProps) {
  const { ride } = route.params;
  const { getToken } = useAuth();
  
  console.log('🔐 OtpScreen received ride data:', ride);
  console.log('🔐 rideId:', ride?.rideId);
  console.log('🔐 driverId:', ride?.driverId);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;
  const checkAnim = React.useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isWaitingForRideStarted, setIsWaitingForRideStarted] = useState(false);

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, []);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Listen for driver cancellation success and ride started events
  React.useEffect(() => {
    const socket = socketManager.getSocket();
    if (socket) {
      console.log('🔗 Socket connection status in OtpScreen:', socket.connected);
      console.log('🔗 Socket ID:', socket.id);
      
      const handleDriverCancellationSuccess = (data: any) => {
        console.log('✅ Driver cancellation success received in OtpScreen:', data);
        // Clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsWaitingForRideStarted(false);
        // Navigate to home screen after successful cancellation
        navigation.navigate('Home');
      };

      const handleRideStarted = (data: any) => {
        console.log('🚀 Ride started event received in OtpScreen:', data);
        if (data.rideId === ride.rideId) {
          console.log('✅ Ride started, navigating to RideInProgressScreen');
          // Clear any pending timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setIsWaitingForRideStarted(false);
          // Navigate to ride in progress screen
          navigation.navigate('RideInProgressScreen', { ride });
        }
      };

      // Listen for socket connection status changes
      const handleConnect = () => {
        console.log('🔗 Socket connected in OtpScreen');
      };

      const handleDisconnect = (reason: string | null) => {
        console.log('🔌 Socket disconnected in OtpScreen:', reason);
        // If socket disconnects while waiting for ride_started, trigger fallback
        if (isWaitingForRideStarted) {
          console.log('⚠️ Socket disconnected while waiting for ride_started, triggering fallback');
          handleFallbackNavigation();
        }
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('driver_cancellation_success', handleDriverCancellationSuccess);
      socket.on('ride_started', handleRideStarted);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('driver_cancellation_success', handleDriverCancellationSuccess);
        socket.off('ride_started', handleRideStarted);
      };
    } else {
      console.warn('⚠️ No socket available in OtpScreen');
    }
  }, [navigation, ride.rideId, isWaitingForRideStarted]);

  // Function to handle fallback navigation after timeout
  const handleFallbackNavigation = () => {
    console.log('⏰ Timeout reached, navigating to RideInProgressScreen as fallback');
    setIsWaitingForRideStarted(false);
    navigation.navigate('RideInProgressScreen', { ride });
  };

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

  const handleSubmit = async () => {
    if (!otp.every(d => d)) {
      Alert.alert('Incomplete OTP', 'Please enter all 4 digits');
      return;
    }

    if (isVerifying) return; // Prevent multiple submissions

    setIsVerifying(true);
    setSubmitted(true);

    try {
      // Get the entered OTP
      const enteredOtp = otp.join('');
      console.log('🔐 Driver entered OTP:', enteredOtp);
      
      // Get authentication token
      const token = await getToken({ template: 'driver_app_token', skipCache: true });
      
      if (!token) {
        console.error('❌ No authentication token available');
        Alert.alert('Authentication Error', 'Unable to verify OTP. Please try again.');
        setSubmitted(false);
        setIsVerifying(false);
        return;
      }
      
      // Step 1: Call API endpoint to verify OTP
      console.log('🔐 Calling API to verify OTP...');
      const apiResponse = await rideService.verifyOtp(ride.rideId, enteredOtp, token);
      
      if (apiResponse.success) {
        console.log('✅ OTP verified successfully via API');
        
        // Check socket connection before sending OTP
        const socket = socketManager.getSocket();
        if (!socket || !socket.connected) {
          console.warn('⚠️ Socket not connected, proceeding with fallback navigation');
          // If socket is not connected, proceed directly to ride screen
          Animated.sequence([
            Animated.timing(checkAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.delay(600),
          ]).start(() => {
            console.log('✅ OTP verified, navigating directly to RideInProgressScreen (no socket)');
            navigation.navigate('RideInProgressScreen', { ride });
          });
          setSubmitted(false);
          checkAnim.setValue(0);
          setIsVerifying(false);
          return;
        }
        
        // Step 2: Also emit socket.io event for real-time communication
        console.log('🔐 Emitting socket.io OTP verification event...');
        socketManager.sendOtp({
          rideId: ride.rideId,
          driverId: ride.driverId,
          otp: enteredOtp
        });
        
        console.log('✅ OTP verification sent via both API and socket.io');
        
        // Step 3: Show success animation and wait for ride_started event
        Animated.sequence([
          Animated.timing(checkAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.delay(600),
        ]).start(() => {
          console.log('✅ OTP verification successful, waiting for ride_started event...');
          
          setIsWaitingForRideStarted(true);
          
          // Set a timeout to prevent getting stuck (10 seconds)
          timeoutRef.current = setTimeout(() => {
            console.log('⏰ Timeout reached for ride_started event');
            handleFallbackNavigation();
          }, 10000); // 10 seconds timeout
          
          setSubmitted(false);
          checkAnim.setValue(0);
          setIsVerifying(false);
        });
        
      } else {
        console.error('❌ API OTP verification failed:', apiResponse.error);
        Alert.alert(
          'OTP Verification Failed', 
          apiResponse.error || 'Incorrect OTP. Please try again.'
        );
        setSubmitted(false);
        setIsVerifying(false);
      }
      
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      Alert.alert(
        'Verification Error', 
        'Failed to verify OTP. Please check your connection and try again.'
      );
      setSubmitted(false);
      setIsVerifying(false);
    }
  };

  // Function to cancel the ride
  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? This action cannot be undone.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        { 
          text: 'Cancel Ride', 
          style: 'destructive',
          onPress: () => {
            console.log('🚫 Driver cancelling ride during OTP entry:', {
              rideId: ride.rideId,
              driverId: ride.driverId,
              reason: 'Driver cancelled during OTP entry'
            });
            
            // Clear any pending timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setIsWaitingForRideStarted(false);
            
            // Send cancellation to server
            socketManager.cancelRide({
              rideId: ride.rideId,
              driverId: ride.driverId,
              reason: 'Driver cancelled during OTP entry'
            });
            
            // Note: Navigation will be handled by the driver_cancellation_success event
          }
        }
      ]
    );
  };

  // Function to manually proceed to ride (fallback button)
  const handleManualProceed = () => {
    console.log('🔄 Manual proceed to ride triggered');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsWaitingForRideStarted(false);
    navigation.navigate('RideInProgressScreen', { ride });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{
        width: 320,
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
        {/* Header with back and cancel buttons */}
        <View style={{ 
          position: 'absolute', 
          top: 18, 
          left: 18, 
          right: 18, 
          zIndex: 10, 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          {/* Back Button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#6c757d',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 16,
              shadowColor: '#6c757d',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4
            }}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Cancel Button */}
          <CancelRideButton
            rideId={ride.rideId}
            driverId={ride.driverId}
            rideDetails={{
              pickupAddress: ride.pickupAddress,
              dropoffAddress: ride.dropoffAddress,
              price: ride.price,
            }}
            onSuccess={() => navigation.navigate('Home')}
            style={{ 
              backgroundColor: '#ff4757', 
              paddingHorizontal: 12, 
              paddingVertical: 8, 
              borderRadius: 16,
              shadowColor: '#ff4757',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4
            }}
            showIcon={true}
          />
        </View>
        <Text style={{ fontSize: 30, fontWeight: 'bold', marginBottom: 10, color: '#1877f2', letterSpacing: 1 }}>Enter OTP</Text>
        <Text style={{ fontSize: 17, marginBottom: 28, color: '#444', textAlign: 'center' }}>Enter the 4-digit code to start your ride</Text>
        
        {/* Status message when waiting for ride_started event */}
        {isWaitingForRideStarted && (
          <View style={{ marginBottom: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8 }}>
              OTP verified successfully! Starting your ride...
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#1877f2', marginRight: 8 }} />
              <Text style={{ fontSize: 12, color: '#888' }}>Connecting to ride...</Text>
            </View>
          </View>
        )}
        
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
              editable={!isVerifying}
            />
          ))}
        </View>
        <TouchableOpacity
          style={{ backgroundColor: otp.every(d => d) && !isVerifying ? '#1877f2' : '#b0b0b0', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 }}
          onPress={handleSubmit}
          disabled={!otp.every(d => d) || isVerifying}
          activeOpacity={otp.every(d => d) && !isVerifying ? 0.8 : 1}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20, letterSpacing: 1 }}>
            {isVerifying ? 'Verifying...' : 'Submit OTP'}
          </Text>
        </TouchableOpacity>
        
        {/* Show manual proceed button if waiting for ride_started event */}
        {isWaitingForRideStarted && (
          <TouchableOpacity
            style={{ backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginTop: 8 }}
            onPress={handleManualProceed}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Proceed to Ride</Text>
          </TouchableOpacity>
        )}
        

        {submitted && (
          <Animated.View style={{ marginTop: 18, opacity: checkAnim, transform: [{ scale: checkAnim }] }}>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
          </Animated.View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
} 