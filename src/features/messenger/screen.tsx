import { Text } from 'react-native';

import { Card } from '@/components/ui/card';
import { Copy, DataScreen } from '@/features/operations/ui';
import { textStyles } from '@/theme/tokens';

export default function MessengerScreen() {
  return <DataScreen title="Messenger" detail ownerOnly>
    <Card>
      <Text style={textStyles.title}>Messenger integration is planned</Text>
      <Copy>The Meta connection, chatbot, conversation capture, and follow-ups will be built in a later phase. This app cannot receive or send Messenger messages yet.</Copy>
      <Copy>Initial testing will use the BuckStar Page and researcher participants. Orders and approved business knowledge can be managed now.</Copy>
    </Card>
  </DataScreen>;
}
