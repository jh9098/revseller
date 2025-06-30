import SellerLayout from '../../components/seller/SellerLayout';

export default function ProgressPage() {
  return (
    <SellerLayout>
      <h2 className="text-2xl font-bold mb-4">진행현황</h2>
      <p>관리자가 설정한 상태에 따라 진행 상황이 표시됩니다. (준비 중)</p>
    </SellerLayout>
  );
}
