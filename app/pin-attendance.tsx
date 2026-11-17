import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  useWindowDimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';
import { AppConfig } from '../constants/config';
import { DeviceApiService } from '../services/DeviceApiService';
import { SoundService } from '../services/SoundService';
import { KioskBrandHeader } from '../components/KioskBrandHeader';
import { CheckInSuccessView } from '../components/CheckInSuccessView';
import { AttendanceEligibilityResponse } from '../types/attendance';

function StudentAvatar({ name, imageUrl }: { name?: string; imageUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);

  const getInitials = (fullName?: string) => {
    if (!fullName || fullName.startsWith('Student (')) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  if (imageUrl && !imgError) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={styles.modalStudentAvatar}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={styles.modalStudentAvatarFallback}>
      {initials ? (
        <Text style={styles.avatarInitialsText}>{initials}</Text>
      ) : (
        <MaterialIcons name="person" size={32} color={Colors.primary} />
      )}
    </View>
  );
}

interface SuccessState {
  studentName: string;
  profileImageUrl?: string | null;
  className: string;
  locationName: string;
  checkInTime: string;
}

export default function PinAttendanceScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = Math.min(screenWidth, screenHeight) >= 600 || screenWidth >= 600;

  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orgName, setOrgName] = useState('');
  const [activeLocation, setActiveLocation] = useState('');
  const [successData, setSuccessData] = useState<SuccessState | null>(null);

  // Result modal state (same UX as QR scanner screen)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalResult, setModalResult] = useState<AttendanceEligibilityResponse | null>(null);
  const [checkoutInProgress, setCheckoutInProgress] = useState(false);
  const lastEnteredPinRef = useRef('');

  // Inactivity / Idle return timer (25s grace period as requested by Jovin)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleReturnToReady = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    setModalVisible(false);
    setModalResult(null);
    setPin('');
    setErrorMessage('');
    setSuccessData(null);
    router.replace('/attendance-home' as any);
  }, [router]);

  const closeModal = useCallback(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    setModalVisible(false);
    setModalResult(null);
    setPin('');
    setErrorMessage('');
  }, []);

  const triggerAutoClose = useCallback((delayMs = 3500, returnHome = false) => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      if (returnHome) {
        handleReturnToReady();
      } else {
        closeModal();
      }
    }, delayMs);
  }, [handleReturnToReady, closeModal]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      console.log('⏱️ [PIN Attendance] Inactivity timeout (30s) reached. Returning to Home.');
      handleReturnToReady();
    }, 30000);
  }, [handleReturnToReady]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const config = await DeviceApiService.getDeviceConfig().catch(() => null);
        if (config?.organisationName) setOrgName(config.organisationName);
        if (config?.locationName) setActiveLocation(config.locationName);

        const stored = await SecureStore.getItemAsync(AppConfig.STORAGE_KEYS.ACTIVE_LOCATION);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.locationName) setActiveLocation(parsed.locationName);
        }
      } catch { }
    };
    loadMetadata();
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [resetIdleTimer]);

  const handleKeyPress = (num: string) => {
    resetIdleTimer();
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }

      if (newPin.length === 6) {
        submitPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    resetIdleTimer();
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMessage('');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!modalResult) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    setCheckoutInProgress(true);

    try {
      const requestId = DeviceApiService.generateRequestId();
      const checkOutRes = await DeviceApiService.checkOut({
        method: 'PIN',
        code: lastEnteredPinRef.current || modalResult.studentId || '',
        classSessionId: modalResult.classSessionId || '',
        visitId: String(modalResult.visitId || ''),
        requestId,
        checkoutConfirmed: true,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        SoundService.playSuccess();
      } catch { }

      // Switch modal to Checked Out successfully
      setModalResult({
        ...modalResult,
        status: 'CHECK_OUT',
        checkOutTime: checkOutRes.checkOutTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      triggerAutoClose(3500, true);
    } catch (err: any) {
      try {
        SoundService.playError();
      } catch { }
      alert(err?.message || 'Check-out failed.');
    } finally {
      setCheckoutInProgress(false);
    }
  };

  const submitPin = async (completedPin: string) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    lastEnteredPinRef.current = completedPin;
    setProcessing(true);
    try {
      console.log(`\n🔑 [PIN Attendance] Identifying via PIN: [${completedPin}]`);
      const eligibility = await DeviceApiService.checkEligibility('PIN', completedPin);
      console.log('📡 [PIN Attendance] Eligibility Result:', eligibility);

      if (eligibility.status === 'CHECK_IN' && eligibility.classSessionId) {
        const requestId = DeviceApiService.generateRequestId();
        const checkInRes = await DeviceApiService.checkIn({
          method: 'PIN',
          code: completedPin,
          classSessionId: eligibility.classSessionId,
          requestId,
        });

        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          SoundService.playSuccess();
        } catch { }

        // Show Screen 3: Check-In Successful
        setSuccessData({
          studentName: checkInRes.studentName || eligibility.studentName || 'Student Member',
          profileImageUrl: checkInRes.profileImageUrl || eligibility.profileImageUrl,
          className: checkInRes.className || eligibility.className || 'Class Session',
          locationName: activeLocation || orgName || 'Attendance Station',
          checkInTime: checkInRes.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (eligibility.status === 'ALREADY_CHECKED_IN') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          SoundService.playWarning();
        } catch { }
        // Open the Already Checked In modal with Check-Out prompt (matches QR flow 100%)
        setModalResult(eligibility);
        setModalVisible(true);
        // Stays visible for user decision (Check Out / Cancel)
      } else if (eligibility.status === 'ALREADY_ATTENDED') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          SoundService.playWarning();
        } catch { }
        setModalResult(eligibility);
        setModalVisible(true);
        triggerAutoClose(3500, false);
      } else if (eligibility.status === 'TOO_EARLY' || eligibility.status === 'CHECKIN_CLOSED' || eligibility.status === 'NO_SESSION') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          SoundService.playWarning();
        } catch { }
        setModalResult(eligibility);
        setModalVisible(true);
        triggerAutoClose(4000, false);
      } else if (eligibility.studentName) {
        // Any other non-checkin status where student was identified
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          SoundService.playError();
        } catch { }
        setModalResult(eligibility);
        setModalVisible(true);
        triggerAutoClose(4000, false);
      } else {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          SoundService.playError();
        } catch { }

        setErrorMessage(eligibility.message || 'Invalid PIN entered. Please try again.');
        setPin('');
      }
    } catch (err: any) {
      try {
        SoundService.playError();
      } catch { }
      setErrorMessage(err?.message || 'Could not verify student PIN.');
      setPin('');
    } finally {
      setProcessing(false);
    }
  };

  // If check-in successful, show Screen 3 CheckInSuccessView
  if (successData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <CheckInSuccessView
          studentName={successData.studentName}
          profileImageUrl={successData.profileImageUrl}
          className={successData.className}
          locationName={successData.locationName}
          checkInTime={successData.checkInTime}
          autoCloseDurationMs={3200}
          onDismiss={handleReturnToReady}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, isTablet && styles.containerTablet]}>
        {/* Top Header with NationSkills Logo */}
        <KioskBrandHeader
          subtitle="Attendance Kiosk"
          showBack
          onBack={handleReturnToReady}
        />

        {/* Center Content Area: Vertically centers naturally on tall tablet screens */}
        <View style={[styles.keypadBodyWrapper, isTablet && styles.keypadBodyWrapperTablet]}>
          {/* Location & Context Subtitle */}
          <View style={[styles.subHeaderBox, isTablet && styles.subHeaderBoxTablet]}>
            {orgName ? <Text style={[styles.subHeaderOrg, isTablet && styles.subHeaderOrgTablet]}>{orgName}</Text> : null}
            <Text style={[styles.subHeaderLoc, isTablet && styles.subHeaderLocTablet]}>
              {activeLocation ? `${activeLocation} • PIN Attendance` : 'PIN Attendance'}
            </Text>
          </View>

          {/* 6-dot indicator */}
          <View style={[styles.dotsRow, isTablet && styles.dotsRowTablet]}>
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = index < pin.length;
              return (
                <View
                  key={index}
                  style={[styles.dot, isTablet && styles.dotTablet, isFilled && styles.dotFilled]}
                />
              );
            })}
          </View>

          {errorMessage ? (
            <Text style={[styles.errorText, isTablet && styles.errorTextTablet]}>{errorMessage}</Text>
          ) : processing ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={[styles.verifyingText, isTablet && styles.verifyingTextTablet]}>Verifying PIN...</Text>
            </View>
          ) : (
            <Text style={[styles.subText, isTablet && styles.subTextTablet]}>Enter your 6-digit student membership PIN</Text>
          )}

          {/* Numeric Dialpad */}
          <View style={[styles.dialpad, isTablet && styles.dialpadTablet]}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
              <View key={rIdx} style={[styles.dialpadRow, isTablet && styles.dialpadRowTablet]}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    style={[styles.keyBtn, isTablet && styles.keyBtnTablet]}
                    onPress={() => handleKeyPress(digit)}
                    disabled={processing}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.keyText, isTablet && styles.keyTextTablet]}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Bottom Dialpad Row */}
            <View style={[styles.dialpadRow, isTablet && styles.dialpadRowTablet]}>
              <TouchableOpacity
                style={[styles.keyBtnSecondary, isTablet && styles.keyBtnSecondaryTablet]}
                onPress={() => {
                  setPin('');
                  setErrorMessage('');
                }}
                disabled={processing || pin.length === 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyTextSecondary, isTablet && styles.keyTextSecondaryTablet]}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keyBtn, isTablet && styles.keyBtnTablet]}
                onPress={() => handleKeyPress('0')}
                disabled={processing}
                activeOpacity={0.7}
              >
                <Text style={[styles.keyText, isTablet && styles.keyTextTablet]}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.keyBtnSecondary, isTablet && styles.keyBtnSecondaryTablet]}
                onPress={handleBackspace}
                disabled={processing || pin.length === 0}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="backspace"
                  size={isTablet ? 30 : 22}
                  color={pin.length > 0 ? Colors.text : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.cancelPillBtn, isTablet && styles.cancelPillBtnTablet]}
            onPress={handleReturnToReady}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={isTablet ? 22 : 18} color="#64748B" />
            <Text style={[styles.cancelPillBtnText, isTablet && styles.cancelPillBtnTextTablet]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ======================================================== */}
      {/* RESULT MODALS (Matches QR Flow: Check-out, Already Checked-in, etc.) */}
      {/* ======================================================== */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => { }}>
              <View style={styles.modalCard}>
                {/* Screen: Check-Out Successful */}
                {modalResult?.status === 'CHECK_OUT' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.success }]}>
                      <MaterialIcons name="check" size={48} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>Checked out successfully!</Text>

                    <View style={styles.modalStudentBox}>
                      <StudentAvatar
                        name={modalResult.studentName}
                        imageUrl={modalResult.profileImageUrl}
                      />
                      <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                      {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                      {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                    </View>

                    <View style={styles.timestampRow}>
                      {modalResult.checkOutTime && (
                        <Text style={styles.timestampText}>Checked out at {modalResult.checkOutTime}</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={handleReturnToReady}
                    >
                      <Text style={styles.modalCloseBtnText}>Done</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Screen 7 & 8: Already Checked In (Prompt for Check-out) */}
                {modalResult?.status === 'ALREADY_CHECKED_IN' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.success }]}>
                      <MaterialIcons name="check" size={48} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>Already checked in</Text>

                    <View style={styles.modalStudentBox}>
                      <StudentAvatar
                        name={modalResult.studentName}
                        imageUrl={modalResult.profileImageUrl}
                      />
                      <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                      {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                      {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                    </View>

                    {modalResult.checkInTime ? (
                      <Text style={styles.timestampText}>Checked in at {modalResult.checkInTime}</Text>
                    ) : null}

                    <View style={styles.infoAlertBox}>
                      <MaterialIcons name="info" size={18} color={Colors.info} />
                      <Text style={styles.infoAlertText}>
                        Student is currently checked in. Do you want to check them out?
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.confirmCheckOutBtn, checkoutInProgress && { opacity: 0.7 }]}
                        onPress={handleConfirmCheckOut}
                        disabled={checkoutInProgress}
                      >
                        {checkoutInProgress ? (
                          <ActivityIndicator color={Colors.textWhite} />
                        ) : (
                          <Text style={styles.confirmCheckOutBtnText}>Check Out</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Screen: Already Attended Today */}
                {modalResult?.status === 'ALREADY_ATTENDED' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.info }]}>
                      <MaterialIcons name="done-all" size={44} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>Already attended today</Text>

                    <View style={styles.modalStudentBox}>
                      <StudentAvatar
                        name={modalResult.studentName}
                        imageUrl={modalResult.profileImageUrl}
                      />
                      <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                      {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                      {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                    </View>

                    <Text style={styles.modalDescText}>
                      {modalResult.message || 'You have already attended this class today.'}
                    </Text>

                    <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                      <Text style={styles.primaryModalBtnText}>Done</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Screen 10: No Eligible Session */}
                {modalResult?.status === 'NO_SESSION' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.error }]}>
                      <MaterialIcons name="priority-high" size={44} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>No session found</Text>
                    <View style={styles.modalStudentBox}>
                      <StudentAvatar
                        name={modalResult.studentName}
                        imageUrl={modalResult.profileImageUrl}
                      />
                      <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                    </View>
                    <Text style={styles.modalDescText}>
                      We couldn't find an eligible session at this location right now. Please speak to your instructor.
                    </Text>
                    <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                      <Text style={styles.primaryModalBtnText}>Done</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Screen 11: Too Early */}
                {modalResult?.status === 'TOO_EARLY' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.warning }]}>
                      <MaterialIcons name="access-time" size={44} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>You're a little early</Text>
                    <View style={styles.modalStudentBox}>
                      <StudentAvatar
                        name={modalResult.studentName}
                        imageUrl={modalResult.profileImageUrl}
                      />
                      <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                      {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                    </View>
                    <Text style={styles.modalDescText}>
                      {modalResult.opensAt ? `Check-in opens at ${modalResult.opensAt}.` : 'Check-in is not open yet. Please check your class timetable.'}
                    </Text>
                    <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                      <Text style={styles.modalCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Screen 12: Check-In Closed / Out of hours */}
                {modalResult?.status === 'CHECKIN_CLOSED' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.error }]}>
                      <MaterialIcons name="block" size={44} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>Check-in has closed</Text>
                    <View style={styles.modalStudentBox}>
                      <StudentAvatar
                        name={modalResult.studentName}
                        imageUrl={modalResult.profileImageUrl}
                      />
                      <Text style={styles.modalStudentName}>{modalResult.studentName || 'Student Member'}</Text>
                      {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                      {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                    </View>
                    <Text style={styles.modalDescText}>
                      {modalResult.message || 'This session check-in window has ended. Please speak to your instructor.'}
                    </Text>
                    <TouchableOpacity style={styles.modalCloseBtn} onPress={closeModal}>
                      <Text style={styles.modalCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Screen 13: Invalid PIN / Code */}
                {modalResult?.status === 'INVALID_CODE' && (
                  <>
                    <View style={[styles.statusIconCircle, { backgroundColor: Colors.error }]}>
                      <MaterialIcons name="close" size={48} color={Colors.textWhite} />
                    </View>
                    <Text style={styles.modalHeading}>PIN not recognised</Text>
                    <Text style={styles.modalDescText}>
                      {modalResult.message || 'Please check your PIN and try again.'}
                    </Text>
                    <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                      <Text style={styles.primaryModalBtnText}>Try again</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Fallback Catch-All: For any unhandled status (e.g. REJECTED, OUT_OF_HOURS, error, etc.) */}
                {![
                  'CHECK_OUT',
                  'ALREADY_CHECKED_IN',
                  'ALREADY_ATTENDED',
                  'NO_SESSION',
                  'TOO_EARLY',
                  'CHECKIN_CLOSED',
                  'INVALID_CODE',
                ].includes(modalResult?.status || '') && (
                    <>
                      <View style={[styles.statusIconCircle, { backgroundColor: Colors.warning }]}>
                        <MaterialIcons name="warning-amber" size={44} color={Colors.textWhite} />
                      </View>
                      <Text style={styles.modalHeading}>
                        {modalResult?.status === 'REJECTED' ? 'Check-in Not Available' : 'Attendance Notice'}
                      </Text>
                      {modalResult?.studentName ? (
                        <View style={styles.modalStudentBox}>
                          <StudentAvatar
                            name={modalResult.studentName}
                            imageUrl={modalResult.profileImageUrl}
                          />
                          <Text style={styles.modalStudentName}>{modalResult.studentName}</Text>
                          {modalResult.className ? <Text style={styles.modalSessionTime}>{modalResult.className}</Text> : null}
                          {modalResult.sessionTime ? <Text style={styles.modalSessionTime}>{modalResult.sessionTime}</Text> : null}
                        </View>
                      ) : null}
                      <Text style={styles.modalDescText}>
                        {modalResult?.message || 'Unable to check in at this time. Please speak to your instructor.'}
                      </Text>
                      <TouchableOpacity style={styles.primaryModalBtn} onPress={closeModal}>
                        <Text style={styles.primaryModalBtnText}>Close</Text>
                      </TouchableOpacity>
                    </>
                  )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  keypadBodyWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadBodyWrapperTablet: {
    paddingVertical: 12,
  },
  subHeaderBox: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  subHeaderOrg: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subHeaderLoc: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#0D3838',
    borderColor: '#0D3838',
  },
  subText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  verifyingText: {
    fontSize: 13,
    color: '#0D3838',
    fontWeight: '600',
  },
  dialpad: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
    marginBottom: 24,
  },
  dialpadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyBtn: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  keyBtnSecondary: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyTextSecondary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  cancelPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cancelPillBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 8,
  },
  demoPinPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F4F4',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  demoPinPillBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  // Tablet specific scaling rules
  containerTablet: {
    maxWidth: 620,
    paddingHorizontal: 36,
  },
  subHeaderBoxTablet: {
    marginTop: 18,
    marginBottom: 32,
  },
  subHeaderOrgTablet: {
    fontSize: 24,
  },
  subHeaderLocTablet: {
    fontSize: 16,
    marginTop: 4,
  },
  dotsRowTablet: {
    gap: 20,
    marginBottom: 24,
  },
  dotTablet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
  },
  subTextTablet: {
    fontSize: 16,
    marginBottom: 36,
  },
  errorTextTablet: {
    fontSize: 16,
    marginBottom: 36,
  },
  verifyingTextTablet: {
    fontSize: 16,
  },
  dialpadTablet: {
    maxWidth: 540,
    gap: 18,
    marginBottom: 28,
  },
  dialpadRowTablet: {
    gap: 18,
  },
  keyBtnTablet: {
    height: 94,
    borderRadius: 24,
  },
  keyTextTablet: {
    fontSize: 38,
  },
  keyBtnSecondaryTablet: {
    height: 94,
    borderRadius: 24,
  },
  keyTextSecondaryTablet: {
    fontSize: 20,
  },
  cancelPillBtnTablet: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 8,
  },
  cancelPillBtnTextTablet: {
    fontSize: 18,
  },

  // Modal styling (matching QR Scanner flow 100%)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  modalStudentBox: {
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  modalStudentAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  modalStudentAvatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  modalStudentName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSessionTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalCloseBtn: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  infoAlertBox: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  infoAlertText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    lineHeight: 18,
  },
  actionRow: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  confirmCheckOutBtn: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCheckOutBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalDescText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginVertical: 6,
  },
  primaryModalBtn: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});
