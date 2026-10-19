export interface DeviceActivationRequest {
  activationCode: string;
}

export interface DeviceActivationResponse {
  token: string;
  deviceName?: string;
  organisationName?: string;
  organisationId?: string;
  locationId?: string;
}

export interface DeviceConfigResponse {
  deviceId: string;
  deviceName: string;
  organisationId: string;
  organisationName: string;
  organisationLogoUrl?: string;
  locationId?: string;
  locationName?: string;
  checkoutConfirmationRequired?: boolean;
  qrEnabled?: boolean;
  pinEnabled?: boolean;
  appVersion?: string;
  lastSync?: string;
}

export interface AttendanceLocation {
  id: string;
  locationName: string;
  isActive?: boolean;
  address?: string;
  city?: string;
  postcode?: string;
  activeSessionsCount?: number;
}

export interface LocationSwitchRequest {
  locationId: string;
  userId: string;
  pin: string;
}

export interface ClassSessionSummary {
  id: string;
  className: string;
  startTime: string; // e.g. "18:00"
  endTime: string;   // e.g. "19:00"
  expectedCount?: number;
  checkedInCount?: number;
  checkedOutCount?: number;
}

export interface AttendanceEligibilityRequest {
  method: 'QR' | 'PIN';
  code: string;
}

export type EligibilityStatus =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'ALREADY_CHECKED_IN'
  | 'ALREADY_ATTENDED'
  | 'NO_SESSION'
  | 'TOO_EARLY'
  | 'CHECKIN_CLOSED'
  | 'INVALID_CODE'
  | 'REJECTED';

export interface StudentInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  profileImageUrl?: string | null;
}

export interface AttendanceEligibilityResponse {
  status: EligibilityStatus;
  message?: string;
  studentName?: string;
  studentId?: string;
  student?: StudentInfo;
  profileImageUrl?: string | null;
  classSessionId?: string;
  className?: string;
  sessionTime?: string;
  checkInTime?: string;
  checkOutTime?: string;
  visitId?: string;
  opensAt?: string;
  organisationName?: string;
  locationName?: string;
  sessions?: ClassSessionSummary[];
}

export interface CheckInRequest {
  method: 'QR' | 'PIN';
  code: string;
  classSessionId: string;
  requestId: string;
}

export interface CheckInResponse {
  success: boolean;
  status?: string;
  message?: string;
  visitId?: string;
  studentName?: string;
  profileImageUrl?: string | null;
  className?: string;
  checkInTime?: string;
  organisationName?: string;
  locationName?: string;
}

export interface CheckOutRequest {
  method: 'QR' | 'PIN';
  code: string;
  classSessionId: string;
  visitId: string;
  requestId: string;
  checkoutConfirmed: boolean;
}

export interface CheckOutResponse {
  success: boolean;
  status?: string;
  message?: string;
  studentName?: string;
  profileImageUrl?: string | null;
  className?: string;
  checkInTime?: string;
  checkOutTime?: string;
  organisationName?: string;
  locationName?: string;
}
