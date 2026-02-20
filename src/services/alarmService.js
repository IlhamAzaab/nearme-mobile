/**
 * AlarmService
 *
 * Plays a custom MP3 alarm sound that loops continuously until stopped.
 * Uses expo-av Audio so the sound works while the app is in the foreground
 * AND continues playing after the app is minimised (staysActiveInBackground).
 *
 * Usage:
 *   import alarmService from './alarmService';
 *   await alarmService.start();   // begin looping alarm
 *   await alarmService.stop();    // silence immediately
 */

import { Audio } from "expo-av";

class AlarmService {
  constructor() {
    this._sound = null;
    this._isPlaying = false;
  }

  /**
   * Start looping the alarm sound.
   * Calling start() while already playing is a no-op.
   *
   * IMPORTANT: _isPlaying is set to true BEFORE any async work so that
   * a stop() call arriving while the MP3 is still loading is not ignored.
   */
  async start() {
    if (this._isPlaying) return;

    // Mark as playing IMMEDIATELY (synchronous) — this is the critical fix.
    // stop() checks this flag; if stop() wins the race it sets it to false,
    // and we bail out after each await below rather than starting sound.
    this._isPlaying = true;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // If stop() was called while setAudioModeAsync was in flight, abort.
      if (!this._isPlaying) return;

      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/alarm.mp3"),
        {
          isLooping: true,
          volume: 1.0,
          shouldPlay: true,
        },
      );

      // If stop() was called while createAsync was in flight, discard the
      // sound object immediately instead of letting it play.
      if (!this._isPlaying) {
        sound.unloadAsync().catch(() => {});
        return;
      }

      this._sound = sound;
      console.log("[Alarm] 🔔 Custom alarm started — looping");
    } catch (err) {
      this._isPlaying = false;
      console.error("[Alarm] Failed to start:", err);
    }
  }

  /**
   * Stop and unload the alarm sound immediately.
   *
   * Clears _isPlaying and _sound synchronously FIRST so that any in-progress
   * start() call will see the updated state and abort before it plays.
   */
  async stop() {
    // Synchronously clear flags and grab the sound reference.
    // This ensures start() will bail out even if it is mid-await.
    this._isPlaying = false;
    const soundToStop = this._sound;
    this._sound = null;

    try {
      if (soundToStop) {
        await soundToStop.stopAsync();
        await soundToStop.unloadAsync();
      }
      console.log("[Alarm] 🔕 Alarm stopped");
    } catch (err) {
      console.error("[Alarm] Failed to stop:", err);
    }
  }

  /** Returns true if the alarm is currently playing */
  isPlaying() {
    return this._isPlaying;
  }
}

// Export a singleton so start/stop state is shared across the whole app
export default new AlarmService();
