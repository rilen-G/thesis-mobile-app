import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@/state/auth';
import { OperationsProvider } from '@/state/operations';
import { AppScreen } from '@/components/layout/app-screen';
export default function OwnerLayout() {
  const {session,loading,recovering}=useAuth();
  if(loading) return <AppScreen hideSettings title="Restoring session"><ActivityIndicator /></AppScreen>;
  if(!session) return <Redirect href="/(auth)/sign-in" />;
  if(recovering) return <Redirect href="/(auth)/recovery" />;
  return <OperationsProvider key={session.user.id}><Stack screenOptions={{headerShown:false}} /></OperationsProvider>;
}
