import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';

function SellerManagement() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sellers"), (querySnapshot) => {
      const sellersData = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sellersData.push({ id: doc.id, ...data });
      });
      setSellers(sellersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  // ✅ 판매자 강제 탈퇴 함수 추가
  const handleDeleteSeller = async (seller) => {
    if (!confirm(`정말로 '${seller.email}' 판매자를 시스템에서 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    alert("경고: 이 기능은 Firestore 보안 규칙이 허용하는 경우에만 동작합니다.\n보안상 Cloud Functions 사용을 권장합니다.");
    
    try {
      // 1. Firestore에서 판매자와 관련된 모든 데이터 삭제
      const batch = writeBatch(db);

      // 판매자 문서 삭제
      const sellerRef = doc(db, 'sellers', seller.id);
      batch.delete(sellerRef);

      // 해당 판매자가 등록한 상품들 삭제
      const productsQuery = query(collection(db, "products"), where("sellerUid", "==", seller.id));
      const productsSnapshot = await getDocs(productsQuery);
      productsSnapshot.forEach(doc => batch.delete(doc.ref));
      
      // ... 필요하다면 payments 등 다른 컬렉션도 조회해서 삭제 ...

      await batch.commit();

      // 2. Firebase Authentication에서 사용자 계정 삭제
      // !!! 중요 !!!
      // 클라이언트 SDK에서는 다른 사용자를 삭제할 수 없습니다. 이 부분은 반드시 Cloud Functions 또는 Admin SDK를 사용하는 백엔드 환경에서 실행되어야 합니다.
      // 아래 코드는 클라이언트에서 실행되지 않으므로, 이 함수를 호출하면 Firestore 데이터만 삭제되고 인증 계정은 남아있게 됩니다.
      // await deleteUser(???);
      
      alert(`'${seller.email}' 판매자의 Firestore 데이터가 삭제되었습니다. (인증 계정은 수동 삭제 필요)`);

    } catch (error) {
      console.error("판매자 삭제 오류:", error);
      alert(`삭제 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  return (
    <AdminLayout>
      <h2 className="text-3xl font-bold mb-6">판매자 관리</h2>
      <div className="bg-white p-6 rounded-lg shadow-md">
        {loading ? (
          <p>판매자 목록을 불러오는 중입니다...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사업자번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">전화번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">닉네임</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">추천인ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예치금</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sellers.map((seller) => (
                <tr key={seller.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.name || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.businessInfo?.b_no || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.phone || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.nickname || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.referrerId || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(seller.deposit ?? 0).toLocaleString()}원</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {/* ✅ 탈퇴 버튼 추가 */}
                    <button
                      onClick={() => handleDeleteSeller(seller)}
                      className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
                    >
                      강제 탈퇴
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}

export default withAdminAuth(SellerManagement);