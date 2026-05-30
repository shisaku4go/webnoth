import { sounds } from '@webnoth/wesnoth-data/sounds';
import { wesnothAssetUrl } from '@/lib/asset-url';

class SoundManager {
  private ctx: AudioContext | null = null;
  private bufferCache = new Map<string, Promise<AudioBuffer>>();
  private masterGain: GainNode | null = null;
  private isUnlocked = false;

  private init() {
    if (this.ctx) return;

    // Create AudioContext (usually starts as suspended due to autoplay policy)
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API is not supported in this browser.');
      return;
    }

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5; // Default volume 50%
    this.masterGain.connect(this.ctx.destination);

    this.setupUnlockListeners();
  }

  private setupUnlockListeners() {
    const unlock = () => {
      if (this.isUnlocked || !this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx
          .resume()
          .then(() => {
            this.isUnlocked = true;
            this.removeUnlockListeners();
            console.log('AudioContext successfully unlocked!');
          })
          .catch((err) => {
            console.error('Failed to unlock AudioContext:', err);
          });
      } else {
        this.isUnlocked = true;
        this.removeUnlockListeners();
      }
    };

    window.addEventListener('click', unlock, { capture: true, once: true });
    window.addEventListener('touchstart', unlock, {
      capture: true,
      once: true,
    });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  private removeUnlockListeners() {
    // Handled by { once: true }, but double check or clean up if needed
  }

  /**
   * Explicitly unlock/resume the audio context. Useful to call on button clicks.
   */
  public unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
        console.log('AudioContext unlocked via explicit request.');
      });
    }
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  public setVolume(volume: number) {
    this.init();
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Fetch and decode an audio file, caching the resulting AudioBuffer Promise.
   */
  private loadBuffer(path: string): Promise<AudioBuffer> {
    this.init();
    if (!this.ctx) {
      return Promise.reject(new Error('AudioContext not initialized'));
    }

    const ctx = this.ctx;

    let promise = this.bufferCache.get(path);
    if (!promise) {
      promise = (async () => {
        const url = wesnothAssetUrl(path);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch sound: ${url} (status: ${response.status})`,
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
      })();
      this.bufferCache.set(path, promise);

      // Handle promise rejection by deleting it from cache so future attempts can retry
      promise.catch(() => {
        this.bufferCache.delete(path);
      });
    }
    return promise;
  }

  /**
   * Preload a list of sound paths.
   */
  public async preloadSounds(paths: string[]): Promise<void> {
    this.init();
    const promises = paths.map((path) =>
      this.loadBuffer(path).catch((err) => {
        console.warn(`Failed to preload sound: ${path}`, err);
        return null;
      }),
    );
    await Promise.all(promises);
  }

  /**
   * Play a sound from an AudioBuffer.
   */
  private playBuffer(buffer: AudioBuffer) {
    if (!this.ctx || !this.masterGain) return;

    // Create source node
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGain);
    source.start(0);
  }

  /**
   * Play a sound by its relative path inside wesnoth-assets.
   */
  public async playPath(path: string) {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      // AudioContext is still suspended. Unlock it if possible, but don't fail silently.
      await this.ctx.resume();
    }

    try {
      const buffer = await this.loadBuffer(path);
      if (buffer) {
        this.playBuffer(buffer);
      }
    } catch (error) {
      console.error(`Error playing sound effect at ${path}:`, error);
    }
  }

  // === Convenience Play Helpers ===

  public playUi(type: 'select' | 'click') {
    const path = sounds.ui[type];
    if (path) {
      this.playPath(path);
    }
  }

  /**
   * Synthesize a level-up chime using oscillators.
   */
  public playLevelUp() {
    this.init();
    const ctx = this.ctx;
    const masterGain = this.masterGain;
    if (!ctx || !masterGain) return;
    try {
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5]; // C4, E4, G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch (e) {
      console.error('Failed to synthesize level-up sound:', e);
    }
  }

  /**
   * Play an attack sound.
   * If it missed, it will play the miss sound after a small delay.
   */
  public playAttack(weaponName: string, isHit: boolean) {
    const name = weaponName.toLowerCase();

    // Find matching attack sound (exact match or word inclusion)
    let attackPath = '';
    for (const [key, path] of Object.entries(sounds.attacks)) {
      if (name.includes(key)) {
        attackPath = path;
        break;
      }
    }

    // Fallback if no matching attack sound is found
    if (!attackPath) {
      attackPath = sounds.attacks.sword;
    }

    // Play attack sound
    this.playPath(attackPath);

    // If it's a miss, we play the miss sound. We can play it simultaneously or slightly offset
    if (!isHit) {
      setTimeout(() => {
        this.playPath(sounds.miss);
      }, 80); // Small offset so attack sound and miss sound mix naturally
    }
  }

  /**
   * Play the hit/damage sound for a given race.
   */
  public playHit(raceName: string) {
    const race = raceName.toLowerCase();
    const hitOptions = sounds.hits[race] || sounds.hits.human;

    if (hitOptions && hitOptions.length > 0) {
      // Pick a random hit variation
      const randomIndex = Math.floor(Math.random() * hitOptions.length);
      const path = hitOptions[randomIndex];
      this.playPath(path);
    }
  }

  /**
   * Play the death sound for a given race.
   */
  public playDie(raceName: string) {
    const race = raceName.toLowerCase();
    const path = sounds.die[race] || sounds.die.human;
    if (path) {
      this.playPath(path);
    }
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
