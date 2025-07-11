import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../../lib/firebase';
import { collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, increment, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import SellerLayout from '../../components/seller/SellerLayout';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ko } from 'date-fns/locale';

// --- 데이터 정의: 트래픽 상품 목록 (카테고리 순으로 정렬) ---
const initialTrafficProducts = [
  { category: '베이직 트래픽', name: '피에스타', description: '', retailPrice: 60000, discountRate: 1-33900/60000 },
  { category: '베이직 트래픽', name: '시그니처', description: '', retailPrice: 50000, discountRate: 1-31900/50000 },
  { category: '애드온 트래픽', name: 'CP', description: '', retailPrice: 60000, discountRate: 1-34900/60000 },
  { category: '애드온 트래픽', name: '솔트', description: '', retailPrice: 70000, discountRate: 1-41900/70000 },
  { category: '애드온 트래픽', name: 'BBS', description: '', retailPrice: 80000, discountRate: 1-34900/80000 },
  { category: '애드온 트래픽', name: '팡팡', description: '', retailPrice: 60000, discountRate: 1-39900/60000 },
];

// 날짜를 YYYY-MM-DD(요일) 형식으로 변환
const formatDateWithDay = (date) => {
    if (!date || !(date instanceof Date)) return '-';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}(${days[date.getDay()]})`;
};


export default function TrafficPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [products, setProducts] = useState(
    initialTrafficProducts.map(p => ({
      ...p,
      salePrice: Math.round(p.retailPrice * (1 - p.discountRate)),
      quantity: 0,
      requestDate: null,
    }))
  );

  const [savedRequests, setSavedRequests] = useState([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [deposit, setDeposit] = useState(0);
  const [useDeposit, setUseDeposit] = useState(false);
  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState(null);

  const categoryCounts = useMemo(() => {
    const counts = {};
    initialTrafficProducts.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
        router.push('/');
        return;
    }
    
    const q = query(collection(db, "traffic_requests"), where("sellerUid", "==", user.uid));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
        const sortedData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setSavedRequests(sortedData);
        setIsLoadingDB(false);
    });

    const sellerDocRef = doc(db, 'sellers', user.uid);
    const unsubscribeSeller = onSnapshot(sellerDocRef, (doc) => {
        if (doc.exists()) {
            setDeposit(doc.data().deposit || 0);
        }
    });

    return () => {
        unsubscribeRequests();
        unsubscribeSeller();
    };
  }, [user, loading, router]);


  const handleInputChange = (index, field, value) => {
    const newProducts = [...products];
    const finalValue = field === 'quantity' ? Math.max(0, Number(value)) : value;
    newProducts[index] = { ...newProducts[index], [field]: finalValue };
    setProducts(newProducts);
  };

  const handleProcessPayment = async () => {
    const itemsToRequest = products.filter(p => p.quantity > 0 && p.requestDate);
    if (itemsToRequest.length === 0 || !user) {
        alert('요청할 상품의 수량과 요청일자를 모두 입력해주세요.');
        return;
    }

    const batch = writeBatch(db);
    const sellerDocRef = doc(db, 'sellers', user.uid);

    itemsToRequest.forEach(item => {
        const { retailPrice, discountRate, ...requestData } = item;
        const requestRef = doc(collection(db, 'traffic_requests'));
        const itemTotal = item.salePrice * item.quantity;
        const finalItemAmount = Math.round(itemTotal * 1.1);
        
        batch.set(requestRef, {
            ...requestData,
            sellerUid: user.uid,
            createdAt: serverTimestamp(),
            status: '미확정',
            paymentReceived: false,
            itemTotal,
            finalItemAmount,
        });
    });

    if (useDeposit && amountToUseFromDeposit > 0) {
        batch.update(sellerDocRef, {
            deposit: increment(-amountToUseFromDeposit)
        });
    }

    try {
        await batch.commit();
        setShowDepositPopup(true);
        // ✅ [수정] 폼 초기화 로직을 여기서 제거합니다.
    } catch (error) {
        console.error('결제 처리 중 오류 발생:', error);
        alert('결제 처리 중 오류가 발생했습니다.');
    }
  };

  // ✅ [추가] 팝업을 닫고 폼을 초기화하는 함수를 새로 만듭니다.
  const handleClosePopupAndReset = () => {
    setShowDepositPopup(false);
    setProducts(
        initialTrafficProducts.map(p => ({
          ...p,
          salePrice: Math.round(p.retailPrice * (1 - p.discountRate)),
          quantity: 0,
          requestDate: null,
        }))
    );
    setUseDeposit(false);
  };

  const handleDepositChange = async (id, checked) => {
    try {
        await updateDoc(doc(db, 'traffic_requests', id), { paymentReceived: checked });
    } catch (err) {
        console.error('입금 여부 업데이트 오류:', err);
    }
  };

  const handleConfirmReservation = async () => {
      if (!confirmRequest) return;
      try {
          await updateDoc(doc(db, 'traffic_requests', confirmRequest.id), {
              status: '예약 확정',
              confirmedAt: serverTimestamp()
          });
      } catch (err) {
          console.error('예약 확정 오류:', err);
      }
      setConfirmRequest(null);
  };

  const quoteTotal = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);
  const totalCommission = Math.round(quoteTotal * 0.1);
  const totalAmount = quoteTotal + totalCommission;
  const amountToUseFromDeposit = useDeposit ? Math.min(totalAmount, deposit) : 0;
  const remainingPayment = totalAmount - amountToUseFromDeposit;
  
  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b border-r border-gray-200";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800 border-b border-r border-gray-200";
  const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-center";

  if (loading || isLoadingDB) return <p>로딩 중...</p>;
  if (!user) return null;

  return (
    <SellerLayout>
      <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
        {/* ... 페이지 상단 내용은 동일 ... */}
        <h1 className="text-3xl font-bold text-gray-800 mb-2">트래픽 요청서</h1>
        <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-400 text-gray-700 rounded-r-lg">
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>원하는 상품의 구매 개수와 요청일자를 입력하고 '입금하기' 버튼을 눌러주세요.</li>
            <li>베이직 트래픽 2종은 자가 세팅 / 애드온 트래픽 4종은 정보 전달하여 개발사 대리 세팅</li>
            <li>트래픽만 사용했을 때 순위 보정 효과가 크지 않을 수 있으므로, 체험단 진행 혹은 오가닉 매출 발생을 병행하는 것이 좋습니다.</li>
          </ul>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700 p-6">트래픽 견적 요청 (스프레드시트)</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    {/* ... 테이블 헤더 내용은 동일 ... */}
                    <thead>
                    <tr>
                        <th className={`${thClass} w-40`}>구분</th>
                        <th className={thClass}>상품명</th>
                        <th className={thClass}>설명</th>
                        <th className={`${thClass} w-48`}>가격</th>
                        <th className={`${thClass} w-28`}>구매 개수</th>
                        <th className={`${thClass} w-40`}>요청일자</th>
                        <th className={`${thClass} w-32`}>시작일자</th>
                        <th className={`${thClass} w-32`}>종료일자</th>
                        <th className={`${thClass} w-36 border-r-0`}>트래픽 견적</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white">
                    {products.map((p, index) => {
                        const startDate = p.requestDate ? new Date(p.requestDate.getTime() + 24 * 60 * 60 * 1000) : null;
                        const endDate = startDate ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                        const estimate = p.salePrice * p.quantity;

                        const prevCategory = index > 0 ? products[index - 1].category : null;
                        const isFirstOfCategory = p.category !== prevCategory;
                        const rowSpanCount = isFirstOfCategory ? categoryCounts[p.category] : 0;

                        return (
                        <tr key={index} className={isFirstOfCategory && index > 0 ? 'border-t-2 border-gray-300' : ''}>
                            {isFirstOfCategory && (
                            <td rowSpan={rowSpanCount} className={`${tdClass} align-middle text-center font-bold bg-gray-50`}>
                                {p.category}
                            </td>
                            )}
                            <td className={`${tdClass} font-semibold`}>{p.name}</td>
                            <td className={tdClass}>{p.description}</td>
                            <td className={`${tdClass} text-xs`}>
                            <div className="flex flex-col">
                                <span>시중가: {p.retailPrice.toLocaleString()}원</span>
                                <span className="text-red-600">할인율: {Math.round(p.discountRate * 100)}%</span>
                                <span className="font-bold text-blue-600 text-sm">판매가: {p.salePrice.toLocaleString()}원</span>
                            </div>
                            </td>
                            <td className={tdClass}>
                            <input 
                                type="number"
                                value={p.quantity}
                                onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                                className={inputClass}
                                min="0"
                            />
                            </td>
                            <td className={tdClass}>
                            <DatePicker
                                selected={p.requestDate}
                                onChange={(date) => handleInputChange(index, 'requestDate', date)}
                                className={inputClass}
                                dateFormat="yyyy/MM/dd"
                                locale={ko}
                                placeholderText="날짜 선택"
                            />
                            </td>
                            <td className={tdClass}>
                            {startDate ? startDate.toLocaleDateString() : '-'}
                            </td>
                            <td className={tdClass}>
                            {endDate ? endDate.toLocaleDateString() : '-'}
                            </td>
                            <td className={`${tdClass} font-bold text-lg text-green-600 border-r-0`}>
                            {estimate.toLocaleString()}원
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
            {/* ... 결제 정보 부분은 동일 ... */}
            <div className="mt-6 p-6 border-t border-gray-200 text-right">
                <div className="space-y-2 mb-4 text-gray-700">
                    <p className="text-md">견적 합계: <span className="font-semibold">{quoteTotal.toLocaleString()}</span> 원</p>
                    <p className="text-md">세금계산서 (10%): <span className="font-semibold">{totalCommission.toLocaleString()}</span> 원</p>
                    <p className="text-lg font-bold">총 결제 금액: <span className="font-bold text-blue-600">{totalAmount.toLocaleString()}</span> 원</p>
                    <hr className="my-3"/>
                    <div className="flex justify-end items-center text-lg">
                        <label htmlFor="use-deposit" className="mr-2">예치금 사용 ({deposit.toLocaleString()}원 보유):</label>
                        <input type="checkbox" id="use-deposit" checked={useDeposit} onChange={(e) => setUseDeposit(e.target.checked)} disabled={deposit === 0 || totalAmount === 0} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"/>
                        <span className={`ml-2 text-red-500 font-semibold ${!useDeposit && 'opacity-50'}`}>- {amountToUseFromDeposit.toLocaleString()} 원</span>
                    </div>
                    <hr className="my-3"/>
                    <p className="text-gray-800">
                        최종 결제 금액:
                        <span className="font-bold text-3xl text-green-600 ml-4">{remainingPayment.toLocaleString()}</span> 원
                    </p>
                </div>
                <button
                    onClick={handleProcessPayment}
                    disabled={totalAmount === 0}
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    입금하기
                </button>
            </div>
        </div>
        
        {/* ... 나의 트래픽 예약 내역 부분은 동일 ... */}
        <div className="mt-8 p-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">나의 트래픽 예약 내역 (DB 저장 완료)</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className={thClass}>요청일자</th>
                            <th className={thClass} title="입금을 완료하셨으면 체크박스를 클릭해 주세요">입금여부*</th>
                            <th className={thClass}>결제상태</th>
                            <th className={thClass}>진행상태</th>
                            <th className={thClass}>상품명</th>
                            <th className={thClass}>개수</th>
                            <th className={thClass}>총 견적</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {savedRequests.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-10 text-gray-500">예약 내역이 없습니다.</td></tr>
                        ) : (
                            savedRequests.map(req => (
                                <tr key={req.id}>
                                    <td className={tdClass}>{req.requestDate?.seconds ? formatDateWithDay(new Date(req.requestDate.seconds * 1000)) : '-'}</td>
                                    <td className={tdClass}>
                                        <input
                                            type="checkbox"
                                            checked={!!req.paymentReceived}
                                            onChange={(e) => handleDepositChange(req.id, e.target.checked)}
                                            title="입금을 완료하셨으면 체크박스를 클릭해 주세요"
                                        />
                                    </td>
                                    <td className={tdClass}>{req.paymentReceived ? '입금완료' : '입금전'}</td>
                                    <td className={tdClass}>
                                        {req.paymentReceived ? (
                                            req.status === '예약 확정' ? (
                                                <span>예약확정</span>
                                            ) : (
                                                <button onClick={() => setConfirmRequest(req)} className="text-blue-600 underline">예약확정</button>
                                            )
                                        ) : '예약중'}
                                    </td>
                                    <td className={tdClass}>{req.name}</td>
                                    <td className={tdClass}>{req.quantity}</td>
                                    <td className={tdClass}>{req.finalItemAmount?.toLocaleString()}원</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
        
        {/* ... 예약확정 팝업은 동일 ... */}
        {confirmRequest && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setConfirmRequest(null)}>
                <div className="bg-white p-6 rounded shadow" onClick={(e) => e.stopPropagation()}>
                    <p className="mb-4">예약확정 하시겠습니까?</p>
                    <div className="flex justify-center space-x-4">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleConfirmReservation}>예</button>
                        <button className="px-4 py-2 bg-gray-300 rounded" onClick={() => setConfirmRequest(null)}>아니오</button>
                    </div>
                </div>
            </div>
        )}

        {/* ✅ [수정] 입금 계좌 안내 팝업의 onClick 핸들러를 수정합니다. */}
        {showDepositPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClosePopupAndReset}>
                <div className="bg-white p-8 rounded-lg shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-xl font-bold mb-4">입금 계좌 안내</h3>
                    <p className="text-lg">아래 계좌로 <strong className="text-green-600">{remainingPayment.toLocaleString()}원</strong>을 입금해주세요.</p>
                    <div className="my-6 p-4 bg-gray-100 rounded-md">
                        <p className="font-semibold text-lg mb-1">채종문 (아이언마운틴컴퍼니)</p>
                        <p className="font-semibold text-2xl text-blue-700">국민은행 834702-04-290385</p>
                    </div>
                    <p className="text-sm text-gray-600 mb-6">입금 확인 후 '나의 트래픽 예약 내역'에서 상태가 변경됩니다.</p>
                    <button className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700" onClick={handleClosePopupAndReset}>확인</button>
                </div>
            </div>
        )}
    </SellerLayout>
  );
}