import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import posthog from 'posthog-js';
import '@fontsource-variable/fraunces';
import { createMeadow } from './meadow.js';
import './style.css';

posthog.init('phc_wsGQcJooNaaf5wrBPQQ5v9CAhuQ64y9RNEgtX6XR3noW', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-05-30',
});

function Icon({ name, ...props }) {
  const paths = {
    grass: 'M12 22C12 13 14 5 19 2M12 22C11 13 7 9 3 8M12 22C14 15 18 12 22 12M12 22C12 12 10 5 7 3',
    sound: 'M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    mute: 'M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6',
    wind: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3',
    pause: 'M8 5v14M16 5v14',
    play: 'm8 5 11 7-11 7V5Z',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}

function Hand({ cursorRef }) {
  return <div ref={cursorRef} className="hand" aria-hidden="true"><svg viewBox="0 0 100 130" fill="none">
    <defs><linearGradient id="skin" x1="15" y1="20" x2="90" y2="110" gradientUnits="userSpaceOnUse"><stop stopColor="#ffedca"/><stop offset="1" stopColor="#d6a172"/></linearGradient></defs>
    <path d="M35 123c-1-14-8-24-16-35L5 67c-6-10 3-17 10-10l16 17-9-49c-2-11 11-14 14-3l8 34-2-44c0-12 13-13 14-1l3 43 6-37c2-11 14-8 12 3l-4 39 9-24c4-10 15-5 11 5L82 80c-3 13-12 27-10 43" fill="url(#skin)" stroke="#ae805c" strokeWidth="1.3"/>
    <path d="M33 77c11-3 23 4 24 15M46 69l12 3M65 71l9-1M28 34l8-2M45 27h10M64 33l10 2M80 48l8 3M36 106c9 3 18 4 30 1" stroke="#b78560" strokeOpacity=".55" strokeWidth="1.3" strokeLinecap="round"/>
  </svg></div>;
}

function App() {
  const canvas = useRef(null);
  const cursor = useRef(null);
  const audio = useRef(null);
  const [wind, setWind] = useState(0.65);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const settings = useRef({ wind, paused, sound });
  settings.current = { wind, paused, sound };

  useEffect(() => {
    let dispose;
    try {
      dispose = createMeadow(canvas.current, cursor.current, settings, () => setTouched(true), () => setError(true), (intensity, pan) => {
        if (!audio.current || !settings.current.sound || settings.current.paused) return;
        const { context, rustleGain, rustleFilter, panner } = audio.current;
        const now = context.currentTime;
        rustleGain.gain.cancelScheduledValues(now);
        rustleGain.gain.setTargetAtTime(intensity > 0 ? 0.01 + intensity * 0.025 : 0, now, intensity > 0 ? 0.035 : 0.015);
        rustleGain.gain.setTargetAtTime(0, now + 0.06, 0.045);
        rustleFilter.frequency.setTargetAtTime(650 + intensity * 550, now, 0.05);
        panner.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan)), now, 0.025);
      });
    } catch (cause) {
      console.error('The meadow could not start.', cause);
      setError(true);
    }
    return () => dispose?.();
  }, []);

  useEffect(() => () => { audio.current?.context.close(); }, []);
  useEffect(() => {
    if (!audio.current) return;
    const { context, windGain, rustleGain } = audio.current;
    windGain.gain.setTargetAtTime(sound && !paused ? 0.045 + wind * 0.045 : 0, context.currentTime, 0.4);
    if (!sound || paused) {
      rustleGain.gain.cancelScheduledValues(context.currentTime);
      rustleGain.gain.setTargetAtTime(0, context.currentTime, 0.015);
    }
  }, [sound, wind, paused]);

  async function toggleSound() {
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const rustleBuffer = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
        const rustleData = rustleBuffer.getChannelData(0);
        const windBuffer = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
        const windData = windBuffer.getChannelData(0);
        let value = 0;
        let windValue = 0;
        for (let i = 0; i < rustleData.length; i++) {
          const noise = Math.random() * 2 - 1;
          value = (value + noise * 0.12) / 1.12;
          rustleData[i] = value * 2;
          windValue = (windValue + noise * 0.025) / 1.025;
          windData[i] = windValue * 5;
        }
        const breeze = context.createBufferSource();
        breeze.buffer = windBuffer;
        breeze.loop = true;
        const windFilter = context.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 650;
        const windGain = context.createGain();
        windGain.gain.value = 0;
        breeze.connect(windFilter).connect(windGain).connect(context.destination);
        breeze.start();
        const rustle = context.createBufferSource();
        rustle.buffer = rustleBuffer;
        rustle.loop = true;
        const rustleFilter = context.createBiquadFilter();
        rustleFilter.type = 'lowpass';
        rustleFilter.frequency.value = 650;
        rustleFilter.Q.value = 0.5;
        const rustleGain = context.createGain();
        rustleGain.gain.value = 0;
        const panner = context.createStereoPanner();
        rustle.connect(rustleFilter).connect(rustleGain).connect(panner).connect(context.destination);
        rustle.start();
        audio.current = { context, windGain, rustleGain, rustleFilter, panner };
      }
      await audio.current.context.resume();
      setSound(current => !current);
      setSoundError(false);
    } catch { setSoundError(true); }
  }

  return <main>
    <canvas ref={canvas} className="meadow" tabIndex={error ? -1 : 0} aria-label="Interactive grass field" aria-describedby="instructions" />
    <Hand cursorRef={cursor} />
    <header className="masthead"><a className="wordmark" href="/" aria-label="aipsychosis.rehab home"><Icon name="grass" />aipsychosis.rehab</a><span className="availability"><i />Nothing needs you right now.</span></header>
    <section className="intro" aria-label="Welcome to the meadow">
      <h1>Touch grass.</h1>
      <p>Your agents can wait.</p>
    </section>
    {error && <div className="error" role="alert"><h2>The meadow couldn’t open.</h2><p>This scene needs WebGL 2. Try a browser with hardware acceleration enabled.</p><button onClick={() => window.location.reload()}>Try again</button></div>}
    <footer className="footer">
      <div className="invitation" aria-live="polite"><span className="little-line" /><p>{touched ? 'There you go. Stay a while.' : 'A little less prompting. A little more being.'}</p><span className="little-line" /></div>
      <div className="controls" aria-label="Meadow controls">
        <button className="sound-button" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}><Icon name={sound ? 'sound' : 'mute'} /><span>Sound {sound ? 'on' : 'off'}</span></button>
        <span className="separator" />
        <label className="wind-control"><Icon name="wind" /><span>Breeze</span><input aria-label="Breeze strength" type="range" min="0" max="1.8" step="0.05" value={wind} onChange={event => setWind(Number(event.target.value))} /></label>
        <span className="separator" />
        <button className="pause-button" onClick={() => setPaused(current => !current)} aria-label={paused ? 'Resume meadow' : 'Pause meadow'} aria-pressed={paused} title={paused ? 'Resume meadow' : 'Pause meadow'}><Icon name={paused ? 'play' : 'pause'} /></button>
      </div>
      <p id="instructions" className="instructions">Move to brush. Hold to press. <span>Or focus the field and use arrow keys + space.</span></p>
      {soundError && <p className="sound-error" role="status">Sound couldn’t start. Tap the sound button to try again.</p>}
      <div className="colophon"><span>A small break from the infinite scroll.</span><span>No tokens. No tasks. Just grass.</span></div>
    </footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
