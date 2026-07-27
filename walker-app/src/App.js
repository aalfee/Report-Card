import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import WalkScreen from './screens/WalkScreen';
import WalkHistoryScreen from './screens/WalkHistoryScreen';
import SummaryScreen from './screens/SummaryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Walker Login' }} />
        <Stack.Screen name="Walk" component={WalkScreen} options={{ title: 'Live Walk' }} />
        <Stack.Screen name="History" component={WalkHistoryScreen} options={{ title: 'Walk History' }} />
        <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Walk Summary' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
