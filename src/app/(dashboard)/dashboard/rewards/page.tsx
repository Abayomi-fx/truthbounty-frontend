import MainLayout from '@/components/layout/MainLayout';
import { ConnectedRewardsCenter } from '@/components/features/rewards-center/ConnectedCenters';

export default function RewardsPage() {
  return (
    <MainLayout>
      <ConnectedRewardsCenter />
    </MainLayout>
  );
}
