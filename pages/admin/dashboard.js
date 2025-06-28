import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';

function AdminDashboard() {
  return (
    <AdminLayout>
      <h2 className="text-3xl font-bold mb-6">관리자 대시보드</h2>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p>이곳에서 사이트의 주요 통계와 정보를 한눈에 확인할 수 있습니다.</p>
        {/* 여기에 나중에 카드 형태로 통계 정보들을 추가할 수 있습니다. */}
        {/* 예: 승인 대기 중인 상품 수, 총 판매자 수 등 */}
      </div>
    </AdminLayout>
  );
}

// withAdminAuth로 페이지를 감싸서 관리자만 접근할 수 있도록 보호합니다.
export default withAdminAuth(AdminDashboard);