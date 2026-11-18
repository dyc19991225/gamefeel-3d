/**
 * AudioForge — 100% Zero-Asset Procedural WebAudio Synthesizer for 3D Games.
 * Synthesizes punchy FPS firearms, forged Tamahagane katana deflects, perilous chimes,
 * Buddhist bronze deathblow gongs, dual-oscillator RPM engines, tire screeches & N2O jets.
 */
export class AudioForge {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowpassBus: BiquadFilterNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;

  // Continuous racing loop nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private screechGain: GainNode | null = null;

  public unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();

      this.lowpassBus = this.ctx.createBiquadFilter();
      this.lowpassBus.type = 'lowpass';
      this.lowpassBus.frequency.value = 20000;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.65;

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 16;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.14;

      this.lowpassBus.connect(this.masterGain);
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);

      this.noiseBuf = this.makeNoise(2.0);
      this.reverbNode = this.makeMetallicReverb(0.48);
      const revGain = this.ctx.createGain();
      revGain.gain.value = 0.2;
      this.reverbNode.connect(revGain);
      revGain.connect(this.lowpassBus);

      this.initRacingLoop();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.65, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Muffle master bus during bullet-time / witch-time */
  public setBulletTimeMuffle(amount01: number): void {
    if (!this.lowpassBus || !this.ctx) return;
    const cutoff = 20000 * Math.pow(0.035, Math.max(0, Math.min(1, amount01)));
    this.lowpassBus.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.03);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeMetallicReverb(seconds: number): ConvolverNode {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, 2.9);
        const early = i < ctx.sampleRate * 0.04 && i % 180 < 10 ? 1.4 : 1.0;
        d[i] = (Math.random() * 2 - 1) * env * early;
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  private initRacingLoop(): void {
    if (!this.ctx || !this.lowpassBus || !this.noiseBuf) return;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 380;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 65;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 130;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.lowpassBus);
    this.engineOsc1.start();
    this.engineOsc2.start();

    const screechSrc = this.ctx.createBufferSource();
    screechSrc.buffer = this.noiseBuf;
    screechSrc.loop = true;

    const sf = this.ctx.createBiquadFilter();
    sf.type = 'bandpass';
    sf.frequency.value = 1950;
    sf.Q.value = 4.2;

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;

    screechSrc.connect(sf);
    sf.connect(this.screechGain);
    this.screechGain.connect(this.lowpassBus);
    screechSrc.start();
  }

  public stopContinuous(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain?.gain.setTargetAtTime(0, t, 0.03);
    this.screechGain?.gain.setTargetAtTime(0, t, 0.03);
    this.setBulletTimeMuffle(0);
  }

  public updateEngine(active: boolean, speedKmh: number, drifting: boolean, boostTier = 0): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (!active) {
      this.engineGain?.gain.setTargetAtTime(0, t, 0.04);
      this.screechGain?.gain.setTargetAtTime(0, t, 0.04);
      return;
    }
    const norm = Math.min(1, Math.max(0, speedKmh / 310));
    const gear = (speedKmh % 68) / 68;
    const rpmFreq = 56 + norm * 118 + gear * 42 + boostTier * 24;
    this.engineOsc1?.frequency.setTargetAtTime(rpmFreq, t, 0.035);
    this.engineOsc2?.frequency.setTargetAtTime(rpmFreq * 1.98, t, 0.035);
    this.engineFilter?.frequency.setTargetAtTime(340 + norm * 960 + boostTier * 380, t, 0.04);
    this.engineGain?.gain.setTargetAtTime(0.08 + norm * 0.075, t, 0.04);

    const screech = drifting && speedKmh > 55 ? Math.min(0.16, (speedKmh / 220) * 0.14) : 0;
    this.screechGain?.gain.setTargetAtTime(screech, t, 0.035);
  }

  /** Flat boring beep used ONLY when Juice is toggled OFF to demonstrate vibecoded audio */
  public playFlatBeep(freq = 280): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g).connect(this.lowpassBus);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  private noiseBurst(
    dest: AudioNode,
    t: number,
    dur: number,
    freq: number,
    q: number,
    type: BiquadFilterType,
    gain: number
  ): void {
    if (!this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private pitchDrop(
    dest: AudioNode,
    t: number,
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    gain: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  public playGunshot(
    preset: 'rifle' | 'suppressed' | 'sniper' | 'cannon' = 'rifle',
    punchScale = 1
  ): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.value = Math.min(1.4, Math.max(0.2, punchScale));
    out.connect(this.lowpassBus);
    if (preset !== 'suppressed' && this.reverbNode) out.connect(this.reverbNode);

    if (preset === 'rifle') {
      this.noiseBurst(out, t, 0.16, 980, 1.2, 'bandpass', 0.95);
      this.noiseBurst(out, t, 0.055, 2800, 0.8, 'highpass', 0.48);
      this.pitchDrop(out, t, 190, 46, 0.11, 'sawtooth', 0.72);
      this.pitchDrop(out, t + 0.028, 2200, 1400, 0.025, 'triangle', 0.22);
    } else if (preset === 'suppressed') {
      this.noiseBurst(out, t, 0.075, 1950, 2.2, 'bandpass', 0.68);
      this.pitchDrop(out, t, 320, 92, 0.055, 'triangle', 0.52);
      this.pitchDrop(out, t + 0.018, 3400, 2200, 0.022, 'sine', 0.26);
    } else if (preset === 'sniper') {
      this.noiseBurst(out, t, 0.34, 1180, 0.75, 'bandpass', 1.15);
      this.noiseBurst(out, t, 0.09, 3300, 0.9, 'highpass', 0.65);
      this.pitchDrop(out, t, 225, 32, 0.25, 'sawtooth', 0.95);
    } else {
      this.noiseBurst(out, t, 0.52, 620, 0.65, 'lowpass', 1.35);
      this.noiseBurst(out, t, 0.22, 1650, 0.8, 'bandpass', 0.95);
      this.pitchDrop(out, t, 145, 24, 0.38, 'sawtooth', 1.15);
      this.pitchDrop(out, t, 88, 22, 0.44, 'sine', 1.0);
    }
  }

  public playBoltCycle(): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    [
      [0.16, 2400],
      [0.28, 1750],
      [0.44, 2080],
      [0.54, 2900],
    ].forEach(([dt, f]) => {
      this.pitchDrop(this.lowpassBus!, t + dt, f, f * 0.65, 0.032, 'triangle', 0.26);
    });
  }

  /** Golden Helmet Headshot Chime ("叮！！") */
  public playHeadshotChime(pitchScale = 1): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    [2340, 3520, 5180].forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * pitchScale, t);
      osc.frequency.exponentialRampToValueAtTime(f * pitchScale * 0.985, t + 0.24);
      g.gain.setValueAtTime(0.34 / (idx * 0.7 + 1), t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26 - idx * 0.04);
      osc.connect(g).connect(this.lowpassBus!);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public playWallImpact(material: 'wood' | 'steel', attenuated = false): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    const mul = attenuated ? 0.58 : 1.0;
    if (material === 'wood') {
      this.noiseBurst(this.lowpassBus, t, 0.09, 720, 1.8, 'bandpass', 0.55 * mul);
      this.pitchDrop(this.lowpassBus, t, 260, 88, 0.075, 'triangle', 0.42 * mul);
    } else {
      this.noiseBurst(this.lowpassBus, t, 0.07, 3200, 3.0, 'bandpass', 0.5 * mul);
      this.pitchDrop(this.lowpassBus, t, 1820, 960, 0.14, 'sine', 0.36 * mul);
    }
  }

  /** Forged Tamahagane Katana Perfect Deflect ("铛！！！") */
  public playKatanaDeflect(perfect = true, comboIndex = 0, harmonicBase = 1): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    const semi = Math.pow(2, ((comboIndex % 7) * 0.65) / 12) * harmonicBase;

    if (!perfect) {
      [540, 860, 1420].forEach((f, i) => {
        this.pitchDrop(this.lowpassBus!, t, f * semi, f * 0.88 * semi, 0.12, 'triangle', 0.24 / (i + 1));
      });
      return;
    }

    const freqs = [1185, 1890, 2740, 4120, 5680];
    const gains = [0.4, 0.34, 0.28, 0.17, 0.11];
    const decays = [0.36, 0.44, 0.28, 0.22, 0.15];
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * semi * 1.03, t);
      osc.frequency.exponentialRampToValueAtTime(f * semi, t + 0.025);
      g.gain.setValueAtTime(gains[idx], t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + decays[idx]);
      osc.connect(g).connect(this.lowpassBus!);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.start(t);
      osc.stop(t + decays[idx] + 0.02);
    });

    this.noiseBurst(this.lowpassBus, t, 0.068, 3900 * semi, 3.2, 'bandpass', 0.6);
    this.pitchDrop(this.lowpassBus, t, 168, 46, 0.095, 'sine', 0.45);
  }

  public playBladeSlash(heavy = false, eerie = false): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const dur = heavy ? 0.25 : 0.15;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(heavy ? 600 : 980, t);
    f.frequency.exponentialRampToValueAtTime(heavy ? 2200 : 2900, t + dur * 0.45);
    f.frequency.exponentialRampToValueAtTime(420, t + dur);
    f.Q.value = eerie ? 4.0 : 2.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(heavy ? 0.42 : 0.28, t + 0.028);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.lowpassBus);
    src.start(t);
    src.stop(t + dur + 0.02);

    if (eerie) {
      this.pitchDrop(this.lowpassBus, t, 220, 88, 0.34, 'sawtooth', 0.2);
    }
  }

  public playHeavyImpact(weight = 1): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    this.pitchDrop(this.lowpassBus, t, 195, 36, 0.18 * weight, 'sawtooth', 0.45);
    this.pitchDrop(this.lowpassBus, t, 120, 28, 0.24 * weight, 'sine', 0.58);
    this.noiseBurst(this.lowpassBus, t, 0.12, 1450, 1.4, 'lowpass', 0.42);
  }

  public playPerilousKanji(): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    [740, 1085, 1520].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = i === 1 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(f * 0.94, t);
      osc.frequency.linearRampToValueAtTime(f * 1.06, t + 0.11);
      osc.frequency.exponentialRampToValueAtTime(f * 0.98, t + 0.42);
      g.gain.setValueAtTime(i === 1 ? 0.16 : 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.44);
      osc.connect(g).connect(this.lowpassBus!);
      osc.start(t);
      osc.stop(t + 0.46);
    });
    this.pitchDrop(this.lowpassBus, t, 130, 38, 0.28, 'sine', 0.42);
  }

  public playMikiriStomp(): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    this.pitchDrop(this.lowpassBus, t, 155, 32, 0.36, 'sine', 0.68);
    [920, 1640, 2980].forEach((f) => {
      this.pitchDrop(this.lowpassBus!, t + 0.02, f, f * 0.96, 0.48, 'triangle', 0.28);
    });
  }

  public playDeathblowGong(): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    this.playHeavyImpact(1.2);
    [112, 224, 342, 518, 785].forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + 0.05);
      g.gain.setValueAtTime(0.36 / (idx * 0.65 + 1), t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.85);
      osc.connect(g).connect(this.lowpassBus!);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.start(t + 0.05);
      osc.stop(t + 1.9);
    });
  }

  public playNitroBoost(tier: 'mini' | 'nitro' | 'cww' = 'nitro'): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    if (tier === 'mini') {
      this.pitchDrop(this.lowpassBus, t, 260, 780, 0.22, 'sine', 0.24);
      this.noiseBurst(this.lowpassBus, t, 0.26, 1650, 1.5, 'bandpass', 0.25);
    } else {
      const top = tier === 'cww' ? 1180 : 860;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165, t);
      osc.frequency.exponentialRampToValueAtTime(top, t + 0.34);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.62);
      osc.connect(g).connect(this.lowpassBus);
      osc.start(t);
      osc.stop(t + 0.65);
      this.noiseBurst(this.lowpassBus, t, 0.6, 950, 1.1, 'bandpass', 0.34);
    }
  }

  public playExplosion(scale = 1): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.lowpassBus, t, 0.72 * scale, 380, 0.7, 'lowpass', 1.1);
    this.noiseBurst(this.lowpassBus, t, 0.28, 1350, 1.0, 'bandpass', 0.65);
    this.pitchDrop(this.lowpassBus, t, 135, 22, 0.55 * scale, 'sine', 0.95);
  }

  public playTimeWarp(enter: boolean): void {
    this.unlock();
    if (!this.ctx || !this.lowpassBus) return;
    const t = this.ctx.currentTime;
    this.pitchDrop(
      this.lowpassBus,
      t,
      enter ? 520 : 120,
      enter ? 68 : 640,
      0.38,
      'sine',
      0.36
    );
  }
}
