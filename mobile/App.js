import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import QRScannerScreen from './src/screens/QRScannerScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <QRScannerScreen />
    </SafeAreaProvider>
  );
}
