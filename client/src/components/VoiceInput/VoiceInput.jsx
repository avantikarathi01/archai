import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, AlertCircle, Volume2, CheckCircle2 } from 'lucide-react';

export default function VoiceInput({
  onTranscript,
  disabled = false,
  className = ''
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'info' | 'error' | 'success', text: string }
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // 'en-IN' provides excellent recognition for Indian English, Hinglish terms (bhk, gaadi, makan, pooja)
      recognition.lang = navigator.language?.startsWith('hi') ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage({ type: 'info', text: 'Listening... Speak your house requirements now.' });
        setRecordingSeconds(0);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((sec) => sec + 1);
        }, 1000);
      };

      recognition.onresult = (event) => {
        let finalSegment = '';
        let interimSegment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalSegment += item[0].transcript;
          } else {
            interimSegment += item[0].transcript;
          }
        }

        setInterimText(interimSegment);

        if (finalSegment.trim()) {
          onTranscript(finalSegment.trim());
          setStatusMessage({ type: 'success', text: 'Speech transcribed. Review or edit above before generating.' });
        }
      };

      recognition.onerror = (event) => {
        clearInterval(timerRef.current);
        setIsListening(false);
        setInterimText('');

        let msg = 'Voice recognition error occurred.';
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser settings to use voice input.';
        } else if (event.error === 'no-speech') {
          msg = 'No speech detected. Please click the mic and try speaking again.';
        } else if (event.error === 'audio-capture') {
          msg = 'No microphone device was detected. Please check your audio input device.';
        } else if (event.error === 'network') {
          msg = 'Network connection error during voice recognition.';
        }
        setStatusMessage({ type: 'error', text: msg });
      };

      recognition.onend = () => {
        clearInterval(timerRef.current);
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('SpeechRecognition initialization error:', err);
      setIsSupported(false);
    }

    return () => {
      clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort errors
        }
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!isSupported) {
      setStatusMessage({
        type: 'error',
        text: 'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'
      });
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.warn('Error stopping recognition:', err);
      }
      clearInterval(timerRef.current);
      setIsListening(false);
      setInterimText('');
    } else {
      setStatusMessage(null);
      setInterimText('');
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn('Error starting recognition:', err);
        // If recognition is already in progress, try stopping and restarting
        try {
          recognitionRef.current?.stop();
          setTimeout(() => recognitionRef.current?.start(), 150);
        } catch (e) {
          setStatusMessage({ type: 'error', text: 'Could not access microphone. Please try again.' });
        }
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`voice-input-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          className={`voice-mic-btn ${isListening ? 'listening' : ''}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: isListening ? '1px solid #ef4444' : '1px solid var(--border-color)',
            background: isListening
              ? 'rgba(239, 68, 68, 0.18)'
              : 'rgba(255, 255, 255, 0.05)',
            color: isListening ? '#fca5a5' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            boxShadow: isListening ? '0 0 14px rgba(239, 68, 68, 0.4)' : 'none'
          }}
          title={
            !isSupported
              ? 'Voice recognition not supported in this browser'
              : isListening
              ? 'Click to stop voice recording'
              : 'Speak your requirement (Voice Input)'
          }
        >
          {isListening ? (
            <>
              <Square size={14} fill="#ef4444" color="#ef4444" />
              <span>Stop Recording ({formatTime(recordingSeconds)})</span>
              <span className="pulse-recording-dot"></span>
            </>
          ) : (
            <>
              <Mic size={15} color={isSupported ? '#38bdf8' : '#94a3b8'} />
              <span>{isSupported ? 'Voice Input' : 'Voice (Unsupported)'}</span>
            </>
          )}
        </button>

        {isListening && (
          <span style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Volume2 size={14} className="voice-wave-anim" />
            Listening in Hindi/English...
          </span>
        )}
      </div>

      {/* Interim live speech preview */}
      {isListening && interimText && (
        <div style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '6px',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px dashed rgba(56, 189, 248, 0.3)',
          fontSize: '0.8rem',
          color: '#93c5fd',
          fontStyle: 'italic'
        }}>
          Hearing: "{interimText}..."
        </div>
      )}

      {/* Status or Error Notifications */}
      {statusMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            background:
              statusMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.12)'
                : statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(56, 189, 248, 0.1)',
            border:
              statusMessage.type === 'error'
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : statusMessage.type === 'success'
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : '1px solid rgba(56, 189, 248, 0.3)',
            color:
              statusMessage.type === 'error'
                ? '#fca5a5'
                : statusMessage.type === 'success'
                ? '#6ee7b7'
                : '#7dd3fc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {statusMessage.type === 'error' ? (
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
            ) : statusMessage.type === 'success' ? (
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            ) : (
              <Mic size={14} style={{ flexShrink: 0 }} />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.9rem',
              padding: '0 0.2rem',
              lineHeight: 1
            }}
            title="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
