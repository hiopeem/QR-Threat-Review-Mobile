import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  Alert,
  SafeAreaView,
} from 'react-native';
import { CameraView, Camera, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { verifyUrl } from '../services/api';

// ── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 3000;
const DIM = 'rgba(0,0,0,0.55)';
const FINDER_SIZE = 256;

const VERDICT_CFG = {
  Safe: {
    pillColor: '#15803d',
    label: 'SAFE',
    message: 'This URL appears safe to visit.',
  },
  Malicious: {
    pillColor: '#b91c1c',
    label: 'MALICIOUS',
    message: 'Warning: this URL has been flagged as malicious!',
  },
  Error: {
    pillColor: '#6b7280',
    label: 'ERROR',
    message: 'Could not verify this URL. Do not open it unless you are certain it is safe.',
  },
};

// ── Main screen ──────────────────────────────────────────────────────────────

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerActive, setScannerActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({
    visible: false,
    url: '',
    verdict: null, // 'Safe' | 'Malicious' | 'Error'
    stats: null,
  });

  // Refs survive re-renders and avoid stale-closure issues with async handlers.
  const processingRef = useRef(false); // true while a network call is in flight
  const lastUrlRef = useRef(null);     // last URL scanned (for debounce)
  const debounceRef = useRef(null);    // debounce timer

  // Core pipeline: called for both camera and gallery paths.
  // Never swallows errors — any exception becomes an 'Error' verdict so the
  // "Open anyway" button is hidden and the user stays safe.
  const processUrl = useCallback(async (url) => {
    if (!url || processingRef.current) return;
    if (lastUrlRef.current === url) return; // debounce duplicate scans

    lastUrlRef.current = url;
    processingRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastUrlRef.current = null;
    }, DEBOUNCE_MS);

    setScannerActive(false);
    setLoading(true);

    let verdict = 'Error';
    let stats = null;

    try {
      const data = await verifyUrl(url);
      // Guard against malformed/unexpected responses. Any verdict that is not
      // exactly 'Safe' or 'Malicious' (the only two the backend can persist) is
      // treated as Error so "Open anyway" stays hidden — fail-safe, not fail-open.
      verdict =
        data.verdict === 'Safe' || data.verdict === 'Malicious'
          ? data.verdict
          : 'Error';
      stats = data.stats ?? null;
    } catch {
      // Network failure, timeout, 5xx, etc. → Error verdict.
      // NEVER default to 'Safe' here.
      verdict = 'Error';
    }

    processingRef.current = false;
    setLoading(false);
    setModal({ visible: true, url, verdict, stats });
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      processUrl(data);
    },
    [processUrl],
  );

  const handleGallery = useCallback(async () => {
    if (processingRef.current) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo library access to scan QR codes from images.',
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (picked.canceled || !picked.assets?.length) return;

    try {
      const barcodes = await Camera.scanFromURLAsync(picked.assets[0].uri, ['qr']);
      if (!barcodes?.length) {
        Alert.alert('No QR code found', 'This image does not contain a readable QR code.');
        return;
      }
      processUrl(barcodes[0].data);
    } catch {
      Alert.alert('Scan failed', 'Could not read a QR code from this image.');
    }
  }, [processUrl]);

  const handleScanAnother = useCallback(() => {
    setModal({ visible: false, url: '', verdict: null, stats: null });
    lastUrlRef.current = null;
    clearTimeout(debounceRef.current);
    setScannerActive(true);
  }, []);

  // ── Permission states ──────────────────────────────────────────────────────

  if (!permission) {
    // Waiting for OS permission dialog response
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permBody}>
          ScamSite Defender needs camera access to scan QR codes.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const cfg = modal.verdict ? VERDICT_CFG[modal.verdict] : null;
  const isMalicious = modal.verdict === 'Malicious';
  const isError = modal.verdict === 'Error';

  return (
    <View style={styles.container}>
      {/* ── Live camera feed ── */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scannerActive && !loading ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* ── Dimmed overlay with transparent finder window ── */}
      {/*
          Layout (top to bottom):
            topDim     — dims upper area, shows app title
            middleRow  — sideDim | transparent finder | sideDim
            bottomDim  — dims lower area, holds gallery button
      */}
      <View style={styles.overlay}>
        <View style={styles.topDim}>
          <Text style={styles.appTitle}>ScamSite Defender</Text>
          <Text style={styles.appSubtitle}>Point your camera at a QR code</Text>
        </View>

        <View style={styles.middleRow}>
          <View style={styles.sideDim} />
          <View style={styles.finder}>
            <Corner position={{ top: 0, left: 0 }} open="right bottom" />
            <Corner position={{ top: 0, right: 0 }} open="left bottom" />
            <Corner position={{ bottom: 0, left: 0 }} open="right top" />
            <Corner position={{ bottom: 0, right: 0 }} open="left top" />
            {loading && (
              <View style={styles.spinnerBox}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.verifyingLabel}>Verifying…</Text>
              </View>
            )}
          </View>
          <View style={styles.sideDim} />
        </View>

        <View style={styles.bottomDim}>
          <TouchableOpacity
            style={[styles.galleryBtn, loading && styles.galleryBtnDisabled]}
            onPress={handleGallery}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.galleryBtnText}>Scan from Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Result bottom sheet ── */}
      <Modal
        visible={modal.visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleScanAnother}
      >
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.dragHandle} />

            {cfg && (
              <View style={[styles.verdictPill, { backgroundColor: cfg.pillColor }]}>
                <Text style={styles.verdictLabel}>{cfg.label}</Text>
              </View>
            )}

            <Text style={styles.scannedUrl} numberOfLines={4} ellipsizeMode="middle">
              {modal.url}
            </Text>

            <Text style={styles.verdictMessage}>{cfg?.message}</Text>

            {/* Detailed engine counts — hidden on Error since there are no stats */}
            {modal.stats && !isError && (
              <View style={styles.statsRow}>
                <StatBadge label="Malicious"  value={modal.stats.malicious}  color="#b91c1c" />
                <StatBadge label="Suspicious" value={modal.stats.suspicious} color="#d97706" />
                <StatBadge label="Harmless"   value={modal.stats.harmless}   color="#15803d" />
                <StatBadge label="Undetected" value={modal.stats.undetected} color="#6b7280" />
              </View>
            )}

            <View style={styles.btnGroup}>
              {/*
                  "Open anyway" button rules (per CLAUDE.md):
                    Safe      → enabled (blue)
                    Malicious → visible but disabled/greyed
                    Error     → HIDDEN entirely (fail-safe)
              */}
              {!isError && (
                <TouchableOpacity
                  style={[styles.openBtn, isMalicious && styles.openBtnDisabled]}
                  disabled={isMalicious}
                  onPress={() => Linking.openURL(modal.url)}
                  activeOpacity={isMalicious ? 1 : 0.75}
                >
                  <Text style={styles.openBtnText}>Open anyway</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.scanAnotherBtn}
                onPress={handleScanAnother}
                activeOpacity={0.75}
              >
                <Text style={styles.scanAnotherText}>Scan another</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

// Renders one corner bracket of the finder box.
// `open` is a space-separated string of the two sides that have no border
// (e.g. "right bottom" for the top-left corner).
function Corner({ position, open }) {
  const sides = open.split(' ');
  const extra = {};
  if (sides.includes('right'))  extra.borderRightWidth = 0;
  if (sides.includes('left'))   extra.borderLeftWidth  = 0;
  if (sides.includes('top'))    extra.borderTopWidth   = 0;
  if (sides.includes('bottom')) extra.borderBottomWidth = 0;
  return <View style={[styles.corner, position, extra]} />;
}

function StatBadge({ label, value, color }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centeredContent: { justifyContent: 'center', alignItems: 'center', padding: 32 },

  // Permission screen
  permTitle: {
    fontSize: 20, fontWeight: '700', color: '#fff',
    marginBottom: 12, textAlign: 'center',
  },
  permBody: {
    fontSize: 15, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginBottom: 28,
  },
  grantBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10,
  },
  grantBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // Camera overlay
  overlay: { flex: 1 },

  topDim: {
    backgroundColor: DIM,
    paddingTop: 60, paddingBottom: 24,
    alignItems: 'center', paddingHorizontal: 24,
  },
  appTitle: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6 },

  middleRow: { flexDirection: 'row', height: FINDER_SIZE },
  sideDim: { flex: 1, backgroundColor: DIM },

  finder: {
    width: FINDER_SIZE,
    height: FINDER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28, height: 28,
    borderColor: '#fff', borderWidth: 3.5,
  },

  spinnerBox: { alignItems: 'center', gap: 10 },
  verifyingLabel: { color: '#fff', fontSize: 14 },

  bottomDim: {
    flex: 1, backgroundColor: DIM,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 56,
  },
  galleryBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13,
  },
  galleryBtnDisabled: { opacity: 0.35 },
  galleryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 28, paddingTop: 12, paddingBottom: 20,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40, height: 4,
    backgroundColor: '#e5e7eb', borderRadius: 2,
    marginBottom: 20,
  },
  verdictPill: {
    paddingHorizontal: 36, paddingVertical: 9,
    borderRadius: 999, marginBottom: 18,
  },
  verdictLabel: {
    color: '#fff', fontWeight: '700',
    fontSize: 15, letterSpacing: 2.5,
  },
  scannedUrl: {
    fontSize: 13, color: '#374151',
    textAlign: 'center', marginBottom: 10, lineHeight: 20,
  },
  verdictMessage: {
    fontSize: 15, color: '#4b5563',
    textAlign: 'center', marginBottom: 20, lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row', gap: 18,
    marginBottom: 24, flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statItem: { alignItems: 'center', minWidth: 64 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  btnGroup: { width: '100%', gap: 10 },
  openBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 15, borderRadius: 12, alignItems: 'center',
  },
  openBtnDisabled: { backgroundColor: '#d1d5db' },
  openBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  scanAnotherBtn: {
    borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingVertical: 15, borderRadius: 12, alignItems: 'center',
  },
  scanAnotherText: { color: '#374151', fontWeight: '600', fontSize: 16 },
});
