# Sound Assets

This folder contains notification and alert sound files for the NearMe app.

## Required Sound Files
- `notification-tone.wav` — General notification sound
- `delivery-alert.wav` — Delivery notification alert
- `driver-alert-tone.wav` — Driver incoming delivery alert
- `success-alert.wav` — Success/completion sound

## Adding Sound Files
Place `.wav` or `.mp3` audio files in this directory. They can be loaded using:
```js
import { Audio } from 'expo-av';
const { sound } = await Audio.Sound.createAsync(require('./notification-tone.wav'));
await sound.playAsync();
```

## Notes
- Keep files under 100KB for fast loading
- Use `.wav` for best cross-platform compatibility
- Recommended: 44.1kHz, 16-bit, mono
