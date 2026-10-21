# NationSkills Attendance Kiosk — Demo & Testing Guide

This guide explains how to test and demo the **3-Screen Attendance Loop** without requiring active server credentials or backend setup.

---

## 🔁 3-Screen Loop Overview

```
[ Screen 1: Attendance Ready ]
        │
        ├───▶ [ Screen 2A: QR Scanner ] ───────┐
        │                                      ▼
        └───▶ [ Screen 2B: Enter PIN ]  ──▶ [ Screen 3: Check-In Successful ]
                                                       │ (2.8s auto-dismiss)
                                                       ▼
                                            [ Return to Screen 1 ]
```

---

## 🧪 How to Demo Without Server Credentials

No server activation code or API token is required for any of the demo actions below:

### 1. QR Code Scanner Demo
1. On **Screen 1 (Attendance Ready)**, tap **"Scan QR Code"**.
2. On **Screen 2 (Scanner)**, you have 3 ways to test:
   - **Method A (Easiest — 1 Tap):** Tap the **`⚡ Test Check-In Demo`** button at the bottom next to Cancel.
   - **Method B (Real QR Scan):** Scan any QR code that contains the word `DEMO` or `TEST` (e.g. generate a free text QR with `NS-DEMO-01`).
   - **Method C (Fallback):** If you scan any random barcode/QR and the *"QR not recognised"* modal appears, tap **`Preview Check-In Screen (Demo)`**.
3. **Result:** Screen 3 opens immediately with success chime, student details, and returns to Screen 1 after 2.8 seconds.

---

### 2. PIN Attendance Demo
1. On **Screen 1 (Attendance Ready)**, tap **"Enter PIN"**.
2. On **Screen 2 (PIN Pad)**:
   - **Method A:** Dial **`1 2 3 4 5 6`** (or `0 0 0 0 0 0`).
   - **Method B:** Tap the **`⚡ Demo PIN (123456)`** pill button at the bottom.
3. **Result:** Screen 3 triggers instantly, confirms check-in, and auto-returns to Screen 1 after 2.8 seconds.

---

### 3. Screen 3: Check-In Successful Details

When triggered, Screen 3 displays:
- **Green Animated Checkmark:** Circular confirmation pulse with confetti sparkles.
- **Student Profile:** Student Avatar / Initials fallback + **"Aarav Sharma"** (Student Member).
- **Class Session:** **"Karate & Martial Arts"**.
- **Time & Date:** Current device time (e.g., `05:00 PM`) and today's date.
- **Location Badge:** Active location name.
- **Audio & Haptic Feedback:** Success chime sound and haptic vibration.
- **Auto-Return Progress:** Auto-closes after **2.8 seconds** and smoothly navigates back to Screen 1.

---

## 📍 In-Place Location Selector Demo

1. On Screen 1, tap the **Partner Centre / Location card** (with the `keyboard-arrow-down` icon).
2. An **in-place modal dropdown** opens on the current screen (no page navigation).
3. Tap any location to select it.
4. The modal closes immediately and updates the location name on Screen 1.
> *Note: If a device only has 1 permitted location assigned, the app automatically selects it without prompting.*

---

## ⚙️ Staff Settings & Kiosk Mode Demo

1. In the top-right corner of Screen 1, tap the **Settings icon** (gear).
2. Enter the Staff PIN (or access dashboard).
3. Open **Device Settings**:
   - **Toggle Check-in Methods:**
     - Turn OFF **"QR Code Scanning"** ➔ Home Screen immediately hides the "Scan QR Code" card.
     - Turn OFF **"Student PIN Entry"** ➔ Home Screen immediately hides the "Enter PIN" card.
     - Turn both OFF ➔ Home Screen displays *"Check-in Paused"*.
   - **Kiosk Security Mode:**
     - Keeps tablet awake 24/7 (`expo-keep-awake`).
     - Hides Android system navigation bar (`expo-navigation-bar`).
     - Blocks hardware/gesture back press (`BackHandler`).
   - Tap **"💾 Save Settings"** to persist your configuration.
