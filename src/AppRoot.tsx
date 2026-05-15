import { StatusBar } from 'expo-status-bar';

import { FoodFactsScreen } from './screens/FoodFactsScreen';

export default function AppRoot() {
  return (
    <>
      <StatusBar style="light" />
      <FoodFactsScreen />
    </>
  );
}
