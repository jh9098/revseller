import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import Papa from 'papaparse'; // 엑셀(CSV) 생성을 위해 임포트

function CampaignManagement() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // 이제 'products'가 아닌 'campaigns' 컬렉션을 사용합니다.
  useEffect(() => {
    setLoading(true);
    // 최신순으로 정렬하여 모든 캠페인을 가져옵니다.
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

  // 캠페인 상태 업데이트 함수 (결제 상태 변경 등)
  const handleUpdateStatus = async (id, newStatus) => {
    const campaignDocRef = doc(db, 'campaigns', id);
    try {
      await updateDoc(campaignDocRef, {
        status: newStatus
      });
      alert(`캠페인 상태가 '${newStatus}'로 변경되었습니다.`);
    } catch (error) {
      console.error("상태 업데이트 오류:", error);
      alert("상태 업데이트에 실패했습니다.");
    }
  };

  // ✅ 엑셀(CSV) 다운로드 함수
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
        <button
          onClick={handleDownloadExcel}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
        >
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
                {/* 요청하신 모든 항목을 테이블 헤더로 표시 */}
                {['진행일자', '판매자', '상품명', '리뷰종류', '개수', '견적', '결제상태', '상태변경'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    {/* ✅ 방어 코드 추가: c.date와 c.date.seconds가 있을 때만 날짜로 변환 */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      {c.date && c.date.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString() : '날짜 정보 없음'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500" title={c.sellerUid}>
                      {/* ✅ 방어 코드 추가: sellerUid가 없을 경우를 대비 */}
                      {c.sellerUid ? c.sellerUid.substring(0, 8) + '...' : '판매자 정보 없음'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold">{c.productName || '상품명 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.reviewType || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.quantity || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      {/* ✅ 방어 코드 추가: itemTotal이 숫자일 때만 변환 */}
                      {typeof c.itemTotal === 'number' ? c.itemTotal.toLocaleString() + '원' : '견적 정보 없음'}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          c.status === '리뷰완료'
                            ? 'bg-blue-100 text-blue-800'
                            : c.status === '구매완료'
                            ? 'bg-green-200 text-green-800'
                            : c.status === '예약 확정'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {c.status || '상태 없음'}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm space-x-2">
                      {c.status !== '예약 확정' && (
                        <button onClick={() => handleUpdateStatus(c.id, '예약 확정')} className="text-indigo-600 hover:text-indigo-900">확정</button>
                      )}
                      {c.status !== '미확정' && (
                        <button onClick={() => handleUpdateStatus(c.id, '미확정')} className="text-gray-500 hover:text-gray-700">미확정</button>
                      )}
                      {c.status !== '구매완료' && (
                        <button onClick={() => handleUpdateStatus(c.id, '구매완료')} className="text-green-600 hover:text-green-800">구매완료</button>
                      )}
                      {c.status !== '리뷰완료' && (
                        <button onClick={() => handleUpdateStatus(c.id, '리뷰완료')} className="text-blue-600 hover:text-blue-800">리뷰완료</button>
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

// 파일 이름이 바뀌었으므로 export 이름도 변경해주는 것이 좋습니다.
export default withAdminAuth(CampaignManagement);