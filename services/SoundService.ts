import { Audio } from 'expo-av';

/**
 * SoundService: Provides crisp audio chimes for kiosk attendance feedback.
 * - playSuccess: Ascending pleasant 3-tone chime for Check-in / Check-out success.
 * - playWarning: Gentle alert chime for Already Checked In / Too Early.
 * - playError: Double buzz chime for Invalid QR / Verification Failed.
 */
class SoundServiceManager {
  private enabled: boolean = true;

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private async playSoundAsset(source: any) {
    if (!this.enabled) return;
    try {
      // Set audio mode for kiosk playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      }).catch(() => {});

      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, volume: 1.0 }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (err) {
      console.warn('Audio playback error (silent fallback):', err);
    }
  }

  public async playSuccess() {
    await this.playSoundAsset(require('../assets/sounds/success.wav'));
  }

  public async playWarning() {
    await this.playSoundAsset(require('../assets/sounds/warning.wav'));
  }

  public async playError() {
    await this.playSoundAsset(require('../assets/sounds/error.wav'));
  }
}

export const SoundService = new SoundServiceManager();
