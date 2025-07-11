//P:\revseller\pages\admin\products.js
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, orderBy, writeBatch, increment } from 'firebase/firestore';
import AdminLayout from '../../components/admin/AdminLayout';
import withAdminAuth from '../../hoc/withAdminAuth';
import Papa from 'papaparse';

function CampaignManagement() {
  const [campaigns, setCampaigns] =  useState([]);
  const [loading, setLoading] = useState(true);
  const [sellersMap, setSellersMap] = useState({});
  const [selectedCampaign, setSelectedCampaign] = useState(null);

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sellers'), (snap) => {
      const map = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.uid) map[data.uid] = data.nickname || '닉네임 없음';
      });
      setSellersMap(map);
    });
    return () => unsub();
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

  // ✅ [수정] 판매자 귀책 취소 및 예치금 적립 함수 (부분 취소 기능 추가)
  const handleCancelBySellerFault = async (campaign) => {
    // 1. 필요한 정보가 있는지 확인 (itemTotal 추가)
    const { id, sellerUid, productPrice, quantity, itemTotal } = campaign;
    if (!sellerUid || productPrice === undefined || quantity === undefined || itemTotal === undefined) {
      alert("필수 정보(판매자UID, 상품가, 수량, 총 견적)가 없어 처리할 수 없습니다.");
      return;
    }

    // 2. 관리자로부터 취소할 수량 입력받기
    const cancelQtyStr = prompt(`취소할 수량을 입력하세요. (현재 수량: ${quantity}개)`, quantity.toString());

    // prompt에서 '취소'를 누르거나 값을 입력하지 않은 경우
    if (cancelQtyStr === null || cancelQtyStr === "") {
      return; 
    }

    const cancelQty = parseInt(cancelQtyStr, 10);

    // 3. 입력값 유효성 검사
    if (isNaN(cancelQty) || cancelQty <= 0) {
      alert("유효한 숫자를 입력하세요.");
      return;
    }
    if (cancelQty > quantity) {
      alert(`취소할 수량이 현재 수량(${quantity}개)보다 많습니다.`);
      return;
    }

    // 4. 환불액 및 캠페인 잔여 정보 계산
    const refundAmount = Number(productPrice) * cancelQty; // 예치금으로 환불될 금액 (상품가 기준)
    const remainingQty = Number(quantity) - cancelQty;

    // 5. 관리자에게 최종 확인
    const confirmationMessage = 
      `정말로 이 캠페인의 수량을 ${cancelQty}개 취소하시겠습니까?\n` +
      `판매자에게 상품가 기준 ${refundAmount.toLocaleString()}원의 예치금이 적립됩니다.\n\n` +
      (remainingQty > 0 ? `캠페인의 남은 수량은 ${remainingQty}개가 됩니다.` : "캠페인이 전체 취소 처리됩니다.");
    
    const confirmation = confirm(confirmationMessage);

    if (!confirmation) return;

    // 6. Firestore 문서 참조 생성 및 Batch Write 준비
    const campaignDocRef = doc(db, 'campaigns', id);
    const sellerDocRef = doc(db, 'sellers', sellerUid);
    const batch = writeBatch(db);

    // 7. 부분 취소와 전체 취소에 따라 다른 작업 수행
    if (remainingQty > 0) {
      // 부분 취소: 캠페인 수량과 견적 금액 업데이트
      // 개당 서비스 단가 계산 = (총 견적 / 수량) - 개당 상품가
      const unitServicePrice = (Number(itemTotal) / Number(quantity)) - Number(productPrice);
      // 새로운 총 견적 = (개당 서비스 단가 + 개당 상품가) * 남은 수량
      const newItemTotal = (unitServicePrice + Number(productPrice)) * remainingQty;

      batch.update(campaignDocRef, { 
        quantity: remainingQty,
        itemTotal: newItemTotal 
      });

    } else {
      // 전체 취소: 캠페인 상태를 '판매자귀책취소'로 변경
      batch.update(campaignDocRef, { status: '판매자귀책취소' });
    }
    
    // 8. 판매자 예치금을 (취소 상품가 * 취소 수량) 만큼 증가 (항상 실행)
    batch.update(sellerDocRef, { deposit: increment(refundAmount) });

    try {
      await batch.commit();
      alert("작업이 성공적으로 처리되었습니다.");
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
                {['진행일자', '닉네임', '상품명', '구분', '리뷰종류', '개수', '견적', '결제상태', '상태변경'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString() : '날짜 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500" title={c.sellerUid}>{sellersMap[c.sellerUid] || '닉네임 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold">
                      <button className="text-blue-600 underline" onClick={() => setSelectedCampaign(c)}>
                        {c.productName || '상품명 없음'}
                      </button>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.deliveryType || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.reviewType || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{c.quantity || '-'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">{typeof c.itemTotal === 'number' ? c.itemTotal.toLocaleString() + '원' : '견적 없음'}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          c.status === '리뷰완료' ? 'bg-blue-100 text-blue-800' :
                          c.status === '구매완료' ? 'bg-green-200 text-green-800' :
                          c.status === '예약 확정' ? 'bg-green-100 text-green-800' :
                          c.status === '판매자귀책취소' ? 'bg-red-100 text-red-800' :
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
                      
                      {/* ✅ [수정] '예약 확정' 및 '구매완료' 상태일 때 귀책 취소 버튼 렌더링 */}
                      {(c.status === '예약 확정' || c.status === '구매완료') && (
                        <button onClick={() => handleCancelBySellerFault(c)} className="text-red-600 hover:text-red-800 font-semibold">귀책 취소</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        )}
      </div>
      {selectedCampaign && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedCampaign(null)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow max-w-lg w-full overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">상세 정보</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="font-semibold pr-2">닉네임</td><td>{sellersMap[selectedCampaign.sellerUid] || '닉네임 없음'}</td></tr>
                <tr><td className="font-semibold pr-2">진행일자</td><td>{selectedCampaign.date?.seconds ? new Date(selectedCampaign.date.seconds * 1000).toLocaleDateString() : '-'}</td></tr>
                <tr><td className="font-semibold pr-2">구분</td><td>{selectedCampaign.deliveryType}</td></tr>
                <tr><td className="font-semibold pr-2">리뷰종류</td><td>{selectedCampaign.reviewType}</td></tr>
                <tr><td className="font-semibold pr-2">체험단 개수</td><td>{selectedCampaign.quantity}</td></tr>
                <tr><td className="font-semibold pr-2">상품명</td><td>{selectedCampaign.productName}</td></tr>
                <tr><td className="font-semibold pr-2">옵션</td><td>{selectedCampaign.productOption}</td></tr>
                <tr><td className="font-semibold pr-2">상품가</td><td>{selectedCampaign.productPrice}</td></tr>
                <tr><td className="font-semibold pr-2">상품URL</td><td><a href={selectedCampaign.productUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{selectedCampaign.productUrl}</a></td></tr>
                <tr><td className="font-semibold pr-2">키워드</td><td>{selectedCampaign.keywords}</td></tr>
                <tr><td className="font-semibold pr-2">리뷰가이드</td><td>{selectedCampaign.reviewGuide}</td></tr>
                <tr><td className="font-semibold pr-2">비고</td><td>{selectedCampaign.remarks}</td></tr>
                <tr><td className="font-semibold pr-2">체험단견적</td><td>{selectedCampaign.itemTotal?.toLocaleString()}원</td></tr>
                <tr><td className="font-semibold pr-2">결제상태</td><td>{selectedCampaign.status}</td></tr>
              </tbody>
            </table>
            <div className="text-center mt-4">
              <button onClick={() => setSelectedCampaign(null)} className="px-4 py-2 bg-gray-700 text-white rounded">닫기</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default withAdminAuth(CampaignManagement);

