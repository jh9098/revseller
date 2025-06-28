import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { nanoid } from 'nanoid';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- 핵심 로직: 리뷰 단가 계산 엔진 (최신 단가표 기준 업데이트) ---
const getBasePrice = (deliveryType, reviewType) => {
  if (deliveryType === '실배송') {
    switch (reviewType) {
      case '별점': return 1600;
      case '텍스트': return 1700;
      case '포토': return 1800;
      case '프리미엄(포토)': return 4000;
      case '프리미엄(영상)': return 5000;
      default: return 0;
    }
  } else if (deliveryType === '빈박스') {
    // ✅ 빈박스는 '별점'과 '텍스트' 두 가지 경우를 모두 처리
    switch (reviewType) {
      case '별점':
      case '텍스트':
        return 5400;
      default:
        return 0;
    }
  }
  return 0;
};

// --- 초기 폼 상태 ---
const initialFormState = {
  date: new Date(),
  deliveryType: '실배송',
  reviewType: '별점',
  quantity: 1,
  productName: '',
  productOption: '',
  productPrice: 0,
  productUrl: '',
  keywords: '',
  reviewGuide: '',
  remarks: ''
};

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [formState, setFormState] = useState(initialFormState);
  const [campaigns, setCampaigns] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [savedCampaigns, setSavedCampaigns] = useState([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  // --- 실시간 단가 계산 로직 ---
  const basePrice = getBasePrice(formState.deliveryType, formState.reviewType);
  const sundayExtraCharge = formState.date.getDay() === 0 ? 600 : 0;
  const finalUnitPrice = basePrice + sundayExtraCharge;

  // ✅ 중요: '구분'이 바뀔 때 '리뷰 종류'를 자동으로 리셋하는 useEffect 추가
  useEffect(() => {
    if (formState.deliveryType === '빈박스') {
      // '빈박스'일 때 유효하지 않은 '리뷰 종류'가 선택되어 있다면, 기본값으로 변경
      if (!['별점', '텍스트'].includes(formState.reviewType)) {
        setFormState(prev => ({ ...prev, reviewType: '별점' }));
      }
    }
  }, [formState.deliveryType, formState.reviewType]);


  // 폼 입력 변경 핸들러
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  // 견적 항목 추가 핸들러
  const handleAddCampaign = (e) => {
    e.preventDefault();
    if (basePrice === 0) {
      alert('해당 조합의 가격 정책이 없습니다. 선택을 확인해주세요.');
      return;
    }
    const itemTotal = (finalUnitPrice + Number(formState.productPrice)) * Number(formState.quantity);

    const newCampaign = {
      id: nanoid(),
      ...formState,
      basePrice, 
      sundayExtraCharge,
      finalUnitPrice,
      itemTotal,
    };
    setCampaigns([...campaigns, newCampaign]);
    setFormState(initialFormState);
  };

  const handleDeleteCampaign = (id) => {
    setCampaigns(campaigns.filter(c => c.id !== id));
  };
  
  useEffect(() => {
    const quoteTotal = campaigns.reduce((sum, campaign) => sum + campaign.itemTotal, 0);
    const final = Math.round(quoteTotal * 1.14);
    setTotalAmount(final);
  }, [campaigns]);
  
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/');
      return;
    }
    const q = query(collection(db, "campaigns"), where("sellerUid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavedCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingDB(false);
    });
    return () => unsubscribe();
  }, [user, loading, router]);
  
  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const handleProcessPayment = async () => {
    if (campaigns.length === 0) {
      alert('결제할 견적 항목이 없습니다.');
      return;
    }
    alert(`총 ${totalAmount.toLocaleString()}원 결제를 진행합니다.\n(PG사 연동 필요)`);
  };

  if (loading || isLoadingDB) return <p>로딩 중...</p>;

  const thClass = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">판매자 대시보드</h1>
        <div className="mt-4 sm:mt-0">
          <span className="mr-4 text-gray-600">{user?.email}</span>
          <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">
            로그아웃
          </button>
        </div>
      </div>

      <form onSubmit={handleAddCampaign} className="p-6 bg-white rounded-xl shadow-lg mb-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-700">새 작업 추가</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 items-end">
          <div>
            <label className={labelClass}>진행 일자</label>
            <DatePicker selected={formState.date} onChange={(date) => setFormState(p => ({...p, date}))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>구분</label>
            <select name="deliveryType" value={formState.deliveryType} onChange={handleFormChange} className={inputClass}>
              <option value="실배송">실배송</option>
              <option value="빈박스">빈박스</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>리뷰 종류</label>
            <select name="reviewType" value={formState.reviewType} onChange={handleFormChange} className={inputClass}>
              {formState.deliveryType === '실배송' ? (
                <>
                  <option>별점</option>
                  <option>텍스트</option>
                  <option>포토</option>
                  <option>프리미엄(포토)</option>
                  <option>프리미엄(영상)</option>
                </>
              ) : (
                <>
                  <option>별점</option>
                  <option>텍스트</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className={labelClass}>작업 개수</label>
            <input type="number" name="quantity" value={formState.quantity} onChange={handleFormChange} className={inputClass} min="1" required/>
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <label className={labelClass}>상품명</label>
            <input type="text" name="productName" value={formState.productName} onChange={handleFormChange} className={inputClass} placeholder="예: 저자극 샴푸" required/>
          </div>
          <div>
            <label className={labelClass}>옵션</label>
            <input type="text" name="productOption" value={formState.productOption} onChange={handleFormChange} className={inputClass} placeholder="예: 500ml 1개" />
          </div>
          <div>
            <label className={labelClass}>상품가 (개당)</label>
            <input type="number" name="productPrice" value={formState.productPrice} onChange={handleFormChange} className={inputClass} placeholder="0" />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>상품 URL</label>
            <input type="url" name="productUrl" value={formState.productUrl} onChange={handleFormChange} className={inputClass} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>키워드</label>
            <input type="text" name="keywords" value={formState.keywords} onChange={handleFormChange} className={inputClass} placeholder="콤마(,)로 구분" />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>리뷰 가이드</label>
            <textarea name="reviewGuide" value={formState.reviewGuide} onChange={handleFormChange} className={inputClass} rows="2"></textarea>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>비고</label>
            <input type="text" name="remarks" value={formState.remarks} onChange={handleFormChange} className={inputClass} />
          </div>
          <div className="md:col-span-full xl:col-span-1 flex items-end">
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md">
              견적에 추가
            </button>
          </div>
        </div>
        
        <div className="mt-6 p-4 border-t border-gray-200 flex justify-end items-center space-x-6">
            <div>
                <span className="text-sm text-gray-500">기본 단가:</span>
                <span className="ml-2 font-semibold">{basePrice.toLocaleString()}원</span>
            </div>
            <span className="text-gray-400">+</span>
            <div>
                <span className="text-sm text-gray-500">일요일 가산금:</span>
                <span className={`ml-2 font-semibold ${sundayExtraCharge > 0 ? 'text-red-500' : ''}`}>{sundayExtraCharge.toLocaleString()}원</span>
            </div>
            <span className="text-gray-400">=</span>
            <div>
                <span className="text-sm text-gray-500">최종 개당 단가:</span>
                <span className="ml-2 font-bold text-lg text-blue-600">{finalUnitPrice.toLocaleString()}원</span>
            </div>
        </div>
      </form>
      
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-700">견적 목록 (스프레드시트)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {['순번', '진행일자', '리뷰 종류', '상품명', '상품가', '작업개수', '견적 상세', '총 견적', '작업'].map(h => <th key={h} className={thClass}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-10 text-gray-500">위에서 작업을 추가해주세요.</td></tr>
              ) : (
                campaigns.map((c, index) => (
                  <tr key={c.id}>
                    <td className={tdClass}>{index + 1}</td>
                    <td className={tdClass}>
                      <span className={c.date.getDay() === 0 ? 'text-red-500 font-bold' : ''}>
                        {new Date(c.date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className={tdClass}>{c.reviewType}</td>
                    <td className={tdClass}>{c.productName}</td>
                    <td className={tdClass}>{Number(c.productPrice).toLocaleString()}원</td>
                    <td className={tdClass}>{c.quantity}</td>
                    <td className={tdClass + " text-xs text-gray-500"}>
                      (리뷰 {c.finalUnitPrice.toLocaleString()} + 상품가 {Number(c.productPrice).toLocaleString()}) * {c.quantity}개
                    </td>
                    <td className={`${tdClass} font-bold`}>{c.itemTotal.toLocaleString()}원</td>
                    <td className={tdClass}>
                      <button onClick={() => handleDeleteCampaign(c.id)} className="text-red-600 hover:text-red-800 font-semibold">삭제</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-right">
            <p className="text-gray-800">최종 결제 금액 (수수료 포함): <span className="font-bold text-3xl text-blue-700">{totalAmount.toLocaleString()}</span> 원</p>
            <button 
                onClick={handleProcessPayment} 
                disabled={campaigns.length === 0}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                결제 진행
            </button>
        </div>
      </div>
    </div>
  );
}