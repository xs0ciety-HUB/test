/**
 * AUDIO PLAYBACK ENHANCEMENT v3
 * Fixes: Music stops mid-play, better buffering, recovery
 * 
 * Include this AFTER the HTML <audio> tag at the bottom of index.html:
 * <script src="/audio-playback-enhanced.js"></script>
 */

(function() {
  const audio = document.getElementById("audioEngine");
  if (!audio) {


    return;
  }

  // Global state for recovery
  const playbackState = {
    currentTrack: null,
    currentIndex: -1,
    lastStreamUrl: null,
    bufferFailures: 0,
    maxBufferFailures: 3,
    lastPlayAttempt: 0,
    playbackAttempts: 0,
    maxPlaybackAttempts: 3,
  };

  /**
   * Enhanced PLAY with recovery
   */
  const originalPlay = audio.play.bind(audio);
  audio.play = async function() {
    try {
      playbackState.playbackAttempts++;
      
      if (playbackState.playbackAttempts > playbackState.maxPlaybackAttempts) {


        toast?.("Tidak bisa putar. Coba lagu lain.");
        return Promise.reject(new Error("Max playback attempts"));
      }


      // Validate src exists
      if (!this.src) {
        throw new Error("No audio source set");
      }

      // Reset buffer failures on new play
      playbackState.bufferFailures = 0;

      const result = await originalPlay.call(this);


      return result;
    } catch (err) {


      throw err;
    }
  };

  /**
   * TIMEUPDATE - Monitor buffering and detect freezes
   */
  audio.addEventListener("timeupdate", () => {
    try {
      // Check if stuck (currentTime not changing = freeze)
      const now = performance.now();
      const timeDelta = audio.currentTime - (playbackState.lastKnownTime || 0);
      const timeSinceLast = now - (playbackState.lastTimeUpdate || 0);

      // Jika jarak waktu > 1 detik tapi currentTime ga berubah = freeze
      if (timeSinceLast > 1000 && Math.abs(timeDelta) < 0.01 && !audio.paused && audio.currentTime > 0) {


        playbackState.bufferFailures++;
        
        if (playbackState.bufferFailures >= playbackState.maxBufferFailures) {
          // Too many freezes, refresh stream


          if (typeof refreshCurrentTrack === "function") {
            refreshCurrentTrack();
          }
          playbackState.bufferFailures = 0;
          return;
        }

        // Try to recover by pausing/playing


        audio.pause();
        setTimeout(() => {
          if (playbackState.currentTrack) {
            audio.play().catch(err => console.error("[AudioPlayback] Recovery play failed:", err));
          }
        }, 300);
        return;
      }

      playbackState.lastKnownTime = audio.currentTime;
      playbackState.lastTimeUpdate = now;
    } catch (err) {


    }
  });

  /**
   * PLAYING - Track actual playback start
   */
  audio.addEventListener("playing", () => {


    playbackState.bufferFailures = 0;
    playbackState.playbackAttempts = 0;
  });

  /**
   * PAUSE - Log pause (check if unexpected)
   */
  audio.addEventListener("pause", () => {
    // Only log unexpected pauses
    if (!audio.paused && audio.currentTime > 0) {


    }
  });

  /**
   * WAITING - Buffering started
   */
  audio.addEventListener("waiting", () => {


    // Show loading indicator if available
    if (typeof updatePlaybackStatus === "function") {
      updatePlaybackStatus("buffering");
    }
  });

  /**
   * CANPLAY - Buffered enough to play
   */
  audio.addEventListener("canplay", () => {


    if (typeof updatePlaybackStatus === "function") {
      updatePlaybackStatus("playing");
    }
  });

  /**
   * STALLED - Network timeout during buffering
   */
  audio.addEventListener("stalled", () => {


    // Retry after delay
    setTimeout(() => {
      if (!audio.paused && audio.currentTime > 0) {


        const pos = audio.currentTime;
        audio.pause();
        audio.currentTime = pos; // Trigger new fetch
        audio.play().catch(err => console.error("[AudioPlayback] Stall recovery failed:", err));
      }
    }, 800);
  });

  /**
   * SUSPEND - Download suspended (usually network)
   */
  audio.addEventListener("suspend", () => {


    // Network issue, try recovery later
    setTimeout(() => {
      if (!audio.paused && audio.currentTime > 0) {


        audio.play().catch(err => console.error("[AudioPlayback] Resume failed:", err));
      }
    }, 1000);
  });

  /**
   * DURATIONCHANGE - Detect actual duration updates
   */
  audio.addEventListener("durationchange", () => {
    if (audio.duration && isFinite(audio.duration)) {


    }
  });

  /**
   * LOADSTART - Download started
   */
  audio.addEventListener("loadstart", () => {


  });

  /**
   * PROGRESS - Download progress
   */
  audio.addEventListener("progress", () => {
    if (audio.buffered && audio.buffered.length > 0) {
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const duration = audio.duration || 1;
      const percentBuffered = (bufferedEnd / duration) * 100;
      
      // Log if significant buffering
      if (Math.round(percentBuffered) % 25 === 0) {


      }
    }
  });

  /**
   * ABORT - Download aborted
   */
  audio.addEventListener("abort", () => {


  });

  /**
   * EMPTIED - Audio element emptied (usually on src change)
   */
  audio.addEventListener("emptied", () => {


    playbackState.bufferFailures = 0;
  });

  /**
   * ERROR - Critical error handler
   */
  audio.addEventListener("error", async (e) => {
    const error = audio.error;
    let errorMsg = "Unknown error";

    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMsg = "Playback aborted";
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMsg = "Network error";
          break;
        case error.MEDIA_ERR_DECODE:
          errorMsg = "Decode error";
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Source not supported";
          break;
      }
    }


    // Recovery logic - delegate to main playback handler
    if (typeof handleAudioError === "function") {
      await handleAudioError(errorMsg, error?.code);
    } else {
      toast?.(`Stream error: ${errorMsg}`);
    }
  });

  /**
   * ENDED - Track finished
   */
  audio.addEventListener("ended", () => {


    playbackState.bufferFailures = 0;
    
    // Let main handler manage next track
    if (typeof handleTrackEnded === "function") {
      handleTrackEnded();
    }
  });

  /**
   * Public API
   */
  window.AudioPlaybackEnhanced = {
    getState: () => ({ ...playbackState }),
    resetBufferFailures: () => { playbackState.bufferFailures = 0; },
    resetPlaybackAttempts: () => { playbackState.playbackAttempts = 0; },
    getBufferStatus: () => {
      if (!audio.buffered || audio.buffered.length === 0) {
        return { bufferedSeconds: 0, totalSeconds: audio.duration || 0, percent: 0 };
      }
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const duration = audio.duration || 1;
      return {
        bufferedSeconds: bufferedEnd,
        totalSeconds: duration,
        percent: (bufferedEnd / duration) * 100
      };
    },
    getPlaybackStats: () => ({
      currentTime: audio.currentTime,
      duration: audio.duration,
      buffered: audio.buffered?.length || 0,
      paused: audio.paused,
      ended: audio.ended,
      error: audio.error?.code || null,
      networkState: audio.networkState, // 0=empty, 1=idle, 2=loading, 3=no source
      readyState: audio.readyState, // 0=nothing, 1=metadata, 2=current, 3=future, 4=enough
    })
  };


})();

/**
 * HELPER FUNCTIONS - Add these to your main HTML script section
 * These are stubs that should be implemented in your main code
 */

// Called when audio error occurs
async function handleAudioError(errorMsg, errorCode) {


  // TODO: Implement in main index.html
  // Should attempt recovery or skip to next track
}

// Called when track ends normally
function handleTrackEnded() {


  // TODO: Implement in main index.html - call playNext() or handle repeat
}

// Called to refresh current track stream (recovery)
function refreshCurrentTrack() {


  // TODO: Implement in main index.html - re-call playTrack(state.currentIndex)
}

// Update playback status UI (buffering, playing, etc)
function updatePlaybackStatus(status) {
  // status: "buffering", "playing", "loading", etc


  // TODO: Implement in main index.html - update UI accordingly
}
