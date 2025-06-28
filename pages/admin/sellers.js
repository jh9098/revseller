import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';

function SellerManagement() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  // 각 판매자별 입력 금액을 관리하기 위한 state
  const [paymentAmounts, setPaymentAmounts] = useState({});

  useEffect(() => {
    // 실시간으로 판매자 목록 가져오기
    const unsubscribe = onSnapshot(collection(db, "sellers"), (querySnapshot) => {
      const sellersData = [];
      const amountsData = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sellersData.push({ id: doc.id, ...data });
        // 기존에 설정된 paymentAmount가 있다면 초기값으로 설정
        amountsData[doc.id] = data.paymentAmount || '';
      });
      setSellers(sellersData);
      setPaymentAmounts(amountsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 입력 필드의 값이 변경될 때마다 paymentAmounts state 업데이트
  const handleAmountChange = (uid, value) => {
    setPaymentAmounts(prev => ({
      ...prev,
      [uid]: value
    }));
  };

  // '저장' 버튼 클릭 시 해당 판매자의 결제 금액을 Firestore에 업데이트
  const handleSaveAmount = async (uid) => {
    const amountToSave = paymentAmounts[uid];
    if (isNaN(amountToSave) || amountToSave === '') {
      alert('유효한 숫자를 입력해주세요.');
      return;
    }

    const sellerDocRef = doc(db, 'sellers', uid);
    try {
      await updateDoc(sellerDocRef, {
        paymentAmount: Number(amountToSave)
      });
      alert('결제 금액이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error("금액 저장 오류:", error);
      alert("금액 저장에 실패했습니다.");
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사업자 번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제 금액 설정</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">저장</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sellers.map((seller) => (
                <tr key={seller.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.businessInfo?.b_no || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      placeholder="금액 입력"
                      value={paymentAmounts[seller.id] || ''}
                      onChange={(e) => handleAmountChange(seller.id, e.target.value)}
                      className="w-32 p-2 border rounded-md"
                    /> 원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleSaveAmount(seller.id)}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                      저장
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