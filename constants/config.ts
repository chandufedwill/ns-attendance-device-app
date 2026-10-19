export const AppConfig = {
  // Base Attendance Device API route
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.test.nationskills.com/portal/attendanceDevice',

  // Fallback Test Activation Code provided by Jovin
  TEST_ACTIVATION_CODE: '621853',

  // SecureStore Key Identifiers
  STORAGE_KEYS: {
    DEVICE_TOKEN: 'ns_attendance_device_token',
    DEVICE_CONFIG: 'ns_attendance_device_config',
    ACTIVE_LOCATION: 'ns_attendance_active_location',
    STAFF_PIN: 'ns_attendance_staff_pin',
  },
};
