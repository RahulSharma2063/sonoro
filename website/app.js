// JavaScript controller for Sonoro Music Landing Page & Interactive Synthesizer

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // UI Elements
    // ----------------------------------------------------
    const mockPlayBtn = document.getElementById("mock-play-pause");
    const mockPrevBtn = document.getElementById("mock-prev");
    const mockNextBtn = document.getElementById("mock-next");
    const mockShuffleBtn = document.getElementById("mock-shuffle");
    const mockRepeatBtn = document.getElementById("mock-repeat");
    const mockTitle = document.getElementById("mock-title");
    const mockArtist = document.getElementById("mock-artist");
    const mockPulse = document.getElementById("mock-pulse");
    const mockProgressFill = document.getElementById("mock-progress-fill");
    const mockProgressContainer = document.getElementById("mock-progress-container");
    const mockTimeCurrent = document.getElementById("mock-time-current");
    const mockTimeDuration = document.getElementById("mock-time-duration");
    const albumArt = document.querySelector(".mock-album-art");
    const canvas = document.getElementById("visualizer-canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    // Set canvas resolution
    if (canvas) {
        canvas.width = 160;
        canvas.height = 160;
    }

    // ----------------------------------------------------
    // Synthesizer Tracks Database
    // ----------------------------------------------------
    const tracks = [
        {
            title: "Neon Horizon",
            artist: "Synthwave Loop",
            bpm: 115,
            duration: 90, // 90 seconds
            // Pentatonic minor in A
            bassPattern: [55.00, 55.00, 65.41, 65.41, 73.42, 73.42, 87.31, 98.00], // A1, C2, D2, F2, G2
            leadPattern: [
                440.00, 523.25, 587.33, 659.25, 783.99, // A4, C5, D5, E5, G5
                659.25, 587.33, 523.25, 440.00, 0,
                523.25, 587.33, 783.99, 880.00, 783.99, 0
            ]
        },
        {
            title: "Midnight Groove",
            artist: "Chill Lo-Fi",
            bpm: 90,
            duration: 120, // 120 seconds
            // Pentatonic minor in D
            bassPattern: [73.42, 73.42, 87.31, 87.31, 98.00, 98.00, 116.54, 116.54], // D2, F2, G2, A#2
            leadPattern: [
                293.66, 349.23, 392.00, 440.00, 523.25, // D4, F4, G4, A4, C5
                440.00, 392.00, 0, 349.23, 293.66,
                392.00, 440.00, 523.25, 587.33, 0, 0
            ]
        },
        {
            title: "Starlight Voyage",
            artist: "Neo-Classical",
            bpm: 130,
            duration: 80, // 80 seconds
            // Pentatonic major in C
            bassPattern: [65.41, 65.41, 73.42, 73.42, 82.41, 82.41, 98.00, 98.00], // C2, D2, E2, G2
            leadPattern: [
                523.25, 587.33, 659.25, 783.99, 880.00, // C5, D5, E5, G5, A5
                987.77, 880.00, 783.99, 659.25, 0,
                587.33, 523.25, 659.25, 783.99, 880.00, 0
            ]
        }
    ];

    // ----------------------------------------------------
    // Playback State Variables
    // ----------------------------------------------------
    let currentTrackIndex = 0;
    let isPlaying = false;
    let shuffleActive = false;
    let repeatActive = false;
    let playTime = 0; // current time in seconds
    
    // Audio API nodes
    let audioCtx = null;
    let analyser = null;
    let delayNode = null;
    let delayFeedback = null;
    let masterGain = null;

    // Sequencer Clock Variables
    let lastScheduledTime = 0;
    let nextStepTime = 0;
    let stepIndex = 0;
    const lookahead = 100.0; // ms
    const scheduleAheadTime = 150.0; // ms
    let sequencerTimer = null;
    let timeUpdateTimer = null;

    // ----------------------------------------------------
    // Initialization of Audio Engine
    // ----------------------------------------------------
    function initAudio() {
        if (audioCtx) return;

        // Create audio context (compatible with older browsers)
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        // Create nodes
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // Low FFT size for simple visualizer bars
        
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.25; // Keep it pleasant and soft

        // Create a premium sounding stereo echo delay node
        delayNode = audioCtx.createDelay(1.0);
        delayFeedback = audioCtx.createGain();
        
        delayNode.delayTime.value = 0.35; // 350ms delay
        delayFeedback.gain.value = 0.45; // 45% feedback

        // Feedback loop
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);

        // Routing: Synth -> Delay -> MasterGain -> Analyser -> Output
        // (Synth will connect to dry masterGain and wet delayNode)
        delayNode.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    // ----------------------------------------------------
    // Sound Generators (Synthesizer Voices)
    // ----------------------------------------------------
    function playKick(time) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(masterGain);

        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.12);

        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

        osc.start(time);
        osc.stop(time + 0.13);
    }

    function playHihat(time) {
        if (!audioCtx) return;
        
        // Synthesize hi-hat using a short buffer of noise
        const bufferSize = audioCtx.sampleRate * 0.04; // 40ms buffer
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 7000;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        source.start(time);
        source.stop(time + 0.04);
    }

    function playBass(freq, time, duration) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const lowpass = audioCtx.createBiquadFilter();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);

        // Lowpass filter sweep
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(250, time);
        lowpass.frequency.exponentialRampToValueAtTime(80, time + duration);

        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.02);
        gain.gain.setValueAtTime(0.6, time + duration - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + duration + 0.05);
    }

    function playLead(freq, time, duration) {
        if (!audioCtx || freq <= 0) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);

        // Add slow subtle pitch vibrato (lfo)
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 5.5; // 5.5 Hz
        lfoGain.gain.value = 4.0;  // 4Hz vibrato depth
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        // Soft ADSR envelope to make it smooth
        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + 0.04);
        gain.gain.setValueAtTime(0.12, time + duration - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Routing dry & wet
        osc.connect(gain);
        gain.connect(masterGain); // Dry
        gain.connect(delayNode);  // Wet

        lfo.start(time);
        osc.start(time);
        lfo.stop(time + duration + 0.05);
        osc.stop(time + duration + 0.05);
    }

    // ----------------------------------------------------
    // Sequencer Clock & Scheduling
    // ----------------------------------------------------
    function scheduleStep(step, time) {
        const track = tracks[currentTrackIndex];
        const stepSeconds = 60.0 / track.bpm / 4.0; // 16th note step length

        // 1. Play Kick on 1, 5, 9, 13 (quarter notes)
        if (step % 4 === 0) {
            playKick(time);
        }

        // 2. Play Hi-hat on off-beats (8th notes off-beats)
        if (step % 4 === 2) {
            playHihat(time);
        }

        // 3. Play Bassline
        const bassIndex = Math.floor(step / 2) % track.bassPattern.length;
        const bassFreq = track.bassPattern[bassIndex];
        if (step % 2 === 0) {
            playBass(bassFreq, time, stepSeconds * 1.8);
        }

        // 4. Play Lead Melody
        const melodyIndex = step % track.leadPattern.length;
        const melodyFreq = track.leadPattern[melodyIndex];
        if (melodyFreq > 0) {
            // Rest index randomly if shuffle is on
            if (shuffleActive && Math.random() > 0.7) {
                const randomFreq = track.leadPattern[Math.floor(Math.random() * track.leadPattern.length)];
                playLead(randomFreq, time, stepSeconds * 0.9);
            } else {
                playLead(melodyFreq, time, stepSeconds * 0.9);
            }
        }
    }

    // Sequencer scheduler loop
    function scheduler() {
        if (!audioCtx) return;
        while (nextStepTime < audioCtx.currentTime + scheduleAheadTime / 1000.0) {
            scheduleStep(stepIndex, nextStepTime);
            
            // Advance clock
            const track = tracks[currentTrackIndex];
            const stepSeconds = 60.0 / track.bpm / 4.0; // 16th note length
            nextStepTime += stepSeconds;

            stepIndex = (stepIndex + 1) % 16;
        }
        sequencerTimer = setTimeout(scheduler, lookahead);
    }

    // ----------------------------------------------------
    // Playback Control Actions
    // ----------------------------------------------------
    function play() {
        initAudio();
        
        // Resume AudioContext if suspended (browser autoplay security)
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }

        isPlaying = true;
        nextStepTime = audioCtx.currentTime + 0.05;
        stepIndex = 0;
        scheduler();

        // Update UI
        if (mockPlayBtn) {
            mockPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
        if (mockPulse) {
            mockPulse.style.animationPlayState = "running";
        }
        if (albumArt) {
            albumArt.classList.add("playing");
        }

        // Start time updates
        startTimeUpdates();
        
        // Start visualizer animation
        drawVisualizer();
    }

    function pause() {
        isPlaying = false;
        clearTimeout(sequencerTimer);
        stopTimeUpdates();

        // Update UI
        if (mockPlayBtn) {
            mockPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        if (mockPulse) {
            mockPulse.style.animationPlayState = "paused";
        }
        if (albumArt) {
            albumArt.classList.remove("playing");
        }
    }

    function togglePlay() {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }

    function loadTrack(index) {
        currentTrackIndex = index;
        const track = tracks[currentTrackIndex];
        
        // Update labels
        if (mockTitle) mockTitle.innerText = track.title;
        if (mockArtist) mockArtist.innerText = track.artist;

        // Reset positions
        playTime = 0;
        stepIndex = 0;
        updateProgressBar();

        if (isPlaying) {
            // Restart sequencer with new BPM
            clearTimeout(sequencerTimer);
            nextStepTime = audioCtx.currentTime + 0.05;
            scheduler();
        }
    }

    function nextTrack() {
        if (shuffleActive) {
            loadTrack(Math.floor(Math.random() * tracks.length));
        } else {
            loadTrack((currentTrackIndex + 1) % tracks.length);
        }
    }

    function prevTrack() {
        let index = currentTrackIndex - 1;
        if (index < 0) index = tracks.length - 1;
        loadTrack(index);
    }

    // ----------------------------------------------------
    // Seekbar & Time Updates
    // ----------------------------------------------------
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    function updateProgressBar() {
        const track = tracks[currentTrackIndex];
        const percent = (playTime / track.duration) * 100;
        
        if (mockProgressFill) {
            mockProgressFill.style.width = `${percent}%`;
        }
        if (mockTimeCurrent) {
            mockTimeCurrent.innerText = formatTime(playTime);
        }
        if (mockTimeDuration) {
            mockTimeDuration.innerText = formatTime(track.duration);
        }
    }

    function startTimeUpdates() {
        // Clear any existing updates
        stopTimeUpdates();
        timeUpdateTimer = setInterval(() => {
            const track = tracks[currentTrackIndex];
            playTime += 0.5; // Tick every half second

            if (playTime >= track.duration) {
                if (repeatActive) {
                    playTime = 0;
                } else {
                    nextTrack();
                }
            }
            updateProgressBar();
        }, 500);
    }

    function stopTimeUpdates() {
        clearInterval(timeUpdateTimer);
    }

    // Seek handler
    if (mockProgressContainer) {
        mockProgressContainer.addEventListener("click", (e) => {
            const track = tracks[currentTrackIndex];
            const rect = mockProgressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            
            // Calculate new playTime
            let clickPercent = clickX / width;
            if (clickPercent < 0) clickPercent = 0;
            if (clickPercent > 1) clickPercent = 1;

            playTime = clickPercent * track.duration;
            updateProgressBar();

            if (isPlaying && audioCtx) {
                // Instantly sync next step to prevent delay
                nextStepTime = audioCtx.currentTime + 0.05;
                stepIndex = Math.floor(clickPercent * 16) % 16;
            }
        });
    }

    // ----------------------------------------------------
    // Controls Event Listeners
    // ----------------------------------------------------
    if (mockPlayBtn) {
        mockPlayBtn.addEventListener("click", togglePlay);
    }
    if (mockPrevBtn) {
        mockPrevBtn.addEventListener("click", prevTrack);
    }
    if (mockNextBtn) {
        mockNextBtn.addEventListener("click", nextTrack);
    }

    if (mockShuffleBtn) {
        mockShuffleBtn.addEventListener("click", () => {
            shuffleActive = !shuffleActive;
            mockShuffleBtn.classList.toggle("active-btn", shuffleActive);
        });
    }

    if (mockRepeatBtn) {
        mockRepeatBtn.addEventListener("click", () => {
            repeatActive = !repeatActive;
            mockRepeatBtn.classList.toggle("active-btn", repeatActive);
        });
    }

    // Set initial track labels
    loadTrack(0);

    // ----------------------------------------------------
    // Live Canvas Audio Visualizer
    // ----------------------------------------------------
    function drawVisualizer() {
        if (!isPlaying || !ctx || !analyser) {
            // Draw default static state if paused
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

        requestAnimationFrame(drawVisualizer);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center visualizer coordinates
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 45;

        // Draw outer glowing neon bars (Radial Equalizer)
        const barsCount = 36;
        for (let i = 0; i < barsCount; i++) {
            const angle = (i * 2 * Math.PI) / barsCount;
            // Get frequency value
            const dataIndex = Math.floor((i / barsCount) * bufferLength);
            const value = dataArray[dataIndex] || 0;
            const barLength = (value / 255) * 35; // Maximum length of 35px

            const startX = centerX + Math.cos(angle) * radius;
            const startY = centerY + Math.sin(angle) * radius;
            const endX = centerX + Math.cos(angle) * (radius + barLength);
            const endY = centerY + Math.sin(angle) * (radius + barLength);

            // Create gradient for bars (fade from purple to magenta)
            const grad = ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, "#8b5cf6");
            grad.addColorStop(1, "#d946ef");

            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Draw inner glowing base circle
        ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, 0, 2 * Math.PI);
        ctx.stroke();
    }

    console.log("Sonoro Music Landing Page & Synthesizer Initialized.");
});
