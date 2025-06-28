import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected'

  // 필터가 변경될 때마다 Firestore에서 실시간으로 데이터 가져오기
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "products"), where("status", "==", filter));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      setLoading(false);
    });

    // 컴포넌트가 언마운트될 때 리스너 정리
    return () => unsubscribe();
  }, [filter]); // filter 상태가 바뀔 때마다 이 useEffect를 다시 실행

  // 상품 상태 업데이트 함수
  const handleUpdateStatus = async (id, newStatus) => {
    const productDocRef = doc(db, 'products', id);
    try {
      await updateDoc(productDocRef, {
        status: newStatus
      });
      alert(`상품 상태가 '${newStatus}'로 변경되었습니다.`);
    } catch (error) {
      console.error("상태 업데이트 오류:", error);
      alert("상태 업데이트에 실패했습니다.");
    }
  };

  return (
    <AdminLayout>
      <h2 className="text-3xl font-bold mb-6">상품 관리</h2>

      {/* 필터 탭 */}
      <div className="mb-4 border-b">
        <nav className="flex space-x-4">
          <button onClick={() => setFilter('pending')} className={`py-2 px-4 ${filter === 'pending' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}>
            승인 대기
          </button>
          <button onClick={() => setFilter('approved')} className={`py-2 px-4 ${filter === 'approved' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}>
            승인 완료
          </button>
          <button onClick={() => setFilter('rejected')} className={`py-2 px-4 ${filter === 'rejected' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}>
            반려 상품
          </button>
        </nav>
      </div>

      {/* 상품 목록 테이블 */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        {loading ? (
          <p>상품 목록을 불러오는 중입니다...</p>
        ) : products.length === 0 ? (
          <p>해당 상태의 상품이 없습니다.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">판매자 UID</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.price.toLocaleString()}원</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sellerUid}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {filter === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateStatus(product.id, 'approved')} className="text-indigo-600 hover:text-indigo-900 mr-4">승인</button>
                        <button onClick={() => handleUpdateStatus(product.id, 'rejected')} className="text-red-600 hover:text-red-900">반려</button>
                      </>
                    )}
                    {filter !== 'pending' && (
                        <button onClick={() => handleUpdateStatus(product.id, 'pending')} className="text-gray-500 hover:text-gray-700">대기 상태로 변경</button>
                    )}
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

export default withAdminAuth(ProductManagement);