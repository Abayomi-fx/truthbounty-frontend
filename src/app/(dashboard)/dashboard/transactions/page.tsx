import MainLayout from '@/components/layout/MainLayout';
import { ConnectedTransactionCenter } from '@/components/features/rewards-center/ConnectedCenters';

export default function TransactionsPage() {
  return (
    <MainLayout>
      <ConnectedTransactionCenter />
    </MainLayout>
  );
}
