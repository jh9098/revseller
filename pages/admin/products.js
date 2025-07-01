import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
// ✅ [수정] writeBatch, increment 추가
import { collection, query, onSnapshot, doc, updateDoc, orderBy, writeBatch, increment } from 'firebase/firestore';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import Papa from 'papaparse';

function CampaignManagement() {
  const [campaigns, setCampaigns] =  useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const campaignsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCampaigns(campaignsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 일반 상태 업데이트 함수
  const handleUpdateStatus = async (id, newStatus) => {
    const campaignDocRef = doc(db, 'campaigns', id);
    try {
      await updateDoc(campaignDocRef, { status: newStatus });
      alert(`캠페인 상태가 '${newStatus}'로 변경되었습니다.`);
    } catch (error) {
      console.error("상태 업데이트 오류:", error);
      alert("상태 업데이트에 실패했습니다.");
    }
  };

  // ✅ [추가] 판매자 귀책 취소 및 예치금 적립 함수
  const handleCancelBySellerFault = async (campaign) => {
    // 1. 필요한 정보가 있는지 확인
    const { id, sellerUid, productPrice, quantity } = campaign;
    if (!sellerUid || productPrice === undefined || quantity === undefined) {
      alert("필수 정보(판매자UID, 상품가, 수량)가 없어 처리할 수 없습니다.");
      return;
    }

    // 2. 관리자에게 재확인
    const refundAmount = Number(productPrice) * Number(quantity);
    const confirmation = confirm(
      `정말로 이 캠페인을 '판매자 귀책'으로 취소하시겠습니까?\n` +
      `판매자에게 ${refundAmount.toLocaleString()}원의 예치금이 적립됩니다.`
    );

    if (!confirmation) return;

    // 3. Firestore 문서 참조 생성
    const campaignDocRef = doc(db, 'campaigns', id);
    const sellerDocRef = doc(db, 'sellers', sellerUid);

    // 4. Batch Write를 사용하여 원자적 업데이트 실행
    const batch = writeBatch(db);

    // 4-1. 캠페인 상태를 '판매자귀책취소'로 변경
    batch.update(campaignDocRef, { status: '판매자귀책취소' });
    
    // 4-2. 판매자 예치금을 (상품가 * 수량) 만큼 증가
    batch.update(sellerDocRef, { deposit: increment(refundAmount) });

    try {
      await batch.commit();
      alert("캠페인이 취소되고 예치금이 성공적으로 적립되었습니다.");
    } catch (error) {
      console.error("취소 및 예치금 적립 처리 중 오류:", error);
      alert("작업 처리 중 오류가 발생했습니다.");
    }
  };

  const handleDownloadExcel = () => {
    if (campaigns.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    // ✅ 방어 코드 추가: 각 필드의 값이 없을 경우 빈 문자열 ''을 사용
    const dataForExcel = campaigns.map((c, index) => ({
      '순번': index + 1,
      '진행일자': c.date && c.date.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString() : '',
      '구분': c.deliveryType || '',
      '리뷰종류': c.reviewType || '',
      '작업개수': c.quantity || 0,
      '상품명': c.productName || '',
      '옵션': c.productOption || '',
      '상품가': c.productPrice || 0,
      '상품URL': c.productUrl || '',
      '키워드': c.keywords || '',
      '리뷰가이드': c.reviewGuide || '',
      '비고': c.remarks || '',
      '체험단견적': c.itemTotal || 0,
      '결제상태': c.status || '',
      '판매자UID': c.sellerUid || ''
    }));

    const csv = Papa.unparse(dataForExcel);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `캠페인_목록_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">전체 캠페인 관리</h2>
        <button onClick={handleDownloadExcel} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">
          엑셀로 다운로드
        </button>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md overflow-x-auto">
        {loading ? (
          <p>캠페인 목록을 불러오는 중입니다...</p>
        ) : campaigns.length === 0 ? (
          <p>등록된 캠페인이 없습니다.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['진행일자', '판매자', '상품명', '리뷰종류', '개수', '견적', '결제상태', '상태변경'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString() : '날짜 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500" title={c.sellerUid}>{c.sellerUid ? c.sellerUid.substring(0, 8) + '...' : '판매자 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold">{c.productName || '상품명 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.reviewType || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.quantity || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{typeof c.itemTotal === 'number' ? c.itemTotal.toLocaleString() + '원' : '견적 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <span
                        // ✅ [수정] '판매자귀책취소' 상태 UI 추가
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          c.status === '리뷰완료' ? 'bg-blue-100 text-blue-800' :
                          c.status === '구매완료' ? 'bg-green-200 text-green-800' :
                          c.status === '예약 확정' ? 'bg-green-100 text-green-800' :
                          c.status === '판매자귀책취소' ? 'bg-red-100 text-red-800' : // <-- 추가
                          'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {c.status || '상태 없음'}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm space-x-2">
                      {/* 일반 상태 변경 버튼들 */}
                      {c.status !== '예약 확정' && <button onClick={() => handleUpdateStatus(c.id, '예약 확정')} className="text-indigo-600 hover:text-indigo-900">확정</button>}
                      {c.status !== '미확정' && <button onClick={() => handleUpdateStatus(c.id, '미확정')} className="text-gray-500 hover:text-gray-700">미확정</button>}
                      {c.status !== '구매완료' && <button onClick={() => handleUpdateStatus(c.id, '구매완료')} className="text-green-600 hover:text-green-800">구매완료</button>}
                      {c.status !== '리뷰완료' && <button onClick={() => handleUpdateStatus(c.id, '리뷰완료')} className="text-blue-600 hover:text-blue-800">리뷰완료</button>}
                      
                      {/* ✅ [추가] 판매자 귀책 취소 버튼 (조건부 렌더링) */}
                      {c.status === '예약 확정' && (
                        <button onClick={() => handleCancelBySellerFault(c)} className="text-red-600 hover:text-red-800 font-semibold">귀책 취소</button>
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

export default withAdminAuth(CampaignManagement);